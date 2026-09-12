# Decisions log

Newest first. One line per decision, with the reason. Add to this as we go.

## 2026-09-12

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
