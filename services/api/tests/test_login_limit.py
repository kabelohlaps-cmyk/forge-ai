from app.routers import auth as auth_router
from tests.conftest import run_sql


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_too_many_failures_block_logins_for_that_email(client, make_user):
    user = make_user()
    for _ in range(auth_router.MAX_LOGIN_FAILURES):
        assert login(client, user.email, "wrong-password").status_code == 401
    r = login(client, user.email, "password-123")  # even the right password, while blocked
    assert r.status_code == 429
    assert "Too many failed sign-in attempts" in r.json()["detail"]
    assert 0 < int(r.headers["Retry-After"]) <= auth_router.LOGIN_FAILURE_WINDOW_SECONDS


def test_block_lifts_once_failures_age_out(client, make_user):
    user = make_user()
    for _ in range(auth_router.MAX_LOGIN_FAILURES):
        login(client, user.email, "wrong-password")
    run_sql("UPDATE login_failures SET attempted_at = now() - interval '16 minutes'")
    assert login(client, user.email, "password-123").status_code == 200


def test_success_resets_the_count(client, make_user):
    user = make_user()
    for _ in range(auth_router.MAX_LOGIN_FAILURES - 1):
        login(client, user.email, "wrong-password")
    assert login(client, user.email, "password-123").status_code == 200
    assert login(client, user.email, "wrong-password").status_code == 401  # count restarted, not blocked


def test_limit_is_per_email(client, make_user):
    alice, bob = make_user(), make_user()
    for _ in range(auth_router.MAX_LOGIN_FAILURES):
        login(client, alice.email, "wrong-password")
    assert login(client, bob.email, "password-123").status_code == 200


def test_unknown_emails_are_limited_the_same_way(client):
    for _ in range(auth_router.MAX_LOGIN_FAILURES):
        assert login(client, "nobody@example.com", "whatever-123").status_code == 401
    assert login(client, "nobody@example.com", "whatever-123").status_code == 429


def test_email_case_does_not_get_around_the_limit(client, make_user):
    user = make_user()
    for i in range(auth_router.MAX_LOGIN_FAILURES):
        login(client, user.email.upper() if i % 2 else user.email, "wrong-password")
    assert login(client, user.email.upper(), "password-123").status_code == 429
