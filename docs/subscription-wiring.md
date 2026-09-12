# Wiring a Claude subscription (no API key)

`backend-wiring.md` assumes the Messages API: `messages.parse`, Batch, prompt-cache
control, Managed Agents. A Claude subscription (Pro/Max) buys none of that. It buys
Claude Code — interactive and headless (`claude -p`) — plus skills, subagents,
scheduled tasks / cloud routines, and connectors (Gmail, Calendar). So the seam moves:
the "typed model call" box becomes a **Claude Code invocation running under the
login**, and model tiering is a per-agent `model:` setting rather than a request field.
Everything else — event log, SQLite projection, views, trust gates — is unchanged.

The Agent SDK *as a library* is API-billed; the CLI under the login is not. The
integration is therefore "shell out to `claude -p`", not "import the SDK".

## What the subscription does and doesn't buy

| | Subscription | API key |
|---|---|---|
| Interactive Claude Code, `claude -p`, skills, subagents | ✓ | ✓ |
| Scheduled tasks / cloud routines | ✓ | ✓ |
| Gmail / Calendar connectors | ✓ | build OAuth apps |
| `messages.parse`, Batch API, cache control, Managed Agents | ✗ | ✓ |
| Cost model | flat fee; **rolling usage windows** (Opus consumes them fastest) | per token |

## The shape

```
launchd / scheduled task            deterministic; owns *when* and *which tier*
   ├─ claude -p "/ingest"  --model haiku
   ├─ claude -p "/clarify" --model sonnet
   └─ claude -p "/review"  --model opus
         └─ subagents (.claude/agents/*.md, each with its own model:)
               └─ tools: gtd CLI · Gmail/Calendar MCP (read only) · Read/Grep on wiki/
                     └─ gtd propose-clarify --item 42 --json '…'
                           validates schema + enums built from the store
                           → appends `clarified` with actor=ai:clarify
```

Three things carry the design:

1. **The `gtd` CLI is the only write path.** It validates against the same Zod schemas
   as `backend-wiring.md §3`, builds the `project` / `owner` enums from the store at
   call time, stamps `actor` from `GTD_ACTOR` (set by the skill), and appends the
   event. Structured output moves from `messages.parse` to *validation at the
   boundary*: the model can only name things that exist, and the proposal→accepted
   diff (§6, the eval set) is still recorded. `claude -p --output-format json` exists,
   but validating in the CLI is sturdier and keeps writes in one place.
2. **Orchestration lives in the scheduler, not in a model.** No conductor agent decides
   what to run. One cron entry per job with the tier baked in — cheap, reproducible,
   and the tier is a config line.
3. **Trust invariants are harness rules, not prompt requests.** `settings.json`
   permission `deny` on `send_message`, `create_event`, `trash_*`, `delete_*`; a
   `PreToolUse` hook that refuses any send unless an `approved` event exists for that
   item; `--allowedTools` narrowed per skill. "AI never sends" stops being an
   instruction the model follows and becomes something it cannot do.

## Tier routing

| Job | Tier | Effort | Why |
|---|---|---|---|
| `ingest` dedupe, "is this even an ask?", reference filing, wiki lint | Haiku 4.5 | — | high volume, low judgment. Haiku has no adaptive thinking or effort dial and a 200K window; keep its prompts extraction-shaped |
| `clarify` (one item + snapshot, enums given) | Sonnet 5 | low | bounded input, strict schema |
| `draft_nudge`, `prep_brief`, `/status` draft | Sonnet 5 | medium | drafting from known facts |
| `review_prep` (whole ledger), `suggest_next_action` on stalled projects, the interactive Friday review, delegation capabilities needing judgment | Opus 5 | high | synthesis over everything; the human's time is on the line |

Mechanics: `model: haiku | sonnet | opus | inherit` in each `.claude/agents/<name>.md`
frontmatter; `--model` on the headless call; effort is the second dial *within* a tier
before jumping tiers.

