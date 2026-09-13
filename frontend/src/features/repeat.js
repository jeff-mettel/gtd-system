// Repeating actions: `repeat: 'daily' | 'weekly' | 'monthly'` on an action. Marking one done spawns the next
// instance with its dates advanced by one period (further, if that would still be in the past).

import { items } from '../data/example.js';
import { TODAY, fmtDate, iso } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { save, state } from '../state.js';

export const REPEATS = [['', 'none'], ['daily', 'daily'], ['weekly', 'weekly'], ['monthly', 'monthly']];

export function advance(x, period, n = 1) {
  const d = new Date(x);
  if (period === 'monthly') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + (period === 'weekly' ? 7 : 1) * n);
  return d;
}

/* Next occurrence: one period on from the current date, then keep stepping until it is not in the past. */
function nextDate(x, period) { let d = advance(x, period); while (d < TODAY) d = advance(d, period); return d; }

/* Chip for shared rows — `${repeatChip(a)}` inside actionRow's .m span. */
export const repeatChip = (a) => a.repeat ? `<span class="chip rep" title="Repeats ${esc(a.repeat)} — the next one is scheduled when this is done">↻ ${esc(a.repeat)}</span>` : '';

/* Mark an item done and, if it repeats, schedule the next instance. Returns the spawned item (or null).
   Callers still toast and render; use `doneToast(spawned)` for the message. */
export function completeItem(it) {
  it._prev = it.kind; it.kind = 'done'; it.doneAt = TODAY;
  state.done[it.id] = true; state.overrides[it.id] = Object.assign(state.overrides[it.id] || {}, { doneAt:TODAY });
  if (!it.repeat) { save(); return null; }
  const id = 'R' + Date.now();
  const n = { id, kind:'action', next:it.next, project:it.project ?? null, ctx:it.ctx, min:it.min, repeat:it.repeat, createdAt:TODAY, energy:it.energy, owner:it.owner === 'ai' ? undefined : it.owner, ai:it.ai };
  if (it.hard) n.hard = nextDate(it.hard, it.repeat);
  if (it.due) n.due = nextDate(it.due, it.repeat);
  items.push(n);
  state.captured.push(Object.assign({}, n, { createdAt:iso(TODAY), hard:n.hard ? iso(n.hard) : undefined, due:n.due ? iso(n.due) : undefined }));
  it._spawned = id;
  save();
  return n;
}

/* Undo of a tick: put the item back and withdraw the instance it spawned. */
export function uncompleteItem(it) {
  it.kind = it._prev || 'action'; delete state.done[it.id];
  if (it._spawned) { const i = items.findIndex(x => x.id === it._spawned); if (i >= 0) items.splice(i, 1); state.captured = state.captured.filter(c => c.id !== it._spawned); delete it._spawned; }
  save();
}

export const doneToast = (spawned) => !spawned ? 'Done · logged for the weekly review' : (spawned.hard || spawned.due) ? `Done · next one scheduled for ${fmtDate(spawned.hard || spawned.due)}` : `Done · repeats ${spawned.repeat}, next one added to your list`;
