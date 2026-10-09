import base64

from app.routers import agent as agent_router
from app.routers import assets as assets_router


def sketch_uri(n_bytes, mime="image/png"):
    return f"data:{mime};base64," + base64.b64encode(b"\0" * n_bytes).decode()


def project_with_turn(user):
    project = user.create_project()
    user.post("/agent/invoke", {"project_id": project["id"], "mode": "vehicle", "prompt": "a rover"})
    return project


def generate(user, project, uri):
    return user.post("/agent/generate-image", {
        "project_id": project["id"], "mode": "vehicle", "prompt": "render", "sketch_data_uri": uri,
    })


def test_small_sketch_is_accepted(make_user, fake_ai):
    _, renders = fake_ai
    user = make_user()
    assert generate(user, project_with_turn(user), sketch_uri(1024)).status_code == 200
    assert len(renders) == 1


def test_oversized_sketch_is_rejected(make_user, fake_ai, monkeypatch):
    _, renders = fake_ai
    monkeypatch.setattr(agent_router, "MAX_SKETCH_BYTES", 1000)
    user = make_user()
    r = generate(user, project_with_turn(user), sketch_uri(1001))
    assert r.status_code == 413
    assert renders == []


def test_sketch_payload_over_the_field_limit_is_rejected(make_user, fake_ai):
    user = make_user()
    limit = agent_router.ImageRequest.model_fields["sketch_data_uri"].metadata[0].max_length
    r = generate(user, project_with_turn(user), "data:image/png;base64," + "A" * limit)
    assert r.status_code == 422


def test_non_image_sketch_is_rejected(make_user, fake_ai):
    _, renders = fake_ai
    user = make_user()
    r = generate(user, project_with_turn(user), sketch_uri(10, mime="application/pdf"))
    assert r.status_code == 400
    assert renders == []


def test_upload_within_limit(make_user):
    user = make_user()
    r = user.client.post("/assets/upload", headers=user.headers, files={"file": ("a.png", b"x" * 2048)})
    assert r.status_code == 200
    assert r.json()["size"] == 2048


def test_upload_over_limit_is_rejected(make_user, monkeypatch):
    monkeypatch.setattr(assets_router, "MAX_UPLOAD_BYTES", 1500)
    monkeypatch.setattr(assets_router, "_CHUNK", 512)
    user = make_user()
    r = user.client.post("/assets/upload", headers=user.headers, files={"file": ("a.png", b"x" * 2048)})
    assert r.status_code == 413
