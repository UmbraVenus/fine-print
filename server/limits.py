"""
Caps on live checks, so a shared link can't run up the API bill: a few a minute per visitor and a
daily total. Counted in the database, because serverless functions keep no memory between requests.
"""

from __future__ import annotations

import os
from datetime import datetime

from .db import Db


def _setting(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name) or default)
    except ValueError:
        return default


def _bump(db: Db, key: str) -> int:
    row = db.one("SELECT value FROM meta WHERE key = ?", (key,))
    count = int(row["value"]) + 1 if row else 1
    db.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
           (key, str(count)))
    return count


def allow_live_check(db: Db, visitor: str | None, now: datetime) -> bool:
    """Count one live check; False when it would go over a cap. Old counters are cleared as it goes."""
    day = f"rate:day:{now:%Y-%m-%d}"
    minute = f"rate:min:{now:%Y-%m-%dT%H:%M}:"
    db.run("DELETE FROM meta WHERE key LIKE 'rate:%' AND key != ? AND key NOT LIKE ?", (day, f"{minute}%"))
    # A visitor over their minute's cap is turned away before it counts toward the day.
    ok = not visitor or _bump(db, f"{minute}{visitor}") <= _setting("LIVE_CHECKS_PER_MINUTE", 10)
    ok = ok and _bump(db, day) <= _setting("LIVE_CHECKS_PER_DAY", 200)
    db.commit()
    return ok
