from fastapi import APIRouter, Request, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import json
from app.services.paypal import paypal_service, PLANS, PlanTier
from app.db import get_db
from app.auth import get_current_user
router = APIRouter(prefix="/billing", tags=["billing"])
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
        cid = res.get("custom_id",""); uid = int(cid.replace("user_","")) if cid else None
        if uid:
            tier = _resolve(res.get("plan_id"))
            await db.execute("UPDATE subscriptions SET status='ACTIVE',tier=$1,activated_at=now() WHERE paypal_sub_id=$2", tier, res.get("id"))
            await _grant(db, uid, tier)
    elif et == "BILLING.SUBSCRIPTION.CANCELLED":
        await db.execute("UPDATE subscriptions SET status='CANCELLED',cancelled_at=now() WHERE paypal_sub_id=$1", res.get("id"))
    elif et == "BILLING.SUBSCRIPTION.SUSPENDED":
        await db.execute("UPDATE subscriptions SET status='SUSPENDED',suspended_at=now() WHERE paypal_sub_id=$1", res.get("id"))
    elif et == "BILLING.SUBSCRIPTION.EXPIRED":
        await db.execute("UPDATE subscriptions SET status='EXPIRED',expired_at=now() WHERE paypal_sub_id=$1", res.get("id"))
    elif et == "PAYMENT.SALE.COMPLETED":
        sid = res.get("billing_agreement_id")
        if sid: await db.execute("UPDATE subscriptions SET last_payment_at=now(),next_billing_at=now()+interval '1 month' WHERE paypal_sub_id=$1", sid)
    return {"status":"ok"}
def _resolve(plan_id):
    for t, c in PLANS.items():
        if c["id"] == plan_id: return t.value
    return PlanTier.FREE.value
async def _grant(db, uid, tier):
    p = PLANS.get(PlanTier(tier))
    if not p: return
    await db.execute("UPDATE users SET tier=$1,render_quota=$2,allowed_modes=$3,updated_at=now() WHERE id=$4", tier, p["renders"], p["modes"], uid)
