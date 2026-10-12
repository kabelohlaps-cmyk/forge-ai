import time

from jose import jwt

from app.services import auth_service
from tests.conftest import run_sql


def test_logout_all_revokes_every_existing_token(client, make_user):
    user = make_user()
    other_device = client.post("/auth/login", json={"email": user.email, "password": "password-123"}).json()["token"]
    assert user.post("/auth/logout-all").status_code == 200
    for token in (user.token, other_device):
        r = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
        assert "sign in again" in r.json()["detail"]
    # Signing in again issues a working token.
    fresh = client.post("/auth/login", json={"email": user.email, "password": "password-123"}).json()["token"]
    assert client.get("/users/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200


def test_tokens_from_before_versioning_still_work_until_revoked(client, make_user):
    user = make_user()
    now = int(time.time())
    legacy = jwt.encode({"sub": str(user.id), "iat": now, "exp": now + 60}, auth_service._require_jwt_secret(), algorithm="HS256")
    headers = {"Authorization": f"Bearer {legacy}"}
    assert client.get("/users/me", headers=headers).status_code == 200
    run_sql("UPDATE users SET token_version = 1 WHERE id = $1", user.id)
    assert client.get("/users/me", headers=headers).status_code == 401


def test_tokens_expire_after_seven_days(client, make_user):
    user = make_user()
    claims = jwt.get_unverified_claims(user.token)
    assert claims["exp"] - claims["iat"] == 7 * 24 * 3600
