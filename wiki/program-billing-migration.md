---
title: Billing platform migration
type: living-doc
program_id: P1
sources: [ledger, Billing sync notes, steering deck 2026-09-04]
created: 2026-09-14
---

## Purpose
Move all invoicing off the legacy system by end of Q1 with zero customer-visible
billing errors. Sponsor: [Ingrid Halvorsen](person-ingrid-halvorsen.md).
Cadence: steering Thursday, status Friday.

## Key links
- Cutover runbook — https://docs.example.internal/billing/cutover-runbook
- Reconciliation dashboard — https://metrics.example.internal/billing/reconciliation
- Steering deck (latest) — https://drive.example.internal/billing/steering-2026-09-04
- Legacy system retirement plan — https://docs.example.internal/billing/legacy-retirement
- Team channel — #billing-migration

## Current status
<!-- compiled:status start -->
**At risk** (compiled Fri 11 Sep). Dry-run plan approved and a 6-hour window is
being confirmed with infra. Finance sign-off is pending Marcus's formal approval of
the 0.1% reconciliation tolerance, 11 days waiting. The cutover date (1 Nov vs
15 Nov) has been with Ingrid for 19 days and now gates the runbook; without it the
dry-run-to-cutover gap compresses.
<!-- compiled:status end -->

## Milestones
| When | What | State |
|---|---|---|
| 11 Sep | Dry-run plan approved | done |
| 25 Sep (target) | Production data dry run | scheduled pending window |
| 2 Oct | Finance sign-off on reconciliation | at risk |
| 1 or 15 Nov | Cutover | undecided |
| 31 Mar | Legacy system retired | planned |

## Stakeholders
| Person | Owns |
|---|---|
| [Priya Natarajan](person-priya-natarajan.md) | Engineering, dry run, infra window |
| [Marcus Bell](person-marcus-bell.md) | Reconciliation sign-off, tolerance approval |
| [Ingrid Halvorsen](person-ingrid-halvorsen.md) | Cutover date decision, sponsor |

## Open commitments
<!-- compiled:commitments start -->
- Next actions (me): 2 — confirm dry-run window with Priya; send reconciliation summary to Marcus (due Wed).
- Waiting for: 2 — Priya, infra window (4d); Marcus, tolerance approval (11d, past follow-up); Ingrid, cutover date (19d, past follow-up).
- Delegated to AI: 1 — compile decisions log from meeting notes (working).
- Projects: Data migration dry run (on track) · Legacy invoice cutover plan (at risk, stalled 12d) · Finance sign-off (at risk).
<!-- compiled:commitments end -->

## Recent history
<!-- compiled:history start -->
- 13 Sep — Cutover risk register rebased.
- 11 Sep — Migration dry-run plan approved.
- 3 Sep — Reconciliation tolerance 0.1% agreed in Billing sync ([decision](program-billing-migration-decisions.md)).
- 26 Aug — Cutover date question escalated to Ingrid.
- 14 Aug — Dry run before cutover made mandatory ([decision](program-billing-migration-decisions.md)).
<!-- compiled:history end -->

## Related pages
- [Decisions](program-billing-migration-decisions.md) · [Timeline](program-billing-migration-timeline.md) · [Risks](program-billing-migration-risks.md)
- [Vendor consolidation](program-vendor-consolidation.md) — shares Ingrid as sponsor; steering slots collide in October.
