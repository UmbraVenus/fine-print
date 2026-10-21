from api.index import app


def test_health():
    res = app.test_client().get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}
