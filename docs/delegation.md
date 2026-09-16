# Delegating work to the AI

The clarify step ends in *do it, delegate it, or defer it*. Handing work to the AI
is delegation — the same as handing it to a person — with two differences: the clock
runs in minutes instead of days, and there is a **review gate** before anything leaves
the system. The AI therefore gets no special mode; it is treated as a delegate and
shows up wherever delegation already shows.

## Three levels

| Level | Meaning | Example |
|---|---|---|
| Can do it | Complete the action; side effects wait for approval | Find a free room on 2 Oct and propose the rebooking |
| Can draft it | Produce the artifact; the human checks and sends | Draft the variance summary from the reconciliation export |
| Can prep it | Can't do the action, but can prepare for it | Pre-read the draft and list open questions |

The clarify model returns `ai_can: {level, cap, what}` alongside the clarification.

## Capabilities and autonomy

Each delegated job belongs to a capability, and each capability has an autonomy
setting: **Never / Always ask first / Draft, then ask / Do it, tell me weekly**.

| Capability | Cap |
|---|---|
| File reference items | up to auto |
| Draft replies, nudges, summaries | up to auto |
| Update ledger data | up to auto |
| Send email, chat, messages | **Always ask** at most |
| Book time on calendars | **Always ask** at most |
| Delete or archive | **Always ask** at most |

Anything that leaves the system is capped at "Always ask" and the UI will not let it be
raised. Everything the assistant does — including at "Do it" — is logged and appears in
the weekly review's audit step. Autonomy is turned up one capability at a time as the
log earns trust.

## Lifecycle

`delegated` → Queued → Working → **Ready for review** → `approved` (executes declared
side effects, marks done) or `taken_back` (returns to the human's list).

The "what approving does" line on every card is computed from the job's **declared side
effects**, not written by the model, so the UI can promise it truthfully.

## Where it appears in the UI

- **Inbox** — an "AI can" row on action proposals; `d` toggles "Accept and hand to AI".
- **Now** — "Hand to AI" / "AI prep" on eligible action rows; a "Ready for your review"
  panel above the calendar when deliverables are waiting (work blocked on the human).
- **Delegated to AI** — rail item with the ready count; three lanes (Queued, Working,
  Ready); Review drawer with editable deliverable, Approve / Take it back; autonomy
  table; this week's AI log.
- **Programs** — a delegated next action reads "Delegated to AI · ready for review"; the
  project counts as covered.
- **People** — the assistant has a card like everyone else: what it owes me, what I owe
  it (reviews).
- **Weekly review** — step "Audit what the AI did this week"; automatic runs highlighted.
- **Flow** — hours handed off this week.

## Back-end

Each capability is a typed model job gated by its autonomy setting: `ask` → deliverable
to the Ready lane; `draft` → same, pre-filled; `auto` → executes and writes a log event.
Approval edits are kept as feedback for the next run.
