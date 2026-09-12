# Back-end wiring

The front-end never talks to a model. It talks to one small API that owns two things:
an **append-only event log** and a handful of **typed model calls**. Every button in the
UI maps to a read (a view over the log) or a write (an event). AI jobs are single
structured-output calls, not agents, and their results enter the system the same way a
human's do: as events, tagged with who produced them.

## 1. The data model is an event log

```
events (append-only)
  id, at, actor ('jeff' | 'ai:clarify' | 'ai:draft' | 'ingest:gmail' | ...),
  type, item_id, payload, confirmed_by, confirmed_at

types: captured · clarified · accepted · edited · done · closed · nudged · promoted ·
       dropped · program_created · program_retired · project_created · project_dropped ·
       health_set · next_action_set · delegated · working · delivered · approved ·
       taken_back · review_completed · wiki_changed
```

`closed` is a waiting-for received (the counterpart of `done`). `health_set` records a
human health judgment; it is the one status-like field, and it lives in the log so it
has a date. `wiki_changed {page, entry_type, words_delta}` is written by the compile,
ingest and file jobs — the wiki's own history stays in git and `log.md`, but this puts
wiki growth on the same clock as commitments, which the Replay view needs.

`items`, `projects`, `people` are materialized from the log (SQLite, rebuilt on demand).
This gives, for free:

- **Last movement** = max `at` over a project's events. Never stored.
- **Audit** = `actor LIKE 'ai:%'`.
- **Unconfirmed AI writes** = `actor LIKE 'ai:%' AND confirmed_by IS NULL` — the list the
  weekly review shows.
- **Reversibility** = a compensating event, not a delete.

Markdown files, if kept for Obsidian editing, are a *projection* written after each
event — not the source. No two-way sync.

## 2. Every UI action is an endpoint

| Front-end control | Request | Server does |
|---|---|---|
| Capture box | `POST /items {raw, source}` | Writes `captured`, enqueues clarify |
| Inbox loads | `GET /inbox` | Items with `clarified` but no `accepted` |
| Accept / `a` | `POST /items/:id/accept {...edited}` | Writes `accepted` with `confirmed_by`; stores the diff vs. proposal |
| Draft nudge | `POST /waiting/:id/nudge/draft` | Model call → returns text; writes nothing |
| Approve and send | `POST /waiting/:id/nudge {text}` | Sends via channel adapter, writes `nudged` |
| Decide next action | `GET /projects/:id/suggest` → `POST /projects/:id/actions` | Model suggestion; `next_action_set` on confirm |
| Prep | `GET /meetings/:id/brief` | Query + one model call for the "Raise" section |
| Hand to AI | `POST /items/:id/delegate {cap}` | Writes `delegated`, enqueues the capability job |
| Approve AI work | `POST /items/:id/approve {deliverable}` | Executes declared side effects, writes `approved` + `done` |
| Complete review | `POST /reviews` | Writes `review_completed`, stamps projects |
| Programs / Waiting / People / Flow | `GET /views/...` | Queries only |

Reads are SQL; model calls happen in a few places, and most write nothing until the
human confirms.

## 3. The typed model jobs

Each is one `messages.parse` call with a Zod schema — inputs are fully known, so a
single call is the right tier. Enums for `project` and `owner` are **built from the
store at call time**, so the model can only name things that exist. The ledger
snapshot (projects, people, open items) is stable across a session and goes in the
system prompt with `cache_control` (1h TTL); the raw item is the only volatile part
and goes last.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic();

function schemas(store: Store) {
  const projectIds = store.projects.map(p => p.id) as [string, ...string[]];
  const personIds  = store.people.map(p => p.id)   as [string, ...string[]];
  return {
    Clarification: z.object({
      kind: z.enum(["action", "waiting", "project", "someday", "reference", "trash"]),
      next_action: z.string().describe("Verb-first, physical, visible. Empty for reference/trash."),
      project: z.enum(projectIds).nullable(),
      new_project_outcome: z.string().nullable(),
      owner: z.enum(personIds).nullable(),
      context: z.enum(["@quick", "@deep", "@1:1", "@agenda", "@errand"]),
      minutes: z.number().int().nullable(),
      due: z.string().nullable(),
      follow_up: z.string().nullable(),
      ai_can: z.object({ level: z.enum(["do", "draft", "assist"]), cap: z.string(), what: z.string() }).nullable(),
      confidence: z.number().min(0).max(1),
      rationale: z.string().max(240),
    }),
  };
}

export async function clarify(store: Store, item: CapturedItem) {
  const { Clarification } = schemas(store);
  const res = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    output_config: { format: zodOutputFormat(Clarification), effort: "low" },
    system: [
      { type: "text", text: CLARIFY_RULES },
      { type: "text", text: store.snapshotForPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } },
    ],
    messages: [{ role: "user", content: renderItem(item) }],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("clarify: unparseable");
  await store.append({ type: "clarified", actor: "ai:clarify", item_id: item.id, payload: out, confirmed_by: null });
  return out;
}
```

| Job | Input | Output | Effort |
|---|---|---|---|
| `clarify` | one captured item + snapshot | above | low |
| `suggest_next_action` | project (outcome, history, open items) | `{next_action, context, minutes, why}` | high |
| `draft_nudge` | waiting item + person + history | `{subject, body, tone}` | medium |
| `prep_brief` | meeting + attendees' open items + decisions | `{raise[], watch_for[]}` | medium |
| `review_prep` | the whole ledger for the week | `{stalled_reasons[], promote[], drop[], wins_summary}` | high |
| delegation capabilities | item + what + source | capability-specific deliverable + declared side effects | per capability |

`clarify` is closer to extraction; `prep_brief` and `review_prep` are synthesis and
earn the model's cost.

## 4. Ingestors are separate from clarify

Ingestors are dumb workers: fetch, dedupe on `source_ref`, write `captured`. They never
call the model. Clarify runs as a second stage off a queue, so: overnight backlog →
Batch API at 50% cost; ingestor failures don't lose model work; a re-clarify pass is a
replay of `captured` events.

## 5. Confidence gating lives on the server

```ts
if (out.confidence >= 0.85 && out.kind !== "project") {
  await store.append({ type: "accepted", actor: "ai:clarify", item_id, payload: out, confirmed_by: null });
} // else it stays in the inbox
```

High-confidence items are filed *and* remain unconfirmed; the weekly review surfaces
them for a fast scan. New projects always go to the human.

## 6. The triage UI is an eval set

On every accept, store the diff between what the model proposed and what was
confirmed. Weeks in, that's hundreds of labeled examples of the user's judgment: a
regression eval before prompt changes, few-shot material, and the measured answer to
"is the AI's filing trustworthy yet?"

## 7. Where it runs

Simplest: a Node service on the Mac (Hono/Fastify + `better-sqlite3`) started by
launchd, with ingest and review jobs as Claude Code scheduled tasks hitting its
endpoints. The front-end becomes real by replacing the in-file `items`/`projects`
arrays with `fetch` calls and `state.*` writes with `POST`s — render functions don't
change. The ingest→clarify pipeline and Friday `review_prep` also fit Managed Agents
scheduled deployments with the store as the one custom tool; start local, since the
log and the eval set are the durable, portable assets.
