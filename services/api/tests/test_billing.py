import json

from app.services import paypal
from app.services.paypal import PLANS, PlanTier
from tests.conftest import run_sql


def post_webhook(client, event):
    return client.post("/billing/webhook", content=json.dumps(event))


def test_webhook_rejects_bad_signature(client, monkeypatch):
    async def deny(headers, raw):
        return False

    monkeypatch.setattr(paypal.paypal_service, "verify_webhook", deny)
    assert post_webhook(client, {"event_type": "BILLING.SUBSCRIPTION.ACTIVATED"}).status_code == 401


def test_activation_upgrades_user(client, make_user, monkeypatch):
    async def allow(headers, raw):
        return True

    monkeypatch.setattr(paypal.paypal_service, "verify_webhook", allow)
    user = make_user()
    run_sql(
        "INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, 'I-SUB1', 'creator')",
        user.id,
    )
    r = post_webhook(client, {
        "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
        "resource": {"id": "I-SUB1", "custom_id": f"user_{user.id}", "plan_id": PLANS[PlanTier.CREATOR]["id"]},
    })
    assert r.status_code == 200
    me = user.get("/users/me").json()
    assert me["tier"] == "creator"
    assert me["render_quota"] == 200
    assert "product" in me["allowed_modes"]
    assert run_sql("SELECT status FROM subscriptions WHERE paypal_sub_id='I-SUB1'")[0][0] == "ACTIVE"
    user.create_project(mode="product")
