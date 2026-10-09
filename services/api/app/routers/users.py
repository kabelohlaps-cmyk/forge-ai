from fastapi import APIRouter, Depends
from app.access import renders_used_this_month
from app.auth import get_current_user
from app.db import get_db
from app.services.subscriptions import paid_access_ends_at

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(user=Depends(get_current_user), db=Depends(get_db)):
    user = dict(user)
    user.pop("password_hash", None)
    user["renders_used"] = await renders_used_this_month(db, user["id"])
    user["plan_ends_at"] = await paid_access_ends_at(db, user["id"])
    return user
