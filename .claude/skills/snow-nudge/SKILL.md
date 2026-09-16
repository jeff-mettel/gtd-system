---
name: snow-nudge
description: Draft a follow-up for a waiting-for item that is past its follow-up date — `/snow-nudge <itemId>`. The draft goes to the Ready lane through `snow draft`; nothing is sent.
allowed-tools: Bash(snow *), Read(wiki/**)
---

**Run `snow …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(snow *)` is permitted, so `cd … && snow …` is denied.


# snow-nudge `<itemId>`

Rules: `.claude/agents/snow-drafter.md`. Interactive or headless (`claude -p "/snow-nudge i_…"`).
Missing argument: ask interactively; headless, stop with `usage: /snow-nudge <itemId>`.

## Read

1. `snow snapshot` — the item (`raw`, `next`, `owner`, `since`, `nudges`, `due`), the owner's name and role, the project and program.
2. `snow export` if you need the exact dates of earlier nudges for this item (events of type `nudged` with this `item`).

## Write — exactly one call

```
snow draft --kind nudge --for <itemId> --json '{
  "channel": "email|chat", "subject": "<if email>",
  "text": "<one paragraph: what was asked, when, what you need and by when>"
}'
```

The deliverable appears in Delegated to AI → Ready for review with "what approving does" declared
by the app, not by you. You cannot send; `send_message` is denied by the harness and the guard
refuses any send without an `approved` event.

## Finish

One line: `nudge drafted for <itemId> → <owner>`.
