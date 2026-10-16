"""The Brevo HTTP path of the mailer, against a fake transport (nothing leaves the machine)."""
import asyncio
import json

import httpx
import pytest

from app.services import mailer


@pytest.fixture
def brevo(monkeypatch):
    """Route the mailer's httpx client to a handler; returns the captured requests."""
    sent = []
    state = {"status": 201}

    def handler(request):
        sent.append(request)
        return httpx.Response(state["status"], json={"messageId": "x"})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        mailer.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)
    )
    monkeypatch.setenv("BREVO_API_KEY", "test-key")
    monkeypatch.setenv("MAIL_FROM", "FORGE AI <sender@example.com>")
    monkeypatch.delenv("MAIL_OUTBOX_DIR", raising=False)
    return sent, state


def test_brevo_request_shape(brevo):
    sent, _ = brevo
    asyncio.run(mailer.send_email("user@example.com", "Hello", "Body text"))

    assert len(sent) == 1
    req = sent[0]
    assert str(req.url) == mailer.BREVO_URL
    assert req.headers["api-key"] == "test-key"
    assert json.loads(req.content) == {
        "sender": {"name": "FORGE AI", "email": "sender@example.com"},
        "to": [{"email": "user@example.com"}],
        "subject": "Hello",
        "textContent": "Body text",
    }


def test_brevo_is_preferred_over_smtp(brevo, monkeypatch):
    sent, _ = brevo
    monkeypatch.setenv("SMTP_HOST", "smtp.invalid")
    monkeypatch.setattr(mailer, "_send_smtp", lambda msg: pytest.fail("SMTP used despite BREVO_API_KEY"))

    asyncio.run(mailer.send_email("user@example.com", "Hello", "Body"))
    assert len(sent) == 1


def test_failed_send_is_logged_not_raised(brevo, caplog, tmp_path, monkeypatch):
    sent, state = brevo
    state["status"] = 400
    monkeypatch.setenv("MAIL_OUTBOX_DIR", str(tmp_path))

    asyncio.run(mailer.send_email("user@example.com", "Hello", "Body"))

    assert len(sent) == 1
    assert "Brevo returned 400" in caplog.text
    assert list(tmp_path.iterdir()) == []  # a failed provider send doesn't fall back to the outbox


def test_sender_falls_back_to_smtp_from(monkeypatch):
    monkeypatch.delenv("MAIL_FROM", raising=False)
    monkeypatch.setenv("SMTP_FROM", "Old <old@example.com>")
    assert mailer._sender() == "Old <old@example.com>"
