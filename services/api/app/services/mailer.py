"""
Outgoing email. Two ways to send, checked in this order:

1. Brevo's HTTP API, when BREVO_API_KEY is set. Use this on Railway's Free,
   Trial and Hobby plans, which block outbound SMTP.
2. Plain SMTP, when SMTP_HOST is set, so any provider works (SendGrid,
   Postmark, Mailgun, SES, Gmail...): SMTP_HOST, SMTP_PORT (default 587,
   STARTTLS), SMTP_USERNAME, SMTP_PASSWORD.

The sender comes from MAIL_FROM (or the older SMTP_FROM), e.g.
"FORGE AI <you@example.com>". With Brevo it must be a sender you verified there.

With neither set nothing is sent. If MAIL_OUTBOX_DIR is set (dev, tests, CI)
each message is written there as JSON; otherwise it is logged, so password
reset links can still be followed locally.

A failed send is logged, not raised: the account change that triggered the
email has already happened, and the user can ask for another link.
"""
import asyncio
import json
import logging
import os
import smtplib
import time
import uuid
from email.message import EmailMessage
from email.utils import parseaddr

import httpx

log = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _sender() -> str:
    return os.getenv("MAIL_FROM") or os.getenv("SMTP_FROM") or "FORGE AI <no-reply@localhost>"


async def _send_brevo(to: str, subject: str, body: str) -> None:
    name, address = parseaddr(_sender())
    payload = {
        "sender": {"name": name or "FORGE AI", "email": address},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(BREVO_URL, json=payload, headers={"api-key": os.environ["BREVO_API_KEY"]})
    if resp.status_code >= 300:
        raise RuntimeError(f"Brevo returned {resp.status_code}: {resp.text[:300]}")


def _send_smtp(msg: EmailMessage) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls()
        if os.getenv("SMTP_USERNAME"):
            smtp.login(os.environ["SMTP_USERNAME"], os.getenv("SMTP_PASSWORD", ""))
        smtp.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    try:
        if os.getenv("BREVO_API_KEY"):
            await _send_brevo(to, subject, body)
            return
        if os.getenv("SMTP_HOST"):
            msg = EmailMessage()
            msg["From"] = _sender()
            msg["To"] = to
            msg["Subject"] = subject
            msg.set_content(body)
            await asyncio.to_thread(_send_smtp, msg)
            return
    except Exception:
        log.exception("Sending email %r to %s failed", subject, to)
        return
    outbox = os.getenv("MAIL_OUTBOX_DIR")
    if outbox:
        os.makedirs(outbox, exist_ok=True)
        path = os.path.join(outbox, f"{time.time():.6f}-{uuid.uuid4().hex[:8]}.json")
        with open(path, "w") as f:
            json.dump({"to": to, "subject": subject, "body": body}, f)
        return
    log.warning("No mail provider configured; email to %s not sent.\nSubject: %s\n%s", to, subject, body)
