# @gtd/ledger

The ledger as code: event schema v1 (`docs/ledger-events.md`), validation, the canonical fold, upcasters,
ids, and the demo fixture. Plain ESM, zero runtime dependencies, Node ≥ 20. The server, the `gtd` CLI and
the front-end store all import this package; none of them should reimplement any of it.

```js
import { fold, validate, upcast, newId, now, demoEvents, LEDGER_VERSION } from '@gtd/ledger';
// or by file: import { fold } from '../packages/ledger/fold.js';
```

## API

| Export | What |
|---|---|
| `LEDGER_VERSION` | `1`. Every event carries `v`; a ledger with events newer than this throws `LedgerTooNew` from `upcast`/`fold`. |
| `validate(event, foldState?) → { ok, errors }` | Envelope (`type`, `v`, `at` ISO, `actor` pattern, `payload` object, `item` for item events), required payload paths per type, `accepted.kind` enum, `config_set.key` shape, actor rules. With a fold state: the item exists (and is not captured twice), `project` / `owner` / `program` / `sponsor` name known ids (or are null), entities are not created twice. Writers call this at the door; a failed event is never appended. |
| `fold(events, { today? }) → S` | The whole system from the log. Runs `upcast` first. Skips unknown types (never throws on data). Pure and deterministic; ~2 ms for the demo's ~1,300 events. `today` (a Date) anchors the calendar projections; default: now. Output is plain objects and arrays only — no Maps — so `GET /api/state` can serialize it as is. |
| `upcast(events, { migrations?, version? })` | Brings every event to `LEDGER_VERSION` by running `migrations/` in order (`v1.js` = v0 → v1 identity stamp). Returns the same array when nothing changed. |
| `newId(prefix)` | Time-sortable unique id: `i_01J…` style (10 chars ms time, 2 chars counter, 6 random; Crockford base32). Prefixes: `i_` items, `p_` programs, `j_` projects, `u_` people, `r_` runs, `e_` events. |
| `now()` | ISO timestamp for `at`. |
| `demoEvents() → event[]` | The example ledger (three programs, eight projects, seven people, ~60 named items plus eight weeks of background volume) as a sorted, seq-numbered v1 event stream. Deterministic; dates are relative to `DEMO_TODAY` (Mon 14 Sep 2026 08:00 local). |
| `EVENT_TYPES`, `SPEC`, `ACTOR_RULES`, `ACCEPT_KINDS`, `DEFAULT_CONFIG`, `wikiStub`, `slug`, `defaultProposal` | The vocabulary and defaults, for writers that build events. |

### Event envelope

```json
{ "seq": 412, "id": "e_01J…", "v": 1, "at": "2026-09-14T08:12:03.120Z", "actor": "jeff", "type": "accepted", "item": "i_01J…", "payload": { … } }
```

`seq` is assigned by the writer (server or local store) after `validate` passes; `id` via `newId('e')`; `at` via `now()`. The fold applies events in **array order** (writer order), never re-sorted by `at`.

### Fold output `S`

```
{ v, seq, count,
  programs: [{ id, name, purpose, sponsor, cadence, color?, created:Date, retired:Date|null, primary, lastMove }],
  projects: [{ id, program, name, outcome, health, suggest, created:Date, dropped, primary:itemId|null, lastMove:Date|null }],
  people:   [{ id, name, role, channels?, lastTouched:Date|null, agenda:[] }],
  items:    [ … see below … ],
  wiki:     { [programId]: { page, compiled:Date|null, health, status, links:[[label,url]], milestones:[[label,what,state,iso]], decisions:[{on,what,who,why,status,projects}], pending:[], risks:[{what,level,owner,projects}], words, pages:{page:words} } },
  config:   { autonomy:{cap:level}, models:{job:{provider,model,effort?}}, prompts:{job:text}, progColor:{program:slot} }   // starts from DEFAULT_CONFIG
  runs:     [{ run, job, item, actor, startedAt, status:'running'|'finished'|'failed', finishedAt?, summary?, error?, args? }],
  deliverables: [{ key:'meeting:<id>', for:{kind,id}, status:'ready'|'approved'|'taken', deliverable, actor, cap, readyAt, effect, approvedAt?, takenAt? }],   // `delivered` events with `for` instead of `item`
  calendar: null | { window:{from,to}, source, syncedAt, events:[{ id, title, start:Date, end:Date, attendees, who:[personId], calendar, location?, allDay? }] },
  calendarWindow: {from,to}|null,
  meetings:      null | [{ id, time:'HH:MM', dur, title, who:[personId], projects:[], decisions:[], location?, allDay }],   // today's, from the latest calendar_synced
  calendarAhead: null | [{ id, on:Date, time, title, who }],
  pastMeetings:  null | [{ id, on:Date, title, who, captured }],   // captured = items whose `ref` is cal:event/<id>
  lastReview: Date|null, reviews: n, migrations: [] }
```

When `meetings` / `calendarAhead` / `pastMeetings` are `null` no calendar has been synced; the front-end store falls back to its fixture constants. Projects also carry `proposed` (the latest `next_action_proposed`: `{ next, ctx?, min?, why, at, actor }`) and people carry `channels.email: string[]`.

```
```

