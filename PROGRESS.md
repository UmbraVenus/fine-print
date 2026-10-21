# Progress

- [x] **M0 · Setup**: React + Vite + TS (strict), antd v6 theme from `tokens.json`, Inter and IBM Plex Mono, ESLint, Vitest, Playwright, Flask API with pytest, `.env.example`, README skeleton.
  - Checks: `npm run lint`, `npm run build`, `npm test` (3 passed), `npm run test:api` (1 passed) and `npm run test:e2e` (2 passed: the home page opens, and `/api/health` answers through the dev proxy).
- [x] **M1 · Data**: libSQL schema and migrations (`server/migrations`), one `seed.py` used by the first run and by Reset (`POST /api/reset`), every date relative to now, ~9 weeks of History filler (about 2,000 closed ads, ~10% affiliate, volume ramping 66 → 418 a week).
  - Checks: `npm test` runs Vitest (date labels "Today", "Tomorrow", "Oct 23") and pytest (24 tests: seed counts 9 pending / 4 due today / 8 in My ads, business-day math, stats agree with table rows, filters, search, reset, daily date refresh).
- [ ] M2 · Shell
- [ ] M3 · Tables
- [ ] M4 · Review
- [ ] M5 · Pre-check and the loop
- [ ] M6 · Live check and rules
- [ ] M7 · Polish
- [ ] M8 · README

## Ideas, not built

_None yet._
