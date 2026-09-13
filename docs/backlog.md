# Backlog — recorded asks

Future work captured from review comments and conversation, newest first. Move an
item to `decisions.md` when it's decided and built.

## 2026-09-12 (evening review pass)

- **Google Calendar integration.** Both calendar sweeps in the weekly review and the
  hard-landscape strip should read the real calendar (Google Calendar connector or
  ingestor) instead of example `meetings` / `calendarAhead` / `pastMeetings`. Front-end
  contract: the same arrays, fed by the back-end. — from review comments on "Sweep last
  week's calendar" and "Preview the next two weeks".
- **Replay: one wiki per program.** Show a single growing bar per program at the end of
  its lane (grows with wiki size) instead of separate page bars. — comment on Replay.
- **Replay: AI delegation per program.** Balls delegated to the AI look different (e.g.
  an "electrical" material/glow) and are visible per program lane. — comment on Replay.
- **Fuzzy date parsing, library upgrade.** The first pass is a small in-house parser
  (`frontend/src/lib/fuzzydate.js`: today/tomorrow/weekdays/next week/in N days/t+N/
  eom/ISO/9-20/20 sep). If it proves limiting, `chrono-node` bundles cleanly through
  Vite and handles free text ("the Friday after next", "end of next month").
- **Contexts, simplified.** Keep GTD contexts but make them optional and mostly derived
  (`@quick` ≤15 min, `@deep` otherwise, `@1:1/<person>` when a person is mentioned,
  `@agenda/<meeting>` when captured from a meeting). Revisit whether to drop them
  entirely after a few weeks of real use.
- **Reference pages of their own.** `refPage:'new'` items should create
  `wiki/ref-<slug>.md` through the compile job.
