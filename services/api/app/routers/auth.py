import hashlib
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AfterValidator, BaseModel, EmailStr
from typing import Annotated

from app.auth import get_current_user
from app.db import get_db
from app.services import mailer
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


class PasswordResetRequest(BaseModel):
    email: Email


class PasswordResetConfirm(BaseModel):
    token: str
    password: str


class OAuthRequest(BaseModel):
    id_token: str


def _check_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")


def _user_public(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d


@router.post("/register")
async def register(body: RegisterRequest, db=Depends(get_db)):
    existing = await db.fetchrow("SELECT id FROM users WHERE lower(email) = $1", body.email)
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    _check_password(body.password)

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


# ---------- password reset ----------

RESET_TOKEN_TTL_MINUTES = 60
MAX_RESET_EMAILS_PER_HOUR = 3
RESET_REQUESTED_MESSAGE = "If an account exists for that email, we've sent a link to reset its password."


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/password-reset/request")
async def request_password_reset(body: PasswordResetRequest, db=Depends(get_db)):
    """Emails a single-use reset link. The response is the same whether or not
    the account exists, so this can't be used to find out who has one. Also
    works for Google/Apple-only accounts, letting them add a password."""
    user = await db.fetchrow("SELECT id, email FROM users WHERE lower(email) = $1", body.email)
    if not user:
        return {"status": "ok", "message": RESET_REQUESTED_MESSAGE}
    recent = await db.fetchval(
        "SELECT count(*) FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'", user["id"]
    )
    if recent >= MAX_RESET_EMAILS_PER_HOUR:  # don't let anyone flood an inbox
        return {"status": "ok", "message": RESET_REQUESTED_MESSAGE}

    token = secrets.token_urlsafe(32)
    # A new link replaces any earlier unused one.
    await db.execute("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", user["id"])
    await db.execute(
        "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))",
        _hash_reset_token(token), user["id"], RESET_TOKEN_TTL_MINUTES,
    )
    link = f"{os.getenv('WEB_ORIGIN', 'http://localhost:3000')}/reset-password?token={token}"
    await mailer.send_email(
        user["email"],
        "Reset your FORGE password",
        f"Someone asked to reset the password for your FORGE account.\n\n"
        f"To choose a new password, open this link within {RESET_TOKEN_TTL_MINUTES} minutes:\n{link}\n\n"
        "If this wasn't you, you can ignore this email; your password won't change.",
    )
    return {"status": "ok", "message": RESET_REQUESTED_MESSAGE}


@router.post("/password-reset/confirm")
async def confirm_password_reset(body: PasswordResetConfirm, db=Depends(get_db)):
    _check_password(body.password)
    async with db.transaction():
        # Claim the token atomically so it can only ever be used once.
        user_id = await db.fetchval(
            "UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id",
            _hash_reset_token(body.token),
        )
        if not user_id:
            raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
        # New password, and every existing session ends (whoever knew the old
        # password is signed out); the login limit is cleared for a fresh start.
        email = await db.fetchval(
            "UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = now() WHERE id = $2 RETURNING email",
            hash_password(body.password), user_id,
        )
        await db.execute("DELETE FROM login_failures WHERE email = $1", email.lower())
    return {"status": "ok"}
