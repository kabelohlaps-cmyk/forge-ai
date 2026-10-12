def test_create_and_list_projects(make_user):
    user = make_user()
    project = user.create_project(mode="vehicle", title="Rover")
    assert [p["id"] for p in user.get("/projects/").json()] == [project["id"]]


def test_create_project_rejects_mode_outside_plan(make_user):
    user = make_user()  # free plan: vehicle + interior
    r = user.post("/projects/", {"title": "Gadget", "mode": "product"})
    assert r.status_code == 403
    assert "plan" in r.json()["detail"]


def test_create_project_rejects_unknown_mode(make_user):
    user = make_user()
    r = user.post("/projects/", {"title": "?", "mode": "spaceship"})
    assert r.status_code == 400


def test_upgraded_plan_unlocks_mode(make_user):
    user = make_user()
    user.set_plan("creator", ["vehicle", "interior", "product", "architecture"], 200)
    user.create_project(mode="product")


def test_users_cannot_see_each_others_projects(make_user):
    alice, bob = make_user(), make_user()
    project = alice.create_project()
    assert bob.get("/projects/").json() == []
    assert bob.get(f"/projects/{project['id']}").status_code == 404
    assert bob.get(f"/projects/{project['id']}/messages").status_code == 404
