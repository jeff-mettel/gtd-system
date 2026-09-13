# Beta plan — 2026-09-13

Goal: run Delivery System on real data, empty from day one, with Google Calendar
and Claude live, and with user data preserved across every future release.

## Principles

1. **Data lives outside the app.** `~/GTD-data/` (a private git repo) holds
   `ledger/events.jsonl`, `wiki/`, `attachments/`, `config.json`. The app repo never
   contains user data; the example programs are a `demo` fixture. Upgrading the app
   is `git pull` in one place; the data folder is untouched. Daily auto-commit of the
   data repo gives history and an offsite copy.
2. **The event log is append-only and versioned.** Every event carries `v`. A
   release that changes shapes ships an *upcaster* (`v1 → v2`, a pure function applied
   at load) — never a destructive rewrite. If a rewrite is unavoidable it writes
   `events.v2.jsonl` beside the old file. The app refuses to open a ledger newer than
   it understands. Export / Import (JSON) lives in Settings → Data.
3. **One writer.** The local service owns the ledger file. Front-end, `gtd` CLI and
   Claude jobs all write through it; every write is validated at that door.
4. **Trust invariants are harness rules.** Sends, calendar writes and deletes are
   denied in `settings.json`; a `PreToolUse` guard refuses side effects without an
   `approved` event. See `subscription-wiring.md`.

## Phases

| Phase | Work |
|---|---|
| **1 — Foundation** | `packages/ledger` (event schema v1, validation, fold, upcasters — the fold that powers Replay becomes canonical); the front-end becomes event-sourced: a store with two backends (`server` over HTTP, `local` in the browser for the published demo), every mutation emits an event and refolds; empty start; Settings → Data (backup, export, import, ledger version). |
| **2 — Claude live** | `server/` (Node): serves the build, JSON API over the ledger, spawns `claude -p` jobs; `bin/gtd` CLI as a thin client; skills + subagents per `subscription-wiring.md` (clarify, suggest, draft nudge, prep, review prep, wiki compile/ingest) with tiers from Settings; scheduled runs; harness deny rules + guard; Delegated lane shows real runs. |
| **3 — Calendar live** | `ingest-calendar` job: the Google Calendar account read on a schedule (the Claude Code Calendar connector where headless runs can reach it; otherwise the same Google account via macOS Calendar, zero OAuth) → `meetings`, `calendarAhead`, `pastMeetings` from real events; meeting → prep brief; past-week sweep from real meetings; the hard-landscape strip and the two-week grid read the same arrays. Capture from a meeting → link-back `cal:event/<id>`. |
| **Beta (weeks 4–5)** | Run alongside current tools. Success: inbox to zero daily; two consecutive Fridays with a completed review; clarify correction rate under ~30% (measured from the proposal → accepted diff). Tiers decided empirically from the same data. |

## Decisions taken with Jeff (2026-09-13)

- Data folder `~/GTD-data/`, private GitHub repo.
- Calendar (not Gmail) is the first live integration; Gmail later.
- The service runs on the Mac under launchd; manual start is fine.
- Wikis start empty; program hubs are written as programs are created.

## Out of scope for beta

Gmail ingest, Slack/URL enrichment, screenshot vision, Tauri/Electron shell,
multi-user. All recorded in `backlog.md`.
