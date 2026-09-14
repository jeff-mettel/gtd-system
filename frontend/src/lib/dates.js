// Dates. Demo "today" is Mon 14 Sep 2026; every example date is relative to it.
/* ---------- example data ---------- */
export const DEMO_TODAY = new Date('2026-09-14T08:00:00');
const realToday = () => { const x = new Date(); x.setHours(8, 0, 0, 0); return x; };
/* "Today" for every view: the demo anchor while the demo ledger is loaded, the real date otherwise. Live binding — the
   store calls setToday() once it knows which ledger it has. */
export let TODAY = realToday();
export const isDemoToday = () => TODAY.getTime() === DEMO_TODAY.getTime();
export function setToday(demo) { TODAY = demo ? DEMO_TODAY : realToday(); }

/* The ledger clock: real wall-clock time, except in demo mode while the anchor is ahead of the real date, when events
   are stamped from TODAY forward (elapsed since the page opened) so "today" in the app and `at` in the ledger agree. */
const opened = Date.now();
export const clock = () => new Date(Math.max(Date.now(), TODAY.getTime() + (Date.now() - opened))).toISOString();

export const d = (n) => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return x; };

export const iso = (x) => new Date(x).toISOString().slice(0, 10);

export const days = (x) => Math.round((TODAY - new Date(x)) / 86400000);

export const until = (x) => -days(x);

export const fmtDate = (x) => new Date(x).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });

export const dueLabel = (x) => { const u = until(x); return u < 0 ? `${-u}d overdue` : u === 0 ? 'today' : u === 1 ? 'tomorrow' : fmtDate(x); };
