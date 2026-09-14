# Decisions log

Newest first. One line per decision, with the reason. Add to this as we go.

## 2026-09-14

- **Speed pass adopted.** Goal: the system fades into the background. (1) Global capture
  overlay on ⌘K / `/`, optimistic filing when the capture names a project, AI proposal as
  a suggested correction rather than a gate. (2) One keyboard grammar on every list
  (j/k/⏎/x/d/p/n/m/Esc) and a ⌘P command palette. (3) SSE from the server and a cached
  fold for instant paint. (4) Engage trimmed to "needs me now" + next actions. (5) One
  "when" per row with one fuzzy editor. (6) Prep and nudge jobs run ahead of need.
  (7) Quiet footer status; instruction cards off by default in live mode.

## 2026-09-13

- **Beta foundation built.** `packages/ledger` is the contract's implementation; the
  front-end is event-sourced (two backends: server, local demo); `server/` is the only
  writer; `bin/gtd` + `.claude/skills/gtd-*` run Claude jobs headlessly with tiers from
  Settings; `GET /api/state` returns entity collections keyed by id for the CLI/jobs while
  the front-end folds from `/api/events`. First real `claude -p /gtd-clarify` run verified.
- **Beta plan adopted** (`beta-plan.md`): data outside the app in `~/GTD-data/` (private
  repo), append-only versioned event log with upcasters, one writer (local service),
  Calendar first, Claude via subscription skills. Event contract in `ledger-events.md`.
- **Renamed to "Delivery System"** (was Commitment Ledger); same subtitle; new route-and-check
  mark. Artifact URL unchanged.
- **Settings view** (rail, key `,`): autonomy moved here from Delegated; per-job model
  selection (Claude or local, model, effort) in `state.models` — the intended keys for the
  back-end job registry; editable prompt stubs in `state.prompts`; options (default
  grouping, sidebar, tips, reset demo). The AI log left Delegated for the review's audit step.
- **Defer** (`start` date on actions): off the lists until the day, counts as project
  coverage, returns to the top of its list with a "back today" chip; visible on the strip.
- **Paste a screenshot** into capture: stored as a small data URL, flagged at 50% so the
  human describes the ask; the live system runs vision on it.
- **Confidence line** sits under the source, not as a callout below the form.
- Programs: sections collapse, cards tinted with their color, color picked from the dot
  by the name (vertical popover), next-action cell clickable, "+N more" expands inline.
