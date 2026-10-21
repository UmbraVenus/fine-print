"""Write side: what reviewers and marketers do to an ad."""

from __future__ import annotations

import json
import secrets
from datetime import datetime

from . import repo
from .dates import iso
from .db import Db

DECISIONS = ("approved", "approved_with_changes", "changes_required", "rejected")
# Decisions that send the kept suggestions and the reviewer's findings to the submitter.
SENDS_FINDINGS = ("approved_with_changes", "changes_required", "rejected")


class ActionError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _ad(db: Db, ad_id: int) -> dict:
    ad = db.one("SELECT * FROM ads WHERE id = ?", (ad_id,))
    if not ad:
        raise ActionError("Ad not found", 404)
    return ad


def _current_version(db: Db, ad: dict) -> dict:
    return db.one("SELECT * FROM ad_versions WHERE ad_id = ? AND version = ?", (ad["id"], ad["current_version"]))


def _finding(db: Db, finding_id: int) -> dict:
    finding = db.one("SELECT * FROM findings WHERE id = ?", (finding_id,))
    if not finding:
        raise ActionError("Finding not found", 404)
    return finding


def _event(db: Db, ad_id: int, now: datetime, actor: str, type_: str, detail: dict) -> int:
    return db.insert("events", {"ad_id": ad_id, "at": iso(now), "actor": actor, "type": type_, "detail": detail})


def _clean(text: str | None, field: str, limit: int = 1000) -> str:
    value = (text or "").strip()
    if not value:
        raise ActionError(f"{field} can't be empty")
    return value[:limit]


# ---------------------------------------------------------------- reviewer: suggestions

def update_finding(db: Db, finding_id: int, action: str, *, text: str | None = None, reason: str | None = None,
                   note: str | None = None) -> dict:
    finding = _finding(db, finding_id)
    if action == "keep":
        db.update("findings", finding_id, {"state": "kept"})
    elif action == "unkeep":
        db.update("findings", finding_id, {"state": "open", "edited_text": None})
    elif action == "edit":
        db.update("findings", finding_id, {"state": "edited", "edited_text": _clean(text, "The text")})
    elif action == "dismiss":
        db.update("findings", finding_id, {"state": "dismissed", "dismiss_reason": _clean(reason, "A reason")})
    elif action == "restore":
        db.update("findings", finding_id, {"state": "open", "dismiss_reason": None})
    elif action == "note":
        value = (note or "").strip() or None
        db.update("findings", finding_id, {"submitter_note": value[:1000] if value else None})
    else:
        raise ActionError(f"Unknown action {action}")
    db.commit()
    return _finding(db, finding_id) | {"previous_state": finding["state"]}


# ---------------------------------------------------------------- reviewer: own findings

def add_reviewer_finding(db: Db, ad_id: int, text: str | None, now: datetime) -> dict:
    ad = _ad(db, ad_id)
    version = _current_version(db, ad)
    position = (db.scalar("SELECT MAX(position) FROM findings WHERE ad_version_id = ? AND origin = 'reviewer'",
                          (version["id"],)) or 0) + 1
    finding_id = db.insert("findings", {
        "ad_version_id": version["id"], "origin": "reviewer", "text": _clean(text, "The finding"),
        "state": "open", "position": position, "created_at": iso(now),
    })
    db.commit()
    return _finding(db, finding_id)


def edit_reviewer_finding(db: Db, finding_id: int, text: str | None) -> dict:
    finding = _finding(db, finding_id)
    if finding["origin"] != "reviewer":
        raise ActionError("Only your own findings can be edited this way")
    db.update("findings", finding_id, {"text": _clean(text, "The finding")})
    db.commit()
    return _finding(db, finding_id)


def delete_reviewer_finding(db: Db, finding_id: int) -> None:
    finding = _finding(db, finding_id)
    if finding["origin"] != "reviewer":
        raise ActionError("Only your own findings can be deleted")
    db.run("DELETE FROM findings WHERE id = ?", (finding_id,))
    db.commit()


# ---------------------------------------------------------------- reviewer: decisions

