# Beta runbook — running Snowball on real data

Companion to `beta-plan.md` (why) and `ledger-events.md` (the contract). This is the *how*:
install, run, verify, back up, upgrade. Everything here is local to one Mac.

## Layout

| Piece | Where | What |
|---|---|---|
| App repo | this checkout | code only; never holds user data |
| Data folder | `~/Snowball/` (`SNOW_DATA`) | `ledger/events.jsonl`, `wiki/`, `attachments/`, `config.json`, `runs/` — a private git repo |
| Server | `server/index.js` → `http://localhost:4310` | the one writer; JSON API; serves `frontend/dist`; runs jobs; scheduler |
| CLI | `bin/snow` | thin HTTP client; the only write path for Claude jobs |
| Jobs | `.claude/skills/snow-*`, `.claude/agents/snow-*` | Claude Code skills/subagents spawned as `claude -p` |
| Trust | `.claude/settings.json`, `bin/snow-hook` | deny list + PreToolUse guard |

## 1. Install

```
git clone <app repo> ~/Documents/GitHub/snowball && cd "$_"
npm install            # workspaces: packages/*, server, frontend (server has no deps)
npm run build          # frontend/dist — the server serves it
npm link               # optional: puts `snow` on PATH; otherwise use bin/snow
```

Requirements: Node ≥ 20, git, Claude Code (`claude` on PATH, logged in under the subscription).

## 2. `snow init`

```
snow init                       # or SNOW_DATA=/elsewhere snow init
```

Creates `~/Snowball/` with `ledger/events.jsonl` (empty), `wiki/index.md`, `wiki/log.md`,
`attachments/`, `runs/`, `config.json` (`{ ledgerVersion: 1, schedule, calendar }`), `git init`
and a `.gitignore` (`runs/`). Idempotent; never overwrites. Exit 5 if `config.json.ledgerVersion`
is newer than the app understands — upgrade the app first.

## 3. Start the server

```
npm run serve                  # PORT=4310 by default; SNOW_DATA=~/Snowball
open http://localhost:4310
curl -s localhost:4310/api/health
```

`/api/health` → `{ ok, version, ledgerVersion, ledgerSource, seq, dataDir, mode:'server', schedule }`.
If `frontend/dist` is missing, `/` says so; run `npm run build`.

### Endpoints

| | |
|---|---|
| `GET /api/state` | the fold for the CLI and jobs (entity collections keyed by id, ISO dates) |
| `GET /api/events?since=N` | `{ events, seq }` — events after seq N (the front-end folds from this) |
| `POST /api/events` `{ type, payload, item?, actor? }` | validate → append → `{ event, seq }`; 400 `{ errors }`; `captured` with an existing `ref` → `{ existing:true, item }` |
| `POST /api/backup` | `git add -A && git commit` in the data dir, `git push` if a remote exists |
| `GET /api/export` · `POST /api/import { events, mode }` | raw event array; `replace` writes `events.<ts>.bak.jsonl` first |
| `POST /api/jobs/:job { args }` · `GET /api/jobs` | start a run / list runs, tiers, queue |

Actors: the front-end writes as `jeff`. `ai:*` / `ingest:*` actors are only accepted from the
`X-Snow-Actor` header (the CLI sets it from `SNOW_ACTOR`) and only for the types the contract allows
them (`captured`, `clarified`, `delivered`, `wiki_changed`, `job_*`, proposed milestones/decisions;
ingest also `calendar_synced`). `accepted`, `done`, `approved`, `nudged` are human-only at the door.

## 4. Install launchd

```
npm run install-launchd        # writes ~/Library/LaunchAgents/com.jeffmettel.snowball.plist and loads it
tail -f ~/Snowball/runs/server.log
npm run uninstall-launchd
```

Upgrading from a pre-0.2 install: the launchd label was `com.jeffmettel.gtd`; unload it once with
`launchctl bootout gui/$(id -u)/com.jeffmettel.gtd && rm ~/Library/LaunchAgents/com.jeffmettel.gtd.plist`
before `npm run install-launchd`, or two servers fight over the port.

The plist bakes in the current `node`, `claude` and `bin/` paths, `SNOW_DATA` and `PORT`. It restarts
the server on crash (`KeepAlive` on unsuccessful exit) and at login. Manual `npm run serve` is
fine too — but not both at once (port clash; second one exits).

