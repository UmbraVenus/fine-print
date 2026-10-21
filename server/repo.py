"""Read side: table rows, stats and ad details. Every number shown in the app comes from here."""

from __future__ import annotations

import json
from datetime import datetime, timedelta

from .dates import iso, local_date, parse_iso
from .db import Db

VIEWS = ("my-ads", "queue", "history")

VIEW_WHERE = {
    "my-ads": "a.is_mine = 1",
    "queue": "a.status = 'pending'",
    "history": "a.status IN ('approved', 'approved_with_changes')",
}
DATE_COLUMN = {"my-ads": "a.updated_at", "queue": "a.due_date", "history": "a.closed_at"}
DEFAULT_SORT = {"my-ads": ("date", "desc"), "queue": ("date", "asc"), "history": ("date", "desc")}

OPEN_AUTO = "f.origin = 'auto' AND f.state != 'dismissed' AND f.ad_version_id = v.id"
ROW_SELECT = f"""
SELECT a.id, a.name, a.format, a.product, a.source, a.status, a.current_version, a.due_date,
       a.created_at, a.updated_at, a.closed_at, a.live_since,
       v.id AS version_id, v.template, v.theme, v.layers,
       (SELECT COUNT(*) FROM findings f WHERE {OPEN_AUTO} AND f.severity = 'critical') AS critical,
       (SELECT COUNT(*) FROM findings f WHERE {OPEN_AUTO} AND f.severity = 'caution') AS caution,
       (SELECT COUNT(*) FROM findings f WHERE f.ad_version_id = v.id AND f.sent_to_submitter = 1) AS sent
FROM ads a JOIN ad_versions v ON v.ad_id = a.id AND v.version = a.current_version
"""

AUTO_CHECK_FILTER = {
    "critical": "critical > 0",
    "caution": "critical = 0 AND caution > 0",
    "good": "critical = 0 AND caution = 0",
}


def _decode_row(row: dict) -> dict:
    row["theme"] = json.loads(row["theme"])
    row["layers"] = json.loads(row["layers"])
    return row


def list_ads(db: Db, view: str, *, q: str = "", formats: list[str] | None = None, products: list[str] | None = None,
             statuses: list[str] | None = None, auto_check: list[str] | None = None, sort: str | None = None,
             order: str | None = None, page: int = 1, page_size: int = 10) -> dict:
    if view not in VIEWS:
        raise ValueError(f"Unknown view {view}")
    where = [VIEW_WHERE[view]]
    params: list = []
    if q.strip():
        where.append("(a.name LIKE ? OR a.source LIKE ? OR a.format LIKE ?)")
        like = f"%{q.strip()}%"
        params += [like, like, like]
    for column, values in (("a.format", formats), ("a.product", products), ("a.status", statuses)):
        if values:
            where.append(f"{column} IN ({', '.join('?' for _ in values)})")
            params += values
    outer = ""
    if auto_check:
        clauses = [AUTO_CHECK_FILTER[k] for k in auto_check if k in AUTO_CHECK_FILTER]
        if clauses:
            outer = " WHERE " + " OR ".join(f"({c})" for c in clauses)

    sort_key, sort_order = DEFAULT_SORT[view]
    if sort in ("name", "date"):
        sort_key = sort
        sort_order = "asc" if order == "asc" else "desc"
    direction = "ASC" if sort_order == "asc" else "DESC"
    if sort_key == "name":
        order_by = f"name COLLATE NOCASE {direction}, id"
    elif view == "queue":
        # Due date, then name, so "3 of 9" is stable for everyone.
        order_by = f"due_date {direction}, name COLLATE NOCASE ASC, id"
    else:
        column = DATE_COLUMN[view].removeprefix("a.")
        order_by = f"{column} {direction}, id {direction}"

    inner = f"{ROW_SELECT} WHERE {' AND '.join(where)}"
    total = db.scalar(f"SELECT COUNT(*) FROM ({inner}){outer}", params)
    page = max(1, page)
    rows = db.all(f"SELECT * FROM ({inner}){outer} ORDER BY {order_by} LIMIT ? OFFSET ?",
                  [*params, page_size, (page - 1) * page_size])
    rows = [_decode_row(r) for r in rows]
    _attach_row_details(db, view, rows)
    return {"rows": rows, "total": total, "page": page, "page_size": page_size, "sort": sort_key, "order": sort_order}


