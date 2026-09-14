// Transient UI state shared across views (not persisted): the selected inbox item, filters, and the kind/owner
// the person clicked on a proposal before accepting it (pkind — the AI's proposal itself is in the ledger).
export const ui = { sel: null, delegateOnAccept: false, nowTime: 0, nowEnergy: '', nowScope: '', pkind: {} };

/* The proposal as shown: the AI's, overlaid with what the person clicked. */
export function proposalOf(it) { const o = ui.pkind[it.id]; return o ? Object.assign({}, it.p, o) : it.p; }
