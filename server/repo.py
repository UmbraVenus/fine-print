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
DEFAULT_SORT = {"my-ads": ("date", "desc"), "queue": ("second", "desc"), "history": ("date", "desc")}

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
             order: str | None = None, page: int = 1, page_size: int = 10, due_by: str | None = None) -> dict:
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
    if due_by:
        # "Due today" counts anything due by today, as the Queue's stat card does.
        where.append("a.due_date <= ?")
        params.append(due_by)
    outer = ""
    if auto_check:
        clauses = [AUTO_CHECK_FILTER[k] for k in auto_check if k in AUTO_CHECK_FILTER]
        if clauses:
            outer = " WHERE " + " OR ".join(f"({c})" for c in clauses)

    sort_key, sort_order = DEFAULT_SORT[view]
    if sort in ("name", "date") or (sort == "check" and view == "queue") or (sort == "second" and view != "history"):
        sort_key = sort
        sort_order = "asc" if order == "asc" else "desc"
    direction = "ASC" if sort_order == "asc" else "DESC"
    if sort_key == "name":
        order_by = f"name COLLATE NOCASE {direction}, id"
    elif sort_key == "second" and view == "my-ads":
        # Due dates belong to ads in review; the rest have none and go last.
        order_by = f"(status != 'pending'), due_date {direction}, updated_at DESC, id"
    elif sort_key == "second":
        order_by = f"updated_at {direction}, id {direction}"
    elif sort_key == "check":
        # Most serious first (descending): Critical counts, then Caution, then the due date.
        order_by = f"critical {direction}, caution {direction}, due_date ASC, name COLLATE NOCASE ASC, id"
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
    """The Queue's own order, most recently updated first, so Review's "3 of 9" matches the table."""
    return [r["id"] for r in db.all("SELECT id FROM ads WHERE status = 'pending' ORDER BY updated_at DESC, id DESC")]


def attention_order(db: Db) -> list[int]:
    """The marketer's to-do list (drafts and ads that need changes), in My ads order."""
    return [r["id"] for r in db.all("SELECT id FROM ads WHERE is_mine = 1 AND status IN ('draft', 'changes_required') "
                                     "ORDER BY updated_at DESC, id DESC")]


def _position(order: list[int], ad_id: int) -> dict:
    index = order.index(ad_id)
    return {
        "position": index + 1,
        "total": len(order),
        "previous": order[index - 1] if index > 0 else None,
        "next": order[index + 1] if index + 1 < len(order) else None,
    }


def pending_count(db: Db) -> int:
    return db.scalar("SELECT COUNT(*) FROM ads WHERE status = 'pending'")


def filter_options(db: Db, view: str) -> dict:
    where = VIEW_WHERE[view]
    def distinct(column: str) -> list[str]:
        return [r["v"] for r in db.all(f"SELECT DISTINCT {column} AS v FROM ads a WHERE {where} ORDER BY v")]
    formats = [r["v"] for r in db.all("SELECT DISTINCT format AS v FROM ads")]
    return {"formats": formats, "products": distinct("a.product"), "statuses": distinct("a.status")}


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
    """Ads you made a decision on: an ad you sent back twice counts once."""
    return db.scalar(
        "SELECT COUNT(DISTINCT ad_id) FROM events WHERE type = 'decision' AND at >= ? AND at < ? "
        "AND json_extract(detail, '$.by_you') = 1", (iso(start), iso(end)))


