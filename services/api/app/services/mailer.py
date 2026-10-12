"""
Outgoing email, over plain SMTP so any provider works (SendGrid, Postmark,
Mailgun, SES, Gmail...). Configure with:

  SMTP_HOST, SMTP_PORT (default 587, STARTTLS), SMTP_USERNAME, SMTP_PASSWORD,
  SMTP_FROM (e.g. "FORGE AI <no-reply@yourdomain.com>")

Without SMTP_HOST nothing is sent. If MAIL_OUTBOX_DIR is set (dev, tests, CI)
each message is written there as JSON; otherwise it is logged, so password
reset links can still be followed locally.
"""
import asyncio
import json
import logging
import os
import smtplib
import time
import uuid
from email.message import EmailMessage

log = logging.getLogger(__name__)


def _send_smtp(msg: EmailMessage) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls()
        if os.getenv("SMTP_USERNAME"):
            smtp.login(os.environ["SMTP_USERNAME"], os.getenv("SMTP_PASSWORD", ""))
        smtp.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    if os.getenv("SMTP_HOST"):
        msg = EmailMessage()
        msg["From"] = os.getenv("SMTP_FROM", "FORGE AI <no-reply@localhost>")
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        await asyncio.to_thread(_send_smtp, msg)
        return
    outbox = os.getenv("MAIL_OUTBOX_DIR")
    if outbox:
        os.makedirs(outbox, exist_ok=True)
        path = os.path.join(outbox, f"{time.time():.6f}-{uuid.uuid4().hex[:8]}.json")
        with open(path, "w") as f:
            json.dump({"to": to, "subject": subject, "body": body}, f)
        return
    log.warning("SMTP_HOST not set; email to %s not sent.\nSubject: %s\n%s", to, subject, body)
