# Ledger event contract — v1

The ledger is `events.jsonl`: one JSON object per line, append-only. Everything the
app shows is a fold over it (`packages/ledger/fold.js`). This file is the contract
between the front-end store, the server, the `gtd` CLI and the Claude jobs.

## Envelope

```json
{ "seq": 412, "id": "e_01J…", "v": 1, "at": "2026-09-14T08:12:03.120-05:00",
  "actor": "jeff", "type": "accepted", "item": "i_01J…", "payload": { … } }
```

- `seq` — assigned by the writer (server or local store), monotonic.
- `actor` — `jeff` · `ai:<job>` (`ai:clarify`, `ai:wiki`, …) · `ingest:<source>`
  (`ingest:calendar`) · `system` (migrations, jobs).
- `item` — the item id when the event is about one; else absent.
- Ids: `i_` items, `p_` programs, `j_` projects, `u_` people, `r_` job runs, `e_` events
  (ULID-ish; any unique string is accepted).

## Types and payloads

Entities

| type | payload |
|---|---|
| `program_created` | `{ program:{ id, name, purpose, sponsor?, cadence?, color? } }` |
| `program_updated` | `{ id, fields }` (name, purpose, sponsor, cadence, color) |
| `program_retired` | `{ id }` |
| `project_created` | `{ project:{ id, program, name, outcome, health } }` |
| `project_updated` | `{ id, fields }` (program, health, outcome, dropped, suggest) |
| `person_created` | `{ person:{ id, name, role?, channels?:{ email?: string[], slack?: string } } }` — `channels.email` is what calendar attendee matching uses |
| `person_updated` | `{ id, fields }` |

Items (every one carries `item`)

| type | payload | fold effect |
|---|---|---|
| `captured` | `{ source, ref?, raw, from?, image?, mentions?, minutes? }` | kind `inbox` |
| `clarified` | `{ proposal:{ kind, next, project?, owner?, ctx?, min?, due?, hard?, start?, repeat?, revisit?, refPage?, conf, why, ai? } }` | sets `p` |
| `accepted` | `{ kind, fields }` — `kind` ∈ action · waiting · someday · reference · done · trash; `fields` are the final values (next, project, owner, ctx, min, due, hard, start, repeat, revisit, refPage, since, followUp) | kind + fields; `confirmed_by` = actor |
| `edited` | `{ fields }` | merge (dates, project move sets `movedAt`, energy, primary) |
| `done` / `undone` | `{}` | kind done / previous |
| `trashed` / `restored` | `{}` | kind trash / inbox |
| `parked` / `promoted` / `dropped` | `{ revisit? }` / `{}` / `{}` | someday / action / trash |
| `nudged` | `{ text, channel? }` | nudges+1, lastNudged, followUp+5d |
| `handed_off` | `{ cap, what, effect, minutes? }` | owner `ai`, del.status queued |
| `delivered` | `{ deliverable, for?:{ kind:'meeting'|'status'|'review'|'wiki', id? } }` | del.status ready; may omit `item` when `for` names a target (prep briefs, status/review drafts land in the Ready lane keyed by `for`) |
| `approved` | `{ deliverable?, effect }` | done; del.status approved |
| `taken_back` | `{}` | owner cleared |
| `next_action_set` | `{ project }` | primary for project (human) |
| `next_action_proposed` | `{ project, proposal:{ next, ctx?, min?, why } }` | AI-writable; shows in the project drawer as a suggestion until accepted (accepting = `captured`+`accepted` by the human) |
| `resurfaced` | `{ for }` (`revisit` or `start` date it fired for) | tickler back in inbox / deferred back today |

Knowledge and system

| type | payload |
|---|---|
| `milestone_added` | `{ program, milestone:{ label, what, state, iso } }` |
| `decision_recorded` | `{ program, decision:{ on, what, who, why, status, projects? } }` |
| `wiki_changed` | `{ page, words, summary?, item? }` |
| `review_completed` | `{ steps? }` |
| `config_set` | `{ key, value }` — keys `autonomy.<cap>`, `models.<job>`, `prompts.<job>`, `progColor.<program>` |
| `job_started` / `job_finished` / `job_failed` | `{ job, run, args? }` / `{ job, run, summary?, events? }` / `{ job, run, error }` |
| `calendar_synced` | `{ window:{ from, to }, events:[{ id, title, start, end, attendees:[{ name, email }], who:[personId], calendar, location?, allDay? }], source:'macos'\|'connector' }` — actor `ingest:calendar`; folds into `meetings` (today), `calendarAhead`, `pastMeetings` and `calendarWindow`; a later sync replaces the window |
| `migrated` | `{ from, to }` |

## Rules

- Writers validate: unknown `type` → reject; required payload fields per table → reject;
  `project`/`owner` must name an existing id (or be null) — enums built from the fold at
  write time. AI actors may only write `captured`, `clarified`, `delivered`, `next_action_proposed`,
  `wiki_changed`, `job_*`, `milestone_added` (proposed), `decision_recorded` (proposed);
  `ingest:*` actors write `captured` and `calendar_synced`; never `approved`, `accepted`,
  `nudged`, `done`.
- Idempotency: `captured` with the same `ref` as an existing item is a no-op that
  returns the existing item id.
- Upcasters live in `packages/ledger/migrations/` as `v1_to_v2.js` etc.; `fold`
  always runs `upcast()` first.
- The demo fixture is the example data expressed as this event stream
  (`frontend/src/replay/events.js` already does most of it).

## Optional payload fields the front-end store writes (v1 additions, 2026-09-13)

Additive only — every field below is optional and the tables above stay valid.
`packages/ledger/schema.js` is the executable form; `packages/ledger/README.md` documents the fold.

- `program_created.program.page` — the wiki hub slug (`program-billing-migration`); default `program-<slug(name)>`.
- `clarified.proposal.followUp` — for a waiting proposal.
- `accepted.fields` may also carry `energy`, `ai` (the "AI can help" hint carried from the proposal),
  `spawnedFrom` (a repeat instance names the action it was spawned from), `since`, `filedAt`, `createdAt`.
- `captured.source` values in use: `email chat meeting voice calendar capture sweep screenshot tickler repeat cli`;
  `captured.ref` for repeat instances is `repeat:<item>:<date>`, for calendar-captured items `cal:event/<id>`.
- `nudged.followUp` — the follow-up date the sender chose; the fold uses it instead of `at + 5 d`.
- `job_started` may name an `item` on the envelope: the fold moves that item's `del.status` to `working`
  (`args.progress` optional). `job_finished` may name the item it worked on (`ai:nudge` drafts, for instance).
- `wiki_changed.program` — which program the page belongs to (else matched by page prefix);
  `wiki_changed.fields` — merged into the program's wiki entry (`status`, `health`, `links`, `risks`, `pending`,
  `compiled: true | iso`), which is how the compile job publishes a new status paragraph.
- `edited.fields` may carry any item field, `kind` included — the store's Undo re-appends the prior fields when no
  compensating type exists (`accepted` → `edited { kind:'inbox', … }`, `parked` → `edited { kind:'action', … }`).
- `resurfaced` is written by the front-end store (actor `system`) when a revisit or start date arrives; the fold
  keeps `resurfacedFor` per item so a date fires once.
- `review_completed.steps` — the step ids ticked when the review was completed.
- The demo fixture lives in `packages/ledger/demo.js` (`demoEvents()`); its background-volume items carry
  `ref: demo:bg/<id>` and are shown by the Replay only.
