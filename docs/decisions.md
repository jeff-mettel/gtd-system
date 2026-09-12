# Decisions log

Newest first. One line per decision, with the reason. Add to this as we go.

## 2026-09-12

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