def decide(db: Db, ad_id: int, status: str, message: str | None, now: datetime) -> dict:
    if status not in DECISIONS:
        raise ActionError(f"Unknown decision {status}")
    ad = _ad(db, ad_id)
    if ad["status"] != "pending":
        raise ActionError("This ad isn't waiting for a decision anymore", 409)
    if status in ("changes_required", "rejected") and not (message or "").strip():
        raise ActionError("Add a short message for the submitter")
    version = _current_version(db, ad)
    order = repo.queue_order(db)

    findings = db.all("SELECT id, sent_to_submitter FROM findings WHERE ad_version_id = ?", (version["id"],))
    snapshot = {
        "ad_id": ad_id,
        "ad": {k: ad[k] for k in ("status", "closed_at", "updated_at", "live_since", "due_date")},
        "sent": {str(f["id"]): f["sent_to_submitter"] for f in findings},
    }

    if status == "approved_with_changes" and (message or "").strip():
        # The change to make, typed in the decision dialog, becomes one of the reviewer's findings.
        position = (db.scalar("SELECT MAX(position) FROM findings WHERE ad_version_id = ? AND origin = 'reviewer'",
                              (version["id"],)) or 0) + 1
        snapshot["created_finding"] = db.insert("findings", {
            "ad_version_id": version["id"], "origin": "reviewer", "text": _clean(message, "The change"),
            "state": "open", "position": position, "created_at": iso(now),
        })
        message = None
    if status in SENDS_FINDINGS:
        db.run("""UPDATE findings SET sent_to_submitter = 1 WHERE ad_version_id = ?
                  AND (origin = 'reviewer' OR state IN ('kept', 'edited'))""", (version["id"],))
    closed = None if status == "changes_required" else iso(now)
    db.update("ads", ad_id, {"status": status, "closed_at": closed, "updated_at": iso(now)})
    event_id = _event(db, ad_id, now, "Reviewer", "decision", {
        "status": status, "message": (message or "").strip() or None,
        "version": ad["current_version"], "by_you": True,
    })
    snapshot["event_id"] = event_id

    token = secrets.token_urlsafe(12)
    db.run("INSERT INTO meta (key, value) VALUES (?, ?)", (f"undo:{token}", json.dumps(snapshot)))
    db.commit()

    remaining = set(repo.queue_order(db))
    index = order.index(ad_id)
    following = [i for i in order[index + 1:] + order[:index] if i in remaining]
    return {"undo": token, "next": following[0] if following else None, "status": status}


def undo(db: Db, token: str) -> dict:
    raw = db.scalar("SELECT value FROM meta WHERE key = ?", (f"undo:{token}",))
    if not raw:
        raise ActionError("This can't be undone anymore", 410)
    snapshot = json.loads(raw)
    ad_id = snapshot["ad_id"]
    db.update("ads", ad_id, snapshot["ad"])
    for finding_id, sent in snapshot["sent"].items():
        db.run("UPDATE findings SET sent_to_submitter = ? WHERE id = ?", (sent, int(finding_id)))
    db.run("DELETE FROM events WHERE id = ?", (snapshot["event_id"],))
    if snapshot.get("created_finding"):
        db.run("DELETE FROM findings WHERE id = ?", (snapshot["created_finding"],))
    db.run("DELETE FROM meta WHERE key = ?", (f"undo:{token}",))
    db.commit()
    return {"ad_id": ad_id}


# ---------------------------------------------------------------- marketer: pre-check and submit

