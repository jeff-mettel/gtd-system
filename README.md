# GTD System

An AI-assisted Getting Things Done system for program management. The personal
system tracks *commitments* — what I owe, what's owed to me, by whom, since when —
organized as programs → projects → next actions. AI handles the high-volume stages
(capture, drafting the clarification, preparing the review, generating views,
drafting nudges); the human owns the two moments that create trust: confirming what
an item *is*, and doing the weekly review.

## Layout

| Path | What |
|---|---|
| `packages/ledger/` | Event schema v1, validation, fold, upcasters, ids, and the demo fixture. Every writer imports it. |
| `server/` | The local service: the only ledger writer, JSON API, `claude -p` job runner with per-job model tiers, scheduler, macOS/connector calendar ingest, backup (git commit of the data repo). |
| `bin/gtd` | CLI — thin client of the server; the write path for Claude jobs (`GTD_ACTOR` required). `bin/gtd-hook` is the PreToolUse guard. |
| `.claude/agents`, `.claude/skills` | The Claude jobs (`gtd-clarify`, `gtd-suggest`, `gtd-nudge`, `gtd-prep`, `gtd-review`, `gtd-compile`, `gtd-ingest-calendar`) and the harness deny rules. |
| `frontend/` | The event-sourced front-end (Vite, plain ES modules): `src/store.js` (commit/fold, server or local backend), `src/views`, `src/drawers`, `src/features`, `src/replay`. Built output is served by the server and published as the demo artifact. |
| `docs/beta-plan.md`, `docs/ledger-events.md`, `docs/runbook-beta.md` | The beta plan, the event contract, and how to install/run/upgrade. |
| `docs/architecture.md` | The architecture: GTD mapping, data model, capture, clarify engine, views, agents, trust invariants, phasing. |
| `docs/backend-wiring.md` | How the front-end connects to a real back-end: event log, endpoints, the five typed model calls, confidence gating, evals. |
| `docs/subscription-wiring.md` | The same back-end on a Claude subscription instead of an API key: skills + subagents per tier, the `gtd` CLI as the single write path, harness-enforced trust rules. |
| `docs/wiki.md` | The program wiki (Karpathy pattern): ledger vs. wiki, page structure, compiled-section markers, the three write paths, lint. |
| `wiki/` | The wiki itself — hub, decisions, timeline, risks per program; person pages; `index.md` + `log.md`. Seeded with example programs. |
| `docs/delegation.md` | Delegating work to the AI: the three levels, the review gate, autonomy settings, how it shows in each view. |
| `docs/decisions.md` | Running log of design decisions made in collaboration, newest first. |

## Status

Beta foundation: event-sourced front-end over a local service and the `packages/ledger` contract; Claude jobs run under your subscription via `claude -p`; Google Calendar via macOS Calendar or the connector. See `docs/runbook-beta.md` to run it on real data (empty start, data in `~/GTD-data`).

Published prototype: https://claude.ai/code/artifact/11289ecb-31a3-4cdc-a8e5-c7b3861d58b6

## Running it

```bash
npm install && npm run build && npm run serve
```

Then open http://localhost:4310 (data in `~/GTD-data`, created on first run). For front-end work: `cd frontend && npm run dev` (http://localhost:5173, `?demo=1` for example data). Everything is client-side; "Reset demo data" on the
Flow view clears localStorage. `npm test` runs the Vitest suites (event log, fold);
`npm run lint` runs ESLint; `npm run build:artifact` writes `dist/` plus
`dist/artifact.html`, the fragment published to the artifact URL above.
