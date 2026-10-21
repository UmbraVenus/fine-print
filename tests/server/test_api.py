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


def test_a_half_finished_migration_is_finished_on_the_next_start(tmp_path):
    from server.db import Db, connect, migrate

    db = Db(connect(f"file:{tmp_path / 'half.db'}"))
    migrate(db)
    # An earlier run added the column but never recorded the migration.
    db.run("DELETE FROM schema_migrations WHERE name = '0002_resolved_by_submitter.sql'")
    db.commit()
    migrate(db)
    assert db.one("SELECT name FROM schema_migrations WHERE name = '0002_resolved_by_submitter.sql'")


def test_first_requests_arriving_together_all_succeed(tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    app = create_app(f"file:{tmp_path / 'race.db'}")
    client = app.test_client()
    with ThreadPoolExecutor(6) as pool:
        codes = list(pool.map(lambda path: client.get(path).status_code,
                              ["/api/nav", "/api/ads?view=queue", "/api/nav", "/api/rules", "/api/nav", "/api/ads?view=history"]))
    assert codes == [200] * 6


def test_secret_link(monkeypatch):
    monkeypatch.setenv("ACCESS_KEY", "s3cret-link-key")
    client = create_app(":memory:").test_client()
    assert client.get("/api/health").status_code == 200
    blocked = client.get("/api/nav")
    assert blocked.status_code == 401 and blocked.get_json()["code"] == "no_access"
    assert client.post("/api/check", json={"adVersionId": 1}).status_code == 401  # no spending without the link
    assert client.post("/api/access", json={"key": "wrong"}).status_code == 401
    assert client.get("/api/access").status_code == 401

    unlocked = client.post("/api/access", json={"key": "s3cret-link-key"})
    assert unlocked.status_code == 200
    cookie = unlocked.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "s3cret-link-key" not in cookie
    assert client.get("/api/access").status_code == 200
    assert client.get("/api/nav").status_code == 200
    assert client.get("/api/nav").headers["X-Robots-Tag"] == "noindex, nofollow"


def test_no_access_key_means_open(monkeypatch):
    monkeypatch.delenv("ACCESS_KEY", raising=False)
    client = create_app(":memory:").test_client()
    assert client.get("/api/nav").status_code == 200
    assert client.get("/api/access").status_code == 200


def test_votes_count_each_browser_once_and_survive_a_reset(tmp_path):
    app = create_app(f"file:{tmp_path / 'votes.db'}")
    one, two = app.test_client(), app.test_client()
    assert one.get("/api/votes").get_json() == {"votes": {"upload": 0, "doc-rules": 0, "search": 0}, "voted": []}
    assert one.post("/api/votes", json={"feature": "upload"}).get_json()["votes"]["upload"] == 1
    # The same browser again: still one vote.
    again = one.post("/api/votes", json={"feature": "upload"}).get_json()
    assert again["votes"]["upload"] == 1 and again["voted"] == ["upload"]
    # Another browser counts.
    assert two.post("/api/votes", json={"feature": "upload"}).get_json()["votes"]["upload"] == 2
    assert two.get("/api/votes").get_json()["voted"] == ["upload"]
    assert one.post("/api/votes", json={"feature": "nope"}).status_code == 400
    one.post("/api/reset")
    assert one.get("/api/votes").get_json()["votes"]["upload"] == 2
    # Undo takes back only your own vote.
    undone = one.delete("/api/votes", json={"feature": "upload"}).get_json()
    assert undone["votes"]["upload"] == 1 and undone["voted"] == []
    assert two.get("/api/votes").get_json()["voted"] == ["upload"]
