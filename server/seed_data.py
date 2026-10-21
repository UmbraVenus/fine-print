"""The sample ClearPath workspace: rules and the hand-made ads from the wireframes.

Dates here are relative ("days_ago", "due_in_business_days"); seed.py turns them into real dates.
"""

from __future__ import annotations

import json

ALL_PRODUCTS = ["personal_loan", "credit_card", "mortgage"]


def lines(*items: tuple[str, str]) -> str:
    """A Do/Don't example with more than one line: [(size, text)], size is main, big, small or tiny."""
    return json.dumps([{"size": size, "text": text} for size, text in items])


RULES = [
    {
        "id": "rate-claims",
        "name": "Rate claims",
        "category": "Claims",
        "severity": "critical",
        "description": "A rate like “as low as 7.99% APR” needs the full APR range and any conditions, like autopay.",
        "applies_to": ["personal_loan", "credit_card"],
        "dont_example": "Loans as low as 7.99% APR",
        "do_example": "Fixed rates 7.99%–29.99% APR with autopay",
    },
    {
        "id": "credit-score-claims",
        "name": "Credit score claims",
        "category": "Claims",
        "severity": "caution",
        "description": "“No impact to your credit score” is only true for checking your rate. Applying is a hard credit check.",
        "applies_to": ALL_PRODUCTS,
        "dont_example": "No impact to your credit score!",
        "do_example": "Checking your rate won't affect your credit score. Applying may.",
    },
    {
        "id": "trigger-terms",
        "name": "Trigger terms",
        "category": "Claims",
        "severity": "critical",
        "description": "Some phrases, like “no annual fee”, require the APR and other key terms, even though they sound like good news.",
        "applies_to": ["credit_card"],
        "dont_example": "No annual fee. Apply now.",
        "do_example": "No annual fee. 21.24%–29.24% variable APR.",
    },
    {
        "id": "savings-claims",
        "name": "Savings claims",
        "category": "Claims",
        "severity": "critical",
        "description": "A savings claim needs real evidence, and its exclusions can't be hidden in fine print.",
        "applies_to": ALL_PRODUCTS,
        "dont_example": "Members save $4,200 on average",
        "do_example": "2025 borrowers who consolidated saved $4,200 on average. Results vary.",
    },
    {
        "id": "guarantees",
        "name": "Guarantees",
        "category": "Claims",
        "severity": "critical",
        "description": "No guaranteed approval, and no rates most people can't actually get.",
        "applies_to": ALL_PRODUCTS,
        "dont_example": "GUARANTEED approval!!!",
        "do_example": "Check your rate in minutes",
    },
    {
        "id": "mortgage-identifiers",
        "name": "Mortgage identifiers",
        "category": "Required elements",
        "severity": "critical",
        "description": "Mortgage ads show the NMLS ID and the Equal Housing logo.",
        "applies_to": ["mortgage"],
        "dont_example": "Get prequalified for your dream home",
        "do_example": lines(("main", "Get prequalified for your dream home"), ("small", "NMLS ID 123456 · Equal Housing Lender")),
    },
    {
        "id": "affiliate-disclosure",
        "name": "Affiliate disclosure",
        "category": "Required elements",
        "severity": "critical",
        "description": "Affiliate content says clearly that the publisher is paid by ClearPath.",
        "applies_to": ["affiliate"],
        "dont_example": "The best loans of 2026",
        "do_example": lines(("main", "The best loans of 2026"), ("small", "We earn a fee from partners like ClearPath.")),
    },
    {
        "id": "paid-testimonials",
        "name": "Paid testimonials",
        "category": "Required elements",
        "severity": "critical",
        "description": "A paid testimonial or influencer post is labeled as a paid partnership.",
        "applies_to": ["affiliate"],
        "dont_example": "I paid off my cards in a month with ClearPath",
        "do_example": lines(("small", "Paid partnership with ClearPath"), ("main", "I paid off my cards in a month with ClearPath")),
    },
    {
        "id": "clear-and-conspicuous",
        "name": "Clear and conspicuous",
        "category": "Presentation",
        "severity": "caution",
        "description": "A disclosure is a readable size, close to the claim it explains, and visible without scrolling. It can't fix a claim that's false on its own.",
        "applies_to": ALL_PRODUCTS,
        "dont_example": lines(("big", "7.99% APR"), ("tiny", "With autopay. Terms apply.")),
        "do_example": lines(("big", "7.99%–29.99% APR"), ("small", "With autopay. Autopay is not required.")),
    },
]

