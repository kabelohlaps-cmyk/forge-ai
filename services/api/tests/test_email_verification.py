import re
import uuid

import pytest

from app.routers import auth as auth_router
from app.services import mailer
from tests.conftest import run_sql

PASSWORD = "password-123"


@pytest.fixture
def mails(monkeypatch):
    sent = []

    async def capture(to, subject, body):
        sent.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr(mailer, "send_email", capture)
    return sent


def verify_mails(mails, email):
    return [m for m in mails if m["to"] == email and m["subject"] == "Verify your FORGE email address"]


def token_of(mail):
    return re.search(r"/verify-email\?token=([\w-]+)", mail["body"]).group(1)


def register(client, email=None):
    email = email or f"v-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return email, r.json()


def verified_at(email):
    return run_sql("SELECT email_verified_at FROM users WHERE email=$1", email)[0][0]


def test_signup_sends_a_link_that_verifies_the_address(client, mails):
    email, body = register(client)
    assert body["user"]["email_verified_at"] is None
    [mail] = verify_mails(mails, email)
    assert client.post("/auth/verify-email", json={"token": token_of(mail)}).status_code == 200
    assert verified_at(email) is not None
    me = client.get("/users/me", headers={"Authorization": f"Bearer {body['token']}"}).json()
    assert me["email_verified_at"] is not None


def test_opening_the_link_again_still_succeeds(client, mails):
    email, _ = register(client)
    token = token_of(verify_mails(mails, email)[0])
    client.post("/auth/verify-email", json={"token": token})
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 200


def test_bad_and_expired_links_are_rejected(client, mails):
    email, _ = register(client)
    assert client.post("/auth/verify-email", json={"token": "nope"}).status_code == 400
    run_sql("UPDATE email_verifications SET expires_at = now() - interval '1 minute'")
    r = client.post("/auth/verify-email", json={"token": token_of(verify_mails(mails, email)[0])})
    assert r.status_code == 400
    assert "invalid or has expired" in r.json()["detail"]
    assert verified_at(email) is None


def test_resend_sends_a_fresh_link_and_is_rate_limited(client, mails):
    email, _ = register(client)  # 1 email
    for _ in range(auth_router.MAX_VERIFY_EMAILS_PER_HOUR + 2):
        r = client.post("/auth/verify-email/resend", json={"email": email.upper()})
        assert r.json()["message"] == auth_router.VERIFY_RESENT_MESSAGE
    assert len(verify_mails(mails, email)) == auth_router.MAX_VERIFY_EMAILS_PER_HOUR


def test_resend_reveals_nothing_and_skips_verified_accounts(client, mails):
    email, _ = register(client)
    client.post("/auth/verify-email", json={"token": token_of(verify_mails(mails, email)[0])})
    verified = client.post("/auth/verify-email/resend", json={"email": email}).json()
    unknown = client.post("/auth/verify-email/resend", json={"email": "nobody@example.com"}).json()
    assert verified == unknown
    assert len(verify_mails(mails, email)) == 1


def test_by_default_unverified_users_can_still_log_in(client, mails):
    email, _ = register(client)
    assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_strict_mode_blocks_unverified_logins_until_verified(client, mails, monkeypatch):
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "true")
    email, _ = register(client)
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 403
    assert r.json()["detail"] == auth_router.EMAIL_NOT_VERIFIED_MESSAGE
    assert len(verify_mails(mails, email)) == 2  # the block re-sent a link
    client.post("/auth/verify-email", json={"token": token_of(verify_mails(mails, email)[-1])})
    assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_strict_mode_still_rejects_wrong_passwords_as_401(client, mails, monkeypatch):
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "true")
    email, _ = register(client)
    assert client.post("/auth/login", json={"email": email, "password": "wrong-password"}).status_code == 401


def test_google_and_apple_accounts_are_verified(client, mails, monkeypatch):
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda t: {
        "email": "g@example.com", "email_verified": True, "name": "G", "google_id": "g-1"})
    user = client.post("/auth/oauth/google", json={"id_token": "x"}).json()["user"]
    assert user["email_verified_at"] is not None
    assert verify_mails(mails, "g@example.com") == []


def test_google_link_keeps_the_password_of_a_verified_account(client, mails, monkeypatch):
    email, _ = register(client)
    client.post("/auth/verify-email", json={"token": token_of(verify_mails(mails, email)[0])})
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda t: {
        "email": email, "email_verified": True, "name": "G", "google_id": "g-2"})
    client.post("/auth/oauth/google", json={"id_token": "x"})
    assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_completing_a_password_reset_verifies_the_address(client, mails):
    email, _ = register(client)
    client.post("/auth/password-reset/request", json={"email": email})
    reset = [m for m in mails if m["subject"] == "Reset your FORGE password"][0]
    token = re.search(r"token=([\w-]+)", reset["body"]).group(1)
    client.post("/auth/password-reset/confirm", json={"token": token, "password": "new-password-1"})
    assert verified_at(email) is not None


def test_migration_marks_existing_oauth_accounts_verified(client):
    run_sql("INSERT INTO users (email, google_id) VALUES ('old-g@example.com', 'g-old')")
    run_sql("INSERT INTO users (email, password_hash) VALUES ('old-p@example.com', 'x')")
    from app.migrations import run_migrations
    client.portal.call(run_migrations)
    assert verified_at("old-g@example.com") is not None
    assert verified_at("old-p@example.com") is None


def test_strict_mode_signup_returns_no_token(client, mails, monkeypatch):
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "true")
    r = client.post("/auth/register", json={"email": "strict@example.com", "password": PASSWORD}).json()
    assert r["verification_required"] is True
    assert "token" not in r
