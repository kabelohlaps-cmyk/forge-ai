"""
Schema upgrades for databases created from an older schema.sql.

schema.sql is still the full schema for a fresh database. Each statement here
must be idempotent (IF NOT EXISTS) and match what schema.sql now creates, so
running them against a fresh or an already-upgraded database does nothing.
They run on API startup under an advisory lock, so several instances starting
at once don't race. Append new statements; never edit or reorder old ones.
"""
from app.db import init_pool

MIGRATIONS = [
    # case-insensitive email lookups (2026-10-09)
    "CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email))",
    # revocable API tokens: bumping this invalidates every token issued before (2026-10-12)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0",
    # failed password logins, for rate limiting (2026-10-12)
    "CREATE TABLE IF NOT EXISTS login_failures(id SERIAL PRIMARY KEY,email TEXT NOT NULL,attempted_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    "CREATE INDEX IF NOT EXISTS idx_login_failures_email ON login_failures(email, attempted_at)",
    # PayPal webhook event ids already processed (2026-10-12)
    "CREATE TABLE IF NOT EXISTS paypal_webhook_events(event_id TEXT PRIMARY KEY,event_type TEXT,received_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    # password reset links; only a hash of each token is stored (2026-10-12)
    "CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ)",
    "CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, created_at)",
    # email verification (2026-10-12). Google/Apple accounts are verified by
    # their provider, so existing ones are marked verified.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
    "UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL AND (google_id IS NOT NULL OR apple_id IS NOT NULL)",
    "CREATE TABLE IF NOT EXISTS email_verifications(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ)",
    "CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id, created_at)",
]

_LOCK_ID = 7_312_004  # arbitrary, just unique to this app


async def run_migrations() -> None:
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock($1)", _LOCK_ID)
            for statement in MIGRATIONS:
                await conn.execute(statement)
