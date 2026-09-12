# GTD gap review — 2026-09-12

Node-by-node comparison of the prototype against the canonical GTD workflow
(Stuff → In → What is it? → Is it actionable? → No: trash / incubate / reference;
Yes: project or next action → do / delegate / defer → calendar or next-action list;
weekly review).

## Node-by-node

| GTD node | Status | Notes |
|---|---|---|
| Stuff → IN | ✓ prototype · ◐ system | Capture box works; ingestors are designed, not built |
| What is it? / Is it actionable? | ✓ | Inbox asks the question literally; AI proposal pre-selected |
| No → Trash | ◐ | Not recoverable — no trash view |
| No → Incubate (someday/maybe) | ◐ | Only visible in the weekly review; no "revisit on" date |
| No → Reference | ✗ | Filed items vanish; no reference list |
| Yes → Projects → Planning → Project plans | ◐ | Outcome + next action exist; no plan (natural planning model) |
| What's the next action? | ✓ | Required, verb-first, AI-suggested |
| Do it (2-minute rule) | ◐ | AI can; the human has no "done now" exit from the inbox |
| Delegate → Waiting for | ✓✓ | People and AI, aged, nudged, follow-up strip |
| Defer → Calendar (hard landscape) | ✗ | Only soft `due`; no day-specific actions, no tickler |
| Defer → Next action lists | ✓ | By context; project-next marked |
| Weekly review | ✓ | Plus horizons, AI audit, wiki lint; missing mind sweep and calendar sweeps |

Beyond the diagram: delegated-to-AI lane with review gate, program wiki, computed
movement, flow metrics, audit trail.

## Recommendations (ranked)

1. **Calendar / hard landscape + tickler.** `hard` date on actions, distinct from
   `due`; Today shows them with meetings; a 7-day strip; hard-dated actions leave the
   context lists. Someday and reference items get "revisit on" and resurface into the
   inbox that morning.
2. **Human two-minute path.** "Do it now" in the inbox: marks done without filing.
3. **Reference → the wiki.** Filing as reference picks a page (program hub key links,
   person, or new ref page); the reference list is the wiki index.
4. **Someday / maybe list** with revisit dates and a visible count.
5. **Weekly review steps:** mind sweep (trigger list + capture), past-calendar sweep
   (meetings with no captured items), upcoming-calendar preview.
6. **Project plans** — `project-<slug>.md` or a Plan section: outcome → brainstorm →
   ordered sub-steps; AI drafts from the outcome.
7. **Now filters** by time available and energy.
8. **Trash with 30-day undo.**
9. **Horizons page** above programs, reviewed monthly.

Execution order: 1–3 first (structural), then 4, 5, 7, 8; 6 and 9 later.
