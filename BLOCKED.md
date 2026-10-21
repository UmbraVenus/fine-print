# Blocked and defaults chosen

## Stack: React + Vite + Flask instead of Next.js (decided by the project owner)

CLAUDE.md specifies Next.js, but the project owner asked for React + Vite + Flask (the repo history has the same switch). These parts of CLAUDE.md change to match:

| CLAUDE.md | Used instead |
| --- | --- |
| Next.js App Router | Vite + React; client-side routing comes in M2 |
| `next/font/google` | `@fontsource/inter` and `@fontsource/ibm-plex-mono`, self-hosted |
| `@anthropic-ai/sdk` | Anthropic Python SDK (`anthropic`) in Flask |
| Drizzle ORM + libSQL | To decide in M1. **Default:** SQLAlchemy with a libSQL driver, so the same code runs on `file:./local.db` locally and on Turso in production |
| `fp_role` cookie read by the server | Still a cookie; Flask reads it for redirects, and the client reads it for nav |

## No `ANTHROPIC_API_KEY` in this session

The environment has no `ANTHROPIC_API_KEY`, so `npm run smoke:anthropic` stops with "ANTHROPIC_API_KEY is not set". Instead, the "reply ok" call went through the Claude Code CLI on the project owner's account, which answered `ok`. The app's server-side check can't use that account login: it needs a real API key in the environment (locally in `.env`, in production as a Vercel env var).
**Default:** keep building. Seeded checks don't need a key, and Re-check shows the "unavailable" message until a key is set.
