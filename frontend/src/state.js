// Lightly persisted state (localStorage) applied over the example data.

import { items, programs, projects, wiki } from './data/example.js';
import { TODAY, d, iso } from './lib/dates.js';
import { wikiStub } from './model.js';
import { resurfaceDeferred } from './features/defer.js';

/* ---------- state (persisted lightly) ---------- */
export const STORE = 'commitment-ledger-demo-v1';

export const state = { kinds:{}, done:{}, nudged:{}, review:{}, lastReview: iso(d(-9)), captured:[] , overrides:{}, primary:{}, projects:[], delegated:{}, guides:{}, collapsed:{}, nowGroup:'context', programs:[], retired:{}, projOverrides:{}, resurfaced:{}, progColor:{}, milestones:{}, autonomy:{ file:'auto', draft:'draft', data:'draft', send:'ask', calendar:'ask', delete:'never' } };
try { const s = localStorage.getItem(STORE); if (s) Object.assign(state, JSON.parse(s)); } catch (e) {}

export function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

export function applyState() {
  for (const g of state.programs) if (!programs.find(x => x.id === g.id)) { programs.push(g); wiki[g.id] = wiki[g.id] || wikiStub(g); }
  for (const j of state.projects) if (!projects.find(x => x.id === j.id)) projects.push(j);
  for (const id in state.projOverrides) { const j = projects.find(x => x.id === id); if (j) Object.assign(j, state.projOverrides[id]); }
  for (const id in state.retired) { const g = programs.find(x => x.id === id); if (g) g.retired = state.retired[id]; }
  for (const c of state.captured) if (!items.find(i => i.id === c.id)) items.unshift(Object.assign({}, c, c.captured ? { captured:new Date(c.captured) } : {}, c.createdAt ? { createdAt:new Date(c.createdAt) } : {}));
  for (const it of items) {
    if (state.kinds[it.id]) it.kind = state.kinds[it.id];
    if (state.done[it.id]) it.kind = 'done';
    if (state.nudged[it.id]) { it.nudges = (it.nudges || 0) + state.nudged[it.id]; it.followUp = d(5); it.lastNudged = TODAY; }
    if (state.overrides[it.id]) Object.assign(it, state.overrides[it.id]);
    const dg = state.delegated[it.id];
    if (dg) { if (dg.status === 'taken') { delete it.owner; delete it.del; } else { it.owner = 'ai'; it.cap = it.cap || dg.cap; it.del = Object.assign({}, it.del || {}, dg); if (dg.status === 'approved') it.kind = 'done'; if (dg.status === 'working') { it.del.status = 'ready'; it.del.readyAt = it.del.readyAt || TODAY; it.del.deliverable = it.del.deliverable || `${it.next}\n\n(Finished while you were away — in the live system the assistant's output appears here.)`; } } }
  }
  resurfaceDue();
}

/* Tickler: a someday or reference item whose revisit date has arrived re-enters the inbox as a decision.
   Idempotent — safe to call on every render. `tickledFor` remembers which revisit date brought it back; accepting
   records `resurfaced[id:tickledFor]` so the same date never fires twice, while a new revisit date can.
   Deferred actions (a `start` date) are the second tickler: they never leave the ledger, they re-enter the lists on
   their day — `resurfacedAt` is stamped here and persisted so the "back today" chip shows for that day only. */
export function resurfaceDue() {
  const back = resurfaceDeferred(items);
  if (back.length) { for (const id of back) state.overrides[id] = Object.assign(state.overrides[id] || {}, { resurfacedAt: items.find(i => i.id === id).resurfacedAt }); save(); }
  for (const it of items) {
    if (!(it.kind === 'someday' || it.kind === 'reference') || !it.revisit || new Date(it.revisit) > TODAY) continue;
    const key = new Date(it.revisit).toDateString();
    if (state.resurfaced[it.id + ':' + key]) continue;
    it.tickledFor = key; it.wasKind = it.kind; it.kind = 'inbox'; it.source = 'tickler'; it.from = null; it.captured = TODAY; it.raw = it.next;
    it.p = { kind:'action', next:it.next, project: it.project || (wiki[it.refPage] ? it.refPage : null), ctx:'@quick', min:15, conf:.7, why:`Tickler — you asked to revisit this on ${new Date(it.revisit).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}. Decide now: act on it, park it again with a new date, or drop it.` };
  }
}

/* Milestones added in the UI live on the program's wiki hub; persisted per program as [label, what, state, iso]. */
export function applyMilestones() {
  for (const gid in state.milestones) { const w = wiki[gid]; if (!w) continue; for (const m of state.milestones[gid]) if (!w.milestones.some(x => x[1] === m[1] && x[3] === m[3])) w.milestones.push(m); }
}

export function linkReferences() {
  /* Reference items filed under a program appear in that program's wiki key links. */
  for (const it of items) if (it.kind === 'reference' && wiki[it.refPage] && !wiki[it.refPage].links.some(l => l[0] === it.next)) wiki[it.refPage].links.push([it.next, '']);
}
