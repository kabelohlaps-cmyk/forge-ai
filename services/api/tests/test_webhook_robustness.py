"""PayPal webhooks arrive late, retried and out of order; these pin down that
the subscription and the user's plan still end up right."""
from app.services.paypal import PLANS, PlanTier
from tests.conftest import run_sql
from tests.test_subscriptions import trust_webhooks, webhook  # noqa: F401  (fixture)

CREATOR_PLAN = PLANS[PlanTier.CREATOR]["id"]


def pending(user, sub_id="I-SUB1", tier="creator"):
    run_sql("INSERT INTO subscriptions (user_id, paypal_sub_id, tier) VALUES ($1, $2, $3)", user.id, sub_id, tier)


def sub(sub_id="I-SUB1"):
    return run_sql("SELECT * FROM subscriptions WHERE paypal_sub_id=$1", sub_id)[0]


def tier(user):
    return run_sql("SELECT tier FROM users WHERE id=$1", user.id)[0]["tier"]


def activate(client, user=None, plan_id=CREATOR_PLAN, sub_id="I-SUB1", **extra):
    resource = {"id": sub_id, "plan_id": plan_id, **extra}
    if user:
        resource["custom_id"] = f"user_{user.id}"
    webhook(client, "BILLING.SUBSCRIPTION.ACTIVATED", **resource)


def test_unknown_plan_id_falls_back_to_the_tier_the_user_subscribed_to(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user, plan_id="P-NOT-CONFIGURED")
    assert tier(user) == "creator"
    assert sub()["tier"] == "creator"


def test_unknown_plan_id_with_nothing_to_fall_back_on_grants_nothing(client, make_user):
    user = make_user()
    activate(client, user, plan_id="P-NOT-CONFIGURED")
    assert tier(user) == "free"
    assert run_sql("SELECT count(*) FROM subscriptions")[0][0] == 0


def test_activation_without_custom_id_uses_the_subscription_owner(client, make_user):
    user = make_user()
    pending(user)
    activate(client)
    assert tier(user) == "creator"


def test_activation_with_no_row_records_the_subscription(client, make_user):
    user = make_user()
    activate(client, user)
    assert tier(user) == "creator"
    assert (sub()["user_id"], sub()["status"]) == (user.id, "ACTIVE")
    # ...so a later expiry can find it and downgrade.
    webhook(client, "BILLING.SUBSCRIPTION.EXPIRED", id="I-SUB1")
    assert tier(user) == "free"


def test_late_activation_does_not_revive_a_cancelled_subscription(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user)
    webhook(client, "BILLING.SUBSCRIPTION.CANCELLED", id="I-SUB1")
    run_sql("UPDATE subscriptions SET next_billing_at = now() - interval '1 day'")
    assert user.get("/users/me").json()["tier"] == "free"  # paid month over -> downgraded
    activate(client, user)  # retried/late delivery of the original ACTIVATED
    assert sub()["status"] == "CANCELLED"
    assert tier(user) == "free"


def test_late_activation_does_not_revive_an_expired_subscription(client, make_user):
    user = make_user()
    pending(user)
    webhook(client, "BILLING.SUBSCRIPTION.EXPIRED", id="I-SUB1")
    activate(client, user)
    assert sub()["status"] == "EXPIRED"
    assert tier(user) == "free"


def test_late_suspension_does_not_cut_short_a_cancelled_paid_month(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user)
    run_sql("UPDATE subscriptions SET next_billing_at = now() + interval '10 days'")
    webhook(client, "BILLING.SUBSCRIPTION.CANCELLED", id="I-SUB1")
    webhook(client, "BILLING.SUBSCRIPTION.SUSPENDED", id="I-SUB1")
    assert sub()["status"] == "CANCELLED"
    assert tier(user) == "creator"


def test_suspended_subscription_can_be_reactivated(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user)
    webhook(client, "BILLING.SUBSCRIPTION.SUSPENDED", id="I-SUB1")
    assert tier(user) == "free"
    activate(client, user)
    assert (sub()["status"], tier(user)) == ("ACTIVE", "creator")


def payment(client, create_time):
    webhook(client, "PAYMENT.SALE.COMPLETED", billing_agreement_id="I-SUB1", create_time=create_time)


def test_payment_dates_come_from_the_sale_and_never_move_back(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user, billing_info={"next_billing_time": "2030-01-15T00:00:00Z"})
    payment(client, "2030-01-15T00:00:00Z")
    assert sub()["next_billing_at"].isoformat().startswith("2030-02-15")
    payment(client, "2030-01-15T00:00:00Z")  # duplicate delivery
    assert sub()["next_billing_at"].isoformat().startswith("2030-02-15")
    payment(client, "2029-12-15T00:00:00Z")  # older payment delivered late
    s = sub()
    assert s["next_billing_at"].isoformat().startswith("2030-02-15")
    assert s["last_payment_at"].isoformat().startswith("2030-01-15")


def test_duplicate_activation_keeps_the_later_billing_date(client, make_user):
    user = make_user()
    pending(user)
    activate(client, user, billing_info={"next_billing_time": "2030-01-15T00:00:00Z"})
    payment(client, "2030-01-15T00:00:00Z")
    activate(client, user, billing_info={"next_billing_time": "2030-01-15T00:00:00Z"})
    assert sub()["next_billing_at"].isoformat().startswith("2030-02-15")
