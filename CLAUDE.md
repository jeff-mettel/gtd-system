# GTD System — working notes for Claude

- Read `docs/architecture.md` first; `docs/decisions.md` is the running log — append a
  line there for every design decision made in conversation.
- Layout: `packages/ledger` (event schema, validate, fold, upcasters, demo fixture — the
  single source of truth for every writer), `server/` (local service: the only ledger
  writer, JSON API, `claude -p` job runner, scheduler, calendar ingest), `bin/gtd` (CLI,
  thin HTTP client — the write path for Claude jobs), `frontend/` (Vite, plain ES modules,
  event-sourced: every mutation is `commit(type, payload)` in `src/store.js`; no example
  data mutation — `packages/ledger/demo.js` seeds the published demo), `.claude/agents`
  + `.claude/skills/gtd-*` (the jobs), `docs/` (architecture, contract, plan, runbook).
- Contract: `docs/ledger-events.md`. Adding an event type means: schema + fold + tests in
  `packages/ledger`, then the front-end/server. Never change a shipped type's shape
  without an upcaster in `packages/ledger/migrations/`.
- User data never lives in this repo: `GTD_DATA` (default `~/GTD-data`). Tests use temp dirs.
- Run: `npm run dev` from `frontend/` (talks to a server on :4310 if one is running, else
  the local demo ledger; `?demo=1` seeds the demo); `npm run serve` at the root starts the
  server. `npm test` at the root runs server + frontend tests; also run
  `npx vitest run` in `packages/ledger`. Lint and tests must pass before publishing. Publish with `npm run build:artifact`, then
  the Artifact tool with `frontend/dist/artifact.html`, `root: frontend/dist`, the
  `assets/*` files (not the `.map`s), and the existing artifact `url` from `README.md` —
  never create a second artifact.
- One session in this checkout at a time. A parallel session that commits with
  `git add -A` sweeps another session's half-finished work into unrelated commits.
- Demo "today" is Mon 14 Sep 2026; dates in example data are relative to `TODAY`.
- Trust invariants are not negotiable in the UI: the AI never sends, books, or deletes
  without approval; every AI write is tagged; "what approving does" is declared, not
  model-written.
- `wiki/` follows the Karpathy conventions in `docs/wiki.md` (same as `knowledge/`):
  frontmatter, `index.md` line and `log.md` entry for every page change; never edit
  inside `<!-- compiled:… -->` fences by hand — that's the compile job's territory.
- Charts follow the dataviz palette already in the file (`--s1..--s3`, `--o1..--o4`).
  Status colors are separate from the accent and always come with a label.
