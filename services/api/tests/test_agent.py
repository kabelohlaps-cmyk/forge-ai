from tests.conftest import run_sql


def invoke(user, project, prompt="design a rover", mode=None):
    return user.post(
        "/agent/invoke",
        {"project_id": project["id"], "mode": mode or project["mode"], "prompt": prompt},
    )


def generate(user, project, mode=None):
    return user.post(
        "/agent/generate-image",
        {"project_id": project["id"], "mode": mode or project["mode"], "prompt": "render it"},
    )


def test_invoke_saves_turn_and_rebuilds_history(make_user, fake_ai):
    user = make_user()
    project = user.create_project()
    r = invoke(user, project)
    assert r.status_code == 200, r.text
    assert r.json()["reply"] == "stub reply"
    messages = user.get(f"/projects/{project['id']}/messages").json()["messages"]
    assert messages == [
        {"role": "user", "content": "design a rover"},
        {"role": "agent", "content": "stub reply"},
    ]


def test_invoke_on_someone_elses_project_is_rejected(make_user, fake_ai):
    graph, _ = fake_ai
    alice, bob = make_user(), make_user()
    project = alice.create_project()
    r = invoke(bob, project, prompt="what did alice say?")
    assert r.status_code == 404
    # Nothing ran and nothing was written into alice's project.
    assert graph.calls == []
    assert run_sql("SELECT count(*) FROM design_versions")[0][0] == 0


def test_invoke_on_missing_project_is_404(make_user):
    user = make_user()
    r = user.post("/agent/invoke", {"project_id": 999, "mode": "vehicle", "prompt": "hi"})
    assert r.status_code == 404


def test_invoke_rejects_mode_that_differs_from_project(make_user, fake_ai):
    user = make_user()
    project = user.create_project(mode="vehicle")
    assert invoke(user, project, mode="interior").status_code == 400


def test_invoke_rejects_mode_after_downgrade(make_user, fake_ai):
    user = make_user()
    user.set_plan("creator", ["vehicle", "interior", "product", "architecture"], 200)
    project = user.create_project(mode="product")
    user.set_plan()  # back to free
    assert invoke(user, project).status_code == 403


def test_generate_image_attaches_to_latest_turn(make_user, fake_ai):
    user = make_user()
    project = user.create_project()
    invoke(user, project)
    r = generate(user, project)
    assert r.status_code == 200, r.text
    messages = user.get(f"/projects/{project['id']}/messages").json()["messages"]
    assert messages[-1]["image_data_uri"].startswith("data:image/png;base64,")


def test_generate_image_needs_a_turn_first(make_user, fake_ai):
    user = make_user()
    project = user.create_project()
    assert generate(user, project).status_code == 400


def test_generate_image_on_someone_elses_project_is_rejected(make_user, fake_ai):
    _, renders = fake_ai
    alice, bob = make_user(), make_user()
    project = alice.create_project()
    invoke(alice, project)
    assert generate(bob, project).status_code == 404
    assert renders == []


def test_render_quota_is_enforced_and_counted(make_user, fake_ai):
    _, renders = fake_ai
    user = make_user()
    user.set_plan(quota=2)
    project = user.create_project()
    invoke(user, project)
    assert generate(user, project).status_code == 200
    assert generate(user, project).status_code == 200
    r = generate(user, project)
    assert r.status_code == 403
    assert "renders" in r.json()["detail"]
    assert len(renders) == 2
    assert run_sql("SELECT count(*) FROM usage_events WHERE feature='render'")[0][0] == 2


def test_last_months_renders_dont_count(make_user, fake_ai):
    user = make_user()
    user.set_plan(quota=1)
    project = user.create_project()
    invoke(user, project)
    run_sql(
        "INSERT INTO usage_events (user_id, feature, created_at) "
        "VALUES ($1, 'render', date_trunc('month', now()) - interval '1 day')",
        user.id,
    )
    assert generate(user, project).status_code == 200


def test_unlimited_quota(make_user, fake_ai):
    user = make_user()
    user.set_plan(quota=-1)
    project = user.create_project()
    invoke(user, project)
    for _ in range(3):
        assert generate(user, project).status_code == 200