def _attach_row_details(db: Db, view: str, rows: list[dict]) -> None:
    """The extra facts the sub-lines need: decision messages for rejected ads."""
    rejected = [r["id"] for r in rows if r["status"] == "rejected"]
    messages: dict[int, str] = {}
    if rejected:
        for event in db.all(
            f"SELECT ad_id, detail FROM events WHERE type = 'decision' AND ad_id IN ({', '.join('?' for _ in rejected)}) "
            "ORDER BY at", rejected):
            message = json.loads(event["detail"]).get("message")
            if message:
                messages[event["ad_id"]] = message
    for row in rows:
        row["decision_message"] = messages.get(row["id"])


def queue_order(db: Db) -> list[int]:
    return [r["id"] for r in db.all(f"SELECT id, name, due_date FROM ({ROW_SELECT} WHERE a.status = 'pending') "
                                     "ORDER BY due_date ASC, name COLLATE NOCASE ASC, id")]


def pending_count(db: Db) -> int:
    return db.scalar("SELECT COUNT(*) FROM ads WHERE status = 'pending'")


def filter_options(db: Db, view: str) -> dict:
    where = VIEW_WHERE[view]
    def distinct(column: str) -> list[str]:
        return [r["v"] for r in db.all(f"SELECT DISTINCT {column} AS v FROM ads a WHERE {where} ORDER BY v")]
    return {"formats": distinct("a.format"), "products": distinct("a.product"), "statuses": distinct("a.status")}


# ---------------------------------------------------------------- stats

def _pct_change(current: float, previous: float) -> int | None:
    if not previous:
        return None
    return round((current - previous) / previous * 100)


def _trend(value: int | None, good_when: str, compared_to: str, unit: str = "%") -> dict | None:
    if value is None or value == 0:
        return None
    good = value > 0 if good_when == "up" else value < 0
    return {"value": abs(value), "direction": "up" if value > 0 else "down", "good": good, "unit": unit,
            "compared_to": compared_to}


def stats(db: Db, view: str, now: datetime) -> list[dict]:
    if view == "my-ads":
        return my_ads_stats(db, now)
    if view == "queue":
        return queue_stats(db, now)
    return history_stats(db, now)


def my_ads_stats(db: Db, now: datetime) -> list[dict]:
    attention = db.scalar("SELECT COUNT(*) FROM ads WHERE is_mine = 1 AND status IN ('draft', 'changes_required')")
    in_review = db.scalar("SELECT COUNT(*) FROM ads WHERE is_mine = 1 AND status = 'pending'")
    approved = db.scalar("SELECT COUNT(*) FROM ads WHERE is_mine = 1 AND status IN ('approved', 'approved_with_changes') "
                         "AND closed_at >= ?", (iso(now - timedelta(days=30)),))
    return [
        {"key": "attention", "value": attention, "label": "need your attention", "tone": "warning", "icon": "attention"},
        {"key": "in_review", "value": in_review, "label": "in review", "tone": "primary", "icon": "clock"},
        {"key": "approved", "value": approved, "label": "approved this month", "tone": "success", "icon": "check"},
    ]


def reviewed_by_you(db: Db, start: datetime, end: datetime) -> int:
    return db.scalar(
        "SELECT COUNT(*) FROM events WHERE type = 'decision' AND at >= ? AND at < ? "
        "AND json_extract(detail, '$.by_you') = 1", (iso(start), iso(end)))


