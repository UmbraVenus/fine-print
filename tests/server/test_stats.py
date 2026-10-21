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
    assert stats["reviewed"]["trend"]["good"]


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
