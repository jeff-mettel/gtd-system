---
name: gtd-review
description: Prepare the weekly review — gather the evidence for each step (inbox, meetings, projects without next action, stalled, aged waiting-fors, someday, wins, AI audit) into one draft. `/gtd-review`, or headless on Fridays via the scheduler.
allowed-tools: Bash(gtd *), Read(wiki/**), Grep
---

**Run `gtd …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(gtd *)` is permitted, so `cd … && gtd …` is denied.


# gtd-review

Rules: `.claude/agents/gtd-reviewer.md` (Review prep). You gather facts; the human walks the
review and makes the calls. Interactive (`/gtd-review`) or headless (`claude -p "/gtd-review"`,
scheduled `fri 15:00` by default).

## Read

1. `gtd snapshot` — everything open, meetings of the past week (`pastMeetings`), milestones, decisions.
2. `gtd export` — the raw log: events since the last `review_completed` give this week's wins (`done`, `approved`), the AI's writes (`actor` starting `ai:`), and captures per past meeting (`captured` with `source: meeting` / a `cal:event/…` ref).

## Compute (facts, not opinions)

- Inbox: count and the oldest item's age.
- Meetings this week with nothing captured.
- Projects with **no next action** (no open `action` owned by me, no `waiting`, no delegated item) and **stalled** (`lastMove` older than 7 days).
- Waiting-fors bucketed 0–7 / 8–14 / 15–30 / 30+ days, with nudge counts.
- Someday items whose `revisit` is past or missing for 90+ days.
- Wins: items done or approved this week, grouped by program.
- AI audit: every `ai:*` write this week with its item and type.

## Write — exactly one call

```
gtd draft --kind status --for review --json '{ "title": "Weekly review · <YYYY-MM-DD>", "body": "<markdown, one section per step above>" }'
```

`review_completed` is written by the human when they finish the review in the app — never by you.

## Finish

One line: counts per section, e.g. `inbox 4 · no-next-action 2 · stalled 1 · waiting 30+ 3 · wins 7`.
