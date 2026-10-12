import json

import httpx
import pytest

from app.services import paypal
from app.services.paypal import PLANS, PlanTier
from tests.conftest import run_sql
from tests.test_subscriptions import trust_webhooks  # noqa: F401  (fixture)


@pytest.fixture
def cancelled(monkeypatch):
    calls = []

    async def fake_cancel(sub_id, reason):
        calls.append(sub_id)

    monkeypatch.setattr(paypal.paypal_service, "cancel_subscription", fake_cancel)
    return calls


def activate(client, user, sub_id, tier):
    body = {"id": f"WH-{sub_id}", "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
            "resource": {"id": sub_id, "custom_id": f"user_{user.id}", "plan_id": PLANS[tier]["id"]}}
    return client.post("/billing/webhook", content=json.dumps(body))


def statuses():
    return dict(run_sql("SELECT paypal_sub_id, status FROM subscriptions"))


def test_upgrading_cancels_the_old_subscription(client, make_user, cancelled):
    user = make_user()
    activate(client, user, "I-CREATOR", PlanTier.CREATOR)
    assert cancelled == []
    assert activate(client, user, "I-ARCHITECT", PlanTier.ARCHITECT).status_code == 200
    assert cancelled == ["I-CREATOR"]
    assert statuses() == {"I-CREATOR": "CANCELLED", "I-ARCHITECT": "ACTIVE"}
    assert run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0][0] == "architect"


def test_a_suspended_old_subscription_is_cancelled_too(client, make_user, cancelled):
    user = make_user()
    activate(client, user, "I-OLD", PlanTier.CREATOR)
    run_sql("UPDATE subscriptions SET status='SUSPENDED'")
    activate(client, user, "I-NEW", PlanTier.CREATOR)
    assert cancelled == ["I-OLD"]


def test_redelivered_activation_does_not_cancel_anything(client, make_user, cancelled):
    user = make_user()
    activate(client, user, "I-ONE", PlanTier.CREATOR)
    run_sql("DELETE FROM paypal_webhook_events")  # as if the event id weren't seen before
    activate(client, user, "I-ONE", PlanTier.CREATOR)
    assert cancelled == []
    assert statuses() == {"I-ONE": "ACTIVE"}


def test_other_users_subscriptions_are_untouched(client, make_user, cancelled):
    alice, bob = make_user(), make_user()
    activate(client, alice, "I-ALICE", PlanTier.CREATOR)
    activate(client, bob, "I-BOB", PlanTier.CREATOR)
    assert cancelled == []


def test_paypal_failure_rolls_back_so_the_retry_tries_again(client, make_user, monkeypatch):
    user = make_user()
    activate(client, user, "I-CREATOR", PlanTier.CREATOR)
    attempts = []

    async def down(sub_id, reason):
        attempts.append(sub_id)
        if len(attempts) == 1:
            raise httpx.ConnectError("PayPal unreachable")

    monkeypatch.setattr(paypal.paypal_service, "cancel_subscription", down)
    with pytest.raises(httpx.ConnectError):
        activate(client, user, "I-ARCHITECT", PlanTier.ARCHITECT)
    assert statuses() == {"I-CREATOR": "ACTIVE"}  # nothing half-applied
    assert run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0][0] == "creator"
    assert activate(client, user, "I-ARCHITECT", PlanTier.ARCHITECT).status_code == 200  # PayPal's retry
    assert attempts == ["I-CREATOR", "I-CREATOR"]
    assert statuses() == {"I-CREATOR": "CANCELLED", "I-ARCHITECT": "ACTIVE"}


# --- the PayPal API call itself ---

@pytest.fixture
def paypal_responds(monkeypatch):
    seen = {}

    def install(status):
        def handler(request):
            seen["url"], seen["body"] = str(request.url), json.loads(request.content)
            return httpx.Response(status)

        real = httpx.AsyncClient
        monkeypatch.setattr(paypal.httpx, "AsyncClient", lambda *a, **k: real(transport=httpx.MockTransport(handler)))

        async def headers(ik=None):
            return {"Authorization": "Bearer test"}

        monkeypatch.setattr(paypal.paypal_service, "_h", headers)
        return seen

    return install


async def _cancel():
    await paypal.PayPalService.cancel_subscription(paypal.paypal_service, "I-OLD", "Replaced by subscription I-NEW")


@pytest.mark.parametrize("status", [204, 404, 422])
def test_cancel_treats_done_and_already_inactive_as_success(paypal_responds, status):
    import asyncio
    seen = paypal_responds(status)
    asyncio.run(_cancel())
    assert seen["url"].endswith("/v1/billing/subscriptions/I-OLD/cancel")
    assert seen["body"] == {"reason": "Replaced by subscription I-NEW"}


def test_cancel_raises_on_other_errors(paypal_responds):
    import asyncio
    paypal_responds(500)
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(_cancel())