def _working_version(db: Db, ad: dict, create: bool) -> dict | None:
    """The version the marketer is editing: the draft itself, or a new unsubmitted version after changes."""
    current = _current_version(db, ad)
    if current["submitted_at"] is None:
        return current
    draft = db.one("SELECT * FROM ad_versions WHERE ad_id = ? AND version = ?", (ad["id"], ad["current_version"] + 1))
    if draft or not create:
        return draft
    draft_id = db.insert("ad_versions", {
        "ad_id": ad["id"], "version": ad["current_version"] + 1, "template": current["template"],
        "theme": current["theme"], "layers": current["layers"], "submitted_at": None, "created_at": current["created_at"],
    })
    # The draft starts from the last check, so suggestions and notes carry on while the copy changes.
    run = db.one("SELECT * FROM check_runs WHERE ad_version_id = ? ORDER BY id DESC LIMIT 1", (current["id"],))
    if run:
        run_id = db.insert("check_runs", {
            "ad_version_id": draft_id, "kind": run["kind"], "good_rule_ids": run["good_rule_ids"],
            "checks_run": run["checks_run"], "created_at": run["created_at"], "error": None,
        })
        for f in db.all("SELECT * FROM findings WHERE ad_version_id = ? AND origin = 'auto' AND state != 'dismissed'",
                        (current["id"],)):
            copy = {k: f[k] for k in ("origin", "rule_id", "severity", "layer_id", "quote", "text", "fix_label",
                                      "suggested_fix", "position", "created_at")}
            db.insert("findings", {**copy, "ad_version_id": draft_id, "check_run_id": run_id, "state": "open"})
    return db.one("SELECT * FROM ad_versions WHERE id = ?", (draft_id,))


def _validate_layers(version: dict, layers: list) -> list[dict]:
    known = {l["id"]: l for l in json.loads(version["layers"])}
    if not isinstance(layers, list):
        raise ActionError("Layers must be a list")
    cleaned = []
    for layer in layers:
        if not isinstance(layer, dict) or layer.get("id") not in known:
            raise ActionError("Unknown layer")
        text = str(layer.get("text", "")).strip()
        if not text:
            raise ActionError("A text layer can't be empty")
        cleaned.append({**known[layer["id"]], "text": text[:2000]})
    if [l["id"] for l in cleaned] != list(known):
        raise ActionError("Send every layer, in order")
    return cleaned


def save_copy(db: Db, ad_id: int, layers: list, now: datetime) -> dict:
    ad = _ad(db, ad_id)
    if ad["status"] not in ("draft", "changes_required"):
        raise ActionError("Only drafts and ads that need changes can be edited", 409)
    version = _working_version(db, ad, create=True)
    db.update("ad_versions", version["id"], {"layers": _validate_layers(version, layers)})
    db.update("ads", ad_id, {"updated_at": iso(now)})
    db.commit()
    return repo.version_detail(db, db.one("SELECT * FROM ad_versions WHERE id = ?", (version["id"],)))


def compare_with_previous(db: Db, version_id: int, now: datetime) -> int:
    """
    Without a live check, carry the last check forward: a suggestion whose quoted words are no longer
    in the copy counts as fixed. Suggestions about something missing stay until a real check runs.
    """
    version = db.one("SELECT * FROM ad_versions WHERE id = ?", (version_id,))
    layers = {l["id"]: l["text"] for l in json.loads(version["layers"])}
    run = db.one("SELECT * FROM check_runs WHERE ad_version_id = ? ORDER BY id DESC LIMIT 1", (version_id,))
    good = set(json.loads(run["good_rule_ids"])) if run else set()
    checks_run = run["checks_run"] if run else 0
    findings = db.all("SELECT * FROM findings WHERE ad_version_id = ? AND origin = 'auto'", (version_id,))
    run_id = db.insert("check_runs", {"ad_version_id": version_id, "kind": "compared", "good_rule_ids": [],
                                      "checks_run": checks_run, "created_at": iso(now)})
    remaining: set[str] = set()
    for f in findings:
        text = layers.get(f["layer_id"]) if f["layer_id"] else None
        fixed = f["quote"] is not None and (text is None or f["quote"] not in text)
        if fixed:
            db.run("DELETE FROM findings WHERE id = ?", (f["id"],))
        else:
            db.update("findings", f["id"], {"check_run_id": run_id})
            remaining.add(f["rule_id"])
    flagged_before = {f["rule_id"] for f in findings}
    good |= flagged_before - remaining
    db.update("check_runs", run_id, {"good_rule_ids": sorted(good)})
    return run_id


