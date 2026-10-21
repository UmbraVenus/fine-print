from datetime import datetime, timezone

import pytest

from server.db import Db, connect, migrate
from server.seed import seed

# A Wednesday morning in Pacific time, like the day the wireframes were drawn.
NOW = datetime(2026, 10, 21, 17, 30, tzinfo=timezone.utc)


@pytest.fixture
def db():
    database = Db(connect(":memory:"))
    migrate(database)
    seed(database, NOW)
    return database
