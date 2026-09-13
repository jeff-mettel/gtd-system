// Deferred actions — GTD's tickler for next actions. An action with a `start` date in the future is parked:
// it stays on its project (so the project is covered) but leaves the context lists and the open counts.
// On the day `start` arrives it re-enters the lists at the top with a "back today" chip; `resurfacedAt`
// remembers the day it came back so the chip shows for that day only (state.js stamps it on render).
//
// Pure helpers take an optional `today` so tests can pin the date.

import { TODAY, fmtDate, iso } from '../lib/dates.js';
import { esc } from '../lib/dom.js';

const dayOf = (x) => { const t = new Date(x); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

/* Whole days from `today` to the start date: >0 future, 0 today, <0 past. null without a start. */
export function untilStart(a, today = TODAY) { if (!a?.start) return null; return Math.round((dayOf(a.start) - dayOf(today)) / 86400000); }

/* Parked: the start date is still ahead. */
export function isDeferred(a, today = TODAY) { const n = untilStart(a, today); return n != null && n > 0; }

/* Came back today: the start date has arrived (today or earlier) and the day it resurfaced is today. An action
   that resurfaced on a day you didn't open the app is stamped the first day you do — the chip follows that stamp. */
export function isBackToday(a, today = TODAY) {
  if (!a?.start || isDeferred(a, today)) return false;
  return !!a.resurfacedAt && dayOf(a.resurfacedAt).getTime() === dayOf(today).getTime();
}

/* Stamp `resurfacedAt` on every action whose start has arrived and which has not been stamped since that start.
   Returns the ids it stamped so the caller can persist them (state.js does). Idempotent. */
export function resurfaceDeferred(list, today = TODAY) {
  const hit = [];
  for (const a of list) {
    if (a.kind !== 'action' || !a.start || isDeferred(a, today)) continue;
    if (a.resurfacedAt && dayOf(a.resurfacedAt) >= dayOf(a.start)) continue;
    a.resurfacedAt = dayOf(today); hit.push(a.id);
  }
  return hit;
}

/* Ordering helper: back-today items first, otherwise stable. */
export const backFirst = (a, b) => (isBackToday(b) ? 1 : 0) - (isBackToday(a) ? 1 : 0);

/* Chips for shared rows — `${backChip(a)}` and `${deferChip(a)}` inside actionRow's .m span. */
export const backChip = (a) => isBackToday(a) ? `<span class="chip back" title="Deferred until ${esc(fmtDate(a.start))} — back in your lists today">↩ back today</span>` : '';
export const deferChip = (a) => isDeferred(a) ? `<span class="chip defer" title="Deferred: leaves the lists until ${esc(fmtDate(a.start))}">⏸ starts ${esc(fmtDate(a.start))}</span>` : '';

/* Item-drawer row: a "Defer until" date with its fuzzy companion. Uses the drawer's data-setdate contract, so the
   existing change handler persists it (drawers/item.js: place it after the "Pinned to a day" row). */
export function deferField(x) {
  return `<div class="wrow"><span class="eyebrow" title="Tickler: leaves your lists until this day, then comes back at the top">Defer until</span><div class="datewrap"><input type="date" class="in" style="width:auto;padding:4px 8px" value="${x.start ? iso(x.start) : ''}" data-setdate="start" data-id="${x.id}"><input class="fuzzy in" data-for-sel="[data-setdate]" placeholder="or: tomorrow, fri, +3" aria-label="Defer until — fuzzy date"></div>${isDeferred(x) ? `<div class="faint" style="grid-column:2">Parked — not in the lists until ${esc(fmtDate(x.start))}; the project still counts as covered.</div>` : ''}</div>`;
}
