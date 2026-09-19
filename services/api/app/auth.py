from fastapi import Depends, HTTPException, Header
from jose import JWTError

from app.db import get_db
from app.services.auth_service import decode_access_token


async def get_current_user(authorization: str = Header(None), db=Depends(get_db)):
    """
    Real per-user auth: the bearer token is a JWT we issued (at register,
    login, or OAuth sign-in), signed with JWT_SECRET. We verify the
    signature and expiry, extract the user id from it, and load that user.
    No token other than one we signed will ever pass this check.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = decode_access_token(token)
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    user = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return dict(user)
