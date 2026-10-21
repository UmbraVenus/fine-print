"""The live auto check: the ad's text against the rules that apply, with Claude. Server-side only."""

from __future__ import annotations

import os
from datetime import datetime

from .db import Db


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def run_check(db: Db, version_id: int, now: datetime, context: str = "re-check", log: bool = True) -> dict:
    if not available():
        return {"status": "unavailable"}
    return {"status": "error"}
