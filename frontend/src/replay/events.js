// The Replay's view of the ledger: the store's events (contract shape) with `at` as milliseconds, sorted, plus
// the item list, review times, wiki page list and the time window. Rebuilt when the ledger grows. In demo mode
// the seeded history (packages/ledger/demo.js) gives the eight weeks their volume.
import { TODAY } from '../lib/dates.js';
import { ledger, people, programs, projects, wiki } from '../store.js';

const DAY = 864e5;

export const hubPage = (pid) => { const j = projects.find(x => x.id === pid); const g = j ? j.program : pid; return wiki[g]?.page || null; };
const pageList = () => { const out = []; for (const g of programs) if (wiki[g.id]) { out.push([wiki[g.id].page, g.id]); for (const s of ['decisions', 'timeline', 'risks']) out.push([wiki[g.id].page + '-' + s, g.id]); for (const p in wiki[g.id].pages) if (!out.some(x => x[0] === p)) out.push([p, g.id]); } for (const p of people) out.push(['person-' + p.id, p.id]); return out; };

let cache = null;
/** Build (memoised per ledger length) the event log for the replay. Returns { EV, ITEMS, REVIEWS, PAGES, T0, T1 }. */
export function buildEvents() {
  if (cache && cache.n === ledger.events.length && cache.seq === ledger.seq) return cache.data;
  const EV = ledger.events.map(e => ({ ...e, at: Date.parse(e.at) })).filter(e => !Number.isNaN(e.at)).sort((a, b) => a.at - b.at || a.seq - b.seq);
  const first = EV.length ? EV[0].at : TODAY.getTime() - 56 * DAY, last = EV.length ? EV[EV.length - 1].at : TODAY.getTime();
  const T1 = Math.max(TODAY.getTime(), last), T0 = Math.min(first, TODAY.getTime() - 56 * DAY - 2 * 36e5);   // eight weeks back, 06:00
  const REVIEWS = EV.filter(e => e.type === 'review_completed').map(e => e.at);
  const ITEMS = [...new Set(EV.filter(e => e.type === 'captured' && e.item).map(e => e.item))];
  const data = { EV, ITEMS, REVIEWS, PAGES: pageList(), T0, T1 };
  cache = { n: ledger.events.length, seq: ledger.seq, data };
  return data;
}
/** Captured / clarified / done per week over the last eight weeks, for the Flow bars. */
export const weeks = () => { const { EV } = buildEvents(); const out = []; const T0 = TODAY.getTime() - 56 * DAY - 2 * 36e5; for (let w = 0; w < 8; w++) { const a = T0 + w * 7 * DAY, b = a + 7 * DAY, wk = { w: new Date(a).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), c: 0, k: 0, d: 0 }; for (const e of EV) { if (e.at < a || e.at >= b) continue; if (e.type === 'captured') wk.c++; else if (e.type === 'clarified') wk.k++; else if (e.type === 'done' || e.type === 'approved') wk.d++; } out.push(wk); } return out; };