def queue_stats(db: Db, now: datetime) -> list[dict]:
    today = local_date(now).isoformat()
    waiting = pending_count(db)
    due_today = db.scalar("SELECT COUNT(*) FROM ads WHERE status = 'pending' AND due_date <= ?", (today,))
    week = reviewed_by_you(db, now - timedelta(days=7), now + timedelta(days=1))
    last_week = reviewed_by_you(db, now - timedelta(days=14), now - timedelta(days=7))
    return [
        {"key": "waiting", "value": waiting, "label": "waiting", "tone": "primary", "icon": "inbox"},
        {"key": "due_today", "value": due_today, "label": "due today", "tone": "warning", "icon": "calendar"},
        {"key": "reviewed", "value": week, "label": "you reviewed this week", "tone": "success", "icon": "check",
         "trend": _trend(_pct_change(week, last_week), "up", "vs. last week")},
    ]


def _closed_between(db: Db, start: datetime, end: datetime, statuses: tuple[str, ...]) -> list[dict]:
    marks = ", ".join("?" for _ in statuses)
    return db.all(
        f"""SELECT a.id, a.status, a.closed_at, a.current_version,
                   (SELECT MIN(v.submitted_at) FROM ad_versions v WHERE v.ad_id = a.id) AS first_submitted
            FROM ads a WHERE a.status IN ({marks}) AND a.closed_at >= ? AND a.closed_at < ?""",
        [*statuses, iso(start), iso(end)])


APPROVED = ("approved", "approved_with_changes")
DECIDED = ("approved", "approved_with_changes", "rejected")


def approved_in(db: Db, start: datetime, end: datetime) -> int:
    return len(_closed_between(db, start, end, APPROVED))


def average_turnaround_hours(db: Db, start: datetime, end: datetime) -> float | None:
    rows = [r for r in _closed_between(db, start, end, APPROVED) if r["first_submitted"]]
    if not rows:
        return None
    hours = [(parse_iso(r["closed_at"]) - parse_iso(r["first_submitted"])).total_seconds() / 3600 for r in rows]
    return round(sum(hours) / len(hours), 1)


def first_review_rate(db: Db, start: datetime, end: datetime) -> int | None:
    rows = _closed_between(db, start, end, DECIDED)
    if not rows:
        return None
    first = sum(1 for r in rows if r["status"] in APPROVED and r["current_version"] == 1)
    return round(first / len(rows) * 100)


def history_stats(db: Db, now: datetime) -> list[dict]:
    end = now + timedelta(days=1)
    week_start = now - timedelta(days=7)
    eight_weeks_ago = (now - timedelta(days=63), now - timedelta(days=56))

    approved = approved_in(db, week_start, end)
    approved_then = approved_in(db, *eight_weeks_ago)
    turnaround = average_turnaround_hours(db, week_start, end)
    turnaround_then = average_turnaround_hours(db, *eight_weeks_ago)
    first = first_review_rate(db, now - timedelta(days=30), end)
    first_then = first_review_rate(db, now - timedelta(days=60), now - timedelta(days=30))

    turnaround_trend = None
    if turnaround is not None and turnaround_then:
        turnaround_trend = _trend(_pct_change(turnaround, turnaround_then), "down", "vs. 8 weeks ago")
    first_trend = None
    if first is not None and first_then is not None:
        first_trend = _trend(first - first_then, "up", "vs. last month", unit="pts")

    return [
        {"key": "approved", "value": approved, "label": "approved this week", "tone": "success", "icon": "check",
         "trend": _trend(_pct_change(approved, approved_then), "up", "vs. 8 weeks ago")},
        {"key": "turnaround", "value": turnaround, "display": f"{turnaround}h" if turnaround is not None else "–",
         "label": "average turnaround", "tone": "primary", "icon": "timer", "trend": turnaround_trend},
        {"key": "first_review", "value": first, "display": f"{first}%" if first is not None else "–",
         "label": "approved on first review", "tone": "primary", "icon": "target", "trend": first_trend},
    ]
