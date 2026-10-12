import json

import pytest

from app.routers import billing as billing_router
from app.services.paypal import PLANS, PlanTier
from tests.conftest import run_sql
from tests.test_subscriptions import trust_webhooks  # noqa: F401  (fixture)

CREATOR_PLAN = PLANS[PlanTier.CREATOR]["id"]


def send(client, event_id, event_type, **resource):
    body = {"event_type": event_type, "resource": resource}
    if event_id:
        body["id"] = event_id
    return client.post("/billing/webhook", content=json.dumps(body))


def test_duplicate_event_is_processed_once(client, make_user):
    user = make_user()
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier, status) VALUES ($1, 'I-SUB1', 'creator', 'ACTIVE')", user.id)
    sale = {"billing_agreement_id": "I-SUB1", "create_time": "2030-01-15T00:00:00Z"}
    assert send(client, "WH-1", "PAYMENT.SALE.COMPLETED", **sale).json() == {"status": "ok"}
    assert send(client, "WH-1", "PAYMENT.SALE.COMPLETED", **sale).json() == {"status": "duplicate"}
    assert run_sql("SELECT count(*) FROM paypal_webhook_events")[0][0] == 1


def test_a_cancel_redelivered_after_reactivation_is_ignored(client, make_user):
    """The case date-based guards can't catch: the same SUSPENDED event delivered
    again after the subscription was reactivated would cut the user off again."""
    user = make_user()
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, 'I-SUB1', 'creator')", user.id)
    activate = dict(id="I-SUB1", custom_id=f"user_{user.id}", plan_id=CREATOR_PLAN)
    send(client, "WH-A1", "BILLING.SUBSCRIPTION.ACTIVATED", **activate)
    send(client, "WH-S1", "BILLING.SUBSCRIPTION.SUSPENDED", id="I-SUB1")
    send(client, "WH-A2", "BILLING.SUBSCRIPTION.ACTIVATED", **activate)  # payment fixed
    send(client, "WH-S1", "BILLING.SUBSCRIPTION.SUSPENDED", id="I-SUB1")  # PayPal retries the old one
    assert run_sql("SELECT status FROM subscriptions")[0][0] == "ACTIVE"
    assert run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0][0] == "creator"


def test_failed_processing_is_not_recorded_so_the_retry_runs(client, make_user, monkeypatch):
    user = make_user()
    calls = {"n": 0}
    real = billing_router._handle_event

    async def flaky(db, ev):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("database hiccup")
        await real(db, ev)

    monkeypatch.setattr(billing_router, "_handle_event", flaky)
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, 'I-SUB1', 'creator')", user.id)
    activate = dict(id="I-SUB1", custom_id=f"user_{user.id}", plan_id=CREATOR_PLAN)
    with pytest.raises(RuntimeError):
        send(client, "WH-A1", "BILLING.SUBSCRIPTION.ACTIVATED", **activate)
    assert run_sql("SELECT count(*) FROM paypal_webhook_events")[0][0] == 0
    assert send(client, "WH-A1", "BILLING.SUBSCRIPTION.ACTIVATED", **activate).json() == {"status": "ok"}
    assert run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0][0] == "creator"


def test_events_without_an_id_are_still_processed(client, make_user):
    user = make_user()
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, 'I-SUB1', 'creator')", user.id)
    send(client, None, "BILLING.SUBSCRIPTION.ACTIVATED", id="I-SUB1", custom_id=f"user_{user.id}", plan_id=CREATOR_PLAN)
    assert run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0][0] == "creator"