## 5. Data repo remote

```
cd ~/Snowball
gh repo create snowball-data --private --source . --remote origin --push   # or git remote add origin …
```

From then on `POST /api/backup` (Settings → Data → Back up) commits and pushes. A daily backup is
one schedule line away: `"backup": "daily 23:00"` is *not* a job yet — call the endpoint from a
cron/launchd line, or press the button. (Candidate for a `backup` job; see report.)

## 6. Calendar — macOS path first

`config.json`:

```json
{ "calendar": { "source": "macos", "calendars": ["Work", "jeff@…"] } }
```

`calendars: []` means all. Test the reader alone (no server, no Claude):

```
node server/calendar-macos.js --days-back 7 --days-ahead 14
```

The first run triggers a macOS **Automation** prompt ("node wants to control Calendar"). It must be
answered in a GUI session; run it once from Terminal.app. Until it is answered the call *hangs*
(observed in this build: a headless session blocked for 2 minutes and was killed) — after that
the script fails fast with the "grant it in System Settings → Privacy & Security → Automation"
message. The process that needs the grant is whichever runs the server (Terminal's `node`, or
the launchd `node`), so run once by hand *and* once under launchd.

Then: `snow run ingest-calendar` (or the Refresh button in the app). It writes one
`calendar_synced` event per sync with the normalised window; the fold turns it into `meetings`
(today), `calendarAhead` (14 days) and `pastMeetings` (7 days). Attendees are matched to People
by `channels.email` (exact, case-insensitive) or full name.

### Connector path

`{ "calendar": { "source": "connector" } }` → the job runs `claude -p "/snow-ingest-calendar"` with
the Google Calendar connector's read tools allowed. **If the connector is not exposed to headless
runs** (typical: connectors attach to interactive sessions), the skill prints
`CALENDAR_CONNECTOR_UNAVAILABLE` and the run fails with "set config.json → calendar.source to
macos". Try it once; fall back to `macos` if it fails.

## 7. Run one job by hand

```
cd ~/Documents/GitHub/snowball
snow capture --source chat --raw "Ingrid wants the board one-pager by Wednesday"    # interactive: actor jeff
SNOW_ACTOR=ai:clarify SNOW_SERVER=http://localhost:4310 claude -p "/snow-clarify" --model sonnet --allowedTools "Bash(snow *)" "Read(wiki/**)"
snow inbox              # → [] once every item has a proposal
```

Or through the server, which is what the app and the scheduler do:
`snow run clarify` → `{ run }`; `snow jobs` shows the queue, recent runs and the tier per job;
`~/Snowball/runs/<run>.log` has the exact `claude` command line, stderr and the JSON result.

Jobs: `clarify` (all unproposed inbox items) · `suggest {project}` · `nudge {item}` · `prep {meeting}` ·
`review` · `compile [{program}]` · `ingest-calendar`. Concurrency 1; runs queue.

Tiers come from Settings → Models per job (`config.models.<job>` in the fold): `claude-opus-5 |
claude-sonnet-5 | claude-haiku-4-5` → `--model opus|sonnet|haiku`, plus `--effort` for Opus/Sonnet.
A `local` (Ollama) provider is **not supported in beta**: the runner logs
`provider "local" … falling back to Claude` in the run log and uses the job's default Claude
tier. The Settings UI still offers it; treat it as a placeholder.

Schedule (`config.json → schedule`): `*/15m` / `15m`, `1h`, `fri 15:00`, `daily 07:00`, `off`.
Defaults: `clarify */15m`, `ingest-calendar 1h`, `review fri 15:00`. Interval jobs first fire one
period after the server starts. Nightly runs at quiet hours keep Opus inside the subscription's
usage windows.

## 8. What the guard blocks

Two layers, both harness-side (the model cannot talk its way past them):

1. **`.claude/settings.json → permissions.deny`** — in *every* session in this repo, interactive
   or headless: `mcp__*__send_message`, `mcp__*__send`, `mcp__*__reply`, `mcp__*__forward`,
   `mcp__*__create_event`, `mcp__*__update_event`, `mcp__*__delete_event`,
   `mcp__*__respond_to_event`, `mcp__*__trash_*`, `mcp__*__delete_*`, `mcp__*__create_draft`,
   `mcp__*__update_draft`. Sending, booking, deleting and drafting-in-the-mail-client are
   impossible from this checkout.
