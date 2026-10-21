# Fine Print

A marketing-compliance review tool for ClearPath Financial (a fictional consumer lender). Marketers pre-check their ads against the compliance rules. Reviewers work a queue, where an AI auto check has already flagged likely issues.

_The full overview and headline number come in M8._

## Stack

- **Frontend:** React 19 + TypeScript (strict) + Vite, with antd v6 and `@ant-design/icons`. The theme is built from `docs/design-system/tokens.json` (`src/theme.ts`). Inter and IBM Plex Mono are self-hosted via `@fontsource`.
- **Backend:** Flask (Python) in `api/`, served as a Vercel Python function. Every route starts with `/api/`.
- **AI:** the Anthropic Python SDK, server-side only.
- **Tests:** Vitest (frontend logic), pytest (API), Playwright (end to end).

## How to run

Requires Node 22+ and Python 3.12+.

```bash
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY if you have one

npm run dev:api        # Flask on :8000
npm run dev            # Vite on :5173, proxies /api to Flask
```

## Checks

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run build` | Type check + production build |
| `npm test` | Vitest unit tests |
| `npm run test:api` | pytest for the Flask API (venv active) |
| `npm run test:e2e` | Playwright (starts both servers). It uses `/opt/pw-browsers/chromium` or `CHROMIUM_PATH` when present; otherwise run `npx playwright install chromium` once. |
| `npm run smoke:anthropic` | One tiny Anthropic call ("reply ok") using `ANTHROPIC_API_KEY` |

## Environment variables

See `.env.example`: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`).

## How to deploy

_Written in M8 (Vercel + Turso + env vars)._

## Assumptions

_Written in M8._

## What's next

_Written in M8._
