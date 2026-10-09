import json

import pytest

from app.services import paypal
from app.services.paypal import PLANS, PlanTier
from tests.conftest import run_sql

CREATOR_MODES = ["vehicle", "interior", "product", "architecture"]


@pytest.fixture(autouse=True)
def trust_webhooks(monkeypatch):
    async def allow(headers, raw):
        return True

    monkeypatch.setattr(paypal.paypal_service, "verify_webhook", allow)


def webhook(client, event_type, **resource):
    r = client.post("/billing/webhook", content=json.dumps({"event_type": event_type, "resource": resource}))
    assert r.status_code == 200, r.text


@pytest.fixture
def subscriber(make_user):
    """A user on the creator plan with an ACTIVE subscription I-SUB1."""
    user = make_user()
    user.set_plan("creator", CREATOR_MODES, 200)
    run_sql(
        "INSERT INTO subscriptions (user_id, paypal_sub_id, tier, status, activated_at) "
        "VALUES ($1, 'I-SUB1', 'creator', 'ACTIVE', now())",
        user.id,
    )
    return user


def tier(user):
    return user.get("/users/me").json()["tier"]


def set_sub(sql_set, *args):
    run_sql(f"UPDATE subscriptions SET {sql_set} WHERE paypal_sub_id='I-SUB1'", *args)


def test_activation_records_next_billing_time(client, make_user):
    user = make_user()
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, 'I-SUB1', 'creator')", user.id)
    webhook(
        client, "BILLING.SUBSCRIPTION.ACTIVATED",
        id="I-SUB1", custom_id=f"user_{user.id}", plan_id=PLANS[PlanTier.CREATOR]["id"],
        billing_info={"next_billing_time": "2030-01-15T10:00:00Z"},
    )
    row = run_sql("SELECT next_billing_at FROM subscriptions WHERE paypal_sub_id='I-SUB1'")[0]
    assert row["next_billing_at"].isoformat().startswith("2030-01-15T10:00:00")
    assert tier(user) == "creator"


def test_cancelled_keeps_paid_features_until_paid_month_ends(client, subscriber):
    set_sub("next_billing_at = now() + interval '10 days'")
    webhook(client, "BILLING.SUBSCRIPTION.CANCELLED", id="I-SUB1")
    assert tier(subscriber) == "creator"
    subscriber.create_project(mode="product")


def test_cancelled_downgrades_once_paid_month_is_over(client, subscriber):
    webhook(client, "BILLING.SUBSCRIPTION.CANCELLED", id="I-SUB1")
    set_sub("next_billing_at = now() - interval '1 minute'")
    me = subscriber.get("/users/me").json()
    assert (me["tier"], me["render_quota"], me["allowed_modes"]) == ("free", 10, ["vehicle", "interior"])
    assert subscriber.post("/projects/", {"title": "x", "mode": "product"}).status_code == 403


def test_cancelled_without_payment_record_lasts_to_end_of_calendar_month(client, subscriber):
    set_sub("status='CANCELLED', cancelled_at=now(), next_billing_at=NULL")
    assert tier(subscriber) == "creator"
    set_sub("cancelled_at = date_trunc('month', now()) - interval '1 day'")
    assert tier(subscriber) == "free"


@pytest.mark.parametrize("event", ["BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.EXPIRED"])
def test_suspended_or_expired_downgrades_immediately(client, subscriber, event):
    set_sub("next_billing_at = now() + interval '10 days'")
    webhook(client, event, id="I-SUB1")
    assert run_sql("SELECT tier FROM users WHERE id=$1", subscriber.id)[0]["tier"] == "free"


def test_lapsed_old_subscription_doesnt_override_a_newer_active_one(client, subscriber):
    run_sql(
        "INSERT INTO subscriptions (user_id, paypal_sub_id, tier, status) VALUES ($1, 'I-SUB2', 'creator', 'ACTIVE')",
        subscriber.id,
    )
    webhook(client, "BILLING.SUBSCRIPTION.SUSPENDED", id="I-SUB1")
    assert tier(subscriber) == "creator"


def test_plan_set_without_any_subscription_is_left_alone(make_user):
    user = make_user()
    user.set_plan("studio", ["vehicle"], -1)
    assert tier(user) == "studio"
