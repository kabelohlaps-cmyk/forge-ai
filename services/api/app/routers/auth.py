from fastapi import APIRouter, Depends, HTTPException
from pydantic import AfterValidator, BaseModel, EmailStr
from typing import Annotated

from app.auth import get_current_user
from app.db import get_db
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
    verify_google_id_token,
    verify_apple_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Emails are compared case-insensitively and stored lowercased, so
# "Ana@x.com" and "ana@x.com" are one account. Queries use lower(email) so
# rows saved before this normalization still match.
Email = Annotated[EmailStr, AfterValidator(str.lower)]


class RegisterRequest(BaseModel):
    email: Email
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: Email
    password: str


class OAuthRequest(BaseModel):
    id_token: str


def _user_public(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d


@router.post("/register")
async def register(body: RegisterRequest, db=Depends(get_db)):
    existing = await db.fetchrow("SELECT id FROM users WHERE lower(email) = $1", body.email)
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
    token = create_access_token(row["id"], row["token_version"])
    return {"token": token, "user": _user_public(row)}


# Password guessing is limited per email address. Not per IP: the web app's
# NextAuth server makes every login call, so the API sees one IP for everyone.
MAX_LOGIN_FAILURES = 5
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60


async def _check_login_rate_limit(db, email: str):
    recent = await db.fetchrow(
        "SELECT count(*) AS n, min(attempted_at) AS oldest FROM login_failures "
        "WHERE email = $1 AND attempted_at > now() - make_interval(secs => $2)",
        email, LOGIN_FAILURE_WINDOW_SECONDS,
    )
    if recent["n"] >= MAX_LOGIN_FAILURES:
        # Seconds until the oldest failure leaves the window.
        wait = await db.fetchval(
            "SELECT ceil(extract(epoch FROM $1::timestamptz + make_interval(secs => $2) - now()))::int",
            recent["oldest"], LOGIN_FAILURE_WINDOW_SECONDS,
        )
        wait = max(wait or 1, 1)
        raise HTTPException(
            429,
            f"Too many failed sign-in attempts. Try again in {max(1, round(wait / 60))} minute(s).",
            headers={"Retry-After": str(wait)},
        )


async def _record_login_failure(db, email: str):
    await db.execute("INSERT INTO login_failures (email) VALUES ($1)", email)
    await db.execute("DELETE FROM login_failures WHERE attempted_at < now() - interval '1 day'")


@router.post("/login")
async def login(body: LoginRequest, db=Depends(get_db)):
    await _check_login_rate_limit(db, body.email)
    row = await db.fetchrow("SELECT * FROM users WHERE lower(email) = $1", body.email)
    # Unknown emails count as failures too, so the limit doesn't reveal which accounts exist.
    if not row or not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
        await _record_login_failure(db, body.email)
        raise HTTPException(401, "Invalid email or password")

    await db.execute("DELETE FROM login_failures WHERE email = $1", body.email)
    token = create_access_token(row["id"], row["token_version"])
    return {"token": token, "user": _user_public(row)}


async def _link_provider(db, row, column: str, provider_id: str):
    """Links a Google/Apple identity to an existing account.

    Sign-up doesn't verify email, so anyone could have registered a password
    account under someone else's address before they arrived. When a provider
    that has verified the address links to such an account for the first time,
    the password is removed and every existing session ends (token_version),
    so whoever set that password loses access and only the address's real
    owner remains.
    """
    assert column in ("google_id", "apple_id")
    if row[column] != provider_id and row["password_hash"]:
        return await db.fetchrow(
            f"UPDATE users SET {column} = $1, password_hash = NULL, token_version = token_version + 1, "
            "updated_at = now() WHERE id = $2 RETURNING *",
            provider_id, row["id"],
        )
    return await db.fetchrow(
        f"UPDATE users SET {column} = $1, updated_at = now() WHERE id = $2 RETURNING *", provider_id, row["id"]
    )


@router.post("/oauth/google")
async def oauth_google(body: OAuthRequest, db=Depends(get_db)):
    try:
        info = verify_google_id_token(body.id_token)
    except Exception:
        raise HTTPException(401, "Invalid Google token")
    info["email"] = info["email"].lower()

    if info["email_verified"]:
        row = await db.fetchrow("SELECT * FROM users WHERE google_id = $1 OR lower(email) = $2", info["google_id"], info["email"])
    else:
        # An unverified address proves nothing about who owns it, so never use
        # it to link into (or claim) an account -- only an existing Google link.
        row = await db.fetchrow("SELECT * FROM users WHERE google_id = $1", info["google_id"])
        if not row:
            raise HTTPException(400, "Your Google account's email address isn't verified")
    if row:
        row = await _link_provider(db, row, "google_id", info["google_id"])
    else:
        row = await db.fetchrow(
            "INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *",
            info["email"],
            info.get("name") or "",
            info["google_id"],
        )

    token = create_access_token(row["id"], row["token_version"])
    return {"token": token, "user": _user_public(row)}


@router.post("/oauth/apple")
async def oauth_apple(body: OAuthRequest, db=Depends(get_db)):
    try:
        info = await verify_apple_id_token(body.id_token)
    except Exception:
        raise HTTPException(401, "Invalid Apple token")
    if info.get("email"):
        info["email"] = info["email"].lower()

    if not info.get("email"):
        # Apple only sends email on first authorization -- if a returning user
        # has no matching apple_id and no email in the token, we can't link them.
        row = await db.fetchrow("SELECT * FROM users WHERE apple_id = $1", info["apple_id"])
        if not row:
            raise HTTPException(400, "Apple did not provide an email; cannot create account")
    else:
        row = await db.fetchrow(
            "SELECT * FROM users WHERE apple_id = $1 OR lower(email) = $2", info["apple_id"], info["email"]
        )
        if row:
            row = await _link_provider(db, row, "apple_id", info["apple_id"])
        else:
            row = await db.fetchrow(
                "INSERT INTO users (email, name, apple_id) VALUES ($1, $2, $3) RETURNING *",
                info["email"],
                "",
                info["apple_id"],
            )

    token = create_access_token(row["id"], row["token_version"])
    return {"token": token, "user": _user_public(row)}


@router.post("/logout-all")
async def logout_all(user=Depends(get_current_user), db=Depends(get_db)):
    """Signs the user out everywhere: every token issued so far stops working."""
    await db.execute("UPDATE users SET token_version = token_version + 1 WHERE id = $1", user["id"])
    return {"status": "ok"}
