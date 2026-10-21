# Progress

- [x] **M0 · Setup**: React + Vite + TS (strict), antd v6 theme from `tokens.json`, Inter and IBM Plex Mono, ESLint, Vitest, Playwright, Flask API with pytest, `.env.example`, README skeleton.
  - Checks: `npm run lint`, `npm run build`, `npm test` (3 passed), `npm run test:api` (1 passed) and `npm run test:e2e` (2 passed: the home page opens, and `/api/health` answers through the dev proxy).
- [x] **M1 · Data**: libSQL schema and migrations (`server/migrations`), one `seed.py` used by the first run and by Reset (`POST /api/reset`), every date relative to now, ~9 weeks of History filler (about 2,000 closed ads, ~10% affiliate, volume ramping 66 → 418 a week).
  - Checks: `npm test` runs Vitest (date labels "Today", "Tomorrow", "Oct 23") and pytest (24 tests: seed counts 9 pending / 4 due today / 8 in My ads, business-day math, stats agree with table rows, filters, search, reset, daily date refresh).
- [x] **M2 · Shell**: navy sidebar with the dark wordmark, VIEWING AS dropdown (sets `fp_role` and goes to that role's home), nav per role with the pending badge, collapsible sidebar, collapsed "Coming next", Reset sample data with a confirm. One renderer per template (social square and portrait, banner, email, landing page, blog post), with outline or underline markers and pins, and a 56px thumbnail that scales the same renderer.
  - Checks: `e2e/shell.spec.ts` (nav per role, cookie, redirects, Coming next, reset, collapse). Screenshots `screenshots/m2-*.png`.
- [x] **M3 · Tables**: one antd Table for My ads, Queue and History with header filters (Reset / Apply), name and date sorting, search, pagination with "Go to" past 5 pages, empty states, computed stat cards with trend tooltips, and the View drawer (`?view=<id>`, Esc closes).
  - Checks: `e2e/tables.spec.ts` (stats agree with rows, filters, search, pagination, drawer). Screenshots `screenshots/m3-*.png`, compared side by side with 01, 02, 04 and 08.
- [x] **M4 · Review**: header with Previous / "3 of 9" / Next in queue order, the ad with linked pins and cards, Critical and Caution groups open, Good and Dismissed collapsed, Keep (toggles to a dark "✓ Kept"), Edit, Dismiss… with a required reason (and Restore), Your findings (add, edit, delete), a sticky decision bar, message dialogs prefilled from what's kept, a 5-second "Approved · Undo" toast that restores everything, the next ad opens in the same tab, and an empty state when the queue clears.
  - Checks: `e2e/review.spec.ts` ("reviewer requests changes on Fall personal loan", Undo, Previous / Next, What changed, text formats, queue cleared) and `tests/server/test_review.py`. Screenshots `screenshots/m4-*.png` vs 05.
- [x] **M5 · Pre-check and the loop**: click any text layer to edit it in place (saved as you go, marked "Edited"), Copy suggested fix, Add a note (saved as you type), Re-check (shows "Auto check unavailable right now…" without a key), Submit (Pending, due 1 business day later, a new version after Changes required, events logged), "From your reviewer" on returned ads, and What changed (v1 above v2, resolved items green on v2, Resolved / Still open / New by rule and layer).
  - Checks: `e2e/loop.spec.ts` runs the full loop (marketer edits Holiday debt email → submits v2 → reviewer sees What changed → approves → History → My ads shows Approved) and the Pre-check details; `tests/server/test_precheck.py`.
- [x] **M6 · Live check and rules**: `POST /api/check { adVersionId }` with the Anthropic Python SDK (model from `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`, 30-second timeout, no retries past it), the applicable rules plus custom ones, structured JSON output, quote validation, severity from the rule, notes kept across re-checks, and an "unavailable" status on any error or without a key. The Rules page with its three sections, and Add a rule (reviewer only) with validation.
  - Checks: `tests/server/test_checker.py` with a stand-in SDK (request and schema, quote validation, errors change nothing, no key, custom rules join the check) and `e2e/rules.spec.ts`. No API key here, so the in-app live smoke test is skipped. Instead, the exact prompt and schema went to `claude-sonnet-5-5` through the Claude CLI. For Best loans of 2026 and Cash back card it returned the same findings as the seeded results (3 Critical / 4 Good; 1 Critical, 1 Caution / 4 Good), and every quote passed validation.
- [x] **M7 · Polish**: every page compared with its wireframe at 1280px (`screenshots/final/01-…10-…png`, made by `e2e/screenshots.spec.ts`), with spacing, copy and colors fixed along the way. Keyboard pass through Review (every pin, card action and decision is reachable, and each focused element shows the teal ring). axe (`@axe-core/playwright`, WCAG 2.1 AA) finds no serious or critical issues on 10 pages. Layout holds at 1024, 1280 and 1440, with no sideways scrolling: below 1100px the sidebar starts collapsed and the table scrolls inside its card.
  - Checks: `e2e/a11y.spec.ts` and `e2e/screenshots.spec.ts`.

### What still differs from the wireframes

- **Good and checks-run counts** are computed from the rules (see BLOCKED.md), so 03, 05 and 07 show one fewer Good and one fewer check than the wireframes. Example: Cash back card shows "4 Good · 6 checks run", where the wireframe has 5 and 7.
- **05-Review** shows a review in progress (#1 Kept, one finding from you). The seed starts before any of that, and `screenshots/final/05-review.png` recreates that state by clicking.
- **06-What changed**: "Resubmitted today" instead of "40 min ago" (dates by day). The resolved headlines are computed from the change ("Added “ClearPath Home Loans · NMLS ID 123456”.") instead of the wireframe's handwritten "NMLS ID added under the banner.".
- **07-Other formats** is a reference sheet, not a route: emails, landing pages and blog posts render inside Review and Pre-check. Consolidation page's fee finding is pinned once, on the claim, not also on the footer qualifier, because a finding has one layer. Emails have a thin brand-colored bar at the top, so their thumbnails can be told apart.
- **01-My ads**: the wireframe shows a "v1" chip on Holiday debt email. CLAUDE.md asks for a chip only when the version is above 1, so there's none.
- **04-Queue**: Fixed rate Instagram is due "Oct 26" (3 business days), where the wireframe shows Oct 24, a Saturday.
- **08-History**: every number is computed, so the totals and trends differ from the wireframe's (about 2,000 approved ads instead of 1,284). There are no SMS ads because there is no SMS template.
- **10-Add a rule** has a fourth "Affiliate content" checkbox (see BLOCKED.md).
- **The decision bar** sticks to the bottom of the window, so Approve is always in reach. At the end of the page it sits exactly where the wireframe puts it.
- **Rows per page** is an antd Select, not a native select. The format filter also lists "Instagram post", which only affiliates use.
- [ ] M8 · README

## Ideas, not built

_None yet._
