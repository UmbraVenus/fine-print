from server.app import create_app


def test_health():
    app = create_app(":memory:")
    res = app.test_client().get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}
