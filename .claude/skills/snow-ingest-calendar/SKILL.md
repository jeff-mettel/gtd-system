---
name: snow-ingest-calendar
description: Sync the calendar window [-7 days, +14 days] into the ledger through the Google Calendar connector — `/snow-ingest-calendar`. Connector path only; the macOS path (`config.json → calendar.source: macos`) runs in the server without Claude.
allowed-tools: Bash(snow *), mcp__*__list_calendars, mcp__*__list_events, mcp__*__get_event, mcp__*__search_events
---

**Run `snow …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(snow *)` is permitted, so `cd … && snow …` is denied.


# snow-ingest-calendar

Rules: `.claude/agents/snow-ingest.md`. This is the **connector** path: it needs the Claude Code
Google Calendar connector's read tools (`list_calendars`, `list_events`, …) to be available in
this session.

## Detect first

If no tool named like `mcp__…__list_events` is available to you in this run, do nothing else:
print exactly

```
CALENDAR_CONNECTOR_UNAVAILABLE
```

and stop. The job runner turns that into a failed run whose message tells the user to set
`config.json → calendar.source` to `"macos"` (the server then reads macOS Calendar via
`server/calendar-macos.js`, zero OAuth, no model).

## Read

1. `snow snapshot` → `people` (ids, names, `channels.email`) so you can report which attendees you recognised (matching itself is done by the server).
2. `list_calendars`; keep the calendars named in `snow snapshot` → `config.calendar.calendars` if that list is non-empty, else all of them.
3. `list_events` per calendar for the window **today − 7 days … today + 14 days**.

## Write — exactly one call

```
snow log --type calendar_synced --json '{
  "window": { "from": "<ISO>", "to": "<ISO>" },
  "source": "connector",
  "events": [ { "id": "<event id>", "title": "…", "start": "<ISO>", "end": "<ISO>",
                "attendees": [ { "name": "…", "email": "…" } ], "calendar": "<name>", "location": "…", "allDay": false } ]
}'
```

Nothing else. No `create_event`, `update_event`, `delete_event`, `respond_to_event` — denied by the harness.

## Finish

One line: `<n> events, <from>..<to>`.
