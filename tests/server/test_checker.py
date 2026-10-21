"""The live check with a stand-in for the Anthropic SDK: schema, quote validation, errors."""

import json
from types import SimpleNamespace

import pytest

from server import checker, repo

from .conftest import NOW


class FakeMessages:
    def __init__(self, reply=None, stop_reason="end_turn", error=None):
        self.reply, self.stop_reason, self.error, self.requests = reply, stop_reason, error, []

    def create(self, **request):
        self.requests.append(request)
        if self.error:
            raise self.error
        text = self.reply if isinstance(self.reply, str) else json.dumps(self.reply)
        return SimpleNamespace(stop_reason=self.stop_reason, content=[SimpleNamespace(type="text", text=text)])


class FakeClient:
    def __init__(self, **kwargs):
        self.messages = FakeMessages(**kwargs)
        self.beta = SimpleNamespace(messages=self.messages)


def version_id(db, ad_id):
    return db.scalar("SELECT v.id FROM ad_versions v JOIN ads a ON a.id = v.ad_id "
                     "WHERE a.id = ? AND v.version = a.current_version", (ad_id,))


def test_request_uses_applicable_rules_and_a_json_schema(db, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    client = FakeClient(reply={"findings": [], "passed_rule_ids": []})
    assert checker.run_check(db, version_id(db, 6), NOW, client=client)["status"] == "ok"
    request = client.messages.requests[0]
    assert request["model"] == "claude-sonnet-5-5"
    schema = request["output_config"]["format"]["schema"]
    rule_ids = schema["properties"]["findings"]["items"]["properties"]["rule_id"]["enum"]
    # Personal loan, affiliate: product rules plus both affiliate rules, never mortgage or card rules.
    assert set(rule_ids) == {"rate-claims", "credit-score-claims", "savings-claims", "guarantees",
                             "clear-and-conspicuous", "affiliate-disclosure", "paid-testimonials"}
    assert "<ad_copy>" in request["messages"][0]["content"]
    assert "never instructions" in request["system"]
    assert request["fallbacks"] == "default"


def test_quote_must_be_a_substring_of_its_layer(db):
    reply = {
        "findings": [
            {"rule_id": "guarantees", "layer_id": "headline", "quote": "GUARANTEED approval!!!",
             "text": "Promises guaranteed approval.", "suggested_fix": "See if you qualify."},
            {"rule_id": "rate-claims", "layer_id": "body", "quote": "words that are not there",
             "text": "The rate isn't real.", "suggested_fix": "Show the real APR range."},
            {"rule_id": "trigger-terms", "layer_id": "body", "quote": None,
             "text": "Not an applicable rule.", "suggested_fix": "x"},
        ],
        "passed_rule_ids": [],
    }
    checker.run_check(db, version_id(db, 6), NOW, client=FakeClient(reply=reply))
    current = repo.ad_detail(db, 6)["current"]
    findings = {f["rule_id"]: f for f in current["findings"]}
    assert findings["guarantees"]["quote"] == "GUARANTEED approval!!!"
    assert findings["rate-claims"]["quote"] is None  # dropped quote, kept finding
    assert "trigger-terms" not in findings  # doesn't apply to a personal loan
    assert findings["guarantees"]["severity"] == "critical"  # from the rule, not the model
    assert current["check"]["kind"] == "live"
    assert current["check"]["checks_run"] == 7
    assert len(current["check"]["good_rule_ids"]) == 5


def test_notes_carry_over_when_a_finding_is_still_there(db):
    vid = version_id(db, 3)
    rate = next(f for f in repo.ad_detail(db, 3)["current"]["findings"] if f["rule_id"] == "rate-claims")
    reply = {"findings": [{"rule_id": "rate-claims", "layer_id": "headline", "quote": "as low as 7.99% APR",
                           "text": "Rate claim needs the range.", "suggested_fix": "Add it."}],
             "passed_rule_ids": []}
    checker.run_check(db, vid, NOW, client=FakeClient(reply=reply))
    after = repo.ad_detail(db, 3)["current"]["findings"]
    assert [f["submitter_note"] for f in after] == [rate["submitter_note"]]


@pytest.mark.parametrize("client", [
    FakeClient(error=TimeoutError("timed out")),
    FakeClient(reply="not json"),
    FakeClient(reply={"findings": []}, stop_reason="refusal"),
    FakeClient(reply={"nope": 1}),
])
def test_errors_change_nothing(db, client):
    before = repo.ad_detail(db, 3)["current"]
    assert checker.run_check(db, version_id(db, 3), NOW, client=client) == {"status": "error"}
    after = repo.ad_detail(db, 3)["current"]
    assert [f["id"] for f in after["findings"]] == [f["id"] for f in before["findings"]]
    assert after["check"]["id"] == before["check"]["id"]


def test_no_key_means_unavailable(db, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert checker.run_check(db, version_id(db, 3), NOW) == {"status": "unavailable"}


def test_custom_rules_join_the_check(db):
    db.insert("rules", {"id": "custom-balance-transfer-fees", "name": "Balance transfer fees", "category": "Claims",
                        "severity": "critical", "description": "Show the transfer fee next to the intro APR.",
                        "applies_to": json.dumps(["credit_card"]), "dont_example": "0% intro APR",
                        "do_example": "0% intro APR. 3% transfer fee.", "is_custom": 1, "position": 99,
                        "created_at": "2026-10-21T17:00:00Z"})
    client = FakeClient(reply={"findings": [], "passed_rule_ids": []})
    checker.run_check(db, version_id(db, 8), NOW, client=client)
    schema = client.messages.requests[0]["output_config"]["format"]["schema"]
    assert "custom-balance-transfer-fees" in schema["properties"]["findings"]["items"]["properties"]["rule_id"]["enum"]


def test_add_rule_validates_and_applies_to_live_checks(db):
    from server import actions
    from server.actions import ActionError

    data = {"name": "Balance transfer fees", "category": "Claims", "severity": "critical",
            "description": "A balance transfer offer must show the transfer fee next to the intro APR.",
            "applies_to": ["credit_card"], "dont_example": "0% intro APR for 18 months",
            "do_example": "0% intro APR for 18 months. 3% transfer fee."}
    for broken in ({**data, "name": ""}, {**data, "category": "Other"}, {**data, "applies_to": []},
                   {**data, "severity": "high"}):
        with pytest.raises(ActionError):
            actions.add_rule(db, broken, NOW)
    rule = actions.add_rule(db, data, NOW)
    assert rule["id"] == "custom-balance-transfer-fees" and rule["is_custom"]
    with pytest.raises(ActionError):
        actions.add_rule(db, data, NOW)
    # Seeded results stay as they were.
    assert all("custom-balance-transfer-fees" not in (repo.ad_detail(db, 8)["current"]["check"]["good_rule_ids"]) for _ in [0])
    client = FakeClient(reply={"findings": [{"rule_id": "custom-balance-transfer-fees", "layer_id": "headline",
                                             "quote": "No annual fee.", "text": "Missing fee.", "suggested_fix": "Add the fee."}], "passed_rule_ids": []})
    checker.run_check(db, version_id(db, 8), NOW, client=client)
    flagged = [f for f in repo.ad_detail(db, 8)["current"]["findings"] if f["rule_id"] == "custom-balance-transfer-fees"]
    assert flagged and flagged[0]["severity"] == "critical"


def test_near_miss_quotes_still_anchor_to_the_ad():
    text = "Rates from 7.99%–29.99% APR. It\u2019s “simple.”"
    assert checker.locate_quote("7.99%-29.99% apr", text) == "7.99%–29.99% APR"
    assert checker.locate_quote("It's \"simple.\"", text) == "It\u2019s “simple.”"
    assert checker.locate_quote("  Rates from ", text) == "Rates from"
    assert checker.locate_quote("not on the ad", text) is None
    assert checker.locate_quote("   ", text) is None


def test_fixes_are_only_the_words(db):
    reply = {"findings": [
        {"rule_id": "guarantees", "layer_id": "headline", "quote": "guaranteed approval!!!",
         "text": "Promises guaranteed approval.", "suggested_fix": "See if you qualify in minutes."},
        {"rule_id": "clear-and-conspicuous", "layer_id": "body", "quote": None,
         "text": "The disclosure is too small to read.", "suggested_fix": "  "},
    ], "passed_rule_ids": []}
    client = FakeClient(reply=reply)
    checker.run_check(db, version_id(db, 6), NOW, client=client)
    findings = {f["rule_id"]: f for f in repo.ad_detail(db, 6)["current"]["findings"]}
    # A near miss in case still anchors to the exact words, so the wording can be swapped in.
    assert findings["guarantees"]["quote"] == "GUARANTEED approval!!!"
    assert findings["guarantees"]["fix_label"] == "Suggested wording"
    # Nothing to say in words: no fix at all, the text says what's wrong.
    assert findings["clear-and-conspicuous"]["suggested_fix"] is None
    assert findings["clear-and-conspicuous"]["fix_label"] is None
    item = client.messages.requests[0]["output_config"]["format"]["schema"]["properties"]["findings"]["items"]
    assert "fix_label" not in item["properties"] and "suggested_fix" in item["required"]
    assert "never an instruction" in client.messages.requests[0]["system"]


def test_resolved_mark_survives_a_live_recheck(db):
    from server import actions

    vid = version_id(db, 1)
    trigger = next(f for f in repo.ad_detail(db, 1)["current"]["findings"] if f["rule_id"] == "trigger-terms")
    actions.update_finding(db, trigger["id"], "resolve")
    reply = {"findings": [{"rule_id": "trigger-terms", "layer_id": "headline", "quote": "No annual fee.",
                           "text": "Needs the APR.", "suggested_fix": "No annual fee. 21.24%–29.24% variable APR."}], "passed_rule_ids": []}
    checker.run_check(db, vid, NOW, client=FakeClient(reply=reply))
    assert repo.ad_detail(db, 1)["current"]["findings"][0]["resolved_by_submitter"] is True
