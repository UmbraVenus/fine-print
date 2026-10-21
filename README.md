# Fine Print

**Fix it before you submit. Approve it in one pass.**

Fine Print is a marketing-compliance review workspace for ClearPath Financial, a fictional consumer lender. Marketers pre-check an ad before they submit it: an AI auto check flags likely problems against ClearPath's rules, pinned on the ad itself, with a suggested fix for each. Reviewers then work one queue, sorted by due date, where every ad arrives prepared. Suggestions are already grouped Critical, Caution and Good, the submitter's notes sit on their finding, and resubmissions show only what changed. Every decision is tracked automatically, so History has real team numbers instead of an Excel log. **The modeled result: the same three-person compliance team goes from about 66 to about 430 approved ads a week (+550%), and submit-to-approval drops from about 6 working days to about 4 hours (92% faster).**

The seeded History in this workspace follows that ramp: about 66 approvals in the oldest week, about 418 in the last 7 days.

## How to run

You need Node 22+ and Python 3.12+.

```bash
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # optional: add ANTHROPIC_API_KEY for live checks

npm run dev:api               # Flask API on :8000 (reads .env; variables already set in your shell win)
npm run dev                   # the app on http://localhost:5173 (proxies /api to Flask)
```

The first request creates `local.db` and fills it with the sample workspace. **Reset sample data** (the icon at the bottom of the sidebar) puts it back to the start at any time.

### Checks

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run build` | TypeScript check and production build |
| `npm test` | Vitest (date labels, theme) and pytest (data, stats, review actions, Pre-check, the live check with a stand-in SDK). Needs the venv active. |
| `npm run test:e2e` | Playwright: shell, tables, Review, the full loop, Rules, axe accessibility, widths, and the screenshot set in `screenshots/final`. It starts both servers on a separate `e2e.db`. It uses `/opt/pw-browsers/chromium` or `CHROMIUM_PATH` if present; otherwise run `npx playwright install chromium` once. |
| `npm run smoke:anthropic` | One tiny Anthropic call ("reply ok") to check your key |

## How to deploy (Vercel + Turso)

The frontend is a static Vite build. The API is one Python serverless function (`api/index.py`, which imports the `server/` package). `vercel.json` already sets this up.

1. **Create a Turso database** (Vercel's filesystem is read-only, so production needs Turso):
   ```bash
   turso db create fine-print
   turso db show fine-print --url      # libsql://fine-print-<you>.turso.io
   turso db tokens create fine-print   # the auth token
   ```
2. **Create a Vercel project** from this repository. Vercel detects Vite from `vercel.json`, and the Python function installs from `requirements.txt`.
3. **Set the environment variables** in the Vercel project (Production and Preview):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | The Turso URL, `libsql://…` |
   | `DATABASE_AUTH_TOKEN` | The Turso token |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key. Without it the app still works, but Re-check shows "Auto check unavailable right now". |
   | `ANTHROPIC_MODEL` | Optional. Defaults to `claude-sonnet-5-5` |
   | `WORKSPACE_TZ` | Optional. Defaults to `America/Los_Angeles` (what "Today" means) |
   | `ACCESS_KEY` | A long random value, for example from `openssl rand -hex 16`. The site then opens only from the secret link below. Leave it out to keep the site open. |

4. **Deploy.** Then open the site and press **Reset sample data** once. The first request creates the tables and seeds the workspace, in about 190 batched statements.
5. **Share the secret link:** `https://<your-app>.vercel.app/?key=<ACCESS_KEY>`. The first visit saves a cookie for 30 days and drops the key from the address bar, so the page can be bookmarked. Without it, visitors (and bots) get "This link isn't valid", and the API refuses them, so nobody else can run up live checks. Pages also ask search engines not to index them. For a hard cost limit, make the API key in its own Anthropic Console workspace with a monthly spend limit.
6. **Check it in a private window:** dates read "Today", the Queue shows 9 waiting and 4 due today, and the History numbers agree with each other.

## Assumptions

- **The throughput model.** The headline numbers are modeled estimates from the spec's assumptions: 3 reviewers; about 100 ads submitted a week; reviewing time going from 24 to 36 of 40 hours; first reviews from 20 to 10 minutes; re-reviews from 3 × 15 to 1 × 5 minutes. Pre-check, prepared review and What changed are the three levers. History tracks the numbers that would prove it: approvals a week, average turnaround, and approval on first review.
- **Two roles only.** Marketer (Marketing team) and Reviewer (Compliance team), switched from the sidebar instead of logging in. Affiliate content arrives through marketing and is labeled "Affiliate · publisher".
- **A sample library instead of uploads.** Every ad is data: a template plus text layers, drawn by one renderer per format (social square and portrait, display banner, email, landing page, blog post). The thumbnail, drawer, Review and Pre-check all show the same ad, and pins anchor to a layer and a quoted phrase. Marketers fix copy by editing it in place.
- **Seeded vs. live checks.** The sample ads carry auto check results prepared in advance, so the app is fast, repeatable and works without an API key. Re-check, and submitting when a key is set, run a live check against the current rules, including rules reviewers add. Without a key, a resubmission is compared with what was sent back on the previous version: a quote that's gone counts as resolved. The check never blocks Submit or Approve.
- **Dates stay current.** Every seeded date is relative to the moment of seeding, and each new day the app moves every date forward, so "due today" is still today when someone opens it later. Due dates are business days in Pacific time.
- **Rule wording is simplified** from Reg Z and FTC guidance for this sample workspace. It is not legal advice.

