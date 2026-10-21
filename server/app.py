"""The Flask API. Every route starts with /api/ because Vercel passes the full path through."""

from __future__ import annotations

from typing import Any, Callable

from flask import Flask, g, jsonify, request

from . import repo
from .dates import iso, local_date, utcnow
from .db import Db, connect, migrate
from .seed import ensure_seeded, seed


def create_app(database_url: str | None = None, clock: Callable = utcnow) -> Flask:
    app = Flask(__name__)
    app.config["DATABASE_URL"] = database_url
    app.config["CLOCK"] = clock
    state: dict[str, Any] = {"migrated": False, "memory": None}

    def get_db() -> Db:
        if "db" not in g:
            url = app.config["DATABASE_URL"]
            if url == ":memory:":
                # Tests: one shared in-memory database for the app's lifetime.
                if state["memory"] is None:
                    state["memory"] = Db(connect(":memory:"))
                g.db = state["memory"]
            else:
                g.db = Db(connect(url))
            if not state["migrated"]:
                migrate(g.db)
                state["migrated"] = True
            ensure_seeded(g.db, now())
        return g.db

    def now():
        return app.config["CLOCK"]()

    app.get_db = get_db  # type: ignore[attr-defined]

    @app.teardown_appcontext
    def close_db(_exc: BaseException | None) -> None:
        db = g.pop("db", None)
        if db is not None and db is not state["memory"]:
            db.conn.close() if hasattr(db.conn, "close") else None

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.post("/api/reset")
    def reset():
        db = get_db()
        seed(db, now())
        return jsonify(ok=True)

    @app.get("/api/ads")
    def ads():
        db = get_db()
        view = request.args.get("view", "queue")
        if view not in repo.VIEWS:
            return jsonify(error="Unknown view"), 400
        args = request.args
        result = repo.list_ads(
            db, view,
            q=args.get("q", ""),
            formats=args.getlist("format"),
            products=args.getlist("product"),
            statuses=args.getlist("status"),
            auto_check=args.getlist("auto_check"),
            sort=args.get("sort"),
            order=args.get("order"),
            page=args.get("page", 1, type=int),
            page_size=min(args.get("page_size", 10, type=int), 50),
        )
        result["stats"] = repo.stats(db, view, now())
        result["filters"] = repo.filter_options(db, view)
        return jsonify(result)

    @app.get("/api/nav")
    def nav():
        db = get_db()
        return jsonify(pending=repo.pending_count(db), today=local_date(now()).isoformat(), now=iso(now()))

    return app
