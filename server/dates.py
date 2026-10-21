"""Dates for the workspace.

Timestamps are stored as UTC ISO strings ("2026-10-21T17:04:00Z"). Due dates are plain
calendar dates in the workspace time zone (ClearPath plans its reviews in Pacific time).
"""

from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

WORKSPACE_TZ = ZoneInfo(os.environ.get("WORKSPACE_TZ", "America/Los_Angeles"))


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def local_date(dt: datetime) -> date:
    return dt.astimezone(WORKSPACE_TZ).date()


def today(now: datetime) -> date:
    return local_date(now)


def at_local(day: date, hour: int, minute: int = 0) -> datetime:
    """A moment on a workspace calendar day, as UTC."""
    return datetime.combine(day, time(hour, minute), tzinfo=WORKSPACE_TZ).astimezone(timezone.utc)


def is_business_day(day: date) -> bool:
    return day.weekday() < 5


def add_business_days(day: date, n: int) -> date:
    """Move n business days forward (or back when n < 0). n == 0 returns the day itself."""
    step = 1 if n >= 0 else -1
    remaining = abs(n)
    current = day
    while remaining:
        current += timedelta(days=step)
        if is_business_day(current):
            remaining -= 1
    return current


def due_after_submit(submitted: datetime) -> date:
    """A submission is due one business day after the day it was submitted."""
    return add_business_days(local_date(submitted), 1)
