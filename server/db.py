"""libSQL access. The same code runs on a local file and on Turso."""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import libsql

MIGRATIONS = Path(__file__).parent / "migrations"


def database_url() -> str:
    return os.environ.get("DATABASE_URL") or "file:./local.db"


def connect(url: str | None = None) -> Any:
    url = url or database_url()
    if url == ":memory:":
        return libsql.connect(":memory:")
    if url.startswith("file:"):
        return libsql.connect(url.removeprefix("file:"))
    return libsql.connect(url, auth_token=os.environ.get("DATABASE_AUTH_TOKEN", ""))


class Db:
    """A thin wrapper that returns rows as dicts."""

    def __init__(self, conn: Any):
        self.conn = conn

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


def migrate(db: Db) -> None:
    db.run("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)")
    done = {r["name"] for r in db.all("SELECT name FROM schema_migrations")}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in done:
            continue
        for statement in _statements(path.read_text()):
            db.run(statement)
        db.run("INSERT INTO schema_migrations (name) VALUES (?)", (path.name,))
    db.commit()


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
