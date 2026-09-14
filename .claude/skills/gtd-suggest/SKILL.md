---
name: gtd-suggest
description: Propose the next physical action for a project that has none (or is stalled) — `/gtd-suggest <projectId>`. Writes one proposal through `gtd propose-action`; the human accepts it in the Inbox.
allowed-tools: Bash(gtd *), Read(wiki/**)
---

# gtd-suggest `<projectId>`

Rules: `.claude/agents/gtd-reviewer.md` (Suggest section). Works interactively and headless
(`claude -p "/gtd-suggest j_…"`). The argument is the project id; if it is missing, ask for it
interactively or stop with `usage: /gtd-suggest <projectId>` when headless.

## Read

1. `gtd snapshot` — find the project (its `outcome`, `health`, `lastMove`), its open items, its program, and the people involved.
2. `gtd export` only if the recent history of the project's items matters (what was tried, what is waiting on whom).
3. `Read wiki/<program>.md` for decisions and risks if the hub exists.

## Write — exactly one call

```
gtd propose-action --project <projectId> --json '{
  "next": "<verb-first, doable in one sitting>", "ctx": "@deep|@quick|@1:1/<person>|…",
  "min": <minutes>, "owner": "<person id | null>", "due": "<YYYY-MM-DD | null>",
  "conf": <0..1>, "why": "<why this moves the outcome>"
}'
```

This lands as a captured item (source `suggest`) with your proposal attached, in the inbox, for
the human to accept. `next_action_set` itself is human-only.

## Finish

One line: `<projectId> → <next> (<conf>)`.
