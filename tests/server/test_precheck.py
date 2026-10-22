import json

import pytest

from server import actions, repo
from server.actions import ActionError

from .conftest import NOW


def layers(db, ad_id, version):
    row = db.one("SELECT layers FROM ad_versions WHERE ad_id = ? AND version = ?", (ad_id, version))
    return json.loads(row["layers"])


def test_editing_a_draft_changes_it_in_place(db):
    copy = layers(db, 1, 1)
    copy[1]["text"] = "No annual fee. 21.24%–29.24% variable APR."
    detail = actions.save_copy(db, 1, copy, NOW)
    assert detail["version"] == 1
    assert layers(db, 1, 1)[1]["text"].endswith("variable APR.")


def test_layers_are_validated(db):
    copy = layers(db, 1, 1)
    with pytest.raises(ActionError):
        actions.save_copy(db, 1, copy[:-1], NOW)
    copy[0]["text"] = "  "
    with pytest.raises(ActionError):
        actions.save_copy(db, 1, copy, NOW)
    with pytest.raises(ActionError):
        actions.save_copy(db, 3, layers(db, 3, 1), NOW)  # pending: not editable


def test_submit_a_draft(db):
    result = actions.submit(db, 1, NOW)
    ad = db.one("SELECT * FROM ads WHERE id = 1")
    assert ad["status"] == "pending" and ad["current_version"] == 1
    assert ad["due_date"] == "2026-10-22" == result["due_date"]
    assert repo.pending_count(db) == 10
    types = [e["type"] for e in db.all("SELECT type FROM events WHERE ad_id = 1 ORDER BY id")]
    assert types[-2:] == ["submitted", "check_ran"]


def test_resubmitting_after_changes_makes_version_2_and_compares(db):
    copy = layers(db, 2, 1)
    copy[3]["text"] = "Roll this season's card balances into one fixed monthly payment. Fixed rates from 8.99% to 29.99% APR with autopay. Autopay is optional."
    detail = actions.save_copy(db, 2, copy, NOW)
    assert detail["version"] == 2 and detail["submitted_at"] is None
    assert db.one("SELECT current_version FROM ads WHERE id = 2")["current_version"] == 1  # still v1 until submit
    actions.submit(db, 2, NOW)
    ad = db.one("SELECT * FROM ads WHERE id = 2")
    assert ad["status"] == "pending" and ad["current_version"] == 2
    v2 = repo.ad_detail(db, 2)["current"]
    assert v2["check"]["kind"] == "compared"
    assert v2["findings"] == []  # the rate claim's quote is gone, so it's resolved
    assert "rate-claims" in v2["check"]["good_rule_ids"]
    assert [e["type"] for e in repo.ad_detail(db, 2)["events"]][:2] == ["check_ran", "resubmitted"]


def test_unfixed_suggestions_stay_open_on_resubmit(db):
    actions.submit(db, 2, NOW)
    v2 = repo.ad_detail(db, 2)["current"]
    assert [f["rule_id"] for f in v2["findings"]] == ["rate-claims"]


def test_full_loop_ends_in_history(db):
    actions.submit(db, 2, NOW)
    actions.decide(db, 2, "approved", None, NOW)
    history = repo.list_ads(db, "history", q="Holiday debt email")
    assert [r["name"] for r in history["rows"]] == ["Holiday debt email"]
    mine = {r["name"]: r["status"] for r in repo.list_ads(db, "my-ads")["rows"]}
    assert mine["Holiday debt email"] == "approved"


def test_notes_reach_the_reviewer(db):
    finding = repo.ad_detail(db, 1)["current"]["findings"][0]
    actions.update_finding(db, finding["id"], "note", note="Legal approved this wording.")
    actions.submit(db, 1, NOW)
    finding = repo.ad_detail(db, 1)["current"]["findings"][0]
    assert finding["submitter_note"] == "Legal approved this wording."


def test_submitter_marks_a_suggestion_resolved_and_the_reviewer_sees_it(db):
    from server import actions as a

    finding = repo.ad_detail(db, 1)["current"]["findings"][0]
    assert finding["resolved_by_submitter"] is False
    assert a.update_finding(db, finding["id"], "resolve")["resolved_by_submitter"] == 1
    a.submit(db, 1, NOW)
    after = next(f for f in repo.ad_detail(db, 1)["current"]["findings"] if f["id"] == finding["id"])
    assert after["resolved_by_submitter"] is True
    assert a.update_finding(db, finding["id"], "reopen")["resolved_by_submitter"] == 0


