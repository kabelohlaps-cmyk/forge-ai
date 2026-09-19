"""
Multi-user authentication: password hashing, JWT issuance/verification,
and OAuth id_token verification for Google and Apple.

Every user gets our own signed JWT after any of the three auth paths
(password login, Google sign-in, Apple sign-in) -- that JWT, not the
provider's token, is what authorizes calls to this API. This keeps
get_current_user() simple and provider-agnostic.
"""
import os
import time
from typing import Optional

import httpx
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from jose import jwt, JWTError
from passlib.context import CryptContext

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 30  # 30 days

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
APPLE_CLIENT_ID = os.getenv("APPLE_CLIENT_ID")  # Apple "Services ID" identifier
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_jwt_secret() -> str:
    if not JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is not set. Generate one with `openssl rand -hex 32` -- there is no default."
        )
    return JWT_SECRET


# ---------- passwords ----------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


# ---------- our own access tokens ----------

def create_access_token(user_id: int) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "iat": now, "exp": now + JWT_EXPIRY_SECONDS}
    return jwt.encode(payload, _require_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Returns the user id encoded in the token, or raises JWTError."""
    payload = jwt.decode(token, _require_jwt_secret(), algorithms=[JWT_ALGORITHM])
    return int(payload["sub"])


# ---------- Google OAuth ----------

def verify_google_id_token(token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError("GOOGLE_CLIENT_ID is not set")
    info = google_id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
    # verify_oauth2_token already checks signature, issuer, audience, and expiry.
    return {"email": info["email"], "name": info.get("name"), "google_id": info["sub"]}


# ---------- Apple Sign In ----------

_apple_keys_cache: Optional[dict] = None
_apple_keys_fetched_at: float = 0.0


async def _get_apple_jwks() -> dict:
    global _apple_keys_cache, _apple_keys_fetched_at
    if _apple_keys_cache and (time.time() - _apple_keys_fetched_at) < 3600:
        return _apple_keys_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(APPLE_KEYS_URL)
        r.raise_for_status()
        _apple_keys_cache = r.json()
        _apple_keys_fetched_at = time.time()
        return _apple_keys_cache


async def verify_apple_id_token(token: str) -> dict:
    if not APPLE_CLIENT_ID:
        raise RuntimeError("APPLE_CLIENT_ID is not set")
    jwks = await _get_apple_jwks()
    unverified_header = jwt.get_unverified_header(token)
    key = next((k for k in jwks["keys"] if k["kid"] == unverified_header["kid"]), None)
    if not key:
        raise JWTError("No matching Apple signing key found")
    payload = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience=APPLE_CLIENT_ID,
        issuer=APPLE_ISSUER,
    )
    return {"email": payload.get("email"), "apple_id": payload["sub"]}
