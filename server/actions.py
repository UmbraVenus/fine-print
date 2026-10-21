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
