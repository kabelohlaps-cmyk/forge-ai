def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_register_login_and_me(client, make_user):
    user = make_user()
    r = client.post("/auth/login", json={"email": user.email, "password": "password-123"})
    assert r.status_code == 200
    me = user.get("/users/me").json()
    assert me["email"] == user.email
    assert me["tier"] == "free"
    assert "password_hash" not in me


def test_login_rejects_wrong_password(client, make_user):
    user = make_user()
    r = client.post("/auth/login", json={"email": user.email, "password": "wrong-password"})
    assert r.status_code == 401


def test_register_rejects_duplicate_email(client, make_user):
    user = make_user()
    r = client.post("/auth/register", json={"email": user.email, "password": "password-123"})
    assert r.status_code == 409


def test_register_rejects_short_password(client):
    r = client.post("/auth/register", json={"email": "short@example.com", "password": "short"})
    assert r.status_code == 400


def test_protected_routes_require_token(client):
    assert client.get("/projects/").status_code == 401
    r = client.get("/projects/", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
