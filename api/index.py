"""Vercel entry point: the Flask app lives in the `server` package."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.app import create_app  # noqa: E402

app = create_app()
