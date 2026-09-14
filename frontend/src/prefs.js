// Per-browser preferences — the only thing besides the ledger that touches localStorage. Nothing here is data:
// dismissed view tips, collapsed panels, the Engage grouping, the sidebar state, and the tick-boxes of the review
// in progress. Everything else the app remembers is an event in the ledger (store.js).

export const PREFS_KEY = 'gtd-prefs-v1';

export const prefs = { guides: {}, collapsed: {}, nowGroup: 'context', review: {} };
try { const s = localStorage.getItem(PREFS_KEY); if (s) Object.assign(prefs, JSON.parse(s)); } catch (e) {}

export function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }

export function resetPrefs() { for (const k of Object.keys(prefs)) delete prefs[k]; Object.assign(prefs, { guides: {}, collapsed: {}, nowGroup: 'context', review: {} }); try { localStorage.removeItem(PREFS_KEY); } catch (e) {} }
