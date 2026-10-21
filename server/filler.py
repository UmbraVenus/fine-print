"""About nine weeks of closed ads for History, ramping up so the trends are real.

Deterministic (fixed random seed), but every date is relative to now.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from .dates import WORKSPACE_TZ

# Weekly volume of approvals, oldest week first. Week 0 is the last 7 days.
APPROVED_PER_WEEK = [66, 88, 118, 158, 205, 258, 312, 368, 418]
# Average hours from first submission to the decision, oldest week first.
TURNAROUND_HOURS = [50.0, 38.0, 27.0, 19.0, 13.0, 9.0, 6.5, 5.2, 4.2]
# Share of ads approved on their first review, oldest week first.
FIRST_PASS = [0.42, 0.44, 0.46, 0.48, 0.50, 0.53, 0.56, 0.58, 0.60]
REJECTED_SHARE = 0.03
AFFILIATE_SHARE = 0.10

PALETTES = [
    ("#FFF1E0", "#7A3E10", "#F2994A"),
    ("#E7EEF9", "#1C3A66", "#7FA7D9"),
    ("#FDECEC", "#8E2A2A", "#E57373"),
    ("#E8F5E9", "#1B5E20", "#81C784"),
    ("#FFF8E1", "#6D4C00", "#FFD54F"),
    ("#E3F2FD", "#0D47A1", "#64B5F6"),
    ("#E3F1E4", "#1F4D2A", "#8CC79A"),
    ("#EDE7F6", "#4527A0", "#9575CD"),
    ("#F3E6EC", "#5A2340", "#B07A93"),
    ("#F4E7D7", "#2B1D14", "#E9A47E"),
    ("#DCEBF7", "#15213B", "#3A6EA5"),
]
DARK_PALETTES = [("#2F3E6B", "#FFFFFF", "#F2C94C"), ("#1E2A4A", "#FFFFFF", "#2BB3A3"), ("#123B36", "#FFFFFF", "#B4F1DA")]
EMAIL_ACCENTS = ["#0F766E", "#3A6EA5", "#B84A3A", "#4E9A4A", "#6D4C00", "#5A2340", "#4527A0"]

# (name, format, product). Affiliate stems are only used for affiliate ads.
INTERNAL_STEMS = [
    ("refinance rate email", "Email", "mortgage"),
    ("home equity banner", "Display banner", "mortgage"),
    ("welcome series, email 2", "Email", "credit_card"),
    ("holiday travel card", "Facebook ad", "credit_card"),
    ("debt payoff calculator", "Landing page", "personal_loan"),
    ("rate lock reminder", "Email", "mortgage"),
    ("prequalify banner", "Display banner", "mortgage"),
    ("open house weekend", "Instagram ad", "mortgage"),
    ("down payment guide", "Landing page", "mortgage"),
    ("first home checklist", "Email", "mortgage"),
    ("cash back reminder", "Email", "credit_card"),
    ("dining rewards card", "Instagram ad", "credit_card"),
    ("grocery rewards post", "Facebook ad", "credit_card"),
    ("secured card intro", "Landing page", "credit_card"),
    ("card upgrade offer", "Display banner", "credit_card"),
    ("gas rewards card", "Facebook ad", "credit_card"),
    ("balance transfer reminder", "Email", "credit_card"),
    ("home project loan", "Instagram ad", "personal_loan"),
    ("wedding loan", "Facebook ad", "personal_loan"),
    ("medical bills loan", "Display banner", "personal_loan"),
    ("moving costs loan", "Instagram ad", "personal_loan"),
    ("car repair loan", "Facebook ad", "personal_loan"),
    ("one payment story", "Instagram ad", "personal_loan"),
    ("rate check reminder", "Email", "personal_loan"),
    ("consolidation explainer", "Landing page", "personal_loan"),
    ("fixed rate banner", "Display banner", "personal_loan"),
    ("travel card launch", "Display banner", "credit_card"),
    ("points booster email", "Email", "credit_card"),
    ("airport lounge post", "Instagram ad", "credit_card"),
    ("contactless pay banner", "Display banner", "credit_card"),
    ("credit limit increase email", "Email", "credit_card"),
    ("card benefits page", "Landing page", "credit_card"),
    ("refinance calculator", "Landing page", "mortgage"),
    ("home buying webinar", "Email", "mortgage"),
    ("rate watch banner", "Display banner", "mortgage"),
    ("new listing alert", "Facebook ad", "mortgage"),
    ("closing cost explainer", "Instagram ad", "mortgage"),
    ("tuition loan", "Facebook ad", "personal_loan"),
    ("kitchen remodel loan", "Instagram ad", "personal_loan"),
    ("emergency expense loan", "Display banner", "personal_loan"),
    ("loan payoff tips email", "Email", "personal_loan"),
    ("budget planner page", "Landing page", "personal_loan"),
    ("fresh start story", "Facebook ad", "personal_loan"),
    ("same rate promise", "Instagram ad", "personal_loan"),
]
AFFILIATE_STEMS = [
    ("travel rewards post", "Blog post", "credit_card", "CardCompare.example"),
    ("first home guide", "Blog post", "mortgage", "HomeSmart.example"),
    ("best cards roundup", "Blog post", "credit_card", "CardCompare.example"),
    ("loan comparison guide", "Blog post", "personal_loan", "LoanLens.example"),
    ("budget reset story", "Instagram post", "personal_loan", "Influencer partner"),
    ("rewards haul post", "Instagram post", "credit_card", "Influencer partner"),
]
PREFIXES = ["fall", "back to school", "holiday", "Q4", "Q3", "evergreen", "local", "member", "prospect",
            "always-on", "launch", "year-end", "renewal", "loyalty", "referral", "midwest", "west coast",
            "east coast", "southern", "urban", "suburban", "rural", "first-time buyer", "returning customer",
            "Spanish-language", "mobile", "partner", "newsletter", "app install", "search", "weekend"]

COPY = {
    "personal_loan": {
        "headline": ["One payment for all your bills", "Fixed rates from 7.99% to 29.99% APR", "Make room for what's next",
                     "Plan your project with one fixed rate"],
        "body": ["Fixed rates from 7.99% to 29.99% APR with autopay. Autopay is not required.",
                 "Checking your rate won't affect your credit score. Applying may."],
        "cta": ["Check your rate", "See my options"],
    },
    "credit_card": {
        "headline": ["Earn 2% cash back on purchases", "Rewards on every trip", "A card that grows with you",
                     "3x points on dining"],
        "body": ["21.24%–29.24% variable APR. See rates and fees.",
                 "Rewards on purchases only. See rates and fees."],
        "cta": ["Apply now", "See card details"],
    },
    "mortgage": {
        "headline": ["Get prequalified in minutes", "Lock in your rate today", "Make the move home",
                     "Refinance on your terms"],
        "body": ["ClearPath Home Loans · NMLS ID 123456 · Equal Housing Lender"],
        "cta": ["Check eligibility", "Talk to a loan officer"],
    },
}

REVIEWER_NOTES = [
    "Add the full APR range next to the rate.",
    "Move the disclosure up, right under the claim.",
    "Say that autopay is optional.",
    "Add “See rates and fees” right after the APR.",
    "Make the footer disclosure at least 10px.",
    "Add the NMLS ID to the footer.",
]
CHANGE_REQUESTS = [
    "Show the full APR range, then resubmit.",
    "The disclosure is too far from the claim. Move it up and resubmit.",
    "Take out the word “guaranteed”, then resubmit.",
    "Label the post as a paid partnership, then resubmit.",
]


def _layers(rng: random.Random, template: str, product: str, name: str) -> tuple[dict, list[dict]]:
    copy = COPY[product]
    headline = rng.choice(copy["headline"])
    body = rng.choice(copy["body"])
    cta = rng.choice(copy["cta"])
    if template in ("social-square", "social-portrait"):
        bg, fg, accent = rng.choice(PALETTES + DARK_PALETTES)
        # The art sits in the bottom-right corner, beside the button and below the copy.
        shape = rng.choice([
            {"shape": "circle", "right": -36, "bottom": -36, "w": 132, "h": 132, "color": accent},
            {"shape": "rect", "right": 28, "bottom": 28, "w": 96, "h": 60, "radius": 10, "color": accent},
        ])
        theme = {"bg": bg, "fg": fg, "cta_bg": fg, "cta_fg": bg, "shapes": [shape]}
        layers = [
            {"id": "eyebrow", "role": "eyebrow", "text": "CLEARPATH"},
            {"id": "headline", "role": "headline", "text": headline, "style": {"fontSize": 30, "weight": 800}},
            {"id": "body", "role": "body", "text": body, "style": {"fontSize": 14}},
            {"id": "cta", "role": "cta", "text": cta},
        ]
    elif template == "banner":
        bg, fg, accent = rng.choice(PALETTES + DARK_PALETTES)
        theme = {"bg": bg, "fg": fg, "cta_bg": fg, "cta_fg": bg, "art": "house" if product == "mortgage" else "card", "art_color": accent}
        layers = [
            {"id": "headline", "role": "headline", "text": headline},
            {"id": "cta", "role": "cta", "text": cta},
            {"id": "disclosure", "role": "disclosure", "text": body},
        ]
    elif template == "email":
        theme = {"accent": rng.choice(EMAIL_ACCENTS)}
        layers = [
            {"id": "from", "role": "from", "text": "ClearPath"},
            {"id": "subject", "role": "subject", "text": headline},
            {"id": "greeting", "role": "body", "text": "Hi there,"},
            {"id": "body", "role": "body", "text": body},
            {"id": "cta", "role": "cta", "text": cta},
        ]
    elif template == "landing-page":
        slug = name.lower().replace(",", "").replace(" ", "-")
        theme = {"url": f"clearpath.example/{slug}", "cta_bg": rng.choice(["#2F5D50", "#15213B", "#0F766E"]), "cta_fg": "#FFFFFF"}
        layers = [
            {"id": "headline", "role": "headline", "text": headline},
            {"id": "body", "role": "body", "text": body},
            {"id": "cta", "role": "cta", "text": cta},
        ]
    else:  # blog-post
        slug = name.lower().replace(",", "").replace(" ", "-")
        theme = {"url": f"{slug}.example/post"}
        layers = [
            {"id": "disclosure", "role": "disclosure", "text": "We earn a fee from partners like ClearPath."},
            {"id": "headline", "role": "headline", "text": name},
            {"id": "body", "role": "body", "text": body},
        ]
    return theme, layers


def _closing_moment(rng: random.Random, now: datetime, week: int) -> datetime:
    """A business-hours moment inside rolling week `week` (0 = the last 7 days), never in the future."""
    end = now - timedelta(days=week * 7, minutes=30)
    start = now - timedelta(days=(week + 1) * 7)
    span = (end - start).total_seconds()
    for _ in range(200):
        moment = start + timedelta(seconds=rng.uniform(0, span))
        local = moment.astimezone(WORKSPACE_TZ)
        if local.weekday() < 5 and 8 <= local.hour < 18:
            return moment.replace(second=0)
    return end


VARIANTS = ["version B", "Spanish", "short", "long", "retargeting", "version C"]


def _unique_name(rng: random.Random, stem: str, used: set[str]) -> str:
    for _ in range(12):
        name = f"{rng.choice(PREFIXES)} {stem}"
        if name not in used:
            break
    else:
        name = f"{name}, {rng.choice(VARIANTS)}"
        while name in used:
            name = f"{rng.choice(PREFIXES)} {stem}, {rng.choice(VARIANTS)}"
    used.add(name)
    return name[0].upper() + name[1:]


def generate(now: datetime, formats: dict[str, str], start_ad_id: int = 1000) -> list[dict]:
    """Plain descriptions of closed ads; seed.py writes them to the database."""
    rng = random.Random(20261021)
    ads: list[dict] = []
    ad_id = start_ad_id
    weeks = len(APPROVED_PER_WEEK)
    used_names: set[str] = set()
    # Newest week first, so the ads on the first History page get the plainest names.
    for index, approved in reversed(list(enumerate(APPROVED_PER_WEEK))):
        week = weeks - 1 - index
        total = round(approved / (1 - REJECTED_SHARE))
        for _ in range(total):
            rejected = rng.random() < REJECTED_SHARE
            if rng.random() < AFFILIATE_SHARE:
                stem, fmt, product, source = rng.choice(AFFILIATE_STEMS)
            else:
                stem, fmt, product = rng.choice(INTERNAL_STEMS)
                source = "internal"
            name = _unique_name(rng, stem, used_names)
            closed = _closing_moment(rng, now, week)
            hours = max(0.5, rng.gauss(TURNAROUND_HOURS[index], TURNAROUND_HOURS[index] * 0.35))
            submitted = closed - timedelta(hours=hours)
            first_pass = rejected or rng.random() < FIRST_PASS[index]
            template = formats[fmt]
            theme, layers = _layers(rng, template, product, name)
            if rejected:
                status = "rejected"
            else:
                status = "approved_with_changes" if rng.random() < 0.4 else "approved"
            ad = {
                "id": ad_id, "name": name, "format": fmt, "product": product, "source": source,
                "status": status, "template": template, "theme": theme, "layers": layers,
                "submitted": submitted, "closed": closed, "first_pass": first_pass,
                "by_you": rng.random() < 1 / 3,
                "precheck": rng.random() < 0.7,
                "note": rng.choice(REVIEWER_NOTES) + " No second review needed." if status == "approved_with_changes" else None,
                "rejection": "The offer in this ad doesn't exist." if rejected else None,
            }
            if not first_pass:
                # One round of changes, somewhere in the middle.
                ad["changes_at"] = submitted + timedelta(hours=hours * rng.uniform(0.3, 0.5))
                ad["resubmitted"] = ad["changes_at"] + timedelta(hours=hours * rng.uniform(0.2, 0.35))
                ad["change_request"] = rng.choice(CHANGE_REQUESTS)
                ad["changes_by_you"] = rng.random() < 1 / 3
            ads.append(ad)
            ad_id += 1
    return ads
