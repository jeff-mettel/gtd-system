// Lightly persisted state (localStorage) applied over the example data.

import { d, iso, items, programs, projects, wiki, wikiStub } from './data/example.js';
import { delegated } from './model.js';
import { guides } from './ui/nav.js';

  { w:'20 Jul', c:31, k:29, d:18 }, { w:'27 Jul', c:27, k:27, d:22 }, { w:'3 Aug', c:35, k:30, d:19 }, { w:'10 Aug', c:24, k:24, d:21 },
  { w:'17 Aug', c:40, k:33, d:25 }, { w:'24 Aug', c:29, k:29, d:23 }, { w:'31 Aug', c:33, k:31, d:20 }, { w:'7 Sep', c:38, k:30, d:17 },
];
export const cycle = [
  { list:'Inbox → clarified', median:'0.6 d', p90:'2.1 d', note:'Target < 1 day' },
  { list:'Next action → done', median:'3.2 d', p90:'11 d', note:'Deep-work items dominate the tail' },
  { list:'Waiting for → closed', median:'9.4 d', p90:'26 d', note:'Legal and sponsor decisions' },
  { list:'Someday → promoted or dropped', median:'41 d', p90:'—', note:'Review monthly' },
];

/* ---------- state (persisted lightly) ---------- */
export const STORE = 'commitment-ledger-demo-v1';
export const state = { kinds:{}, done:{}, nudged:{}, review:{}, lastReview: iso(d(-9)), captured:[] , overrides:{}, primary:{}, projects:[], delegated:{}, guides:{}, collapsed:{}, nowGroup:'context', programs:[], retired:{}, projOverrides:{}, resurfaced:{}, autonomy:{ file:'auto', draft:'draft', data:'draft', send:'ask', calendar:'ask', delete:'never' } };
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

    if (state.overrides[it.id]) Object.assign(it, state.overrides[it.id]);
    /* Tickler: a someday or reference item whose revisit date has arrived re-enters the inbox as a decision. */
}
