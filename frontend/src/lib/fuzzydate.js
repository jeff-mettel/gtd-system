// Fuzzy date parsing: "tomorrow", "fri", "next week", "+3", "eom", "9/20", "20 sep" → a Date at 08:00 local.
// Pure: no DOM. `base` is the reference "today" (defaults to the demo TODAY).

import { TODAY } from './dates.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const at8 = (y, m, d) => new Date(y, m, d, 8, 0, 0, 0);
const dayOf = (x) => at8(x.getFullYear(), x.getMonth(), x.getDate());
const addDays = (x, n) => at8(x.getFullYear(), x.getMonth(), x.getDate() + n);
const addMonths = (x, n) => { const t = at8(x.getFullYear(), x.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return at8(t.getFullYear(), t.getMonth(), Math.min(x.getDate(), last)); };
const dayIndex = (s) => { const i = DAYS.findIndex(n => n === s || n.slice(0, 3) === s); return i; };
const monthIndex = (s) => MONTHS.findIndex(n => n === s || n.slice(0, 3) === s || (s === 'sept' && n === 'september'));

/* A month/day with no year means the next such day on or after base. */
function monthDay(base, m, d, y) {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  if (y != null) { if (y < 100) y += 2000; const x = at8(y, m, d); return x.getMonth() === m ? x : null; }
  let x = at8(base.getFullYear(), m, d); if (x.getMonth() !== m) return null;
  if (x < base) x = at8(base.getFullYear() + 1, m, d);
  return x;
}

export function parseFuzzy(text, base = TODAY) {
  const s = String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const b = dayOf(new Date(base));
  let m;
  if (['today', 'tod', 'now'].includes(s)) return b;
  if (['tomorrow', 'tmr', 'tmrw', 'tom'].includes(s)) return addDays(b, 1);
  if (s === 'yesterday') return addDays(b, -1);
  if (s === 'next week' || s === 'nw') return addDays(b, (8 - b.getDay()) % 7 || 7);     // next Monday
  if (s === 'next month' || s === 'nm') return at8(b.getFullYear(), b.getMonth() + 1, 1);
  if (s === 'eow') return addDays(b, (5 - b.getDay() + 7) % 7);                            // this Friday
  if (s === 'eom') return at8(b.getFullYear(), b.getMonth() + 1, 0);
  if (s === 'eoq') return at8(b.getFullYear(), Math.floor(b.getMonth() / 3) * 3 + 3, 0);
  if (s === 'eoy') return at8(b.getFullYear(), 11, 31);
  /* weekday: coming occurrence (strictly after today); "next fri" = the one after that. */
  if ((m = s.match(/^(next |this )?([a-z]+)$/)) && dayIndex(m[2]) >= 0) { const i = dayIndex(m[2]); const n = ((i - b.getDay() + 7) % 7) || 7; return addDays(b, m[1] === 'next ' ? n + 7 : n); }
  /* in N days | N d | +N | t+N */
  if ((m = s.match(/^(?:in )?\+?(\d+) ?(d|days?|w|wks?|weeks?|m|mo|months?)$/))) { const n = +m[1], u = m[2][0]; return u === 'd' ? addDays(b, n) : u === 'w' ? addDays(b, n * 7) : addMonths(b, n); }
  if ((m = s.match(/^(?:t|today)? ?\+ ?(\d+)$/))) return addDays(b, +m[1]);
  if ((m = s.match(/^-(\d+)$/))) return addDays(b, -m[1]);
  /* ISO 2026-09-20 */
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return monthDay(b, +m[2] - 1, +m[3], +m[1]);
  /* US 9/20 or 9/20/2026 */
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) return monthDay(b, +m[1] - 1, +m[2], m[3] ? +m[3] : null);
  /* 20 sep | 20 sep 2026 | sep 20 | sept 20th, 2026 */
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?: ,?(\d{2,4}))?$/)) && monthIndex(m[2]) >= 0) return monthDay(b, monthIndex(m[2]), +m[1], m[3] ? +m[3] : null);
  if ((m = s.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{2,4}))?$/)) && monthIndex(m[1]) >= 0) return monthDay(b, monthIndex(m[1]), +m[2], m[3] ? +m[3] : null);
  return null;
}