2. **`PreToolUse` hook → `bin/snow-hook`** — active only when `SNOW_ACTOR` is set, i.e. in job runs
   spawned by the server (ordinary development sessions are untouched). It allows read tools
   (`Read`, `Grep`, `Glob`, `WebFetch`, any `mcp__*__list_*/get_*/search_*`), `Bash` only when the
   command starts with `snow`, `Edit`/`Write` only under a `wiki/` folder, and blocks the deny-list
   names outright. Anything else must pass `snow guard --tool <name> --item <id>`, which exits 0
   only if an `approved` event for that item exists and was not followed by `taken_back`.
   A block returns exit 2 with the reason, which the model sees.

Plus the door itself: the server refuses `accepted`/`done`/`approved`/`nudged`/`next_action_set`
from any `ai:*` actor, and the CLI refuses to write at all without `SNOW_ACTOR` in a headless run.

Verified in this build: `Bash(snow inbox)` passes; `Bash(rm -rf /)` blocked; `mcp__gmail__send_message`
blocked by name; an unknown MCP tool on an approved item passes, on an unapproved one is refused.

## 9. Backup and restore

- **Backup**: Settings → Data → Back up, or `curl -XPOST localhost:4310/api/backup`. The data
  folder is a git repo; every backup is a commit; push goes to the remote if set.
- **Export**: `snow export > ledger.json` (or Settings → Data → Export).
- **Restore from git**: `cd ~/Snowball && git checkout <commit> -- ledger/events.jsonl`, restart.
- **Restore from JSON**: `POST /api/import { events, mode:'replace' }` — the current log is copied
  to `ledger/events.<ts>.bak.jsonl` first. `mode:'append'` re-validates each event and reports
  rejects without writing them.
- The `.bak.jsonl` files are git-tracked too; prune when they pile up.

## 10. Upgrading the app

```
cd ~/Documents/GitHub/snowball && git pull && npm install && npm run build
launchctl kickstart -k gui/$(id -u)/com.jeffmettel.snowball     # or Ctrl-C + npm run serve
curl -s localhost:4310/api/health
```

The data folder is untouched by an upgrade — except once, on the first 0.2 start with the default
folder: `~/GTD-data` is renamed to `~/Snowball` (same volume, logged as `moved … → …`; nothing is
moved if both exist, and an explicit `SNOW_DATA` is never touched). The pre-0.2 `GTD_*` env names
(`GTD_DATA`, `GTD_SERVER`, `GTD_ACTOR`, …) and the `X-GTD-Actor` header still work in 0.2 with a
deprecation note on stderr; the CLI is now `bin/snow` (`npm link` puts `snow` on PATH) and the jobs
are `/snow-*`. If health reports `refusing to start: ledgerVersion N
is newer…` you are running an *older* app against a newer ledger — pull again.

## 11. How ledger upcasts run

Every event carries `v`. The ledger package's `upcast(events)` runs at load (server start,
`snow init`, every fold) and brings each event to the current version with pure functions in
`packages/ledger/migrations/v1_to_v2.js` etc. Nothing is rewritten on disk: the file stays at
the version it was written at and is upcast in memory; `config.json.ledgerVersion` records the
newest shape the folder has been written with. When a release bumps the version, the server
appends a `migrated { from, to }` event on first start and updates `config.json`; an older app
then refuses to open the folder. If a destructive rewrite is ever unavoidable, it writes
`events.v2.jsonl` beside the old file and never deletes `events.jsonl`.

## Troubleshooting

- `cannot reach the Snowball server` from `snow` → server not running, or `SNOW_SERVER` points elsewhere.
- Job fails instantly with `could not start claude` → `claude` not on the PATH baked into the plist; re-run `npm run install-launchd` from a shell where `which claude` works.
- Job finishes but wrote nothing → read `runs/<run>.log`; the model's final line is the summary, and `{ errors }` from the CLI appear in the tool output it saw.
- Calendar hangs → Automation prompt not answered (see §6).
