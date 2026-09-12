// Dates. Demo "today" is Mon 14 Sep 2026; every example date is relative to it.
/* ---------- example data ---------- */
export const TODAY = new Date('2026-09-14T08:00:00');

export const d = (n) => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return x; };

export const iso = (x) => new Date(x).toISOString().slice(0, 10);

export const days = (x) => Math.round((TODAY - new Date(x)) / 86400000);

export const until = (x) => -days(x);

export const fmtDate = (x) => new Date(x).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });

export const dueLabel = (x) => { const u = until(x); return u < 0 ? `${-u}d overdue` : u === 0 ? 'today' : u === 1 ? 'tomorrow' : fmtDate(x); };
