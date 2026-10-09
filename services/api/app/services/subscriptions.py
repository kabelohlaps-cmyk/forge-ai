"""
Subscription lifecycle: when a paid user's plan ends.

- SUSPENDED / EXPIRED (payment failed, or PayPal ended it): paid features stop
  right away -- the webhook downgrades the user.
- CANCELLED: the user keeps paid features until the end of the month they've
  paid for (next_billing_at; if no payment was ever recorded, the end of the
  calendar month they cancelled in). PayPal sends no event when that date
  passes and there is no scheduler, so expire_lapsed_plan runs on each
  authenticated request (see app/auth.py) and downgrades then.

A user is only downgraded if they have a lapsed subscription and no other
subscription still giving them access, so re-subscribing or switching plans
doesn't strip a plan, and plans set by hand (no subscription rows) are left
alone.
"""
from app.services.paypal import FREE_PLAN, PlanTier

# A subscription that still entitles the user to their paid tier.
_GIVES_ACCESS = """
    status = 'ACTIVE'
    OR (status = 'CANCELLED' AND now() < COALESCE(
        next_billing_at, date_trunc('month', cancelled_at) + interval '1 month'))
"""


async def downgrade_to_free(db, user_id: int) -> None:
    await db.execute(
        "UPDATE users SET tier=$1, render_quota=$2, allowed_modes=$3, updated_at=now() WHERE id=$4",
        PlanTier.FREE.value, FREE_PLAN["renders"], FREE_PLAN["modes"], user_id,
    )


async def has_paid_access(db, user_id: int) -> bool:
    return await db.fetchval(
        f"SELECT EXISTS (SELECT 1 FROM subscriptions WHERE user_id=$1 AND ({_GIVES_ACCESS}))",
        user_id,
    )


async def downgrade_if_lapsed(db, user_id: int) -> bool:
    lapsed = await db.fetchval(
        "SELECT EXISTS (SELECT 1 FROM subscriptions WHERE user_id=$1 "
        "AND status IN ('CANCELLED', 'SUSPENDED', 'EXPIRED'))",
        user_id,
    )
    if lapsed and not await has_paid_access(db, user_id):
        await downgrade_to_free(db, user_id)
        return True
    return False


async def expire_lapsed_plan(db, user: dict) -> dict:
    """Returns the user row, downgraded to free if their paid plan has run out."""
    if user["tier"] == PlanTier.FREE.value:
        return user
    if await downgrade_if_lapsed(db, user["id"]):
        return dict(await db.fetchrow("SELECT * FROM users WHERE id=$1", user["id"]))
    return user
