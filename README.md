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
| `frontend/` | The front-end: a Vite project in plain ES modules. `src/data` (example ledger), `src/model.js` (derived reads), `src/views`, `src/drawers`, `src/replay` (the event log, its fold, and the three.js scene shown in Flow), `tests/` (Vitest). Built output is published as the artifact. |
| `docs/architecture.md` | The architecture: GTD mapping, data model, capture, clarify engine, views, agents, trust invariants, phasing. |
| `docs/backend-wiring.md` | How the front-end connects to a real back-end: event log, endpoints, the five typed model calls, confidence gating, evals. |
| `docs/subscription-wiring.md` | The same back-end on a Claude subscription instead of an API key: skills + subagents per tier, the `gtd` CLI as the single write path, harness-enforced trust rules. |
| `docs/wiki.md` | The program wiki (Karpathy pattern): ledger vs. wiki, page structure, compiled-section markers, the three write paths, lint. |
| `wiki/` | The wiki itself — hub, decisions, timeline, risks per program; person pages; `index.md` + `log.md`. Seeded with example programs. |
| `docs/delegation.md` | Delegating work to the AI: the three levels, the review gate, autonomy settings, how it shows in each view. |
| `docs/decisions.md` | Running log of design decisions made in collaboration, newest first. |

## Status

Design and front-end prototype. No back-end yet — see `docs/backend-wiring.md` for the plan.

Published prototype: https://claude.ai/code/artifact/11289ecb-31a3-4cdc-a8e5-c7b3861d58b6

## Running the front-end

```bash
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173. Everything is client-side; "Reset demo data" on the
Flow view clears localStorage. `npm test` runs the Vitest suites (event log, fold);
`npm run lint` runs ESLint; `npm run build:artifact` writes `dist/` plus
`dist/artifact.html`, the fragment published to the artifact URL above.
