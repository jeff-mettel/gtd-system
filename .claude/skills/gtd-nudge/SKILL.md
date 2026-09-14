---
name: gtd-nudge
description: Draft a follow-up for a waiting-for item that is past its follow-up date — `/gtd-nudge <itemId>`. The draft goes to the Ready lane through `gtd draft`; nothing is sent.
allowed-tools: Bash(gtd *), Read(wiki/**)
---

# gtd-nudge `<itemId>`

Rules: `.claude/agents/gtd-drafter.md`. Interactive or headless (`claude -p "/gtd-nudge i_…"`).
Missing argument: ask interactively; headless, stop with `usage: /gtd-nudge <itemId>`.

## Read

1. `gtd snapshot` — the item (`raw`, `next`, `owner`, `since`, `nudges`, `due`), the owner's name and role, the project and program.
2. `gtd export` if you need the exact dates of earlier nudges for this item (events of type `nudged` with this `item`).

## Write — exactly one call

```
gtd draft --kind nudge --for <itemId> --json '{
  "channel": "email|chat", "subject": "<if email>",
  "text": "<one paragraph: what was asked, when, what you need and by when>"
}'
```

The deliverable appears in Delegated to AI → Ready for review with "what approving does" declared
by the app, not by you. You cannot send; `send_message` is denied by the harness and the guard
refuses any send without an `approved` event.

## Finish

One line: `nudge drafted for <itemId> → <owner>`.
