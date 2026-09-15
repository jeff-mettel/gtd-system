// Per-browser preferences — the only thing besides the ledger that touches localStorage. Nothing here is data:
// dismissed view tips, collapsed panels, the Engage grouping, the sidebar state, and the tick-boxes of the review
// in progress. Everything else the app remembers is an event in the ledger (store.js).

export const PREFS_KEY = 'gtd-prefs-v1';

/* Defaults. `collapsed` is merged key by key with what was saved, so a new default (the Engage filter row starts folded)
   reaches existing browsers; `reviewGuided` is the weekly review's one-step-at-a-time mode; `guidesInit` marks that live
   mode has folded the instruction cards once (store.js). */
const DEFAULTS = () => ({ guides: {}, collapsed: { nowFilter: true }, nowGroup: 'context', review: {}, reviewGuided: false, guidesInit: false });
export const prefs = DEFAULTS();
try { const s = localStorage.getItem(PREFS_KEY); if (s) { const saved = JSON.parse(s); Object.assign(prefs, saved, { collapsed: { ...prefs.collapsed, ...(saved.collapsed || {}) } }); } } catch (e) {}

export function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }

export function resetPrefs() { for (const k of Object.keys(prefs)) delete prefs[k]; Object.assign(prefs, DEFAULTS()); try { localStorage.removeItem(PREFS_KEY); } catch (e) {} }
