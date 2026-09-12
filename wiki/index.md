# Program Wiki Index

Compiled knowledge about programs — purpose, links, status, decisions, history,
stakeholders. The ledger (`ledger/events.jsonl`) is canonical for commitments;
this wiki is canonical for context. Updated on every ingest and compile.

Convention: `program-<slug>.md` is the hub; `-decisions`, `-timeline`, `-risks` are
sub-pages; `person-<slug>.md` are shared entity pages. Sections between
`<!-- compiled:… -->` markers are rewritten by the compile job; everything else is
hand- or ingest-written and edited in place. See `docs/wiki.md`.

> The three programs below are **example data** matching the front-end prototype
> (demo date Mon 14 Sep 2026). Replace with real programs when the ledger goes live.

## Programs

### Billing platform migration (P1)
- [Billing platform migration](program-billing-migration.md) — **Hub · living doc.** Move invoicing off the legacy system by end of Q1. At risk: cutover date undecided, finance sign-off pending. (ledger + steering notes)
- [Decisions](program-billing-migration-decisions.md) — Append-only decision log with rationale and ledger ids.
- [Timeline](program-billing-migration-timeline.md) — Dated history: milestones, status changes, incidents.
- [Risks](program-billing-migration-risks.md) — Living risk register.

### Fall launch readiness (P2)
- [Fall launch readiness](program-fall-launch.md) — **Hub · living doc.** Ship the fall release 21 Oct with support, comms and go/no-go in place. On track; go/no-go criteria need an owner. (ledger + readiness notes)
- [Decisions](program-fall-launch-decisions.md) — Append-only decision log.
- [Timeline](program-fall-launch-timeline.md) — Dated history.
- [Risks](program-fall-launch-risks.md) — Living risk register.

### Vendor consolidation (P3)
- [Vendor consolidation](program-vendor-consolidation.md) — **Hub · living doc.** 14 vendors → 6 by year end, ~$1.1M/yr. Blocked on legal redlines. (ledger + steering notes)
- [Decisions](program-vendor-consolidation-decisions.md) — Append-only decision log.
- [Timeline](program-vendor-consolidation-timeline.md) — Dated history.
- [Risks](program-vendor-consolidation-risks.md) — Living risk register.

## People

- [Priya Natarajan](person-priya-natarajan.md) — Engineering lead, billing. Owns the migration dry run.
- [Marcus Bell](person-marcus-bell.md) — Finance controller. Signs reconciliation results.
- [Dana Whitfield](person-dana-whitfield.md) — Product marketing. Owns launch comms.
- [Leo Okafor](person-leo-okafor.md) — Support manager. Owns support readiness and on-call.
- [Sam Reyes](person-sam-reyes.md) — Legal counsel. Owns master agreement redlines.
- [Ingrid Halvorsen](person-ingrid-halvorsen.md) — VP Operations; sponsor of all three programs.
- [Tomas Vieira](person-tomas-vieira.md) — Vendor management. Owns the vendor scorecard.
