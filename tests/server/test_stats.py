from server import repo

from .conftest import NOW


def by_key(stats):
    return {s["key"]: s for s in stats}


def test_my_ads_stats_agree_with_rows(db):
    stats = by_key(repo.stats(db, "my-ads", NOW))
    rows = repo.list_ads(db, "my-ads")["rows"]
    assert stats["attention"]["value"] == sum(r["status"] in ("draft", "changes_required") for r in rows) == 2
    assert stats["in_review"]["value"] == sum(r["status"] == "pending" for r in rows) == 3
    assert stats["approved"]["value"] == 2


def test_queue_stats_agree_with_rows(db):
    stats = by_key(repo.stats(db, "queue", NOW))
    assert stats["waiting"]["value"] == repo.list_ads(db, "queue")["total"] == 9
    assert stats["due_today"]["value"] == 4
    assert stats["reviewed"]["value"] > 0
    assert "trend" not in stats["reviewed"]  # trends live on Insights


def test_history_stats(db):
    stats = by_key(repo.stats(db, "history", NOW))
    approved = stats["approved"]
    assert approved["value"] > 300
    assert approved["trend"]["direction"] == "up" and approved["trend"]["compared_to"] == "vs. 8 weeks ago"
    turnaround = stats["turnaround"]
    assert 2 < turnaround["value"] < 8
    assert turnaround["trend"]["direction"] == "down" and turnaround["trend"]["good"]
    first = stats["first_review"]
    assert 40 <= first["value"] <= 70
    assert first["trend"]["unit"] == "pts"
    # Points are the difference between this month's rate and the one the tooltip shows.
    then = int(first["trend"]["compared_to"].removeprefix("vs. ").removesuffix("% last month"))
    assert first["value"] - then == first["trend"]["value"]


def test_history_total_matches_approved_ads(db):
    total = repo.list_ads(db, "history")["total"]
    assert total == db.scalar("SELECT COUNT(*) FROM ads WHERE status IN ('approved', 'approved_with_changes')")


def test_filters_and_search(db):
    emails = repo.list_ads(db, "queue", formats=["Email"])
    assert {r["name"] for r in emails["rows"]} == {"Rate check email", "Member savings email"}
    critical = repo.list_ads(db, "queue", auto_check=["critical"])
    assert critical["total"] == 5
    good = repo.list_ads(db, "queue", auto_check=["good"])
    assert {r["name"] for r in good["rows"]} == {"Dream home banner", "Fixed rate Instagram"}
    found = repo.list_ads(db, "queue", q="legit")
    assert [r["name"] for r in found["rows"]] == ["Best loans of 2026"]
    assert repo.list_ads(db, "queue", q="nothing like this")["total"] == 0


def test_sort_by_name(db):
    rows = repo.list_ads(db, "my-ads", sort="name", order="asc")["rows"]
    names = [r["name"] for r in rows]
    assert names == sorted(names, key=str.lower)


def test_insights_tell_the_same_story_as_history(db):
    insights = repo.insights(db, NOW)
    metrics = {m["key"]: m for m in insights["metrics"]}
    history = by_key(repo.stats(db, "history", NOW))
    # Same numbers as History's cards, and each series ends on its headline number.
    assert metrics["approved"]["value"] == history["approved"]["value"] == metrics["approved"]["series"][-1]
    assert metrics["turnaround"]["value"] == history["turnaround"]["value"] == metrics["turnaround"]["series"][-1]
    assert metrics["first_round"]["value"] == history["first_review"]["value"]
    assert metrics["first_round"]["trend"] == history["first_review"]["trend"]
    base, latest = metrics["approved"]["series"][0], metrics["approved"]["series"][-1]
    assert metrics["approved"]["note"] == f"Up from {base} before using Fine Print"
    # Time saved is the difference between before and now; efficiency is the ratio of rounds.
    t = metrics["turnaround"]["series"]
    assert metrics["turnaround"]["display"] == f"{round(t[0] - t[-1])}h" and "working days" in metrics["turnaround"]["note"]
    r = metrics["rounds"]["series"]
    assert metrics["rounds"]["display"] == f"{round(r[0] / r[-1], 1)}×" and r[-1] < r[0]
    assert [m["label"] for m in insights["metrics"]] == [
        "More ads approved per week", "Time saved per ad", "Review efficiency", "Right the first time"]
    assert len(metrics["approved"]["series"]) == 9
    # Top issues: the most flagged rules, biggest first, as shares of all findings.
    shares = [i["share"] for i in insights["issues"]]
    assert shares == sorted(shares, reverse=True) and sum(shares) <= 100 and insights["issues"][0]["name"] == "Rate claims"
    # Affiliates: worst first, with the status that matches the score.
    affiliates = insights["affiliates"]
    assert [a["score"] for a in affiliates] == sorted(a["score"] for a in affiliates)
    assert {a["source"] for a in affiliates} == {"TotallyLegitLoans.biz", "Influencer partner", "Loan comparison site", "Personal finance blog"}
    for a in affiliates:
        assert a["status"] == ("good" if a["score"] >= 85 else "watch" if a["score"] >= 60 else "at_risk")
    assert affiliates[0]["source"] == "TotallyLegitLoans.biz" and affiliates[0]["status"] == "at_risk"


def test_stat_card_filters_match_their_numbers(db):
    from server.dates import local_date

    queue = by_key(repo.stats(db, "queue", NOW))
    due = repo.list_ads(db, "queue", due_by=local_date(NOW).isoformat())
    assert due["total"] == queue["due_today"]["value"] == 4
    mine = by_key(repo.stats(db, "my-ads", NOW))
    assert repo.list_ads(db, "my-ads", statuses=["draft", "changes_required"])["total"] == mine["attention"]["value"]
    assert repo.list_ads(db, "my-ads", statuses=["pending"])["total"] == mine["in_review"]["value"]
    assert repo.list_ads(db, "my-ads", statuses=["approved", "approved_with_changes"])["total"] == mine["approved"]["value"]


def test_queue_sorts_by_auto_check_severity(db):
    rows = repo.list_ads(db, "queue", sort="check", order="desc")["rows"]
    keys = [(r["critical"], r["caution"]) for r in rows]
    assert keys == sorted(keys, reverse=True)
    assert rows[0]["name"] == "Best loans of 2026"  # 3 Critical
    assert rows[-1]["critical"] == 0 and rows[-1]["caution"] == 0  # Good standing last
    up = repo.list_ads(db, "queue", sort="check", order="asc")["rows"]
    assert (up[0]["critical"], up[0]["caution"]) == (0, 0)