**Escalation is the confidence gate that already exists.** `clarify` on Sonnet returns
`confidence < 0.6` → re-run once on Opus before the item lands in the triage queue.
One hop, one job type; bounded.

**Tiers are decided empirically.** `backend-wiring.md §6` stores the proposal→accepted
diff. Run a week of `clarify` on Sonnet and a week on Opus; compare correction rates.
The cheaper tier wins only if the *human* correction cost doesn't rise — a Haiku
clarify that has to be fixed costs more than a Sonnet one accepted in one keystroke.
Judge cost per completed task; under a subscription "cost" is quota-window headroom
plus minutes.

## Agent definitions (sketch)

```
.claude/
  agents/
    gtd-ingest.md      model: haiku    tools: Bash(gtd *), mcp gmail read, mcp calendar read
    gtd-clarify.md     model: sonnet   tools: Bash(gtd *), Read(wiki/**)
    gtd-drafter.md     model: sonnet   tools: Bash(gtd *), Read(wiki/**)          # nudges, prep, status
    gtd-reviewer.md    model: opus     tools: Bash(gtd *), Read(wiki/**), Grep
  skills/
    ingest / clarify / nudge / prep / status / review   → each invokes its agent
  settings.json
    permissions.deny: send_message, create_event, update_event, trash_*, delete_*
    hooks.PreToolUse: gtd guard --tool $TOOL --item $ITEM   (exit 2 unless `approved` exists)
```

Each agent's system prompt carries the job's rules and the `gtd` contract; the ledger
snapshot comes from `gtd snapshot` at run time rather than living in the prompt.

## The `gtd` CLI contract

```
gtd snapshot                         projects, people, open items — for the prompt
gtd inbox                            captured items with no `clarified`
gtd capture --source gmail --ref gmail:thread/… --raw '…'      idempotent on ref
gtd propose-clarify --item ID --json '…'                       → `clarified`
gtd propose-action  --project ID --json '…'                    → `next_action_set` (unconfirmed)
gtd draft --kind nudge|prep|status --for ID --json '…'          → deliverable to Ready lane; writes nothing else
gtd guard --tool T --item ID         exit 0 only if an `approved` event covers T for ID
gtd log --actor ai:… --type … --item ID --json '…'              generic append (tagged)
```

`GTD_ACTOR` must be set; the CLI refuses an unset or non-`ai:` actor from a headless
run. Every AI write lands `confirmed_by: null` and shows in the weekly review's audit
step, as before.

## What changes versus the API plan

- **Quota windows, not dollars.** Nightly `ingest` + `clarify` of ~30 items and a
  Friday Opus review sit comfortably inside Pro; hourly Opus does not. Heavy jobs run
  at quiet hours, and every job is **resumable** — the event log gives this for free
  (replay `captured` events that have no `clarified`).
- **No Batch API discount.** Irrelevant on a flat fee.
- **Synchronous clarify at capture time** (`POST /items` → enqueue) gets awkward:
  spawning `claude -p` per capture is slow. Clarify on a 15-minute cadence instead —
  GTD wants capture to be dumb anyway — or, later, add a small API key for that one hot
  path. A hybrid (subscription for scheduled + interactive, API for one job) is fine.
- **Ingestors get simpler.** They are skills over the Gmail / Calendar connectors, not
  OAuth apps to maintain. Dedupe on `source_ref` still lives in the CLI.
- **Local vs. cloud.** launchd + local Claude Code needs the Mac awake; cloud routines
  run regardless but need the repo on GitHub and the ledger reachable. Because
  `ledger/events.jsonl` is git-tracked, a routine can commit events and the Mac pulls —
  an option that exists only because storage is plain text.

## Recommendation

Start subscription-only: every job a skill + subagent, tiers as config, the `gtd` CLI
as the single write path. The model-call boundary is one module either way, so moving
a hot job to the API later is a local change. The durable, portable assets remain the
event log and the eval set.
