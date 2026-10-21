"""Finding the exact words on an ad that a finding quotes."""

from __future__ import annotations

import re

# Characters a model often swaps for their look-alikes when it copies a quote.
_LOOK_ALIKES = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
                              "\u2013": "-", "\u2014": "-", "\u00a0": " "})


def locate_quote(quote: str, text: str) -> str | None:
    """
    The exact words on the layer that a quote points at, forgiving curly quotes, dashes and case,
    so a near miss still anchors to the ad. None when the words aren't there.
    """
    quote = quote.strip()
    if not quote:
        return None
    if quote in text:
        return quote
    loose_text, loose_quote = text.translate(_LOOK_ALIKES).lower(), quote.translate(_LOOK_ALIKES).lower()
    if len(loose_text) != len(text) or len(loose_quote) != len(quote):
        return None
    start = loose_text.find(loose_quote)
    return text[start:start + len(quote)] if start >= 0 else None


# Words a reviewer puts in quotation marks: “these” or "these".
_QUOTED = re.compile(r'[“"]([^”"]+)[”"]')


def anchor(text: str, layers: list[dict]) -> tuple[str | None, str | None]:
    """
    The layer and exact words a reviewer's finding points at: the first phrase in quotation marks
    that's on the ad. (None, None) when nothing quoted is on the ad, and the finding stays plain text.
    """
    for phrase in _QUOTED.findall(text):
        for layer in layers:
            words = locate_quote(phrase, layer["text"])
            if words:
                return layer["id"], words
    return None, None
