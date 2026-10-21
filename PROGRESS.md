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
- [ ] M5 · Pre-check and the loop
- [ ] M6 · Live check and rules
- [ ] M7 · Polish
- [ ] M8 · README

## Ideas, not built

_None yet._
