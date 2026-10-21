"""One seed for the first run (empty database) and for Reset sample data.

Every date is computed relative to `now`, and refresh() moves them forward each new day,
so the workspace never looks stale on the day it's viewed.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from . import filler
from .dates import add_business_days, at_local, iso, local_date, utcnow
from .db import Db
from .seed_data import ADS, FORMAT_TEMPLATES, RULES, rule_applies

TABLES = ["events", "findings", "check_runs", "ad_versions", "ads", "rules", "meta"]


class Clock:
    """Turns (days_ago, hour) into a real moment that is never in the future."""

    def __init__(self, now: datetime):
        self.now = now
        self.today = local_date(now)

    def at(self, when: tuple[int, int] | None) -> datetime | None:
        if when is None:
            return None
        days_ago, hour = when
        moment = at_local(self.today - timedelta(days=days_ago), hour)
        if moment > self.now:
            # Earlier today than the wireframe's hour: keep it today, a little before now.
            start_of_day = at_local(self.today, 0)
            moment = max(start_of_day, self.now - timedelta(minutes=10 + hour))
        return moment


def seed(db: Db, now: datetime | None = None) -> None:
    now = now or utcnow()
    clock = Clock(now)
    for table in TABLES:
        db.run(f"DELETE FROM {table}")

    for position, rule in enumerate(RULES):
        db.insert("rules", {
            **rule,
            "applies_to": json.dumps(rule["applies_to"]),
            "is_custom": False,
            "position": position,
            "created_at": iso(now - timedelta(days=90)),
        })

    for ad in ADS:
        _seed_ad(db, ad, clock)

    _seed_filler(db, now)

    db.run("INSERT INTO meta (key, value) VALUES ('anchor_date', ?)", (clock.today.isoformat(),))
    db.run("INSERT INTO meta (key, value) VALUES ('seeded_at', ?)", (iso(now),))
    db.commit()


def _counts(findings: list[dict]) -> dict:
    severities = [f["severity"] for f in findings if f.get("origin", "auto") == "auto"]
    return {"critical": severities.count("critical"), "caution": severities.count("caution")}


def _seed_ad(db: Db, ad: dict, clock: Clock) -> None:
    created = clock.at(ad["created"])
    updated = clock.at(ad["updated"])
    closed = clock.at(ad.get("closed"))
    live = clock.at(ad.get("live"))
    due = add_business_days(clock.today, ad["due"]) if "due" in ad else None
    rules = {r["id"]: r for r in RULES}
    applicable = [r["id"] for r in RULES if rule_applies(r, ad["product"], ad["source"])]

    db.insert("ads", {
        "id": ad["id"], "name": ad["name"], "format": ad["format"], "product": ad["product"],
        "source": ad["source"], "status": ad["status"], "current_version": len(ad["versions"]),
        "is_mine": ad.get("is_mine", False), "due_date": due.isoformat() if due else None,
        "created_at": iso(created), "updated_at": iso(updated),
        "closed_at": iso(closed) if closed else None, "live_since": iso(live) if live else None,
    })

    version_counts: dict[int, dict] = {}
    for number, version in enumerate(ad["versions"], start=1):
        submitted = clock.at(version["submitted"])
        checked = clock.at(version["check"]) or submitted or created
        version_id = db.insert("ad_versions", {
            "ad_id": ad["id"], "version": number,
            "template": FORMAT_TEMPLATES[ad["format"]],
            "theme": version["theme"], "layers": version["layers"],
            "submitted_at": iso(submitted) if submitted else None,
            "created_at": iso(submitted or created),
        })
        flagged = {f["rule_id"] for f in version["findings"] if f.get("rule_id")}
        run_id = db.insert("check_runs", {
            "ad_version_id": version_id, "kind": "seeded",
            "good_rule_ids": [rid for rid in applicable if rid not in flagged],
            "checks_run": len(applicable), "created_at": iso(checked),
        })
        findings = []
        for position, finding in enumerate(version["findings"]):
            origin = finding.get("origin", "auto")
            rule = rules.get(finding["rule_id"]) if finding["rule_id"] else None
            row = {
                "ad_version_id": version_id,
                "check_run_id": run_id if origin == "auto" else None,
                "origin": origin,
                "rule_id": finding["rule_id"],
                "severity": rule["severity"] if rule else None,
                "layer_id": finding["layer_id"],
                "quote": finding["quote"],
                "text": finding["text"],
                "fix_label": finding["fix_label"],
                "suggested_fix": finding["suggested_fix"],
                "state": finding.get("state", "open"),
                "dismiss_reason": finding.get("dismiss_reason"),
                "submitter_note": finding.get("submitter_note"),
                "sent_to_submitter": finding.get("sent", False),
                "position": position,
                "created_at": iso(checked),
            }
            _check_quote(ad, version, row)
            db.insert("findings", row)
            findings.append(row)
        version_counts[number] = _counts(findings)

    for event in ad["events"]:
        kind, when = event[0], clock.at(event[1])
        if kind == "check":
            context = event[2]
            number = 1 if context == "pre-check" and ad["status"] == "draft" else _version_at(ad, event[1])
            _event(db, ad["id"], when, "Auto check", "check_ran", {"context": context, "version": number, **version_counts[number]})
        elif kind in ("submitted", "resubmitted"):
            _event(db, ad["id"], when, "Marketer", kind, {"version": event[2]})
        elif kind == "decision":
            _event(db, ad["id"], when, "Reviewer", "decision", {"status": event[2], "message": event[3], "by_you": True,
                                                              "version": _version_at(ad, event[1])})
        elif kind == "live":
            _event(db, ad["id"], when, "Marketer", "went_live", {})


def _version_at(ad: dict, when: tuple[int, int]) -> int:
    """The newest version submitted at or before `when` (days_ago, hour)."""
    def key(moment: tuple[int, int]) -> tuple[int, int]:
        return (-moment[0], moment[1])

    number = 1
    for index, version in enumerate(ad["versions"], start=1):
        submitted = version["submitted"]
        if submitted and key(submitted) <= key(when):
            number = index
    return number


def _check_quote(ad: dict, version: dict, row: dict) -> None:
    if row["quote"] is None:
        return
    layer = next((l for l in version["layers"] if l["id"] == row["layer_id"]), None)
    if layer is None or row["quote"] not in layer["text"]:
        raise ValueError(f"Seeded quote {row['quote']!r} is not in layer {row['layer_id']!r} of {ad['name']}")


def _event(db: Db, ad_id: int, at: datetime, actor: str, type_: str, detail: dict) -> None:
    db.insert("events", {"ad_id": ad_id, "at": iso(at), "actor": actor, "type": type_, "detail": detail})


def _seed_filler(db: Db, now: datetime) -> None:
    rules = RULES
    ads = filler.generate(now, FORMAT_TEMPLATES)
    next_version = (db.scalar("SELECT MAX(id) FROM ad_versions") or 0) + 1
    next_run = (db.scalar("SELECT MAX(id) FROM check_runs") or 0) + 1
    ad_rows, version_rows, run_rows, finding_rows, event_rows = [], [], [], [], []

    for ad in ads:
        if ad["format"] == "Instagram post":
            ad["layers"][0]["text"] = "Paid partnership with ClearPath"
        applicable = [r["id"] for r in rules if rule_applies(r, ad["product"], ad["source"])]
        versions = [(1, ad["submitted"])]
        if not ad["first_pass"]:
            versions.append((2, ad["resubmitted"]))
        ad_rows.append((
            ad["id"], ad["name"], ad["format"], ad["product"], ad["source"], ad["status"], len(versions), 0, None,
            iso(ad["submitted"] - timedelta(hours=2)), iso(ad["closed"]), iso(ad["closed"]), None,
        ))
        events = []
        if ad["precheck"]:
            events.append((ad["submitted"] - timedelta(minutes=40), "Auto check", "check_ran",
                           {"context": "pre-check", "version": 1, "critical": 0, "caution": 0}))
        for number, submitted in versions:
            version_id = next_version
            next_version += 1
            version_rows.append((version_id, ad["id"], number, ad["template"], json.dumps(ad["theme"]),
                                 json.dumps(ad["layers"]), iso(submitted), iso(submitted)))
            run_rows.append((next_run, version_id, "seeded", json.dumps(applicable), len(applicable), iso(submitted)))
            next_run += 1
            events.append((submitted, "Marketer", "submitted" if number == 1 else "resubmitted", {"version": number}))
            events.append((submitted + timedelta(seconds=20), "Auto check", "check_ran",
                           {"context": "submit", "version": number, "critical": 0, "caution": 0}))
            if number == 1 and not ad["first_pass"]:
                finding_rows.append((version_id, "reviewer", ad["change_request"], 1, iso(ad["changes_at"])))
                events.append((ad["changes_at"], "Reviewer", "decision",
                               {"status": "changes_required", "message": ad["change_request"], "version": 1,
                                "by_you": ad["changes_by_you"]}))
            if number == len(versions):
                if ad["note"]:
                    finding_rows.append((version_id, "reviewer", ad["note"], 1, iso(ad["closed"])))
                events.append((ad["closed"], "Reviewer", "decision",
                               {"status": ad["status"], "message": ad["rejection"], "version": number,
                                "by_you": ad["by_you"]}))
        for at, actor, type_, detail in events:
            event_rows.append((ad["id"], iso(at), actor, type_, json.dumps(detail)))

    db.many("INSERT INTO ads (id, name, format, product, source, status, current_version, is_mine, due_date, "
            "created_at, updated_at, closed_at, live_since) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ad_rows)
    db.many("INSERT INTO ad_versions (id, ad_id, version, template, theme, layers, submitted_at, created_at) "
            "VALUES (?,?,?,?,?,?,?,?)", version_rows)
    db.many("INSERT INTO check_runs (id, ad_version_id, kind, good_rule_ids, checks_run, created_at) "
            "VALUES (?,?,?,?,?,?)", run_rows)
    db.many("INSERT INTO findings (ad_version_id, origin, text, sent_to_submitter, created_at) VALUES (?,?,?,?,?)",
            finding_rows)
    db.many("INSERT INTO events (ad_id, at, actor, type, detail) VALUES (?,?,?,?,?)", event_rows)


# ---------------------------------------------------------------- keeping dates current

TIMESTAMP_COLUMNS = {
    "rules": ["created_at"],
    "ads": ["created_at", "updated_at", "closed_at", "live_since"],
    "ad_versions": ["submitted_at", "created_at"],
    "check_runs": ["created_at"],
    "findings": ["created_at"],
    "events": ["at"],
}


def refresh(db: Db, now: datetime | None = None) -> int:
    """Move every date forward by the days since the workspace was last seen. Returns the shift in days."""
    now = now or utcnow()
    anchor = db.scalar("SELECT value FROM meta WHERE key = 'anchor_date'")
    if not anchor:
        return 0
    shift = (local_date(now) - date.fromisoformat(anchor)).days
    if shift <= 0:
        return 0
    modifier = f"+{shift} days"
    for table, columns in TIMESTAMP_COLUMNS.items():
        sets = ", ".join(f"{c} = strftime('%Y-%m-%dT%H:%M:%SZ', {c}, ?)" for c in columns)
        db.run(f"UPDATE {table} SET {sets}", [modifier] * len(columns))
    db.run("UPDATE ads SET due_date = date(due_date, ?) WHERE due_date IS NOT NULL", (modifier,))
    db.run("UPDATE meta SET value = ? WHERE key = 'anchor_date'", (local_date(now).isoformat(),))
    db.commit()
    return shift


def ensure_seeded(db: Db, now: datetime | None = None) -> None:
    if not db.scalar("SELECT value FROM meta WHERE key = 'seeded_at'"):
        seed(db, now)
    else:
        refresh(db, now)