RULES_BY_ID = {r["id"]: r for r in RULES}

FORMAT_TEMPLATES = {
    "Facebook ad": "social-square",
    "Instagram post": "social-square",
    "Instagram ad": "social-portrait",
    "Display banner": "banner",
    "Email": "email",
    "Landing page": "landing-page",
    "Blog post": "blog-post",
}


def rule_applies(rule: dict, product: str, source: str) -> bool:
    applies = rule["applies_to"] if isinstance(rule["applies_to"], list) else json.loads(rule["applies_to"])
    if product in applies:
        return True
    return "affiliate" in applies and source != "internal"


def L(layer_id: str, role: str, text: str, **style) -> dict:
    layer = {"id": layer_id, "role": role, "text": text}
    if style:
        layer["style"] = style
    return layer


def F(rule_id: str | None, layer_id: str | None, quote: str | None, text: str, fix: str | None = None,
      **extra) -> dict:
    """
    An auto finding. The fix is only the words to use: a drop-in replacement for the quote, or the words
    to add when something is missing. No fix when it isn't about words; the text already says what's wrong.
    """
    return {"rule_id": rule_id, "layer_id": layer_id, "quote": quote, "text": text,
            "suggested_fix": fix, "fix_label": "Suggested wording" if fix else None, **extra}


def R(text: str, **extra) -> dict:
    """A reviewer finding: no rule and no severity, always sent to the submitter."""
    return {"rule_id": None, "layer_id": None, "quote": None, "text": text, "suggested_fix": None,
            "fix_label": None, "origin": "reviewer", **extra}


# ---------------------------------------------------------------- the ads

CASH_BACK_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "No annual fee.", fontSize=34, weight=800),
    L("body", "body", "2% cash back on everything.", fontSize=18, weight=600),
    L("disclosure", "disclosure", "Cash back on purchases only. Excludes balance transfers, fees and cash advances. Terms apply.", fontSize=7),
]

FALL_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "Personal loans as low as 7.99% APR", fontSize=32, weight=800),
    L("body", "body", "Checking your rate won't affect your credit score.", fontSize=15),
    L("cta", "cta", "Check your rate"),
    L("disclosure", "disclosure", "Rates from 7.99% APR with autopay. Terms apply.", fontSize=7),
]

HOLIDAY_LAYERS = [
    L("from", "from", "ClearPath"),
    L("subject", "subject", "One payment for every holiday balance"),
    L("greeting", "body", "Hi there,"),
    L("body", "body", "Roll this season's card balances into one fixed monthly payment. Rates as low as 8.99% APR with autopay."),
    L("cta", "cta", "Check my rate"),
]

RATE_CHECK_LAYERS = [
    L("from", "from", "ClearPath"),
    L("subject", "subject", "Check your rate with no impact to your credit score!"),
    L("greeting", "body", "Hi there,"),
    L("body", "body", "Wondering what rate you'd get on a personal loan? Find out in about two minutes."),
    L("cta", "cta", "Check my rate"),
]

DREAM_V1 = [
    L("headline", "headline", "Get prequalified for your dream home"),
    L("cta", "cta", "Check eligibility"),
]
DREAM_V2 = DREAM_V1 + [
    L("nmls", "disclosure", "ClearPath Home Loans · NMLS ID 123456"),
    L("ehl", "disclosure", "EQUAL HOUSING LENDER", icon="equal-housing"),
]

