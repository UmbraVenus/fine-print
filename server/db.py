"""libSQL access. The same code runs on a local file and on Turso."""

from __future__ import annotations

import json
import os
import re
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import libsql

MIGRATIONS = Path(__file__).parent / "migrations"


def default_url() -> str:
    explicit = os.environ.get("DATABASE_URL")
    if explicit:
        return explicit
    # On Vercel with no shared database: a SQLite file in the function's /tmp, seeded on first use.
    # Each running copy of the function then has its own data.
    if os.environ.get("VERCEL"):
        return "file:/tmp/fine-print.db"
    return "file:./local.db"


def is_remote(url: str | None) -> bool:
    return bool(url) and not url.startswith("file:") and url != ":memory:"


REPLICA_PATH = "/tmp/fine-print-replica.db"
# Pull other copies' writes at most this often; a page's burst of requests shares one sync.
SYNC_EVERY_SECONDS = 1.0


class Replica:
    """
    A local copy of the remote database, for Vercel. Reads run on the local file, writes go to
    the remote database, and sync() pulls in what other running copies wrote. One connection per
    process, used one request at a time.
    """

    def __init__(self, url: str):
        self.conn = libsql.connect(REPLICA_PATH, sync_url=url, auth_token=os.environ.get("DATABASE_AUTH_TOKEN", ""),
                                   _check_same_thread=False)
        self.lock = threading.Lock()
        self.last_sync = 0.0
        self.sync(force=True)

    @contextmanager
    def released(self) -> Iterator[None]:
        """Let other requests use the copy during a slow outside call, such as the model."""
        self.conn.commit()
        self.lock.release()
        try:
            yield
        finally:
            self.lock.acquire()
            self.sync(force=True)

    def sync(self, force: bool = False) -> None:
        if force or time.monotonic() - self.last_sync >= SYNC_EVERY_SECONDS:
            self.conn.sync()
            self.last_sync = time.monotonic()


_replica: Replica | None = None
_replica_lock = threading.Lock()


def replica(url: str) -> Replica:
    global _replica
    with _replica_lock:
        if _replica is None:
            _replica = Replica(url)
    return _replica


def connect(url: str | None = None) -> Any:
    url = url or default_url()
    if url == ":memory:":
        return libsql.connect(":memory:")
    if url.startswith("file:"):
        return libsql.connect(url.removeprefix("file:"))
    return libsql.connect(url, auth_token=os.environ.get("DATABASE_AUTH_TOKEN", ""))


class Db:
    """A thin wrapper that returns rows as dicts."""

    def __init__(self, conn: Any, replica: "Replica | None" = None):
        self.conn = conn
        self.replica = replica

    @contextmanager
    def released(self) -> Iterator[None]:
        """Around a slow outside call: on a shared local copy, frees it for other requests meanwhile."""
        if self.replica is None:
            yield
        else:
            with self.replica.released():
                yield

    def all(self, sql: str, params: tuple | list = ()) -> list[dict]:
        cur = self.conn.execute(sql, tuple(params))
        cols = [d[0] for d in cur.description or []]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def one(self, sql: str, params: tuple | list = ()) -> dict | None:
        rows = self.all(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: tuple | list = ()) -> Any:
        row = self.conn.execute(sql, tuple(params)).fetchone()
        return row[0] if row else None

    def run(self, sql: str, params: tuple | list = ()) -> int:
        cur = self.conn.execute(sql, tuple(params))
        return cur.lastrowid

    def many(self, sql: str, rows: list[tuple], chunk: int = 400) -> None:
        """
        Insert many rows as multi-row INSERTs. On Turso every statement is a network round trip,
        so thousands of single-row inserts would take minutes; a few dozen batches take seconds.
        """
        if not rows:
            return
        head, values = sql.split("VALUES", 1)
        placeholder = values.strip()
        for start in range(0, len(rows), chunk):
            batch = rows[start:start + chunk]
            statement = f"{head}VALUES {', '.join([placeholder] * len(batch))}"
            self.conn.execute(statement, tuple(v for row in batch for v in row))

    def insert(self, table: str, values: dict) -> int:
        cols = list(values)
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})"
        return self.run(sql, [_encode(values[c]) for c in cols])

    def update(self, table: str, row_id: Any, values: dict) -> None:
        sets = ", ".join(f"{c} = ?" for c in values)
        self.run(f"UPDATE {table} SET {sets} WHERE id = ?", [*(_encode(v) for v in values.values()), row_id])

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()


def _encode(value: Any) -> Any:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return value


_ADD_COLUMN = re.compile(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)", re.IGNORECASE)


def migrate(db: Db) -> None:
    db.run("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)")
    done = {r["name"] for r in db.all("SELECT name FROM schema_migrations")}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in done:
            continue
        for statement in _statements(path.read_text()):
            if not _already_applied(db, statement):
                db.run(statement)
        db.run("INSERT INTO schema_migrations (name) VALUES (?)", (path.name,))
        db.commit()


def _already_applied(db: Db, statement: str) -> bool:
    """A column added by an earlier, half-finished run is there already; adding it again would fail."""
    match = _ADD_COLUMN.match(statement)
    if not match:
        return False
    table, column = match.groups()
    return any(r["name"] == column for r in db.all(f"PRAGMA table_info({table})"))


def _statements(sql: str) -> list[str]:
    lines = [line.split("--", 1)[0] for line in sql.splitlines()]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


@contextmanager
def session(url: str | None = None) -> Iterator[Db]:
    conn = connect(url)
    db = Db(conn)
    try:
        yield db
        conn.commit()
    except Exception:
        conn.rollback()
        raise
