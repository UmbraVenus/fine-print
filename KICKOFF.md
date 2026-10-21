# Kickoff

## Before you sleep (about 15 min)

1. Create an empty GitHub repo, e.g. `fine-print`.
2. Unzip this package into the repo root and commit it:
   - `CLAUDE.md`
   - `docs/spec.md`
   - `docs/wireframes/`
   - `docs/design-system/`
3. Start a **cloud Claude Code session** on that repo, so it runs sandboxed while you sleep.
   - Model: Opus. Effort: high.
   - Let it run without permission prompts. Only do this in the sandboxed cloud session, never on your laptop.
   - Add `ANTHROPIC_API_KEY` as an environment variable or secret for the session. Never commit it.
4. Paste the prompt below.

## Prompt

> Read CLAUDE.md fully, then skim docs/spec.md and look at every image in docs/wireframes/.
> Build Fine Print by working through the milestones in CLAUDE.md in order.
> After each milestone: run its checks, save screenshots to /screenshots, commit, and update PROGRESS.md.
> Do not move on until the current milestone's checks pass. If blocked, write it in BLOCKED.md with the default you chose, and continue.
> Match the wireframes closely: spacing, copy and colors. Do not add anything that isn't in CLAUDE.md.
> When all milestones are done, do one last pass comparing every page screenshot to its wireframe and fix differences.

## In the morning

1. Read `PROGRESS.md` and `BLOCKED.md` first.
2. Run it locally, then follow the tour script in the README yourself.
3. Deploy:
   - Create a Turso database.
   - Create a Vercel project and set these env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
   - Deploy, then press "Reset sample data" once.
4. Check the deployed URL in a private window: dates read "Today" and the numbers agree.