BEST_LOANS_LAYERS = [
    L("headline", "headline", "Best loan of 2026. GUARANTEED approval!!!"),
    L("body", "body", "We tried them all. ClearPath wins, with 0% APR forever* for everyone."),
]

CARD_PAYOFF_LAYERS = [
    L("eyebrow", "eyebrow", "@MAYAMONEYTALKS"),
    L("headline", "headline", "I paid off my cards in a month with ClearPath", fontSize=28, weight=800),
    L("body", "body", "One loan, one payment, zero stress. Link in bio.", fontSize=15),
]

STUDENT_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "Your first card. No annual fee.", fontSize=32, weight=800),
    L("body", "body", "Build credit while you study.", fontSize=16, weight=600),
    L("cta", "cta", "Apply now"),
]

CONSOLIDATION_V1 = [
    L("headline", "headline", "Consolidate your debt into one payment."),
    L("claim", "body", "Guaranteed approval. No origination fee required. No late fees.", fontSize=15, weight=600),
    L("cta", "cta", "See my rate"),
    L("disclosure", "disclosure", "*An optional origination fee may lower your rate. See full terms."),
]
CONSOLIDATION_V2 = [
    L("headline", "headline", "Consolidate your debt into one payment."),
    L("claim", "body", "No origination fee required. No late fees.", fontSize=15, weight=600),
    L("cta", "cta", "See my rate"),
    L("disclosure", "disclosure", "*An optional origination fee may lower your rate. See full terms."),
]

MEMBER_V1 = [
    L("from", "from", "ClearPath"),
    L("subject", "subject", "Your consolidation options are ready"),
    L("greeting", "body", "Hi there,"),
    L("body", "body", "Rates as low as 6.99% APR when you consolidate card debt with ClearPath."),
    L("cta", "cta", "See my options"),
]
MEMBER_V2 = [
    L("from", "from", "ClearPath"),
    L("subject", "subject", "Your consolidation options are ready"),
    L("greeting", "body", "Hi there,"),
    L("body", "body", "Members save $4,200 on average when they consolidate card debt with ClearPath. Fixed rates from 7.99% to 29.99% APR."),
    L("cta", "cta", "See my options"),
]

FIXED_RATE_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "Fixed rates from 7.99% to 29.99% APR", fontSize=30, weight=800),
    L("body", "body", "One payment, one rate, no surprises.", fontSize=16),
    L("cta", "cta", "Check your rate"),
    L("disclosure", "disclosure", "Lowest rate with autopay. Autopay is not required. Checking your rate won't affect your credit score. Applying may.", fontSize=11),
]

BALANCE_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "0% intro APR on balance transfers for 18 months"),
    L("cta", "cta", "Transfer now"),
]

SPRING_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "Spring into one simple payment", fontSize=32, weight=800),
    L("body", "body", "Fixed rates from 7.99% to 29.99% APR with autopay. Autopay is not required.", fontSize=15),
    L("cta", "cta", "Check your rate"),
]

GRADUATION_LAYERS = [
    L("eyebrow", "eyebrow", "CLEARPATH"),
    L("headline", "headline", "Grads save $3,000 a year with ClearPath", fontSize=30, weight=800),
    L("body", "body", "Turn your student debt into one simple payment.", fontSize=16),
    L("cta", "cta", "Learn more"),
]

