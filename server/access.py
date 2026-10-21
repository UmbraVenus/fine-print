"""
The secret link. When ACCESS_KEY is set, the API answers only visitors who opened the site with
?key=<ACCESS_KEY> once; that visit leaves a cookie. Without ACCESS_KEY (local work) everything is open.
"""

from __future__ import annotations

import hashlib
import hmac
import os

from flask import Flask, jsonify, make_response, request

COOKIE = "fp_access"
OPEN_PATHS = {"/api/health", "/api/access"}
THIRTY_DAYS = 30 * 24 * 3600


def _key() -> str | None:
    return os.environ.get("ACCESS_KEY") or None


def _token(key: str) -> str:
    # The cookie holds a digest of the key, never the key itself.
    return hashlib.sha256(f"fine-print:{key}".encode()).hexdigest()


def has_access() -> bool:
    key = _key()
    return key is None or hmac.compare_digest(request.cookies.get(COOKIE, ""), _token(key))


def install(app: Flask) -> None:
    @app.before_request
    def require_access():
        if request.path.startswith("/api/") and request.path not in OPEN_PATHS and not has_access():
            return jsonify(error="This link isn't valid.", code="no_access"), 401
        return None

    @app.after_request
    def keep_out_of_search(response):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return response

    @app.get("/api/access")
    def access_status():
        return (jsonify(ok=True), 200) if has_access() else (jsonify(error="This link isn't valid.", code="no_access"), 401)

    @app.post("/api/access")
    def unlock():
        key = _key()
        given = str((request.get_json(silent=True) or {}).get("key") or "")
        if key is None:
            return jsonify(ok=True)
        if not hmac.compare_digest(given, key):
            return jsonify(error="This link isn't valid.", code="no_access"), 401
        response = make_response(jsonify(ok=True))
        response.set_cookie(COOKIE, _token(key), max_age=THIRTY_DAYS, httponly=True, samesite="Lax",
                            secure=request.is_secure or request.headers.get("X-Forwarded-Proto") == "https")
        return response
