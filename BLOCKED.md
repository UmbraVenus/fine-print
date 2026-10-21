# Blocked and defaults chosen

## Stack: React + Vite + Flask instead of Next.js (decided by the project owner)

CLAUDE.md specifies Next.js, but the project owner asked for React + Vite + Flask (the repo history has the same switch). These parts of CLAUDE.md change to match:

| CLAUDE.md | Used instead |
| --- | --- |
| Next.js App Router | Vite + React; client-side routing comes in M2 |
| `next/font/google` | `@fontsource/inter` and `@fontsource/ibm-plex-mono`, self-hosted |
| `@anthropic-ai/sdk` | Anthropic Python SDK (`anthropic`) in Flask |
| Drizzle ORM + libSQL | The `libsql` Python driver with plain SQL and numbered migration files in `server/migrations`. The same code runs on `file:./local.db` and on Turso |
| `fp_role` cookie read by the server | Still a cookie; Flask reads it for redirects, and the client reads it for nav |

## No `ANTHROPIC_API_KEY` in this session

The environment has no `ANTHROPIC_API_KEY`, so `npm run smoke:anthropic` stops with "ANTHROPIC_API_KEY is not set". Instead, the "reply ok" call went through the Claude Code CLI on the project owner's account, which answered `ok`. The app's server-side check can't use that account login: it needs a real API key in the environment (locally in `.env`, in production as a Vercel env var).
**Default:** keep building. Seeded checks don't need a key, and Re-check shows the "unavailable" message until a key is set.

## Data decisions

- **Wireframe "Good" and "checks run" counts don't match the rule table.** For example, 03-PreCheck shows "5 Good · 7 checks run", but only 6 rules apply to an internal credit card ad. CLAUDE.md also says "Checks run equals the number of rules that apply" and "Good n means n rules passed". **Default:** compute both from the rules, so the counts always agree with the Good list (Cash back card: 1 Critical, 1 Caution, 4 Good, 6 checks run).
- **Dates stay current.** Seeded dates are relative to the moment of seeding. Each day the app is opened later, every date moves forward by the days that have passed, so "due today" is still today. Decisions people made move with them.
- **"This week" is the last 7 days**, and "8 weeks ago" is the 7 days that ended 56 days ago. A Monday-based week would make Monday's numbers look like a collapse.
- **"You reviewed this week"** counts decisions made in this workspace plus about a third of the seeded team decisions (the other two reviewers on the team made the rest).
- **Queue order** is due date, then name. That gives the wireframe's order exactly ("3 of 9" for Fall personal loan, "5 of 9" for Dream home banner).
- **Who owns an ad:** My ads needs to know which ads are this marketer's, so `ads` has an `is_mine` flag (ads 1–5 and 12–14).
- **A `compared` check run kind** exists besides `seeded` and `live`: when a resubmission can't get a live check (no API key), v2 is compared with what was sent back on v1. A quote that's no longer in the copy counts as resolved.
- **Two wireframe details conflict with the date rule:** 06-WhatChanged says "Resubmitted 40 min ago", and dates are by day, so it reads "Resubmitted today". 05-Review shows a submitter note "on Oct 2", and CLAUDE.md's seed says "Legal approved this rate wording last month.", which is used.
- **SMS** appears once in the History wireframe, but no SMS template exists, so the filler has no SMS ads.

## Live check: structured output instead of a forced tool call

CLAUDE.md asks the check to "force a tool call with a JSON schema". The default model, `claude-sonnet-5-5`, rejects forced `tool_choice` (`any` or `tool`) with a 400. **Default:** the check asks for the same JSON shape with structured outputs (`output_config.format` with a JSON schema). That is the documented replacement, and it still guarantees the shape. The schema limits `rule_id` to the rules that apply and `layer_id` to the ad's layers. The server then drops any quote that isn't an exact substring of its layer.
It also opts into the server-side refusal fallback (`fallbacks: "default"`), so a false-positive safety refusal falls back instead of failing. Any refusal that remains shows as "unavailable", like any other error.

## Add a rule: "Affiliate content" checkbox

The data model's `applies_to` allows products and/or "affiliate", but the 10-AddRule wireframe shows only the three products. **Default:** a fourth checkbox, "Affiliate content", so reviewers can add affiliate rules too.

## After the milestones: changes the project owner asked for

- **"Use this wording" replaces "Copy suggested fix".** CLAUDE.md and 03-PreCheck show a "Copy suggested fix" button, but a copied fix was often advice ("Add … right under the claim"), not text to paste. Now, when a suggestion is a change of words, "Use this wording" swaps the flagged words on the ad in one click. Seeded wording and the live check's prompt both make "Suggested wording" a drop-in replacement for the quote. A wording suggestion without a valid quote is turned into advice. Advice-style suggestions get "Edit on ad", which opens that text for editing.
- **"Mark resolved" is manual.** The marketer marks a suggestion resolved by hand (a person decides, not the check). It moves to "Resolved by you" with a green pin, can be reopened, survives a live Re-check, and the reviewer sees "The submitter marked this resolved" on the card.
- **Download ad (PNG)** in the View drawer, for Approved and Approved with changes ads only, so unapproved versions can't end up launched. It's drawn from the ad's data at full size and twice the pixel density.
- **No uploads**, on purpose (see the README's What's next).
- **Suggested fixes are words only.** The finding's sentence already says what's wrong, so the box holds just the words to use, with a copy button. Fixes that aren't about words (the tiny disclosure on Fall personal loan) show no box. This changes two wireframe lines: 05-Review's "Put the disclosure right under the rate, at a readable size." is gone, and 07-OtherFormats' "Add at the top: “…”" is now just the quoted sentence.
- **Art never covers copy.** Decorative shapes that the copy can't avoid by shrinking the headline are hidden.
- **"Use this wording" is now "Swap"**, an icon and a word at the right of the suggested wording's header, after Copy, in line with Mark resolved below. It turns into "Swapped" once used.
- **Reviewer findings can be pinned.** CLAUDE.md says reviewer findings have no click-a-spot; that still holds. But the wireframe's own hint, "Quote the words if you can.", now does something: quoted words that are on the ad pin the finding there, matched the same forgiving way as the live check's quotes (`server/quotes.py`).
- **Insights page.** CLAUDE.md's Don't list includes "a dashboard page" and "rounds on reviewer screens". The project owner added Insights (with rounds per ad) after the brief, to show the throughput story; built from their mock-up. "You reviewed this week" now counts ads, not decisions, since an ad can be sent back several times.
- **Insights** sits under History (the owner tried it as the Reviewer's home and moved it back: switching roles kept landing there). It opens with one line ("408 approved this week, up from 66 before using Fine Print.") and "Open the Queue". Card titles are the owner's: More ads approved per week, Time saved per ad, Review efficiency, Right the first time.
- **Changes required hands an internal ad to marketing.** CLAUDE.md seeds My ads as ads 1–5 and 12–14. When a reviewer requests changes on any other internal ad, it now lands in My ads too (Undo takes it back), so the marketer can Pre-check and resubmit it. Affiliate ads don't: affiliates don't log in.
- **No Add a rule** (owner's call, to keep the scope testable). The Rules page is read-only for both roles. The data model still has custom rules (`is_custom`), and the live check would use them, but there's no way to add one in the app.