# Each ad: its versions (oldest first), and per version its findings and check result.
# Dates: "submitted" / "decided" etc. are (days_ago, hour) in workspace time.
ADS = [
    {
        "id": 1, "name": "Cash back card", "format": "Facebook ad", "product": "credit_card", "source": "internal",
        "status": "draft", "is_mine": True, "created": (1, 15), "updated": (0, 10),
        "versions": [{
            "theme": {"bg": "#1E2A4A", "fg": "#FFFFFF", "fine": "#C9D1E3",
                      "shapes": [{"shape": "rect", "right": 28, "bottom": 56, "w": 150, "h": 94, "radius": 10, "color": "#2BB3A3"},
                                 {"shape": "rect", "right": 136, "bottom": 116, "w": 26, "h": 20, "radius": 3, "color": "#F2C94C"}]},
            "layers": CASH_BACK_LAYERS,
            "submitted": None,
            "check": (0, 10),
            "findings": [
                F("trigger-terms", "headline", "No annual fee.",
                  "“No annual fee” is a trigger term, so the ad also needs the APR.",
                  "No annual fee. 21.24%–29.24% variable APR."),
                F("clear-and-conspicuous", "body", "2% cash back on everything.",
                  "“On everything” has exclusions that only appear in the fine print.",
                  "2% cash back on purchases."),
            ],
        }],
        "events": [("check", (0, 10), "pre-check")],
    },
    {
        "id": 2, "name": "Holiday debt email", "format": "Email", "product": "personal_loan", "source": "internal",
        "status": "changes_required", "is_mine": True, "created": (2, 10), "updated": (0, 11),
        "versions": [{
            "theme": {"accent": "#B84A3A"},
            "layers": HOLIDAY_LAYERS,
            "submitted": (1, 11),
            "check": (1, 11),
            "findings": [
                F("rate-claims", "body", "Rates as low as 8.99% APR with autopay.",
                  "The rate claim is missing the full APR range and the autopay condition.",
                  "Fixed rates from 8.99% to 29.99% APR with autopay. Autopay is optional.", state="kept", sent=True),
                R("Add the APR range and say autopay is optional.", sent=True),
            ],
        }],
        "events": [("check", (1, 11), "pre-check"), ("submitted", (1, 11), 1), ("check", (1, 11), "submit"),
                   ("decision", (0, 11), "changes_required", "Please add the full APR range and say autopay is optional, then resubmit.")],
    },
    {
        "id": 3, "name": "Fall personal loan", "format": "Instagram ad", "product": "personal_loan", "source": "internal",
        "status": "pending", "is_mine": True, "created": (1, 14), "updated": (0, 9), "due": 0,
        "versions": [{
            "theme": {"bg": "#F4E7D7", "fg": "#2B1D14", "cta_bg": "#2B1D14", "cta_fg": "#FFFFFF",
                      "shapes": [{"shape": "circle", "right": 28, "bottom": 72, "w": 110, "h": 110, "color": "#E9A47E"}]},
            "layers": FALL_LAYERS,
            "submitted": (0, 9),
            "check": (0, 9),
            "findings": [
                F("rate-claims", "headline", "as low as 7.99% APR",
                  "The rate claim is missing the full APR range and the autopay condition.",
                  "from 7.99% to 29.99% APR with autopay",
                  submitter_note="Legal approved this rate wording last month."),
                F("clear-and-conspicuous", "disclosure", "Rates from 7.99% APR with autopay. Terms apply.",
                  "The disclosure is too small to read and far from the claim."),
                F("credit-score-claims", "body", "Checking your rate won't affect your credit score.",
                  "“Won't affect your credit score” is only true for checking your rate.",
                  "Checking your rate won't affect your credit score. Applying may."),
            ],
        }],
        "events": [("check", (0, 8), "pre-check"), ("submitted", (0, 9), 1), ("check", (0, 9), "submit")],
    },
    {
        "id": 4, "name": "Rate check email", "format": "Email", "product": "personal_loan", "source": "internal",
        "status": "pending", "is_mine": True, "created": (3, 13), "updated": (2, 10), "due": 0,
        "versions": [{
            "theme": {"accent": "#0F766E"},
            "layers": RATE_CHECK_LAYERS,
            "submitted": (2, 10),
            "check": (2, 10),
            "findings": [
                F("credit-score-claims", "subject", "with no impact to your credit score!",
                  "“No impact to your credit score” is only true for checking your rate.",
                  "with no impact to your credit score. Applying may affect it."),
            ],
        }],
        "events": [("submitted", (2, 10), 1), ("check", (2, 10), "submit")],
    },
    {
        "id": 5, "name": "Dream home banner", "format": "Display banner", "product": "mortgage", "source": "internal",
        "status": "pending", "is_mine": True, "created": (4, 9), "updated": (0, 8), "due": 1,
        "versions": [
            {
                "theme": {"bg": "#DCEBF7", "fg": "#15213B", "cta_bg": "#15213B", "cta_fg": "#FFFFFF", "art": "house", "art_color": "#3A6EA5"},
                "layers": DREAM_V1,
                "submitted": (3, 10),
                "check": (3, 10),
                "findings": [
                    F("mortgage-identifiers", None, None, "No NMLS ID on the banner.",
                      "ClearPath Home Loans · NMLS ID 123456", state="kept", sent=True),
                    F("mortgage-identifiers", None, None, "No Equal Housing logo.",
                      "Equal Housing Lender", state="kept", sent=True),
                ],
            },
            {
                "theme": {"bg": "#DCEBF7", "fg": "#15213B", "cta_bg": "#15213B", "cta_fg": "#FFFFFF", "art": "house", "art_color": "#3A6EA5"},
                "layers": DREAM_V2,
                "submitted": (0, 8),
                "check": (0, 8),
                "findings": [],
            },
        ],
        "events": [("submitted", (3, 10), 1), ("check", (3, 10), "submit"),
                   ("decision", (2, 14), "changes_required", "Add the NMLS ID and the Equal Housing logo, then resubmit."),
                   ("resubmitted", (0, 8), 2), ("check", (0, 8), "submit")],
    },
    {
        "id": 6, "name": "Best loans of 2026", "format": "Blog post", "product": "personal_loan", "source": "TotallyLegitLoans.biz",
        "status": "pending", "created": (1, 9), "updated": (0, 7), "due": 0,
        "versions": [{
            "theme": {"url": "totallylegitloans.biz/best-loans"},
            "layers": BEST_LOANS_LAYERS,
            "submitted": (0, 7),
            "check": (0, 7),
            "findings": [
                F("guarantees", "headline", "GUARANTEED approval!!!", "Promises guaranteed approval.",
                  "See if you qualify in minutes."),
                F("rate-claims", "body", "0% APR forever*", "“0% APR forever” isn't a rate ClearPath offers.",
                  "fixed rates from 7.99% to 29.99% APR"),
                F("affiliate-disclosure", None, None, "Never says the publisher is paid by ClearPath.",
                  "We earn a commission if you're approved through our links."),
            ],
        }],
        "events": [("submitted", (0, 7), 1), ("check", (0, 7), "submit")],
    },
    {
        "id": 7, "name": "Card payoff story", "format": "Instagram post", "product": "personal_loan", "source": "Influencer partner",
        "status": "pending", "created": (1, 10), "updated": (0, 7), "due": 0,
        "versions": [{
            "theme": {"bg": "#E8DDF5", "fg": "#5B3F86", "avatar": "#9B7BC7"},
            "layers": CARD_PAYOFF_LAYERS,
            "submitted": (0, 7),
            "check": (0, 7),
            "findings": [
                F("paid-testimonials", "headline", "I paid off my cards in a month with ClearPath",
                  "A paid post, but it isn't labeled as a paid partnership.",
                  "Paid partnership with ClearPath. I paid off my cards in a month with ClearPath"),
            ],
        }],
        "events": [("submitted", (0, 7), 1), ("check", (0, 7), "submit")],
    },
    {
        "id": 8, "name": "Student card post", "format": "Facebook ad", "product": "credit_card", "source": "internal",
        "status": "pending", "created": (1, 11), "updated": (0, 10), "due": 1,
        "versions": [{
            "theme": {"bg": "#EDE7F6", "fg": "#4527A0", "cta_bg": "#4527A0", "cta_fg": "#FFFFFF",
                      "shapes": [{"shape": "rect", "right": 28, "bottom": 32, "w": 120, "h": 84, "radius": 10, "color": "#9575CD"}]},
            "layers": STUDENT_LAYERS,
            "submitted": (0, 10),
            "check": (0, 10),
            "findings": [
                F("trigger-terms", "headline", "Your first card. No annual fee.",
                  "“No annual fee” is a trigger term, so the ad also needs the APR.",
                  "Your first card. No annual fee. 21.24%–29.24% variable APR."),
            ],
        }],
        "events": [("check", (1, 16), "pre-check"), ("submitted", (0, 10), 1), ("check", (0, 10), "submit")],
    },
    {
        "id": 9, "name": "Consolidation page", "format": "Landing page", "product": "personal_loan", "source": "internal",
        "status": "pending", "created": (6, 10), "updated": (0, 11), "due": 2,
        "versions": [
            {
                "theme": {"url": "clearpath.example/consolidate", "cta_bg": "#2F5D50", "cta_fg": "#FFFFFF"},
                "layers": CONSOLIDATION_V1,
                "submitted": (5, 10),
                "check": (5, 10),
                "findings": [
                    F("guarantees", "claim", "Guaranteed approval.", "Promises guaranteed approval.",
                      "See if you qualify in minutes.", state="kept", sent=True),
                ],
            },
            {
                "theme": {"url": "clearpath.example/consolidate", "cta_bg": "#2F5D50", "cta_fg": "#FFFFFF"},
                "layers": CONSOLIDATION_V2,
                "submitted": (0, 11),
                "check": (0, 11),
                "findings": [
                    F("clear-and-conspicuous", "claim", "No origination fee required. No late fees.",
                      "The fee claims are only qualified in the page footer, far from the claim.",
                      "No origination fee required, and an optional one may lower your rate. No late fees."),
                ],
            },
        ],
        "events": [("submitted", (5, 10), 1), ("check", (5, 10), "submit"),
                   ("decision", (4, 15), "changes_required", "Take out the approval guarantee, then resubmit."),
                   ("resubmitted", (0, 11), 2), ("check", (0, 11), "submit")],
    },
    {
        "id": 10, "name": "Member savings email", "format": "Email", "product": "personal_loan", "source": "internal",
        "status": "pending", "created": (7, 10), "updated": (0, 12), "due": 2,
        "versions": [
            {
                "theme": {"accent": "#4E9A4A"},
                "layers": MEMBER_V1,
                "submitted": (6, 10),
                "check": (6, 10),
                "findings": [
                    F("rate-claims", "body", "Rates as low as 6.99% APR",
                      "The rate claim is missing the full APR range and the autopay condition.",
                      "Fixed rates from 7.99% to 29.99% APR with autopay. Autopay is not required.", state="kept", sent=True),
                ],
            },
            {
                "theme": {"accent": "#4E9A4A"},
                "layers": MEMBER_V2,
                "submitted": (0, 12),
                "check": (0, 12),
                "findings": [
                    F("savings-claims", "body", "Members save $4,200 on average when they consolidate card debt with ClearPath.",
                      "The savings claim doesn't say where the number comes from.",
                      "2025 borrowers who consolidated card debt with ClearPath saved $4,200 on average. Results vary."),
                ],
            },
        ],
        "events": [("submitted", (6, 10), 1), ("check", (6, 10), "submit"),
                   ("decision", (5, 16), "changes_required", "Show the full APR range, then resubmit."),
                   ("resubmitted", (0, 12), 2), ("check", (0, 12), "submit")],
    },
    {
        "id": 11, "name": "Fixed rate Instagram", "format": "Instagram ad", "product": "personal_loan", "source": "internal",
        "status": "pending", "created": (1, 13), "updated": (0, 13), "due": 3,
        "versions": [{
            "theme": {"bg": "#E3ECF8", "fg": "#1C3A66", "cta_bg": "#1C3A66", "cta_fg": "#FFFFFF", "fine": "#3D5A85"},
            "layers": FIXED_RATE_LAYERS,
            "submitted": (0, 13),
            "check": (0, 13),
            "findings": [],
        }],
        "events": [("check", (0, 12), "pre-check"), ("submitted", (0, 13), 1), ("check", (0, 13), "submit")],
    },
    {
        "id": 12, "name": "Balance transfer banner", "format": "Display banner", "product": "credit_card", "source": "internal",
        "status": "approved_with_changes", "is_mine": True, "created": (7, 9), "updated": (4, 11), "closed": (4, 11),
        "versions": [{
            "theme": {"bg": "#2F3E6B", "fg": "#FFFFFF", "cta_bg": "#F2C94C", "cta_fg": "#15213B", "art": "card", "art_color": "#F2C94C"},
            "layers": BALANCE_LAYERS,
            "submitted": (6, 10),
            "check": (6, 10),
            "findings": [
                F("clear-and-conspicuous", "headline", "0% intro APR on balance transfers for 18 months",
                  "The intro rate doesn't say what the rate is after 18 months.",
                  "0% intro APR on balance transfers for 18 months, then 20.24%–28.24% variable APR",
                  state="dismissed", dismiss_reason="Covered by my finding."),
                R("Add “then 20.24%–28.24% variable APR” right after the intro rate. No second review needed.", sent=True),
            ],
        }],
        "events": [("check", (6, 9), "pre-check"), ("submitted", (6, 10), 1),
                   ("decision", (4, 11), "approved_with_changes", None)],
    },
    {
        "id": 13, "name": "Spring personal loan", "format": "Instagram ad", "product": "personal_loan", "source": "internal",
        "status": "approved", "is_mine": True, "created": (10, 9), "updated": (7, 14), "closed": (7, 14), "live": (6, 9),
        "versions": [{
            "theme": {"bg": "#E3F1E4", "fg": "#1F4D2A", "cta_bg": "#1F4D2A", "cta_fg": "#FFFFFF",
                      "shapes": [{"shape": "circle", "right": -40, "bottom": -40, "w": 180, "h": 180, "color": "#8CC79A"}]},
            "layers": SPRING_LAYERS,
            "submitted": (8, 10),
            "check": (8, 10),
            "findings": [],
        }],
        "events": [("check", (8, 9), "pre-check"), ("submitted", (8, 10), 1), ("check", (8, 10), "submit"),
                   ("decision", (7, 14), "approved", None), ("live", (6, 9), None)],
    },
    {
        "id": 14, "name": "Graduation savings post", "format": "Facebook ad", "product": "personal_loan", "source": "internal",
        "status": "rejected", "is_mine": True, "created": (14, 10), "updated": (12, 15), "closed": (12, 15),
        "versions": [{
            "theme": {"bg": "#F3E6EC", "fg": "#5A2340", "cta_bg": "#5A2340", "cta_fg": "#FFFFFF",
                      "shapes": [{"shape": "rect", "right": 28, "bottom": 32, "w": 110, "h": 80, "radius": 10, "color": "#B07A93"}]},
            "layers": GRADUATION_LAYERS,
            "submitted": (13, 10),
            "check": (13, 10),
            "findings": [
                F("savings-claims", "headline", "Grads save $3,000 a year",
                  "The savings claim has no evidence behind it.",
                  "Graduate to one simple payment", state="kept", sent=True),
            ],
        }],
        "events": [("submitted", (13, 10), 1), ("check", (13, 10), "submit"),
                   ("decision", (12, 15), "rejected", "Savings claim without evidence")],
    },
]
