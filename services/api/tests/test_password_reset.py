import re

import pytest

from app.routers import auth as auth_router
from app.services import mailer
from tests.conftest import run_sql


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    async def capture(to, subject, body):
        sent.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr(mailer, "send_email", capture)
    return sent


def request_reset(client, email):
    return client.post("/auth/password-reset/request", json={"email": email})


def link_token(mail):
    return re.search(r"/reset-password\?token=([\w-]+)", mail["body"]).group(1)


def confirm(client, token, password="brand-new-pass"):
    return client.post("/auth/password-reset/confirm", json={"token": token, "password": password})


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_full_reset_flow(client, make_user, outbox):
    user = make_user()
    r = request_reset(client, user.email.upper())
    assert r.status_code == 200
    assert [m["to"] for m in outbox] == [user.email]
    assert confirm(client, link_token(outbox[0])).status_code == 200
    assert login(client, user.email, "brand-new-pass").status_code == 200
    assert login(client, user.email, "password-123").status_code == 401


def test_unknown_email_gets_the_same_answer_and_no_mail(client, make_user, outbox):
    user = make_user()
    known = request_reset(client, user.email).json()
    unknown = request_reset(client, "nobody@example.com").json()
    assert known == unknown
    assert len(outbox) == 1


def test_link_works_once(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    token = link_token(outbox[0])
    assert confirm(client, token).status_code == 200
    r = confirm(client, token, "another-pass-1")
    assert r.status_code == 400
    assert "invalid or has expired" in r.json()["detail"]


def test_expired_link_is_rejected(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    run_sql("UPDATE password_resets SET expires_at = now() - interval '1 minute'")
    assert confirm(client, link_token(outbox[0])).status_code == 400
    assert login(client, user.email, "password-123").status_code == 200


def test_a_new_link_replaces_the_old_one(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    request_reset(client, user.email)
    first, second = link_token(outbox[0]), link_token(outbox[1])
    assert confirm(client, first).status_code == 400
    assert confirm(client, second).status_code == 200


def test_bogus_token_is_rejected(client):
    assert confirm(client, "not-a-real-token").status_code == 400


def test_short_password_is_rejected_without_using_the_link(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    token = link_token(outbox[0])
    assert confirm(client, token, "short").status_code == 400
    assert confirm(client, token).status_code == 200


def test_reset_signs_out_every_existing_session(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    confirm(client, link_token(outbox[0]))
    assert user.get("/users/me").status_code == 401


def test_reset_clears_a_login_lockout(client, make_user, outbox):
    user = make_user()
    for _ in range(auth_router.MAX_LOGIN_FAILURES):
        login(client, user.email, "wrong-password")
    assert login(client, user.email, "password-123").status_code == 429
    request_reset(client, user.email)
    confirm(client, link_token(outbox[0]))
    assert login(client, user.email, "brand-new-pass").status_code == 200


def test_reset_emails_are_rate_limited(client, make_user, outbox):
    user = make_user()
    for _ in range(auth_router.MAX_RESET_EMAILS_PER_HOUR + 2):
        assert request_reset(client, user.email).status_code == 200
    assert len(outbox) == auth_router.MAX_RESET_EMAILS_PER_HOUR


def test_google_only_account_can_add_a_password(client, outbox, monkeypatch):
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda t: {
        "email": "g@example.com", "email_verified": True, "name": "G", "google_id": "g-1"})
    client.post("/auth/oauth/google", json={"id_token": "stub"})
    request_reset(client, "g@example.com")
    confirm(client, link_token(outbox[0]))
    assert login(client, "g@example.com", "brand-new-pass").status_code == 200


def test_token_is_stored_only_as_a_hash(client, make_user, outbox):
    user = make_user()
    request_reset(client, user.email)
    token = link_token(outbox[0])
    stored = run_sql("SELECT token_hash FROM password_resets")[0][0]
    assert token not in stored and len(stored) == 64


def test_outbox_mode_writes_mail_to_files(tmp_path, monkeypatch):
    import asyncio, json
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.setenv("MAIL_OUTBOX_DIR", str(tmp_path))
    asyncio.run(mailer.send_email("a@example.com", "Hi", "Body"))
    [f] = list(tmp_path.iterdir())
    assert json.loads(f.read_text()) == {"to": "a@example.com", "subject": "Hi", "body": "Body"}