Item shape (what the views consume; every date is a `Date`):
`id, kind ('inbox'|'action'|'waiting'|'someday'|'reference'|'done'|'trash'), next, raw, source, from, captured, p (proposal), project, ctx, min, energy, due, hard, start, repeat, owner, since, followUp, nudges, lastNudged, del ({ status:'queued'|'working'|'ready'|'approved', at, readyAt, minutes, progress, effect, what, deliverable, run }), cap, ai, revisit, refPage, filedAt, createdAt, doneAt, trashedAt, movedAt, resurfacedAt, tickledFor, wasKind, image, mentions, ref, confirmedBy, prevKind, resurfacedFor`.

Fold rules of note:

- `captured` creates the item as `inbox` (a second `captured` for the same id is a no-op). `clarified` sets `p`. An inbox item without `p` should be shown with `defaultProposal(item)`.
- `accepted { kind, fields }` merges `fields`, sets `kind`, and stamps `createdAt` (action), `since` + `followUp` (waiting, +3 d if absent), `since` (someday), `filedAt` (reference), `doneAt` (done), `trashedAt` (trash) from `at` unless `fields` carries them. `confirmedBy` = actor.
- `edited { fields }` merges; a changed `project` stamps `movedAt`.
- `done`/`undone`, `trashed`/`restored`, `parked`/`promoted`, `dropped` move `kind`; `prevKind` remembers the kind before. `restored` puts the item back in the inbox with a default proposal if it has none.
- `nudged` → `nudges + 1`, `lastNudged = at`, `followUp = payload.followUp ?? at + 5 d`.
- `handed_off` → `owner:'ai'`, `del.status:'queued'`; a `job_started` event that names the item on its envelope → `del.status:'working'` (`args.progress` optional); `delivered` → `ready`; `approved` → `approved` + kind `done`; `taken_back` clears `owner`/`del`.
- `next_action_set { project }` → `project.primary = item` (works for program ids too). `next_action_proposed { project, proposal }` → `project.proposed` (latest wins; cleared by nothing — the UI prefers it over `suggest` until a human adds an action).
- `delivered` / `approved` / `taken_back` without `item` but with `payload.for:{ kind:'meeting'|'status'|'review'|'wiki', id? }` maintain `S.deliverables` (keyed `kind:id`) instead of an item's `del`.
- `calendar_synced` replaces `S.calendar` wholesale (a later sync wins) and derives `meetings` (today), `calendarAhead`, `pastMeetings`, `calendarWindow`.
- `resurfaced { for }`: someday/reference with a `revisit` comes back to the inbox as a tickler (`source:'tickler'`, `wasKind`, `tickledFor`, generated `p`); an action with a `start` gets `resurfacedAt = at`. `resurfacedFor` lists every date that has fired, so the caller can avoid firing twice.
- `program_created` stubs `wiki[id]` (`payload.program.page` sets the hub slug, else `program-<slug(name)>`); `wiki_changed` adds `words` to the page and its program (`payload.program`, else matched by page prefix) and merges optional `payload.fields` into the wiki entry (`compiled:true` → `at`). `milestone_added` / `decision_recorded` append. Reference items filed under a program are added to its `links` (derived).
- `config_set { key:'autonomy.file', value }` writes `config.autonomy.file`; `value:null` deletes.
- `review_completed` → `lastReview = at`.
- Project/program `lastMove` = the latest `at` of an accepted / done / nudged / parked / promoted / handed_off / delivered / approved / taken_back event on one of its items.

### Actor rules (`ACTOR_RULES`)

`jeff` and `system` may write anything. `ai:*` may write only `captured, clarified, delivered, next_action_proposed, wiki_changed, job_started, job_finished, job_failed, milestone_added, decision_recorded`. `ingest:*` may write `captured`, `calendar_synced` and `job_*`.

## Layout

```
packages/ledger/
  index.js       public re-exports
  schema.js      EVENT_TYPES, SPEC (required payload paths), ACTOR_RULES, DEFAULT_CONFIG, validate()
  fold.js        fold(), wikiStub(), defaultProposal()
  upcast.js      upcast(), LedgerTooNew
  migrations/    v1.js (v0 → v1), index.js (the ordered list)
  ids.js         newId(), now()
  demo.js        demoEvents(), DEMO_TODAY
  scripts/devserver.js   a 60-line stand-in for server/ that serves /api/health, /api/state, /api/events, /api/backup over a JSON file
  tests/         Vitest
```

## HTTP contract the front-end store codes against

The store (`frontend/src/store.js`) uses server mode when `window.__GTD_SERVER__` is set or `GET /api/health` returns JSON `{ ok:true }`.

| Route | Request | Response |
|---|---|---|
| `GET /api/health` | — | `{ ok:true, v:1, seq, dataDir }` |
| `GET /api/state` | — | the fold (`fold(events)`, JSON) |
| `GET /api/events?since=<seq>` | — | `{ events:[…], seq }` — events with `seq > since`, in order |
| `POST /api/events` | `{ type, payload, item?, actor? }` | `201 { event, seq }` — the server stamps `seq`, `id`, `at`, `v`, defaults `actor` to `jeff`, validates against its current fold; `400 { errors:[…] }` on rejection. `captured` with a `ref` already in the ledger returns `200 { event:<existing capture>, seq, duplicate:true }`. |
| `POST /api/backup` | — | `{ ok:true, path?, note? }` |

Run the stand-in: `node packages/ledger/scripts/devserver.js [--port 8787] [--data ./ledger.json] [--demo]`.
