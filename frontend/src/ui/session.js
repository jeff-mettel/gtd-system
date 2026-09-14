// Transient UI state shared across views (not persisted): the selected inbox item, filters, and the kind/owner
// the person clicked on a proposal before accepting it (pkind — the AI's proposal itself is in the ledger).
export const ui = { sel: null, delegateOnAccept: false, nowTime: 0, nowEnergy: '', nowScope: '', pkind: {} };

/* The proposal as shown: the AI's, overlaid with what the person clicked. */
import { defaultProposal } from '@gtd/ledger';
/* The proposal to show: the AI's when it has one, else a first guess (flagged) so the form always works; `pending` says which. */
export function proposalOf(it) { const base = it.p || Object.assign(defaultProposal(it), { pending: true }); const o = ui.pkind[it.id]; return o ? Object.assign({}, base, o) : base; }