- Engage strip: actions above calendar in each day column. Rail: fixed slots for badge and
  key hint; `[` toggles outside fields, ⌘[ anywhere. Render keeps scroll position within a view.
- Replay: done chute removed (floor ring instead), scene theme tokens restored, stats as
  label-over-value tiles, legend in labelled groups.
- Waiting-for aging bars scale to the total, not the largest bucket.

## 2026-09-12

- **Replay: one wiki bar per program**, at the end of its lane, growing with the
  program's total wiki words; the per-page wall is gone. **Delegated items stay in
  their lane** with a charged/electrical look (emissive, halo, sparks while moving;
  hovering when ready for review) — the separate AI machine is removed.
- **Milestones are added in the wiki drawer** (what, date, state) and appended to the
  program hub's Milestones table; prep briefs list milestones due in the next 14 days.
- **Trash is never deleted.** The ledger is append-only; trashing is an event, not a
  removal. The UI shows all trashed items with Restore; the earlier "kept 30 days" copy
  was wrong and is gone.
- **Fuzzy dates** are parsed in-house (`lib/fuzzydate.js`): weekday names mean the coming
  occurrence (never today), `next <day>` = that + 7, month/day without a year rolls
  forward, `eom`/`eow`/`t+N`/`+N`/`in N days` supported. Companion `.fuzzy` text fields
  sit next to every date input and clear themselves on a successful parse.
- **Inbox keyboard:** ↑/↓ move, Tab cycles list → kinds → next action, ⌘⏎ accepts from
  any field; `@` in capture autocompletes programs, projects and people and files the
  mentions on the item.
- **Undo everywhere, via state snapshot.** Every mutating action offers a ~4s Undo in
  the toast; in the prototype Undo restores the pre-action state snapshot and reloads
  (state is applied over example data at load). With a real back-end, undo becomes a
  compensating event.
- **Repeating actions** carry `repeat: daily|weekly|monthly`; completing one spawns the
  next instance with dates advanced. No recurrence engine beyond that — GTD treats a
  Friday status as a calendar item that regenerates, not a standing task.
- **Program colors are configurable** per program (8 slots from the categorical
  palette), overriding the default slot-by-order assignment; the choice follows the
  program everywhere.
- **`docs/backlog.md`** holds recorded asks not yet built (Google Calendar, Replay
  tweaks, chrono-node upgrade, reference pages).
- **Desktop shell deferred; Tauri when it comes.** A shell would live in `desktop/`
  beside `frontend/` (which stays a plain web app), with CI and release workflows in
  `.github/workflows/`. Open question for then: webview → ledger over Tauri IPC or the
  local HTTP API — HTTP if scheduled Claude Code jobs share the same service.
- **Front-end restructured into modules** (`frontend/`, Vite + ES modules, Vitest, ESLint).
  The single-file ledger is retired; one module per view, drawer and concern; `three`
  from npm, lazy-loaded. The built `dist/` is what gets published to the existing
  artifact. Reason: the file had passed 1,200 lines and a second visual was about to
  double it; modules are also what the back-end phase needs.
- **Replay lives in Flow, not the weekly review.** Flow is the meta view — the system
  seen from above — so the eight-week playback belongs there; the review only links to
  it, scoped to "since last review" (and to the AI's moves for the audit step).
- **Program plates in the replay.** Each program's tracks sit on a translucent plate
  outlined in the program's identity colour (`--c1..--c8`, the same as its chips), with
  the program name at the plate's near edge, so it reads which projects belong to which
  program without following lines.
- **Replay is a three.js scene, not a chart** (`frontend/src/replay`). Every item is a
  ball; stations are the GTD lists laid out as a physical system; the playhead is a
  global clock and every position is a fold of events ≤ t (only motion is tweened,
  never state). Wireframe = AI-proposed, solid = confirmed, a bounce = corrected
  proposal; waiting-fors age through the receivable colours; stalled tracks grey with a
  pulsing ring; wiki pages are columns that grow on `wiki_changed`. Requires the event
  log to carry `program_created/retired`, `project_created/dropped`, `health_set`,
  `wiki_changed`, `closed` (waiting received) and `working`/`delivered` — added to
  `backend-wiring.md`. The prototype's example data becomes an event log for this.
- **Subscription wiring** (`docs/subscription-wiring.md`): with a Claude subscription
  instead of an API key, AI jobs run as Claude Code skills + subagents under the login,
  scheduled deterministically; tiers per agent (Haiku ingest/filing, Sonnet clarify and
  drafts, Opus review and synthesis), escalation via the existing confidence gate, tiers
  chosen from the triage eval diff. The `gtd` CLI is the only write path (schema and
  enum validation there, not `messages.parse`); sends/books/deletes are denied in
  `settings.json` and a `PreToolUse` guard, not merely by prompt.
- **Gap review items 1–5, 7, 8 built.** `hard` date on actions (calendar, leaves the
  context lists); ticklers via `revisit` on someday/reference; "Do it now" in the
  inbox (`x`); reference filed into wiki pages (`refPage`) with the Reference view as
  the wiki index; Someday view with revisit dates; review gains mind sweep,
  past-calendar sweep, two-week preview; Now filters by time and energy; trash kept
  30 days with restore. Rail is now the full GTD list set (keys 1–9, 0).
- **GTD gap review adopted** (`docs/gtd-gap-review.md`): add the calendar / hard
  landscape and tickler, a human two-minute path, reference filed into the wiki, a
  Someday list, mind-sweep and calendar-sweep review steps, Now filters, recoverable
  trash. Project plans and a horizons page deferred.
- **Programs are created deliberately, retired never deleted.** Add program lives in
  the Programs header and the review's horizons step (and the inbox can clarify an
  ask as a new program); purpose is required; creation stubs the wiki hub. Retiring
  requires every project moved or dropped, keeps wiki pages as history.
- **Teach the system in the UI.** Each view carries a dismissable instruction card
  naming the GTD stage it serves and how to use it; `?` / Guide opens the full loop,
  the two-store model, trust rules and keys. Rail tabs get inline SVG icons (no icon
  font — the artifact CSP allows only Google Fonts stylesheets).
- **Program wiki added (`wiki/`), Karpathy pattern, inside this repo.** Ledger is
  canonical for commitments (dates, owners); wiki is canonical for context (purpose,
  links, decisions with rationale, history, risks). Compile job rewrites only fenced
  `<!-- compiled:… -->` sections and may run at "do it, tell me weekly"; ingests and
  decisions go through the review gate. Wiki lint is a weekly-review step. Same
  conventions as `knowledge/` so the ingest skill transfers.
- **Back-end storage resolved: append-only `ledger/events.jsonl` is canonical.**
  SQLite index and markdown pages are derived projections, one-directional. Not
  folders-as-status, not tags: the views need history (computed movement, AI audit,
  proposal→accepted diff, take-it-back), and a frontmatter file only holds current
  state. Markdown projection deferred until it's wanted on the phone.
- **Repo created** at `~/Documents/GitHub/GTD System` to hold design docs and the
  front-end prototype; the published artifact stays the review surface.
- **AI as a delegate, not a mode.** Delegation to the AI reuses GTD's delegate step and
  the Waiting-For pattern, with a review gate and per-capability autonomy. Sending,
  booking, deleting capped at "Always ask".
- **Projects can be added from the Programs view**; outcome statement is required
  (the GTD rule), first next action strongly encouraged.
- **Last movement is computed, never stored.** Derived from ledger events (action
  added, waiting opened, nudge sent, item done, delegated, delivered, approved).
- **One explicit primary next action per project** when several are open; the
  Programs table and morning brief lead with it.
- **Front-end talks to an API, never to a model.** Event log as the back-end model;
  typed structured-output calls for the AI jobs; enums built from the store.
- **The triage UI doubles as the eval set** — store the proposal→accepted diff.
- **Team systems of record are not mirrored.** Only items where I have an action or a
  waiting-for, with `source_ref` back.
- **Storage:** markdown + frontmatter canonical, SQLite derived, HTML generated —
  unless/until the event-log service replaces it; markdown then becomes a projection.
- **Design identity:** Bricolage Grotesque headings, IBM Plex Sans/Mono body and data;
  indigo accent for chrome; semantic good/warn/crit always paired with a label;
  CVD-validated chart palette; light and dark both designed.
- **Demo date** fixed at Mon 14 Sep 2026 with fictional programs, so ages and
  "today" are stable.