def _counts(db: Db, version_id: int) -> dict:
    rows = db.all("SELECT severity FROM findings WHERE ad_version_id = ? AND origin = 'auto' AND state != 'dismissed'",
                  (version_id,))
    severities = [r["severity"] for r in rows]
    return {"critical": severities.count("critical"), "caution": severities.count("caution")}


def submit(db: Db, ad_id: int, now: datetime, live_check=None) -> dict:
    """Submit (or resubmit) the marketer's copy. The auto check never blocks this."""
    from .dates import due_after_submit

    ad = _ad(db, ad_id)
    if ad["status"] not in ("draft", "changes_required"):
        raise ActionError("This ad is already with a reviewer", 409)
    resubmit = ad["status"] == "changes_required"
    version = _working_version(db, ad, create=True)
    number = version["version"]
    db.update("ad_versions", version["id"], {"submitted_at": iso(now), "created_at": iso(now)})
    db.update("ads", ad_id, {
        "status": "pending", "current_version": number, "updated_at": iso(now), "closed_at": None,
        "due_date": due_after_submit(now).isoformat(),
    })
    _event(db, ad_id, now, "Marketer", "resubmitted" if resubmit else "submitted", {"version": number})
    db.commit()

    check = live_check(version["id"]) if live_check else None
    if (check is None or check.get("status") != "ok") and resubmit:
        compare_with_previous(db, version["id"], now)
    _event(db, ad_id, now, "Auto check", "check_ran", {"context": "submit", "version": number,
                                                        **_counts(db, version["id"])})
    db.commit()
    return {"ad_id": ad_id, "version": number, "due_date": due_after_submit(now).isoformat()}


def checkable_version(db: Db, version_id: int) -> int:
    """Re-check only ever touches the marketer's working copy, never a version a reviewer has seen."""
    version = db.one("SELECT * FROM ad_versions WHERE id = ?", (version_id,))
    if not version:
        raise ActionError("Version not found", 404)
    ad = _ad(db, version["ad_id"])
    if version["submitted_at"] is None:
        return version_id
    if ad["status"] == "changes_required" and version["version"] == ad["current_version"]:
        working = _working_version(db, ad, create=True)
        db.commit()
        return working["id"]
    raise ActionError("Only a draft or a returned ad can be re-checked", 409)


# ---------------------------------------------------------------- reviewer: rules

CATEGORIES = ("Claims", "Required elements", "Presentation")
APPLIES = ("personal_loan", "credit_card", "mortgage", "affiliate")


def add_rule(db: Db, data: dict, now: datetime) -> dict:
    """A reviewer's rule. Live checks use it from now on; seeded results stay as they were."""
    import re

    name = _clean(data.get("name"), "The rule name", 80)
    category = data.get("category")
    if category not in CATEGORIES:
        raise ActionError("Pick a category")
    severity = data.get("severity")
    if severity not in ("critical", "caution"):
        raise ActionError("Pick Critical or Caution")
    applies = data.get("applies_to")
    if not isinstance(applies, list) or not applies or any(a not in APPLIES for a in applies):
        raise ActionError("Pick at least one thing it applies to")
    if db.scalar("SELECT COUNT(*) FROM rules WHERE lower(name) = lower(?)", (name,)):
        raise ActionError("A rule with that name already exists", 409)
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "rule"
    rule_id = f"custom-{slug}"
    suffix = 2
    while db.scalar("SELECT COUNT(*) FROM rules WHERE id = ?", (rule_id,)):
        rule_id = f"custom-{slug}-{suffix}"
        suffix += 1
    position = (db.scalar("SELECT MAX(position) FROM rules") or 0) + 1
    db.insert("rules", {
        "id": rule_id, "name": name, "category": category, "severity": severity,
        "description": _clean(data.get("description"), "What it checks", 400),
        "applies_to": [a for a in APPLIES if a in applies],
        "dont_example": _clean(data.get("dont_example"), "The Don't example", 200),
        "do_example": _clean(data.get("do_example"), "The Do example", 200),
        "is_custom": True, "position": position, "created_at": iso(now),
    })
    db.commit()
    return next(r for r in repo.rules(db) if r["id"] == rule_id)
