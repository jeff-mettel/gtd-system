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
| `frontend/commitment-ledger.html` | Self-contained front-end (vanilla JS, example data, localStorage). Published as an artifact for review. |
| `frontend/replay.html` | Replay: a three.js scene where every item is a ball moving through the system (ports → inbox → clarify gate → project tracks / waiting shelf / AI machine → done heap, wiki wall behind), scrubbed over an event log derived from the same example data. Opens locally; not yet embedded in the ledger. |
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

Open `frontend/commitment-ledger.html` in a browser. Everything is client-side;
"Reset demo data" on the Flow view clears localStorage.