def test_seeded_wording_reads_correctly_in_place():
    from server.seed_data import ADS

    for ad in ADS:
        for version in ad["versions"]:
            texts = {l["id"]: l["text"] for l in version["layers"]}
            for f in version["findings"]:
                if f.get("suggested_fix") and f.get("quote"):
                    assert f["quote"] in texts[f["layer_id"]], (ad["name"], f["text"])
                if f.get("suggested_fix"):
                    # Only the words to use; the finding's own text already says what to change.
                    assert f["fix_label"] == "Suggested wording"
                    assert f["suggested_fix"].split()[0] not in {"Add", "Put", "Move", "Remove", "Make", "Show"}, f["suggested_fix"]


def test_precheck_steps_through_the_ads_that_need_attention(db):
    first, second = repo.attention_order(db)
    assert {first, second} == {1, 2}  # Cash back card (Draft) and Holiday debt email (Changes required)
    one = repo.ad_detail(db, first)["attention"]
    assert one == {"position": 1, "total": 2, "previous": None, "next": second}
    assert repo.ad_detail(db, second)["attention"]["previous"] == first
    # In My ads order: most recently updated first.
    rows = repo.list_ads(db, "my-ads")["rows"]
    listed = [r["id"] for r in rows if r["status"] in ("draft", "changes_required")]
    assert listed == [first, second]
    assert repo.ad_detail(db, 3)["attention"] is None


def test_a_too_small_disclosure_can_be_made_readable(db):
    actions.decide(db, 3, "changes_required", "Fix the disclosure.", NOW)
    layers = repo.ad_detail(db, 3)["current"]["layers"]
    tiny = next(l for l in layers if l["id"] == "disclosure")
    assert tiny["style"]["fontSize"] < actions.READABLE_SIZE
    with pytest.raises(ActionError):  # still too small
        actions.save_copy(db, 3, [{**l, "style": {"fontSize": 9}} if l["id"] == "disclosure" else l for l in layers], NOW)
    draft = actions.save_copy(db, 3, [{**l, "style": {"fontSize": 11}} if l["id"] == "disclosure" else l for l in layers], NOW)
    saved = next(l for l in draft["layers"] if l["id"] == "disclosure")
    assert saved["style"]["fontSize"] == 11 and saved["text"] == tiny["text"]
    # Resubmitted without a key: the size fix resolves "too small to read".
    actions.submit(db, 3, NOW)
    open_rules = {f["rule_id"] for f in repo.ad_detail(db, 3)["current"]["findings"] if f["origin"] == "auto"}
    assert "clear-and-conspicuous" not in open_rules
    assert "rate-claims" in open_rules  # the words weren't touched


def test_applying_a_suggestion_resolves_it_on_the_new_draft(db):
    actions.decide(db, 3, "changes_required", "Fix the rate.", NOW)
    layers = repo.ad_detail(db, 3)["current"]["layers"]
    swapped = [{**l, "text": l["text"].replace("as low as 7.99% APR", "from 7.99% to 29.99% APR with autopay")}
               if l["id"] == "headline" else l for l in layers]
    draft = actions.save_copy(db, 3, swapped, NOW, resolve={"rule_id": "rate-claims", "layer_id": "headline"})
    by_rule = {f["rule_id"]: f for f in draft["findings"] if f["origin"] == "auto"}
    assert by_rule["rate-claims"]["resolved_by_submitter"] is True
    assert by_rule["credit-score-claims"]["resolved_by_submitter"] is False


def test_marks_and_notes_survive_the_first_edit(db):
    actions.decide(db, 2, "changes_required", "Fix it.", NOW) if repo.ad_detail(db, 2)["ad"]["status"] == "pending" else None
    current = repo.ad_detail(db, 2)["current"]
    rate = next(f for f in current["findings"] if f["rule_id"] == "rate-claims")
    actions.update_finding(db, rate["id"], "resolve")
    actions.update_finding(db, rate["id"], "note", note="Legal signed off.")
    layers = [{**l, "text": l["text"] + " "} for l in current["layers"]]
    layers[0]["text"] = current["layers"][0]["text"] + " today"
    draft = actions.save_copy(db, 2, layers, NOW)
    copied = next(f for f in draft["findings"] if f["rule_id"] == "rate-claims")
    assert copied["resolved_by_submitter"] is True and copied["submitter_note"] == "Legal signed off."

