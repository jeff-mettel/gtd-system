---
title: Billing platform migration — Risks
type: living-doc
program_id: P1
sources: [steering notes, ledger]
created: 2026-09-14
---

| Risk | Level | Owner | Mitigation | Status |
|---|---|---|---|---|
| Cutover date undecided compresses the dry-run-to-cutover gap | high | Ingrid Halvorsen | Put both options on Thursday steering with a recommendation (1 Nov) | open, ledger W7 |
| Finance sign-off slips past Thursday close | medium | Marcus Bell | Send variance summary Wednesday; walk through in Billing sync | open, ledger A2 |
| Infra can't give a 6-hour window before 25 Sep | medium | Priya Natarajan | Fallback: two 3-hour windows, partial replay | open, ledger W2 |
| Legacy rounding differences exceed 0.1% on edge accounts | low | Priya Natarajan | Exclusion list agreed with Marcus before dry run | monitoring |

## Related pages
[Hub](program-billing-migration.md)
