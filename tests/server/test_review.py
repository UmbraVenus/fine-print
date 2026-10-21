import pytest

from server import actions, repo
from server.actions import ActionError

from .conftest import NOW


def current_findings(db, ad_id):
    return db.all("SELECT f.* FROM findings f JOIN ad_versions v ON v.id = f.ad_version_id JOIN ads a ON a.id = v.ad_id "
                  "WHERE a.id = ? AND v.version = a.current_version ORDER BY f.id", (ad_id,))


def test_keep_edit_dismiss_restore(db):
    rate = current_findings(db, 3)[0]
    assert actions.update_finding(db, rate["id"], "keep")["state"] == "kept"
    assert actions.update_finding(db, rate["id"], "unkeep")["state"] == "open"
    edited = actions.update_finding(db, rate["id"], "edit", text="Show the full APR range.")
    assert edited["state"] == "edited" and edited["edited_text"] == "Show the full APR range."
    with pytest.raises(ActionError):
        actions.update_finding(db, rate["id"], "dismiss", reason="  ")
    dismissed = actions.update_finding(db, rate["id"], "dismiss", reason="Legal approved it.")
    assert dismissed["state"] == "dismissed" and dismissed["dismiss_reason"] == "Legal approved it."
    assert actions.update_finding(db, rate["id"], "restore")["state"] == "open"


def test_dismissed_findings_leave_the_auto_check_count(db):
    for finding in current_findings(db, 6):
        actions.update_finding(db, finding["id"], "dismiss", reason="Not applicable")
    row = next(r for r in repo.list_ads(db, "queue")["rows"] if r["id"] == 6)
    assert row["critical"] == 0


def test_reviewer_findings(db):
    added = actions.add_reviewer_finding(db, 3, "Pick an image that doesn't suggest same-day cash.", NOW)
    assert added["origin"] == "reviewer" and added["severity"] is None
    assert actions.edit_reviewer_finding(db, added["id"], "New text")["text"] == "New text"
    actions.delete_reviewer_finding(db, added["id"])
    assert all(f["origin"] == "auto" for f in current_findings(db, 3))
    with pytest.raises(ActionError):
        actions.add_reviewer_finding(db, 3, "   ", NOW)


def test_request_changes_sends_kept_and_reviewer_findings(db):
    findings = current_findings(db, 3)
    actions.update_finding(db, findings[0]["id"], "keep")
    actions.add_reviewer_finding(db, 3, "Pick another photo.", NOW)
    with pytest.raises(ActionError):
        actions.decide(db, 3, "changes_required", "", NOW)
    order = repo.queue_order(db)
    result = actions.decide(db, 3, "changes_required", "Please fix the rate claim.", NOW)
    assert result["next"] == order[order.index(3) + 1]  # the next ad in the Queue's order
    ad = db.one("SELECT * FROM ads WHERE id = 3")
    assert ad["status"] == "changes_required" and ad["closed_at"] is None
    sent = [f for f in current_findings(db, 3) if f["sent_to_submitter"]]
    assert len(sent) == 2
    assert repo.pending_count(db) == 8


def test_approve_closes_and_undo_restores_everything(db):
    before_events = db.scalar("SELECT COUNT(*) FROM events WHERE ad_id = 5")
    result = actions.decide(db, 5, "approved", None, NOW)
    ad = db.one("SELECT * FROM ads WHERE id = 5")
    assert ad["status"] == "approved" and ad["closed_at"] == "2026-10-21T17:30:00Z"
    assert repo.history_stats(db, NOW)[0]["value"] >= 1
    actions.undo(db, result["undo"])
    ad = db.one("SELECT * FROM ads WHERE id = 5")
    assert ad["status"] == "pending" and ad["closed_at"] is None
    assert db.scalar("SELECT COUNT(*) FROM events WHERE ad_id = 5") == before_events
    with pytest.raises(ActionError):
        actions.undo(db, result["undo"])


def test_last_item_has_no_next(db):
    for ad_id in repo.queue_order(db)[:-1]:
        actions.decide(db, ad_id, "approved", None, NOW)
    last = repo.queue_order(db)[0]
    assert actions.decide(db, last, "approved", None, NOW)["next"] is None
    with pytest.raises(ActionError):
        actions.decide(db, last, "approved", None, NOW)


def test_decision_counts_toward_you_reviewed(db):
    before = repo.queue_stats(db, NOW)[2]["value"]
    actions.decide(db, 4, "approved", None, NOW)
    assert repo.queue_stats(db, NOW)[2]["value"] == before + 1


def test_approve_with_changes_turns_the_change_into_a_finding(db):
    result = actions.decide(db, 11, "approved_with_changes", "Add “See rates and fees” after the APR.", NOW)
    sent = [f for f in current_findings(db, 11) if f["sent_to_submitter"]]
    assert [f["text"] for f in sent] == ["Add “See rates and fees” after the APR."]
    actions.undo(db, result["undo"])
    assert current_findings(db, 11) == []


def test_quoted_words_in_a_reviewer_finding_pin_it_to_the_ad(db):
    # Fall personal loan's headline is "Personal loans as low as 7.99% APR".
    pinned = actions.add_reviewer_finding(db, 3, "Say “As low as 7.99% APR” only with the full range.", NOW)
    assert (pinned["layer_id"], pinned["quote"]) == ("headline", "as low as 7.99% APR")  # case forgiven, exact words kept
    # Words that aren't on the ad, or no quotation marks at all: plain text, as before.
    assert actions.add_reviewer_finding(db, 3, 'Add "then 20.24% variable APR" after it.', NOW)["layer_id"] is None
    assert actions.add_reviewer_finding(db, 3, "Pick another photo.", NOW)["quote"] is None
    # Editing re-reads the quote.
    edited = actions.edit_reviewer_finding(db, pinned["id"], "Pick another photo.")
    assert edited["layer_id"] is None and edited["quote"] is None
    repinned = actions.edit_reviewer_finding(db, pinned["id"], 'Reword "Checking your rate".')
    assert (repinned["layer_id"], repinned["quote"]) == ("body", "Checking your rate")


def test_changes_required_hands_an_internal_ad_to_marketing(db):
    def mine():
        return [r["id"] for r in repo.list_ads(db, "my-ads", page_size=50)["rows"]]

    assert 8 not in mine()  # Student card post, someone else's until it's sent back
    result = actions.decide(db, 8, "changes_required", "Add the APR.", NOW)
    assert 8 in mine() and repo.ad_detail(db, 8)["attention"] is not None
    actions.undo(db, result["undo"])
    assert 8 not in mine()
    # Affiliates don't log in, so their ads never land in My ads.
    actions.decide(db, 6, "changes_required", "Add the disclosure.", NOW)
    assert 6 not in mine()
