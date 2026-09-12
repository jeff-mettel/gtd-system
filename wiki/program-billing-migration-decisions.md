---
title: Billing platform migration — Decisions
type: living-doc
program_id: P1
sources: [Billing sync notes, steering notes]
created: 2026-09-14
---

Append-only. Newest first. Each entry cites the ledger event or meeting it came from.

## 2026-09-03 — Reconciliation tolerance set at 0.1%
**Who:** Marcus Bell, Priya Natarajan (Billing sync). **Status:** agreed; formal sign-off pending (ledger W3).
**Why:** Matches the external auditor's materiality threshold; tighter would fail on
known rounding differences in the legacy system, looser would not satisfy Finance.
**Consequence:** Dry-run success criterion is now <0.1% variance.

## 2026-08-14 — Dry run before cutover is mandatory
**Who:** Ingrid Halvorsen (steering). **Ledger:** decision_recorded #e-0412.
**Why:** The 2024 CRM migration skipped a full-data rehearsal and produced two weeks
of customer-facing errors. Not repeating that.
**Consequence:** Cutover cannot be earlier than dry run + 3 weeks.

## Pending
- Cutover date: 1 Nov vs 15 Nov — with Ingrid since 26 Aug (ledger W7). 1 Nov keeps
  Q1 retirement comfortable; 15 Nov gives the dry run a second attempt.

## Related pages
[Hub](program-billing-migration.md) · [Timeline](program-billing-migration-timeline.md)
