from fastapi import APIRouter, Depends
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    user = dict(user)
    user.pop("password_hash", None)
    return user
