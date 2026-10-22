import time

from server import app as app_module
from server import db as db_module
from server.app import create_app


def test_an_unreachable_shared_database_falls_back_to_a_local_one(tmp_path, monkeypatch):
    # The site never goes down because the shared database can't be reached.
    monkeypatch.setattr(db_module, "REPLICA_PATH", str(tmp_path / "replica.db"))
    monkeypatch.setattr(db_module, "_replica", None)
    local = tmp_path / "local.db"
    real_connect = app_module.connect
    monkeypatch.setattr(app_module, "connect", lambda url=None: real_connect(f"file:{local}") if url == "file:/tmp/fine-print.db" else real_connect(url))
    app = create_app("libsql://127.0.0.1:9")
    started = time.monotonic()
    res = app.test_client().get("/api/ads?view=queue")
    assert res.status_code == 200
    assert res.get_json()["total"] == 9
    assert time.monotonic() - started < 15


def test_the_local_copy_syncs_at_most_once_a_second(monkeypatch):
    calls = []

    class Conn:
        def sync(self):
            calls.append(1)

    copy = db_module.Replica.__new__(db_module.Replica)
    copy.conn, copy.last_sync = Conn(), 0.0
    copy.sync(force=True)
    copy.sync()
    copy.sync()
    assert len(calls) == 1
    copy.last_sync -= 2
    copy.sync()
    assert len(calls) == 2
