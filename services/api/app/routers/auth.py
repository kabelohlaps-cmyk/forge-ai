from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
    verify_google_id_token,
    verify_apple_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthRequest(BaseModel):
    id_token: str


def _user_public(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d


@router.post("/register")
async def register(body: RegisterRequest, db=Depends(get_db)):
    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    row = await db.fetchrow(
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *",
        body.email,
        body.name,
        hash_password(body.password),
    )
    token = create_access_token(row["id"])
    return {"token": token, "user": _user_public(row)}


@router.post("/login")
async def login(body: LoginRequest, db=Depends(get_db)):
    row = await db.fetchrow("SELECT * FROM users WHERE email = $1", body.email)
    if not row or not row["password_hash"]:
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(row["id"])
    return {"token": token, "user": _user_public(row)}


@router.post("/oauth/google")
async def oauth_google(body: OAuthRequest, db=Depends(get_db)):
    try:
        info = verify_google_id_token(body.id_token)
    except Exception:
        raise HTTPException(401, "Invalid Google token")

    row = await db.fetchrow("SELECT * FROM users WHERE google_id = $1 OR email = $2", info["google_id"], info["email"])
    if row:
        row = await db.fetchrow(
            "UPDATE users SET google_id = $1, updated_at = now() WHERE id = $2 RETURNING *",
            info["google_id"],
            row["id"],
        )
    else:
        row = await db.fetchrow(
            "INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *",
            info["email"],
            info.get("name") or "",
            info["google_id"],
        )

    token = create_access_token(row["id"])
    return {"token": token, "user": _user_public(row)}


@router.post("/oauth/apple")
async def oauth_apple(body: OAuthRequest, db=Depends(get_db)):
    try:
        info = await verify_apple_id_token(body.id_token)
    except Exception:
        raise HTTPException(401, "Invalid Apple token")

    if not info.get("email"):
        # Apple only sends email on first authorization -- if a returning user
        # has no matching apple_id and no email in the token, we can't link them.
        row = await db.fetchrow("SELECT * FROM users WHERE apple_id = $1", info["apple_id"])
        if not row:
            raise HTTPException(400, "Apple did not provide an email; cannot create account")
    else:
        row = await db.fetchrow(
            "SELECT * FROM users WHERE apple_id = $1 OR email = $2", info["apple_id"], info["email"]
        )
        if row:
            row = await db.fetchrow(
                "UPDATE users SET apple_id = $1, updated_at = now() WHERE id = $2 RETURNING *",
                info["apple_id"],
                row["id"],
            )
        else:
            row = await db.fetchrow(
                "INSERT INTO users (email, name, apple_id) VALUES ($1, $2, $3) RETURNING *",
                info["email"],
                "",
                info["apple_id"],
            )

    token = create_access_token(row["id"])
    return {"token": token, "user": _user_public(row)}
