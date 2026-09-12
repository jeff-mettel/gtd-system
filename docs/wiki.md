# Program wiki

A Karpathy-pattern wiki (`wiki/`) that holds compiled knowledge about programs, next
to the ledger that holds commitments. Conventions match Jeff's `knowledge/` repo
(`{category}-{topic}.md`, frontmatter, `index.md` catalog, append-only `log.md`).

## Ledger vs. wiki

| | Ledger (`ledger/events.jsonl`) | Wiki (`wiki/`) |
|---|---|---|
| Kind of memory | Episodic — what happened, what's owed | Semantic — what's true about a program, compiled |
| Canonical for | Items, dates, owners, nudges, approvals | Purpose, key links, decisions with rationale, history narrative, stakeholder maps, risks |
| Written by | Ingestors, triage UI, delegation approvals | Compile job (from ledger) + ingest (from notes/docs), each reviewed |
| Read by | The views | Prep briefs, status drafts, "what's the story on X" |

**Rule:** anything with a date and an owner lives in the ledger; anything that
explains, links or narrates lives in the wiki. Each cites the other — a wiki decision
entry carries the ledger event id; a ledger `approved` event names the page it changed.

## Pages

```
wiki/
  index.md                          catalog by program, one line per page
  log.md                            append-only: ingest | compile | query | lint
  program-<slug>.md                 HUB · living-doc
  program-<slug>-decisions.md       append-only, newest first, rationale + ledger ids
  program-<slug>-timeline.md        dated history
  program-<slug>-risks.md           living register
  person-<slug>.md                  entity, shared across programs
```

Hub sections, in order: Purpose · Key links · Current status · Milestones ·
Stakeholders · Open commitments · Recent history · Related pages.

## Compiled sections

Sections the compile job owns are fenced with HTML comments and rewritten wholesale;
everything outside the fences is hand- or ingest-written and edited in place.

```
<!-- compiled:status start -->
…one paragraph: health, what moved, what's blocked, what needs attention…
<!-- compiled:status end -->
<!-- compiled:commitments start --> … <!-- compiled:commitments end -->
<!-- compiled:history start -->     … <!-- compiled:history end -->
```

The compile job runs Friday (with the weekly review) and on triggers — health change,
decision approved, milestone state change. It appends to `-timeline`, updates the
`updated:` frontmatter date, and writes a `compile` entry to `log.md`. It touches
nothing outside the fences, so it is safe at autonomy "Do it, tell me weekly".

## Three write paths

1. **Compile (ledger → wiki), automatic.** As above.
2. **Ingest (source → wiki), reviewed.** Meeting notes, a deck, a long thread — one
   source at a time, per the `knowledge-wiki-ingest` procedure — run as the delegated
   capability *Update the wiki*. Edits land in the Ready-for-review lane with "what
   approving does: updates N sections on <page>, adds M decisions". Approval applies
   them and writes an `ingest` log entry.
3. **Decisions, via the wiki.** A decision made in a meeting is captured like any ask,
   clarified as `kind: decision`; on accept it's appended to `-decisions.md` with
   rationale and the ledger gets `decision_recorded` pointing at it.

## Lint

The Karpathy lint pass is a weekly-review step: pages whose compiled status is older
than 7 days, contradictions between wiki and ledger (owner on a risk vs. owner in the
ledger), orphan pages with no Related pages, index lines with no page. Findings are
shown in the review; fixes go through path 2.

## What the front-end reads from the wiki

- Programs: compiled status paragraph under each program header; **Wiki** button
  opens the hub in a drawer (links, milestones, stakeholders, decisions, risks).
- Project drawer: "From the wiki" — key links, latest decision, open risk for that
  project's program.
- Prep brief: "Recent decisions" and "Watch for" (open risks involving attendees).
- Delegated: capability *Update the wiki* in the autonomy table.
- Weekly review: "Wiki lint" step.
