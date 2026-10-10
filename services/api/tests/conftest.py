"""
API tests run against a real Postgres (with pgvector) so the SQL is exercised
for real. Point TEST_DATABASE_URL at a throwaway database -- every test
truncates all tables. The Gemini calls are stubbed out.
"""
import asyncio
import base64
import os
import uuid

import asyncpg
import pytest

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-" + "x" * 32)
os.environ.setdefault("ENCRYPTION_MASTER_KEY", base64.b64encode(b"k" * 32).decode())

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routers import agent as agent_router  # noqa: E402

TABLES = "usage_events, design_memories, assets, design_versions, projects, subscriptions, users"


def run_sql(query: str, *args):
    """Runs one statement on its own connection (outside the app's pool/loop)."""

    async def _run():
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            return await conn.fetch(query, *args)
        finally:
            await conn.close()

    return asyncio.run(_run())


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_db():
    run_sql(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE")


class FakeGraph:
    def __init__(self):
        self.calls = []

    async def ainvoke(self, state, config=None):
        self.calls.append((state, config))
        return {"messages": state["messages"] + [{"role": "agent", "content": "stub reply"}]}


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    graph = FakeGraph()
    renders = []

    async def fake_generate(prompt, mode, sketch_bytes=None, sketch_mime_type="image/png"):
        renders.append((prompt, mode))
        return b"\x89PNG fake"

    monkeypatch.setattr(agent_router, "forge_graph", graph)
    monkeypatch.setattr(agent_router, "generate_design_image", fake_generate)
    return graph, renders


class User:
    def __init__(self, client, id, token):
        self.client, self.id, self.token = client, id, token

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, path, **kw):
        return self.client.get(path, headers=self.headers, **kw)

    def post(self, path, json=None, **kw):
        return self.client.post(path, json=json, headers=self.headers, **kw)

    def set_plan(self, tier="free", modes=("vehicle", "interior"), quota=10):
        run_sql(
            "UPDATE users SET tier=$1, allowed_modes=$2, render_quota=$3 WHERE id=$4",
            tier, list(modes), quota, self.id,
        )

    def create_project(self, mode="vehicle", title="Test project"):
        r = self.post("/projects/", {"title": title, "mode": mode})
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture
def make_user(client):
    def _make(password="password-123"):
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        r = client.post("/auth/register", json={"email": email, "password": password, "name": "T"})
        assert r.status_code == 200, r.text
        body = r.json()
        user = User(client, body["user"]["id"], body["token"])
        user.email = email
        return user

    return _make
