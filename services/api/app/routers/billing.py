from fastapi import APIRouter, Request, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import json
import logging
from datetime import datetime
from app.services.paypal import paypal_service, PLANS, PlanTier
from app.db import get_db
from app.auth import get_current_user
from app.services.subscriptions import downgrade_if_lapsed
router = APIRouter(prefix="/billing", tags=["billing"])
log = logging.getLogger(__name__)
# PayPal can't reactivate these, so a late or retried ACTIVATED/SUSPENDED for
# one is stale and must not overwrite it (webhooks aren't delivered in order).
_FINAL_STATUSES = ("CANCELLED", "EXPIRED")
class SubscribeRequest(BaseModel):
    tier: PlanTier
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None
@router.post("/subscribe")
async def create_subscription(body: SubscribeRequest, user=Depends(get_current_user), db=Depends(get_db)):
    plan = PLANS.get(body.tier)
    if not plan: raise HTTPException(400, "Invalid plan tier")
    sub = await paypal_service.create_subscription(plan_id=plan["id"], user_email=user["email"], custom_id=f"user_{user['id']}", return_url=body.return_url, cancel_url=body.cancel_url)
    approval = next((l["href"] for l in sub["links"] if l["rel"]=="approve"), None)
    await db.execute("INSERT INTO subscriptions (user_id,paypal_sub_id,tier,status,created_at) VALUES ($1,$2,$3,'PENDING',now()) ON CONFLICT (paypal_sub_id) DO UPDATE SET tier=$3,status='PENDING'", user["id"], sub["id"], body.tier.value)
    return {"approval_url": approval, "subscription_id": sub["id"]}
@router.post("/webhook")
async def paypal_webhook(request: Request, db=Depends(get_db), paypal_transmission_id: str = Header(None), paypal_transmission_time: str = Header(None), paypal_cert_url: str = Header(None), paypal_auth_algo: str = Header(None), paypal_transmission_sig: str = Header(None)):
    raw = await request.body()
    h = {"paypal-transmission-id": paypal_transmission_id, "paypal-transmission-time": paypal_transmission_time, "paypal-cert-url": paypal_cert_url, "paypal-auth-algo": paypal_auth_algo, "paypal-transmission-sig": paypal_transmission_sig}
    if not await paypal_service.verify_webhook(h, raw): raise HTTPException(401, "Invalid webhook signature")
    ev = json.loads(raw); et = ev.get("event_type"); res = ev.get("resource", {})
    if et == "BILLING.SUBSCRIPTION.ACTIVATED":
        await _activate(db, res)
    elif et == "BILLING.SUBSCRIPTION.CANCELLED":
        # No downgrade here: paid features last until the end of the paid month
        # (see app/services/subscriptions.py).
        await db.execute("UPDATE subscriptions SET status='CANCELLED',cancelled_at=now() WHERE paypal_sub_id=$1", res.get("id"))
    elif et == "BILLING.SUBSCRIPTION.SUSPENDED":
        uid = await db.fetchval("UPDATE subscriptions SET status='SUSPENDED',suspended_at=now() WHERE paypal_sub_id=$1 AND status <> ALL($2::text[]) RETURNING user_id", res.get("id"), list(_FINAL_STATUSES))
        if uid: await downgrade_if_lapsed(db, uid)
    elif et == "BILLING.SUBSCRIPTION.EXPIRED":
        uid = await db.fetchval("UPDATE subscriptions SET status='EXPIRED',expired_at=now() WHERE paypal_sub_id=$1 RETURNING user_id", res.get("id"))
        if uid: await downgrade_if_lapsed(db, uid)
    elif et == "PAYMENT.SALE.COMPLETED":
        # Dated from the sale itself, and never moved backwards, so a retried or
        # late delivery of an older payment can't shift the paid-through date.
        sid = res.get("billing_agreement_id"); paid_at = _parse_time(res.get("create_time"))
        if sid: await db.execute("UPDATE subscriptions SET last_payment_at=GREATEST(last_payment_at,COALESCE($2,now())),next_billing_at=GREATEST(next_billing_at,COALESCE($2,now())+interval '1 month') WHERE paypal_sub_id=$1", sid, paid_at)
    return {"status":"ok"}
async def _activate(db, res):
    sid = res.get("id")
    if not sid: return
    row = await db.fetchrow("SELECT user_id, tier, status FROM subscriptions WHERE paypal_sub_id=$1", sid)
    if row and row["status"] in _FINAL_STATUSES:
        log.info("Ignoring ACTIVATED for %s subscription %s", row["status"], sid); return
    cid = res.get("custom_id") or ""
    uid = int(cid.removeprefix("user_")) if cid.startswith("user_") else (row and row["user_id"])
    # The plan_id should map to a tier; if it doesn't (e.g. a PAYPAL_PLAN_* env
    # var is wrong), fall back to the tier the user chose at /billing/subscribe.
    tier = _resolve(res.get("plan_id")) or (row and row["tier"])
    if not uid or tier not in {t.value for t in PLANS}:
        log.error("Can't activate subscription %s: user=%r plan_id=%r tier=%r", sid, uid, res.get("plan_id"), tier); return
    # Upsert, so a subscription with no row from /billing/subscribe is still
    # recorded and can be cancelled or expired later.
    await db.execute(
        "INSERT INTO subscriptions (user_id,paypal_sub_id,tier,status,activated_at,next_billing_at) VALUES ($1,$2,$3,'ACTIVE',now(),COALESCE($4,now()+interval '1 month')) "
        "ON CONFLICT (paypal_sub_id) DO UPDATE SET status='ACTIVE',tier=$3,activated_at=COALESCE(subscriptions.activated_at,now()),next_billing_at=GREATEST(subscriptions.next_billing_at,EXCLUDED.next_billing_at)",
        uid, sid, tier, _next_billing(res))
    await _grant(db, uid, tier)
def _parse_time(raw):
    # PayPal's ISO timestamps, e.g. "2026-11-09T10:00:00Z"
    try: return datetime.fromisoformat(raw.replace("Z", "+00:00")) if raw else None
    except ValueError: return None
def _next_billing(res):
    return _parse_time((res.get("billing_info") or {}).get("next_billing_time"))
def _resolve(plan_id):
    for t, c in PLANS.items():
        if c["id"] == plan_id: return t.value
    return None
async def _grant(db, uid, tier):
    p = PLANS.get(PlanTier(tier))
    if not p: return
    await db.execute("UPDATE users SET tier=$1,render_quota=$2,allowed_modes=$3,updated_at=now() WHERE id=$4", tier, p["renders"], p["modes"], uid)