More decisions, and the defaults chosen where the brief was unclear, are in `BLOCKED.md`. `PROGRESS.md` lists what still differs from the wireframes.

### How the live check works (AI, server-side)

`POST /api/check { adVersionId }` sends Claude the rules that apply (by product, plus affiliate rules for affiliate content) and the version's text layers as plain JSON, using the Anthropic Python SDK. It asks for structured JSON output: one finding per broken rule, with the exact quote, one plain sentence and a concrete fix, plus the rules that passed. Ad text is wrapped in `<ad_copy>` and treated strictly as content, never as instructions. The server keeps findings only for rules that apply, drops any quote that isn't an exact substring of its layer, and takes severity from the rule, never from the model. Timeout is 30 seconds. Any error returns a status the UI shows as "Auto check unavailable right now. You can still submit / review as usual."

## What's next

From spec section 11. The sidebar shows the first three under "Coming next":

- **Turn compliance documents into rules.** Upload a policy, get suggested rules to review.
- **Upload your own ads** (images, PDFs, text) instead of picking from the sample library. This was left out on purpose. Every part of the review (pins on the exact words, the auto check, What changed, Swap, Mark resolved) works because an ad is text layers on a template. An uploaded image has none of that: it would first need its text read out and located on the image (so pins land in the right place), plus file storage. Until then, marketers fix copy in place, and design changes happen in their design tool.
- **Search past decisions** for precedent.
- **A safety check for hidden instructions in affiliate content**, so text inside an ad is checked, never followed. It was cut from the MVP to stay focused. Today the prompt already treats ad text as content only.
- **Pin a reviewer finding to a spot on the ad.**

## A short tour (about 5 minutes)

1. **Open Queue.** You start as a Reviewer. There are 9 ads, sorted by due date, with 4 due today. The stat cards and the trend tooltip are computed from the data.
2. **Review Fall personal loan.** Click **Review** (it opens a new tab). Pins on the ad and cards on the right are linked. Try the info icon next to "Claims · Rate claims", the submitter's note, and **Keep** on finding 1. Add a finding of your own, such as "Pick an image that doesn't suggest same-day cash."
3. **Request changes.** The message comes prefilled from what you kept and added. The next ad in the queue opens in the same tab, and the toast offers **Undo** for 5 seconds.
4. **Switch to Marketer** (VIEWING AS, top left). Fall personal loan now shows "Changes required · 2 comments from your reviewer" in My ads.
5. **Fix it and resubmit.** Click **Pre-check**. The reviewer's comments are at the top. On the rate suggestion, click **Swap** (top right of the suggested wording): the headline now reads "Personal loans from 7.99% to 29.99% APR with autopay" and shows "Edited". (Any text on the ad can also be clicked and edited by hand.) Click **Mark resolved**, add a note if you like, and **Submit**. It goes back to Pending as v2.
6. **Approve the What changed view.** Switch back to Reviewer and open Fall personal loan (now v2) from the Queue. You see v1 above v2, the rate claim under **Resolved**, and green markers on the change. Click **Approve**.
7. **Check History.** Search for "Fall personal loan" to find it at the top. The approved-this-week count went up by one. Click the name for the drawer with its full activity, and **Download ad** to get the approved ad as a PNG, ready to launch.
8. **Add a rule and Re-check.** Open **Rules** and click **Add a rule**: "Balance transfer fees", Claims, Critical, Credit card, with a Don't and a Do example. Then, as Marketer, open **Pre-check** on Cash back card and click **Re-check**. With an `ANTHROPIC_API_KEY` set, the live check now includes the new rule. Without one, you'll see "Auto check unavailable right now. You can still submit as usual."

## Stack

React 19 + TypeScript (strict) + Vite, antd v6 with one theme built from `docs/design-system/tokens.json`, Inter and IBM Plex Mono (self-hosted). Flask in `api/` and `server/`, libSQL (a local file or Turso) with numbered SQL migrations, the Anthropic Python SDK, Vitest, pytest and Playwright.
