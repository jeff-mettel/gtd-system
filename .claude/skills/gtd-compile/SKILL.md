---
name: gtd-compile
description: Rewrite the compiled sections of the program wiki hubs from ledger activity — `/gtd-compile [programId]`. Edits only inside `<!-- compiled:start/end -->` fences, logs each change with `gtd log --type wiki_changed`.
allowed-tools: Bash(gtd *), Read(wiki/**), Edit, Write
---

**Run `gtd …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(gtd *)` is permitted, so `cd … && gtd …` is denied.


# gtd-compile `[programId]`

Rules: `.claude/agents/gtd-reviewer.md` (Compile) and the wiki conventions in `docs/wiki.md`.
Interactive (`/gtd-compile`, optionally one program) or headless (`claude -p "/gtd-compile"`).
The wiki lives in the **data folder**: `$GTD_DATA/wiki/` (the runner adds it with `--add-dir`);
the app repo's `wiki/` holds the demo hubs and is read-only for this job.

## Read

1. `gtd snapshot` — programs (active ones; retired hubs are history), their projects, open items, milestones, decisions.
2. `gtd export` — activity since the page's last compile (`wiki_changed` events for the page).
3. `Read $GTD_DATA/wiki/<program>.md`; if the hub does not exist, create it from the template below.

## Write

For each program (or the one given):

1. Rewrite only the text between `<!-- compiled:start -->` and `<!-- compiled:end -->`: **Status** (health, projects and their next actions, stalled flags), **Commitments** (open waiting-fors by person), **History** (dated movement since the last compile). Everything outside the fences — purpose, links, decisions, risks, anything a person wrote — stays byte-for-byte.
2. Note the compile date on the first line inside the fences: `_Compiled <YYYY-MM-DD> from the ledger._`
3. Keep `wiki/index.md` (one line per page) and prepend one entry to `wiki/log.md` (`- <date> · compile · <page> · <summary>`).
4. Log it: `gtd log --type wiki_changed --json '{ "page": "<page>", "words": <words inside the fences>, "summary": "<one line>" }'`.

Hub template for a new program page:

```
---
title: <name>
kind: program
program: <id>
---
# <name>

<purpose>

<!-- compiled:start -->
_Compiled <date> from the ledger._
## Status
## Commitments
## History
<!-- compiled:end -->

## Decisions
## Risks
## Links
```

## Finish

One line per page: `<page> · <words> words · <summary>`.
