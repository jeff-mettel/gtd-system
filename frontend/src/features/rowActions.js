// Row-level actions shared by the keyboard grammar (features/keys.js), the command palette (features/palette.js)
// and the "when" chip. Each is one or two ledger events plus a toast; callers wrap them in withTx() for Undo and
// render afterwards. Nothing here navigates.

import { fmtDate } from '../lib/dates.js';
import { toast } from '../lib/dom.js';
import { pname, projName, projOf } from '../model.js';
import { commit, items } from '../store.js';
import { completeItem, doneToast } from './repeat.js';
import { applySuggestion, aiSuggestion } from './aiSuggest.js';

export const itemOf = (id) => items.find(i => i.id === id) || null;

const WHEN_LABEL = { due: 'Due', hard: 'Pinned to', start: 'Deferred until', followUp: 'Follow up', revisit: 'Resurfaces' };

/** Set (or clear, with null) one date field. */
export function setWhen(id, field, date) {
  const it = itemOf(id); if (!it) return false;
  commit('edited', { fields: { [field]: date } }, { item: id });
  toast(date ? `${WHEN_LABEL[field] || field} ${fmtDate(date)}` : `${WHEN_LABEL[field] || field} cleared`);
  return true;
}

/** x — done. Waiting-fors close as received; repeating actions spawn their next instance. */
export function doneItem(id) {
  const it = itemOf(id); if (!it || it.kind === 'done' || it.kind === 'trash') return false;
  if (it.owner === 'ai' && it.del) { toast('AI work is approved, not ticked — open it (⏎) and review'); return false; }   // trust invariant: approving is explicit
  if (it.kind === 'waiting') { commit('done', {}, { item: id }); toast(`Received from ${pname(it.owner)} · done`); return true; }
  if (it.kind === 'inbox') { commit('accepted', { kind: 'done', fields: { next: it.next || it.raw, min: 2 } }, { item: id }); toast('Done — two-minute rule'); return true; }
  const spawned = completeItem(it); toast(doneToast(spawned)); return true;
}

/** d — defer: an action leaves the lists until `date`; a waiting-for moves its follow-up; someday/reference re-date their tickler. */
export function deferField(it) { return it.kind === 'waiting' ? 'followUp' : (it.kind === 'someday' || it.kind === 'reference') ? 'revisit' : 'start'; }
export function deferItem(id, date) { const it = itemOf(id); if (!it) return false; return setWhen(id, deferField(it), date); }

/** p — park in someday / maybe. */
export function parkItem(id) {
  const it = itemOf(id); if (!it || it.kind === 'someday' || it.kind === 'done' || it.kind === 'trash') return false;
  commit('parked', {}, { item: id }); toast('Parked in someday / maybe'); return true;
}

/** m — move into a project (or to program level). */
export function moveItemTo(id, pid) {
  const it = itemOf(id), j = projOf(pid); if (!it || !j || it.project === pid) return false;
  commit('edited', { fields: { project: pid } }, { item: id }); toast(`Moved to ${j.name}`); return true;
}

/** The AI's late second opinion on a filed item: accept applies it, keep dismisses it. Both stamp aiReviewed. */
export function acceptSuggestion(id) {
  const it = itemOf(id), s = aiSuggestion(it); if (!s) return false;
  for (const e of applySuggestion(it, s)) commit(e.type, e.payload, { item: id });
  toast(`Refiled as the AI suggested · ${s.label}`); return true;
}
export function keepFiling(id) {
  const it = itemOf(id); if (!it) return false;
  commit('edited', { fields: { aiReviewed: true } }, { item: id }); toast(`Kept in ${it.project ? projName(it.project) : 'place'}`); return true;
}
