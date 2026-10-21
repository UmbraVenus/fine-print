"""The Flask API. Every route starts with /api/ because Vercel passes the full path through."""

from __future__ import annotations

import secrets
import threading
from typing import Any, Callable

from flask import Flask, g, jsonify, request

from . import access, actions, checker, repo
from .dates import iso, local_date, utcnow
from .db import Db, connect, migrate
from .seed import ensure_seeded, seed


def create_app(database_url: str | None = None, clock: Callable = utcnow) -> Flask:
    app = Flask(__name__)
    app.config["DATABASE_URL"] = database_url
    app.config["CLOCK"] = clock
    access.install(app)
    state: dict[str, Any] = {"migrated": False, "memory": None}
    setup_lock = threading.Lock()

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
            # The first requests arrive together; one at a time migrates and seeds.
            with setup_lock:
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
            due_by=local_date(now()).isoformat() if args.get("due") == "today" else None,
            page_size=min(args.get("page_size", 10, type=int), 50),
        )
        result["stats"] = repo.stats(db, view, now())
        result["filters"] = repo.filter_options(db, view)
        return jsonify(result)

    @app.get("/api/ads/<int:ad_id>")
    def ad(ad_id: int):
        detail = repo.ad_detail(get_db(), ad_id)
        if detail is None:
            return jsonify(error="Ad not found"), 404
        return jsonify(detail)

    @app.get("/api/rules")
    def rules():
        return jsonify(rules=repo.rules(get_db()))

    @app.errorhandler(actions.ActionError)
    def action_error(error: actions.ActionError):
        return jsonify(error=str(error)), error.status

    def body() -> dict:
        return request.get_json(silent=True) or {}

    @app.post("/api/findings/<int:finding_id>")
    def update_finding(finding_id: int):
        data = body()
        return jsonify(actions.update_finding(get_db(), finding_id, data.get("action", ""), text=data.get("text"),
                                              reason=data.get("reason"), note=data.get("note")))

    @app.post("/api/ads/<int:ad_id>/findings")
    def add_finding(ad_id: int):
        return jsonify(actions.add_reviewer_finding(get_db(), ad_id, body().get("text"), now())), 201

    @app.put("/api/reviewer-findings/<int:finding_id>")
    def edit_finding(finding_id: int):
        return jsonify(actions.edit_reviewer_finding(get_db(), finding_id, body().get("text")))

    @app.delete("/api/reviewer-findings/<int:finding_id>")
    def delete_finding(finding_id: int):
        actions.delete_reviewer_finding(get_db(), finding_id)
        return jsonify(ok=True)

    @app.post("/api/ads/<int:ad_id>/decision")
    def decision(ad_id: int):
        data = body()
        return jsonify(actions.decide(get_db(), ad_id, data.get("status", ""), data.get("message"), now()))

    @app.post("/api/undo/<token>")
    def undo(token: str):
        return jsonify(actions.undo(get_db(), token))

    @app.put("/api/ads/<int:ad_id>/copy")
    def save_copy(ad_id: int):
        data = body()
        return jsonify(actions.save_copy(get_db(), ad_id, data.get("layers"), now(), resolve=data.get("resolve")))

    @app.post("/api/ads/<int:ad_id>/submit")
    def submit(ad_id: int):
        db = get_db()
        live = (lambda version_id: checker.run_check(db, version_id, now(), context="submit", log_event=False)) \
            if checker.available() else None
        return jsonify(actions.submit(db, ad_id, now(), live_check=live))

    @app.post("/api/check")
    def check():
        data = body()
        version_id = data.get("adVersionId")
        if not isinstance(version_id, int):
            return jsonify(error="adVersionId must be a number"), 400
        db = get_db()
        version_id = actions.checkable_version(db, version_id)
        # The visitor, for the per-minute cap: the first address Vercel's proxy saw.
        visitor = (request.headers.get("X-Forwarded-For") or request.remote_addr or "").split(",")[0].strip() or None
        result = checker.run_check(db, version_id, now(), context=data.get("context", "re-check"), visitor=visitor)
        return jsonify(result)

    @app.get("/api/insights")
    def insights():
        return jsonify(repo.insights(get_db(), now()))

    # Coming next: votes on features that aren't built yet, to decide what to build first.
    # One vote per feature per browser: an anonymous voter id in a cookie, and a row per (feature, voter).
    COMING_NEXT = ("upload", "doc-rules", "search")
    VOTER_COOKIE = "fp_voter"

    def vote_counts(voter: str | None) -> dict:
        db = get_db()
        counts = {r["feature"]: r["n"] for r in db.all("SELECT feature, COUNT(*) AS n FROM feature_votes GROUP BY feature")}
        mine = {r["feature"] for r in db.all("SELECT feature FROM feature_votes WHERE voter = ?", (voter or "",))}
        return {"votes": {f: counts.get(f, 0) for f in COMING_NEXT}, "voted": sorted(mine)}

    @app.get("/api/votes")
    def votes():
        return jsonify(vote_counts(request.cookies.get(VOTER_COOKIE)))

    @app.post("/api/votes")
    def vote():
        feature = body().get("feature")
        if feature not in COMING_NEXT:
            return jsonify(error="Unknown feature"), 400
        voter = request.cookies.get(VOTER_COOKIE) or secrets.token_urlsafe(16)
        db = get_db()
        db.run("INSERT INTO feature_votes (feature, voter, created_at) VALUES (?, ?, ?) "
               "ON CONFLICT(feature, voter) DO NOTHING", (feature, voter, iso(now())))
        db.commit()
        response = jsonify(vote_counts(voter))
        response.set_cookie(VOTER_COOKIE, voter, max_age=365 * 24 * 3600, httponly=True, samesite="Lax",
                            secure=request.is_secure or request.headers.get("X-Forwarded-Proto") == "https")
        return response

    @app.delete("/api/votes")
    def unvote():
        feature = body().get("feature")
        voter = request.cookies.get(VOTER_COOKIE)
        if feature not in COMING_NEXT:
            return jsonify(error="Unknown feature"), 400
        if voter:
            db = get_db()
            db.run("DELETE FROM feature_votes WHERE feature = ? AND voter = ?", (feature, voter))
            db.commit()
        return jsonify(vote_counts(voter))

    @app.get("/api/nav")
    def nav():
        db = get_db()
        return jsonify(pending=repo.pending_count(db), today=local_date(now()).isoformat(), now=iso(now()))

    return app
