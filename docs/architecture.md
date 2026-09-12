# Architecture

## Thesis

GTD works because of a *trusted system*: everything is captured into it, each item is
clarified into a concrete next action or a "waiting for," and the whole thing is
reviewed on a cadence so your brain stops holding it. It collapses in two places —
capture leaks (asks arrive in six places, you record four) and the weekly review
decays (it's tedious, so it stops happening).

For a Program Manager, most tracked work is *other people's*. Your own next-action
list is short; your "Waiting For" list is enormous and is where programs slip. So a
PM's GTD system is a **commitments ledger** — what I owe, what's owed to me, by whom,
since when — with projects and programs as the structure above it.

AI's job description follows from that:

- AI owns the tedious, high-volume stages: capture from every surface, drafting the
  clarification, preparing the review, generating views, drafting nudges.
- The human owns the two moments where judgment creates trust: confirming what an item
  *is*, and doing the weekly review.
- **Invariant: AI proposes, the human disposes; everything AI does is logged and
  reversible.** If AI auto-files everything, lists fill with misjudged items and the
  system dies the way paper GTD dies.

## The five GTD stages

| Stage | GTD says | AI does | Human does |
|---|---|---|---|
| Capture | Everything into one inbox | Ingest from every surface on a schedule; dedupe; link back to source | Quick-capture from phone/voice/chat |
| Clarify | Is it actionable? Next action? | Draft a structured clarification with a confidence score; do 2-minute items as drafts awaiting approval | Confirm/correct in a fast triage view (<10 s per item) |
| Organize | Route to lists by context | Views computed from data | Nothing |
| Reflect | Weekly review | Prepare it: stalled projects, aging waiting-fors, projects with no next action, wins → status draft | Walk the review; make the calls |
| Engage | Do the right thing now | Morning brief, pre-meeting prep, "what fits this gap," drafted nudges | Decide, act, approve sends |

## Data model — the commitment store

GTD's lists are views over one set of entities:

- **Item** — the universal unit. `id`, `source`, `source_ref` (URI: `gmail:thread/…`,
  `cal:event/…`, `voice:<ts>`, `chat:<session>`), `captured_at`, `raw`; after clarify:
  `kind` (action | waiting | project-seed | reference | someday | trash), `next_action`
  (verb-first), `owner` (me | person | ai), `context` (`@deep`, `@quick`, `@1:1/<person>`,
  `@meeting/<recurring>`, `@agenda/<forum>`), `minutes`, `due`, `tickler`, `project`,
  `confidence`, `confirmed_by_human`.
- **Project** — any outcome needing more than one step. `outcome` (what done looks
  like — required), one *primary* next action, `status`, `program`, `health`,
  `stakeholders`, `milestones`. Last movement is **computed** from item activity,
  never stored.
- **Program** — GTD's Area of Responsibility. `purpose` (required), `sponsor`,
  `cadences`, health rolled up from projects. Has no next action of its own. Created
  rarely and deliberately (Programs header, review horizons step, or an inbox item
  clarified as `kind: program`); creation stubs its wiki hub. Retired, never deleted:
  requires all projects moved or dropped; wiki pages stay as history.
- **Person** — the PM-specific addition. What I'm waiting on from them, what they're
  waiting on from me, last touched, queued 1:1 agenda.
- **Decision**, **Risk** — lightweight, linked to project.
- **Meeting** — calendar event → prep brief → notes → extracted items.

"Waiting For" is `Item.kind = waiting` with `owner ≠ me`, `since`, `follow_up_on`,
`nudge_count` — aged like receivables (0–7, 8–14, 15–30, 30+ days).

### The one rule the Programs view enforces

Every active project must have exactly one of: a next action owned by me, a waiting-for
owned by someone else, or an item delegated to the AI. Otherwise it's flagged
**No next action**. Independently, **Stalled** fires when nothing has moved in >7 days.

### Storage

Resolved 2026-09-12 (see `decisions.md`): an append-only event log
`ledger/events.jsonl` is canonical — plain text, git-tracked, Claude-readable,
replayable. A SQLite index is derived from it for queries; markdown + frontmatter
pages (programs, projects, people) are a one-directional projection for Obsidian
reading, added when wanted. Not folders-as-status and not tags: the views need
history, and a frontmatter file only holds current state. Details in
`backend-wiring.md`; the same design on a Claude subscription (no API key) is in
`subscription-wiring.md`.

Scoping rule: team systems of record (issue trackers etc.) are **not mirrored**. The
store only holds items where *I* have an action or am waiting on someone, with a
`source_ref` back. Two sources of truth both rot.

## Capture layer

One ingestor per surface, idempotent on `source_ref`, run by scheduled tasks:
email, calendar (every meeting → Meeting record; recurring meetings get a standing
`@agenda` context), chat, doc comments, voice/phone (append to `inbox.md`), and chat
with Claude ("remind me to…" writes an item directly).

## Clarify engine

Claude runs over the inbox with a strict output schema per item: `actionable`, `kind`,
`next_action`, `owner`, `project_match` (existing id or proposed new project with an
outcome), `context`, `minutes`, `due`, `waiting_on`, `confidence`, `rationale`. Gate on
confidence:

- High → filed, marked `confirmed_by_human: false` until seen in the weekly review.
- Low → triage queue, AI's guess pre-selected so confirmation is one keystroke.
- Two-minute rule → if the action is "reply to X" / "schedule with Y," AI drafts it and
  queues for approval. It never sends.

The triage view is the single most important UI. If it's fast the system runs.

## Views

1. **Now** — what to do in the next hour: calendar with prep, due today, overdue
   waiting-fors, next actions by context, AI work ready for review.
2. **Program board** — programs → projects; health, next action, days since movement,
   stalled / no-next-action flags.
3. **Waiting-for ledger** — by person, aging buckets, nudge history, draft nudge.
4. **People** — each stakeholder in both directions, plus 1:1 agenda queue.
5. **Weekly review** — Allen's checklist with the data inline; steps auto-complete
   when the data says so.
6. **Flow** — captured / clarified / done per week, cycle time by list, inbox-zero
   streak. Tells you the *system* is decaying before you feel it.
7. **Delegated to AI** — see `delegation.md`.
8. **Someday / maybe** — parked items with optional revisit dates (ticklers).
9. **Reference** — the wiki index: program hubs and key links, filed items, people pages.

The **calendar / hard landscape** lives inside Now: actions with a `hard` date must
happen on that day, so they appear in Today and the 7-day strip and leave the context
lists. Ticklers (someday or reference items with a `revisit` date) re-enter the inbox
on that morning. The inbox offers the human two-minute path ("Do it now") and
reference filing into the wiki. Trash is kept 30 days and restorable.

Programs, the project drawer and prep briefs also read from the **program wiki** —
see `wiki.md`.

## Agents and cadences

| Skill | Trigger | Does |
|---|---|---|
| `/capture <text>` | any time | Writes an item |
| `/ingest` | hourly | Runs all ingestors, dry-run logs additions |
| `/triage` | inbox > 0 | Presents clarify drafts for confirmation |
| `/brief` | 07:00 weekdays | Morning brief + Now view |
| `/prep <meeting>` | 15 min before | Related project, open items with attendees, waiting-fors, last decisions |
| `/nudge` | daily | Drafts follow-ups past `follow_up_on`; each approved individually |
| `/status <program>` | weekly | Status report from health + wins + risks + decisions |
| `/review` | Friday 15:00 | Builds the weekly review page |

## Trust invariants

- AI never sends, posts, or deletes. It drafts; you approve.
- Every AI write is tagged (`ai-filed`, `ai-drafted`, `ai-suggested`) and logged.
- Dry-run by default; `--apply` mutates.
- Nothing leaves the inbox without a `next_action` phrased as a physical, visible
  action. "Follow up on budget" isn't one; "Email Priya asking for the Q4 budget
  revision by Thursday" is.

## Phasing

- Week 1: repo, schema, `/capture`, `/triage`, the Now view. Build the habit with
  manual capture before automating.
- Weeks 2–3: ingestors; morning brief integration.
- Weeks 4–5: waiting-for ledger, `/nudge`, `/prep`, weekly review page.
- After: program board, status generation, flow analytics, interactive dashboards,
  delegation to AI.
