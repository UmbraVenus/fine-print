import json
from datetime import timedelta

from server import repo
from server.dates import local_date
from server.seed import refresh, seed
from server.seed_data import RULES, rule_applies

from .conftest import NOW


def test_rules():
    assert len(RULES) == 9


def test_queue_counts(db):
    assert repo.pending_count(db) == 9
    queue = repo.list_ads(db, "queue")
    assert queue["total"] == 9
    today = local_date(NOW).isoformat()
    assert sum(1 for r in queue["rows"] if r["due_date"] == today) == 4


def test_queue_order_is_most_recently_updated_first(db):
    rows = repo.list_ads(db, "queue")["rows"]
    assert [r["updated_at"] for r in rows] == sorted((r["updated_at"] for r in rows), reverse=True)
    # Review's Previous / "n of 9" / Next follows the same order as the table.
    assert [r["id"] for r in rows] == repo.queue_order(db)[:len(rows)]


def test_my_ads(db):
    rows = repo.list_ads(db, "my-ads")["rows"]
    assert len(rows) == 8
    assert {r["id"] for r in rows} == {1, 2, 3, 4, 5, 12, 13, 14}
    assert all(r["source"] == "internal" for r in rows)


def test_checks_run_equals_applicable_rules(db):
    for run in db.all("SELECT c.*, a.product, a.source FROM check_runs c JOIN ad_versions v ON v.id = c.ad_version_id "
                      "JOIN ads a ON a.id = v.ad_id WHERE a.id < 100"):
        applicable = [r["id"] for r in RULES if rule_applies(r, run["product"], run["source"])]
        assert run["checks_run"] == len(applicable)
        flagged = {f["rule_id"] for f in db.all("SELECT rule_id FROM findings WHERE check_run_id = ?", (run["id"],))}
        assert set(json.loads(run["good_rule_ids"])) == set(applicable) - flagged


def test_finding_severity_comes_from_rule(db):
    severity = {r["id"]: r["severity"] for r in RULES}
    for f in db.all("SELECT rule_id, severity FROM findings WHERE rule_id IS NOT NULL"):
        assert f["severity"] == severity[f["rule_id"]]


def test_seeded_findings(db):
    def findings(ad_id, version=None):
        return db.all("SELECT f.* FROM findings f JOIN ad_versions v ON v.id = f.ad_version_id "
                      "WHERE v.ad_id = ? AND v.version = COALESCE(?, (SELECT current_version FROM ads WHERE id = ?)) "
                      "ORDER BY f.position", (ad_id, version, ad_id))
    cash = findings(1)
    assert [(f["rule_id"], f["severity"], f["quote"]) for f in cash] == [
        ("trigger-terms", "critical", "No annual fee."),
        ("clear-and-conspicuous", "caution", "2% cash back on everything."),
    ]
    fall = findings(3)
    assert fall[0]["submitter_note"] == "Legal approved this rate wording last month."
    assert [f["severity"] for f in fall] == ["critical", "caution", "caution"]
    assert findings(5) == []  # Dream home v2 is in good standing
    assert len(findings(5, 1)) == 2
    assert len(findings(6)) == 3
    assert findings(11) == []


def test_history_has_eight_weeks(db):
    oldest = db.scalar("SELECT MIN(closed_at) FROM ads WHERE status IN ('approved', 'approved_with_changes')")
    assert oldest < (NOW - timedelta(days=56)).strftime("%Y-%m-%dT%H:%M:%SZ")
    affiliate = db.scalar("SELECT AVG(source != 'internal') FROM ads WHERE id >= 1000")
    assert 0.05 < affiliate < 0.15


def test_reset_is_repeatable(db):
    first = db.scalar("SELECT COUNT(*) FROM ads")
    seed(db, NOW)
    assert db.scalar("SELECT COUNT(*) FROM ads") == first


def test_refresh_moves_dates_forward(db):
    later = NOW + timedelta(days=3)
    assert refresh(db, later) == 3
    today = local_date(later).isoformat()
    due_today = db.scalar("SELECT COUNT(*) FROM ads WHERE status = 'pending' AND due_date = ?", (today,))
    assert due_today == 4
    assert refresh(db, later) == 0
