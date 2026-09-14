// Repeating actions: `repeat: 'daily' | 'weekly' | 'monthly'` on an action. Marking one done spawns the next
// instance with its dates advanced by one period (further, if that would still be in the past).

import { TODAY, fmtDate } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { commit, items } from '../store.js';

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
  commit('done', {}, { item: it.id });
  if (!it.repeat) return null;
  const id = 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fields = { next:it.next, project:it.project ?? null, ctx:it.ctx, min:it.min, repeat:it.repeat, energy:it.energy, ai:it.ai, spawnedFrom:it.id };
  if (it.hard) fields.hard = nextDate(it.hard, it.repeat);
  if (it.due) fields.due = nextDate(it.due, it.repeat);
  commit('captured', { source:'repeat', raw:it.next, ref:`repeat:${it.id}:${(fields.hard || fields.due || TODAY).toISOString().slice(0, 10)}` }, { item: id });
  commit('accepted', { kind:'action', fields }, { item: id });
  return items.find(x => x.id === id);
}

/* Undo of a tick: put the item back and withdraw the instance it spawned (nothing is deleted — it goes to trash). */
export function uncompleteItem(it) {
  commit('undone', {}, { item: it.id });
  const spawned = items.find(x => x.spawnedFrom === it.id && x.kind === 'action');
  if (spawned) commit('trashed', {}, { item: spawned.id });
}

export const doneToast = (spawned) => !spawned ? 'Done · logged for the weekly review' : (spawned.hard || spawned.due) ? `Done · next one scheduled for ${fmtDate(spawned.hard || spawned.due)}` : `Done · repeats ${spawned.repeat}, next one added to your list`;
