---
name: snow-prep
description: Assemble a pre-meeting brief from the ledger and the wiki — `/snow-prep <meetingId>`. Delivered through `snow draft --kind prep`; the human reads it before the meeting.
allowed-tools: Bash(snow *), Read(wiki/**)
---

**Run `snow …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(snow *)` is permitted, so `cd … && snow …` is denied.


# snow-prep `<meetingId>`

Rules: `.claude/agents/snow-drafter.md`. Interactive or headless (`claude -p "/snow-prep <id>"`).
The meeting id comes from `snow snapshot` → `meetings` / `calendarAhead` (calendar event ids).
Missing argument: ask interactively; headless, stop with `usage: /snow-prep <meetingId>`.

## Read

1. `snow snapshot` — the meeting (`title`, `start`, `who`), then everything touching its attendees: open items owned by them or mentioning them, waiting-fors, the projects they share with the user, milestones due in 14 days, the latest decisions per program.
2. `Read wiki/<program>.md` (+ `-decisions`, `-risks`) for each related program.

## Write — exactly one call

```
snow draft --kind prep --for <meetingId> --json '{
  "title": "Prep · <meeting title> · <date>",
  "asks": ["<what to decide or ask, most important first>"],
  "projects": ["<project ids>"],
  "brief": "<markdown: Decide/ask · Open with attendees · Waiting on them · Latest decisions · Risks · Milestones due>"
}'
```

## Finish

One line: `prep drafted for <meetingId> (<title>)`.
