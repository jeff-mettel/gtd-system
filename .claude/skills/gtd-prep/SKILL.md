---
name: gtd-prep
description: Assemble a pre-meeting brief from the ledger and the wiki — `/gtd-prep <meetingId>`. Delivered through `gtd draft --kind prep`; the human reads it before the meeting.
allowed-tools: Bash(gtd *), Read(wiki/**)
---

# gtd-prep `<meetingId>`

Rules: `.claude/agents/gtd-drafter.md`. Interactive or headless (`claude -p "/gtd-prep <id>"`).
The meeting id comes from `gtd snapshot` → `meetings` / `calendarAhead` (calendar event ids).
Missing argument: ask interactively; headless, stop with `usage: /gtd-prep <meetingId>`.

## Read

1. `gtd snapshot` — the meeting (`title`, `start`, `who`), then everything touching its attendees: open items owned by them or mentioning them, waiting-fors, the projects they share with the user, milestones due in 14 days, the latest decisions per program.
2. `Read wiki/<program>.md` (+ `-decisions`, `-risks`) for each related program.

## Write — exactly one call

```
gtd draft --kind prep --for <meetingId> --json '{
  "title": "Prep · <meeting title> · <date>",
  "asks": ["<what to decide or ask, most important first>"],
  "projects": ["<project ids>"],
  "brief": "<markdown: Decide/ask · Open with attendees · Waiting on them · Latest decisions · Risks · Milestones due>"
}'
```

## Finish

One line: `prep drafted for <meetingId> (<title>)`.
