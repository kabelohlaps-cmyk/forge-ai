import asyncio, sys
sys.path.insert(0, "services/api")
from app.services.paypal import paypal_service, PLANS
async def main():
    p = await paypal_service.create_product(name="FORGE AI", description="AI-powered design and invention agent")
    print(f"PRODUCT_ID={p['id']}")
    for tier, cfg in PLANS.items():
        plan = await paypal_service.create_plan(product_id=p["id"], name=f"FORGE {tier.value.capitalize()}", price_usd=cfg["price_usd"])
        print(f"PLAN_{tier.value.upper()}={plan['id']}")
if __name__ == "__main__": asyncio.run(main())
