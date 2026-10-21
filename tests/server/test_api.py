from server.app import create_app

from .conftest import NOW


def make_client():
    app = create_app(":memory:", clock=lambda: NOW)
    return app, app.test_client()


def test_first_run_seeds_an_empty_database():
    _, client = make_client()
    res = client.get("/api/nav")
    assert res.get_json() == {"pending": 9, "today": "2026-10-21", "now": "2026-10-21T17:30:00Z"}


def test_reset_restores_sample_data():
    app, client = make_client()
    client.get("/api/nav")
    with app.app_context():
        db = app.get_db()
        db.run("UPDATE ads SET status = 'approved' WHERE status = 'pending'")
        db.commit()
    assert client.get("/api/nav").get_json()["pending"] == 0
    assert client.post("/api/reset").get_json() == {"ok": True}
    assert client.get("/api/nav").get_json()["pending"] == 9


def test_list_endpoint():
    _, client = make_client()
    data = client.get("/api/ads?view=queue&page_size=10").get_json()
    assert data["total"] == 9
    assert [s["value"] for s in data["stats"]][:2] == [9, 4]
    assert data["rows"][0]["layers"][0]["text"]
    filtered = client.get("/api/ads?view=queue&format=Email&format=Blog%20post").get_json()
    assert filtered["total"] == 3
    assert client.get("/api/ads?view=nope").status_code == 400
