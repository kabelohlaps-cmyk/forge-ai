import asyncio
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import JWTError, jwk, jwt

from app.routers import auth as auth_router
from app.services import auth_service
from tests.conftest import run_sql


@pytest.fixture
def google_says(monkeypatch):
    """Makes the next Google sign-in return these verified claims."""
    def _set(email, google_id="g-123", verified=True):
        monkeypatch.setattr(auth_router, "verify_google_id_token", lambda token: {
            "email": email, "email_verified": verified, "name": "G User", "google_id": google_id,
        })
    return _set


def google_sign_in(client):
    return client.post("/auth/oauth/google", json={"id_token": "stub"})


def test_google_creates_account(client, google_says):
    google_says("new@example.com")
    r = google_sign_in(client)
    assert r.status_code == 200
    assert r.json()["user"]["google_id"] == "g-123"


def test_google_with_verified_email_links_existing_account(client, make_user, google_says):
    user = make_user()
    google_says(user.email)
    assert google_sign_in(client).json()["user"]["id"] == user.id


def test_google_with_unverified_email_cannot_take_over_an_account(client, make_user, google_says):
    user = make_user()
    google_says(user.email, verified=False)
    r = google_sign_in(client)
    assert r.status_code == 400
    assert run_sql("SELECT google_id FROM users WHERE id=$1", user.id)[0][0] is None


def test_google_with_unverified_email_still_signs_in_an_already_linked_account(client, google_says):
    google_says("linked@example.com")
    first = google_sign_in(client).json()["user"]["id"]
    google_says("linked@example.com", verified=False)
    r = google_sign_in(client)
    assert r.status_code == 200
    assert r.json()["user"]["id"] == first


# --- Apple: real signature checks against a locally generated key ---

APPLE_AUD = "com.example.forge.web"


@pytest.fixture
def apple_key(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public = jwk.construct(
        key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo),
        "RS256",
    ).to_dict()
    public["kid"] = "test-kid"

    async def jwks():
        return {"keys": [public]}

    monkeypatch.setattr(auth_service, "_get_apple_jwks", jwks)
    monkeypatch.setattr(auth_service, "APPLE_CLIENT_ID", APPLE_AUD)

    def sign(**overrides):
        now = int(time.time())
        claims = {"iss": auth_service.APPLE_ISSUER, "aud": APPLE_AUD, "sub": "apple-1",
                  "iat": now, "exp": now + 600, "email": "a@example.com", **overrides}
        return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": "test-kid"})

    return sign


def test_apple_token_with_at_hash_is_accepted(apple_key):
    info = asyncio.run(auth_service.verify_apple_id_token(apple_key(at_hash="c29tZWhhc2g")))
    assert info == {"email": "a@example.com", "apple_id": "apple-1"}


@pytest.mark.parametrize("bad", [{"aud": "someone-else"}, {"iss": "https://evil.example"}, {"exp": 1}])
def test_apple_token_with_wrong_claims_is_rejected(apple_key, bad):
    with pytest.raises(JWTError):
        asyncio.run(auth_service.verify_apple_id_token(apple_key(**bad)))
