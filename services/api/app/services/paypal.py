import os, httpx, base64
from datetime import datetime, timedelta
from typing import Optional
from enum import Enum
BASE = os.getenv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com")
CID = os.getenv("PAYPAL_CLIENT_ID"); CSEC = os.getenv("PAYPAL_CLIENT_SECRET"); WHID = os.getenv("PAYPAL_WEBHOOK_ID")
class PlanTier(str, Enum): FREE="free"; CREATOR="creator"; ARCHITECT="architect"; STUDIO="studio"
PLANS = {
  PlanTier.CREATOR: {"id": os.getenv("PAYPAL_PLAN_CREATOR","P-CREATOR-PLACEHOLDER"), "price_usd":"19.00","renders":200,"modes":["vehicle","interior","product","architecture"]},
  PlanTier.ARCHITECT: {"id": os.getenv("PAYPAL_PLAN_ARCHITECT","P-ARCHITECT-PLACEHOLDER"),"price_usd":"39.00","renders":500,"modes":["vehicle","interior","product","architecture","world","character","telecom"]},
  PlanTier.STUDIO: {"id": os.getenv("PAYPAL_PLAN_STUDIO","P-STUDIO-PLACEHOLDER"),"price_usd":"99.00","renders":-1,"modes":["vehicle","interior","product","architecture","world","character","telecom","servers"]},
}
class PayPalService:
    def __init__(self): self._t=None; self._e=None
    async def _token(self):
        if self._t and self._e and datetime.utcnow()<self._e: return self._t
        creds=base64.b64encode(f"{CID}:{CSEC}".encode()).decode()
        async with httpx.AsyncClient() as c:
            r=await c.post(f"{BASE}/v1/oauth2/token",headers={"Authorization":f"Basic {creds}","Content-Type":"application/x-www-form-urlencoded"},data={"grant_type":"client_credentials"})
            r.raise_for_status(); d=r.json()
        self._t=d["access_token"]; self._e=datetime.utcnow()+timedelta(seconds=d.get("expires_in",32400)-60)
        return self._t
    async def _h(self, ik: str=None):
        h={"Authorization":f"Bearer {await self._token()}","Content-Type":"application/json"}
        if ik: h["PayPal-Request-Id"]=ik
        return h
    async def create_product(self,name,description):
        async with httpx.AsyncClient() as c:
            r=await c.post(f"{BASE}/v1/catalogs/products",headers=await self._h(f"prod-{name}"),json={"name":name,"description":description,"type":"SERVICE","category":"SOFTWARE"})
            r.raise_for_status(); return r.json()
    async def create_plan(self,product_id,name,price_usd,interval="MONTH"):
        async with httpx.AsyncClient() as c:
            r=await c.post(f"{BASE}/v1/billing/plans",headers=await self._h(f"plan-{name}"),json={"product_id":product_id,"name":name,"billing_cycles":[{"frequency":{"interval_unit":interval,"interval_count":1},"tenure_type":"REGULAR","sequence":1,"total_cycles":0,"pricing_scheme":{"fixed_price":{"value":price_usd,"currency_code":"USD"}}}],"payment_preferences":{"auto_bill_outstanding":True,"payment_failure_threshold":2}})
            r.raise_for_status(); return r.json()
    async def create_subscription(self,plan_id,user_email,custom_id=None,return_url=None,cancel_url=None):
        body={"plan_id":plan_id,"subscriber":{"email_address":user_email},"application_context":{"brand_name":"FORGE AI","locale":"en-US","shipping_preference":"NO_SHIPPING","user_action":"SUBSCRIBE_NOW","return_url":return_url or "https://forge.ai/billing/success","cancel_url":cancel_url or "https://forge.ai/billing/cancel"}}
        if custom_id: body["custom_id"]=custom_id
        async with httpx.AsyncClient() as c:
            r=await c.post(f"{BASE}/v1/billing/subscriptions",headers=await self._h(f"sub-{custom_id}-{plan_id}"),json=body)
            r.raise_for_status(); return r.json()
    async def verify_webhook(self,headers,raw_body):
        vb={"transmission_id":headers.get("paypal-transmission-id"),"transmission_time":headers.get("paypal-transmission-time"),"cert_url":headers.get("paypal-cert-url"),"auth_algo":headers.get("paypal-auth-algo"),"transmission_sig":headers.get("paypal-transmission-sig"),"webhook_id":WHID,"webhook_event":raw_body.decode("utf-8")}
        async with httpx.AsyncClient() as c:
            r=await c.post(f"{BASE}/v1/notifications/verify-webhook-signature",headers=await self._h(),json=vb)
            if r.status_code!=200: return False
            return r.json().get("verification_status")=="SUCCESS"
paypal_service = PayPalService()
