---
name: snow-clarify
description: Clarify every inbox item that has no proposal yet — propose kind, next action, owner, context and confidence through `snow propose-clarify`. Use for "/snow-clarify", "clarify my inbox", "run clarify", or headlessly via `claude -p "/snow-clarify"`.
allowed-tools: Bash(snow *), Read(wiki/**)
---

**Run `snow …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(snow *)` is permitted, so `cd … && snow …` is denied.


# snow-clarify

Clarify is the method's second stage: for each captured item, is it actionable, what is the very next
physical action, who owns it. You **propose**; the human confirms in the Inbox view. The `snow`
CLI is the only write path; it validates the schema and the project/owner enums and tags every
write `ai:clarify`. Read the full rules in `.claude/agents/snow-clarify.md` — they apply here
whether this runs interactively (`/snow-clarify`) or headless (`claude -p "/snow-clarify"`).
Interactively you may delegate to the `snow-clarify` subagent; headless runs do the work inline.

## Read

1. `snow snapshot` — programs, projects, people (ids and names), open items, meetings. Use these ids only.
2. `snow inbox` — the items to clarify. If it is `[]`, say "inbox has nothing to clarify" and stop. An item with `filedAs` was filed by the person straight from capture; still propose — if you agree with `filedAs`, propose the same kind/project with your confidence; if you disagree, propose what you think is right (it shows as a suggestion they can accept or keep).
3. Optionally `Read wiki/<program>.md` for the hub of a program an item seems to belong to.

## Write — one call per item, nothing else

```
snow propose-clarify --item <id> --json '{
  "kind": "action|waiting|someday|reference|done|trash",
  "next": "<verb-first physical action>",
  "project": "<project or program id, or null>",
  "owner": "<person id | ai | null>",
  "ctx": "@deep|@quick|@1:1/<person>|@meeting/<name>|@agenda/<forum>",
  "min": <minutes>, "due": "<YYYY-MM-DD or null>", "hard": <true if it must happen that day>,
  "revisit": "<YYYY-MM-DD for someday/reference ticklers, or null>",
  "conf": <0..1>, "why": "<one line>",
  "ai": { "level": "do|draft|assist", "cap": "file|draft|data|send|calendar|delete", "what": "…" }   // optional
}'
```

The CLI rejects unknown kinds, unknown ids and out-of-range confidence with `{ errors:[…] }`;
fix the payload and retry once. `accepted`, `done`, `nudged`, `approved` are not yours to write.

## Finish

One line per item: `<id> → <kind> (<conf>) — <next>`. No prose beyond that.
