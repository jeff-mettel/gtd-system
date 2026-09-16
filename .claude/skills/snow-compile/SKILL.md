---
name: snow-compile
description: Rewrite the compiled sections of the program wiki hubs from ledger activity — `/snow-compile [programId]`. Edits only inside `<!-- compiled:start/end -->` fences, logs each change with `snow log --type wiki_changed`.
allowed-tools: Bash(snow *), Read(wiki/**), Edit, Write
---

**Run `snow …` directly.** The working directory is already the app repo and `bin/` is on PATH — never `cd` first and never wrap the call; only `Bash(snow *)` is permitted, so `cd … && snow …` is denied.


# snow-compile `[programId]`

Rules: `.claude/agents/snow-reviewer.md` (Compile) and the wiki conventions in `docs/wiki.md`.
Interactive (`/snow-compile`, optionally one program) or headless (`claude -p "/snow-compile"`).
The wiki lives in the **data folder**: `$SNOW_DATA/wiki/` (the runner adds it with `--add-dir`);
the app repo's `wiki/` holds the demo hubs and is read-only for this job.

## Read

1. `snow snapshot` — programs (active ones; retired hubs are history), their projects, open items, milestones, decisions.
2. `snow export` — activity since the page's last compile (`wiki_changed` events for the page).
3. `Read $SNOW_DATA/wiki/<program>.md`; if the hub does not exist, create it from the template below.

## Write

For each program (or the one given):

1. Rewrite only the text between `<!-- compiled:start -->` and `<!-- compiled:end -->`: **Status** (health, projects and their next actions, stalled flags), **Commitments** (open waiting-fors by person), **History** (dated movement since the last compile). Everything outside the fences — purpose, links, decisions, risks, anything a person wrote — stays byte-for-byte.
2. Note the compile date on the first line inside the fences: `_Compiled <YYYY-MM-DD> from the ledger._`
3. Keep `wiki/index.md` (one line per page) and prepend one entry to `wiki/log.md` (`- <date> · compile · <page> · <summary>`).
4. Log it: `snow log --type wiki_changed --json '{ "page": "<page>", "words": <words inside the fences>, "summary": "<one line>" }'`.

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