def queue_stats(db: Db, now: datetime) -> list[dict]:
    today = local_date(now).isoformat()
    waiting = pending_count(db)
    due_today = db.scalar("SELECT COUNT(*) FROM ads WHERE status = 'pending' AND due_date <= ?", (today,))
    week = reviewed_by_you(db, now - timedelta(days=7), now + timedelta(days=1))
    return [
        {"key": "waiting", "value": waiting, "label": "waiting", "tone": "primary", "icon": "inbox"},
        {"key": "due_today", "value": due_today, "label": "due today", "tone": "warning", "icon": "calendar"},
        # Just the number: the trends live on Insights.
        {"key": "reviewed", "value": week, "label": "you reviewed this week", "tone": "success", "icon": "check"},
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
        # Percentage points: the difference between the two rates, with last month's rate to read it against.
        first_trend = _trend(first - first_then, "up", f"vs. {first_then}% last month", unit="pts")

    return [
        {"key": "approved", "value": approved, "label": "approved this week", "tone": "success", "icon": "check",
         "trend": _trend(_pct_change(approved, approved_then), "up", "vs. 8 weeks ago")},
        {"key": "turnaround", "value": turnaround, "display": f"{turnaround}h" if turnaround is not None else "–",
         "label": "average turnaround", "tone": "primary", "icon": "timer", "trend": turnaround_trend},
        {"key": "first_review", "value": first, "display": f"{first}%" if first is not None else "–",
         "label": "approved on first review", "tone": "primary", "icon": "target", "trend": first_trend},
    ]


# ---------------------------------------------------------------- one ad

def rules(db: Db) -> list[dict]:
    rows = db.all("SELECT * FROM rules ORDER BY position, created_at")
    for row in rows:
        row["applies_to"] = json.loads(row["applies_to"])
        row["is_custom"] = bool(row["is_custom"])
    return rows


def _findings(db: Db, version_id: int) -> list[dict]:
    rows = db.all("SELECT * FROM findings WHERE ad_version_id = ? ORDER BY origin, position, id", (version_id,))
    for row in rows:
        row["sent_to_submitter"] = bool(row["sent_to_submitter"])
        row["resolved_by_submitter"] = bool(row["resolved_by_submitter"])
    return rows


def _check(db: Db, version_id: int) -> dict | None:
    run = db.one("SELECT * FROM check_runs WHERE ad_version_id = ? ORDER BY id DESC LIMIT 1", (version_id,))
    if run:
        run["good_rule_ids"] = json.loads(run["good_rule_ids"])
    return run


def version_detail(db: Db, version: dict) -> dict:
    version = dict(version)
    version["theme"] = json.loads(version["theme"])
    version["layers"] = json.loads(version["layers"])
    version["findings"] = _findings(db, version["id"])
    version["check"] = _check(db, version["id"])
    return version


def ad_detail(db: Db, ad_id: int) -> dict | None:
    ad = db.one("SELECT * FROM ads WHERE id = ?", (ad_id,))
    if not ad:
        return None
    ad["is_mine"] = bool(ad["is_mine"])
    versions = [version_detail(db, v) for v in db.all(
        "SELECT * FROM ad_versions WHERE ad_id = ? ORDER BY version", (ad_id,))]
    current = next(v for v in versions if v["version"] == ad["current_version"])
    draft = next((v for v in versions if v["version"] > ad["current_version"]), None)
    events = db.all("SELECT * FROM events WHERE ad_id = ? ORDER BY at DESC, id DESC", (ad_id,))
    for event in events:
        event["detail"] = json.loads(event["detail"])
    detail = {
        "ad": ad,
        "versions": [v for v in versions if v["version"] <= ad["current_version"]],
        "current": current,
        "draft": draft,
        "events": events,
        "rules": rules(db),
        "queue": None,
        "attention": None,
    }
    if ad["status"] == "pending":
        detail["queue"] = _position(queue_order(db), ad_id)
    attention = attention_order(db)
    if ad_id in attention:
        detail["attention"] = _position(attention, ad_id)
    return detail


# ---------------------------------------------------------------- insights

INSIGHT_WEEKS = 9  # the 8 weeks with Fine Print, plus the week before it as the baseline
WORKING_DAY_HOURS = 8


def _week(now: datetime, weeks_ago: int) -> tuple[datetime, datetime]:
    """Rolling week `weeks_ago` (0 = the last 7 days), as on History."""
    end = now + timedelta(days=1) if weeks_ago == 0 else now - timedelta(days=7 * weeks_ago)
    return now - timedelta(days=7 * (weeks_ago + 1)), end


def rounds_per_ad(db: Db, start: datetime, end: datetime) -> float | None:
    rows = _closed_between(db, start, end, APPROVED)
    return round(sum(r["current_version"] for r in rows) / len(rows), 1) if rows else None


def _duration(hours: float) -> str:
    if hours >= 2 * WORKING_DAY_HOURS:
        return f"about {round(hours / WORKING_DAY_HOURS)} working days"
    return f"about {round(hours)} hours"


def insights(db: Db, now: datetime) -> dict:
    """The throughput story, all from the database: now against the week before Fine Print."""
    weeks = [_week(now, w) for w in reversed(range(INSIGHT_WEEKS))]  # oldest first
    approved = [approved_in(db, *w) for w in weeks]
    turnaround = [average_turnaround_hours(db, *w) for w in weeks]
    rounds = [rounds_per_ad(db, *w) for w in weeks]
    first_by_week = [first_review_rate(db, *w) for w in weeks]
    first = first_review_rate(db, now - timedelta(days=30), now + timedelta(days=1))
    first_then = first_review_rate(db, now - timedelta(days=60), now - timedelta(days=30))

    metrics = []
    base, latest = approved[0], approved[-1]
    metrics.append({
        "key": "approved", "label": "More ads approved per week", "value": latest, "display": str(latest),
        "trend": _trend(_pct_change(latest, base), "up", "vs. before using Fine Print"),
        "note": f"{'Up' if latest >= base else 'Down'} from {base} before using Fine Print",
        "series": approved,
    })
    base_t, latest_t = turnaround[0], turnaround[-1]
    if latest_t is not None and base_t:
        saved = round(base_t - latest_t)
        metrics.append({
            "key": "turnaround", "label": "Time saved per ad", "value": latest_t,
            "display": f"{saved}h" if saved > 0 else f"{latest_t}h",
            "trend": _trend(_pct_change(latest_t, base_t), "down", "vs. before using Fine Print"),
            "note": f"From {_duration(base_t)} to {latest_t} hours, submit to approval" if saved > 0
            else f"Submit to approval, against {_duration(base_t)} before",
            "series": turnaround,
        })
    base_r, latest_r = rounds[0], rounds[-1]
    if latest_r and base_r:
        metrics.append({
            # How many times fewer rounds an ad needs; the number already says the direction.
            "key": "rounds", "label": "Review efficiency", "value": latest_r,
            "display": f"{round(base_r / latest_r, 1)}×", "trend": None,
            "note": f"Ads now clear in {latest_r} rounds, down from about {round(base_r)}",
            "series": rounds,
        })
    if first is not None and first_then is not None:
        change = first - first_then
        movement = "up from" if change > 0 else "down from" if change < 0 else "the same as"
        metrics.append({
            "key": "first_round", "label": "Right the first time", "value": first, "display": f"{first}%",
            "trend": _trend(change, "up", f"vs. {first_then}% last month", unit="pts"),
            "note": f"Approved in round 1, {movement} {first_then}% last month",
            "series": first_by_week,
        })

    # What the auto check flags most, over the 8 weeks.
    start = weeks[1][0]
    counts = db.all(
        """SELECT f.rule_id, r.name, COUNT(*) AS n FROM findings f
           JOIN ad_versions v ON v.id = f.ad_version_id JOIN rules r ON r.id = f.rule_id
           WHERE f.origin = 'auto' AND v.submitted_at >= ? GROUP BY f.rule_id, r.name ORDER BY n DESC, r.name""",
        (iso(start),))
    total = sum(c["n"] for c in counts)
    issues = [{"rule_id": c["rule_id"], "name": c["name"], "share": round(c["n"] / total * 100)} for c in counts[:4]] if total else []

    # Each affiliate publisher's score: the share of its ads approved in round 1.
    publishers = db.all(
        """SELECT source, COUNT(*) AS n, SUM(current_version = 1) AS first FROM ads
           WHERE source != 'internal' AND status IN ('approved', 'approved_with_changes', 'rejected')
             AND closed_at >= ? GROUP BY source""", (iso(start),))
    affiliates = []
    for p in publishers:
        score = round(p["first"] / p["n"] * 100)
        status = "good" if score >= 85 else "watch" if score >= 60 else "at_risk"
        affiliates.append({"source": p["source"], "score": score, "ads": p["n"], "status": status})
    affiliates.sort(key=lambda a: (a["score"], a["source"]))
    return {"metrics": metrics, "issues": issues, "affiliates": affiliates}
