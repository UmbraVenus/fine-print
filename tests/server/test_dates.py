from datetime import date, datetime, timezone

from server.dates import add_business_days, due_after_submit, local_date

WED = date(2026, 10, 21)


def test_add_business_days_within_week():
    assert add_business_days(WED, 0) == WED
    assert add_business_days(WED, 1) == date(2026, 10, 22)
    assert add_business_days(WED, 2) == date(2026, 10, 23)


def test_add_business_days_skips_weekend():
    assert add_business_days(WED, 3) == date(2026, 10, 26)
    assert add_business_days(date(2026, 10, 23), 1) == date(2026, 10, 26)
    assert add_business_days(date(2026, 10, 24), 1) == date(2026, 10, 26)


def test_add_business_days_backwards():
    assert add_business_days(date(2026, 10, 26), -1) == date(2026, 10, 23)


def test_due_one_business_day_after_submit():
    friday_evening_pt = datetime(2026, 10, 24, 1, 0, tzinfo=timezone.utc)  # Fri Oct 23, 6pm PT
    assert local_date(friday_evening_pt) == date(2026, 10, 23)
    assert due_after_submit(friday_evening_pt) == date(2026, 10, 26)
