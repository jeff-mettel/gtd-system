// Fold the event log into state-at-time-t. No rendering here.

const MOVE = new Set(['accepted', 'done', 'nudged', 'closed', 'delegated', 'delivered', 'approved', 'taken_back', 'promoted']);
/** State of the whole system at time t: a left fold over events ≤ t. Pure; call as often as you like. */
export function fold(EV, t) {
  const S = { items: new Map(), programs: new Map(), projects: new Map(), wiki: new Map(), last: null, aiTouched: new Map(), reviews: 0 };
  for (const e of EV) {
    if (e.at > t) break;
    S.last = e; if (e.actor.startsWith('ai:') && e.item) S.aiTouched.set(e.item, e.at);
    switch (e.type) {
      case 'program_created': S.programs.set(e.program, { id: e.program, created: e.at, retired: null }); break;
      case 'program_retired': { const g = S.programs.get(e.program); if (g) g.retired = e.at; break; }
      case 'project_created': S.projects.set(e.project, { id: e.project, program: e.program, created: e.at, health: 'good', lastMove: e.at, dropped: false }); break;
      case 'project_dropped': { const p = S.projects.get(e.project); if (p) p.dropped = true; break; }
      case 'health_set': { const p = S.projects.get(e.project); if (p) p.health = e.health; break; }
      case 'wiki_changed': S.wiki.set(e.page, (S.wiki.get(e.page) || 0) + e.words); if (e.item) { const it = S.items.get(e.item); if (it) { it.stage = 'wiki'; it.since = e.at; it.page = e.page; } } break;
      case 'review_completed': S.reviews++; break;
      case 'captured': S.items.set(e.item, { id: e.item, text: e.text, source: e.source, project: e.project, minutes: e.minutes, stage: 'inbox', kind: null, proposed: false, since: e.at, owner: null, nudges: 0, lastEv: e.at, hist: [e] }); break;
      default: {
        const it = S.items.get(e.item); if (!it) break;
        it.hist.push(e); it.lastEv = e.at;
        if (e.type === 'clarified') { it.proposed = true; it.pkind = e.kind; it.stage = 'gate'; it.since = e.at; if (e.project) it.project = e.project; }
        else if (e.type === 'accepted') { it.kind = e.kind; it.project = e.project || it.project; it.owner = e.owner; if (e.corrected) it.corrected = e.at; it.stage = ({ action: 'action', waiting: 'waiting', someday: 'someday', reference: 'reference', trash: 'trash', project: 'action' })[e.kind] || 'action'; it.since = e.at; }
        else if (e.type === 'dropped') { it.stage = 'trash'; it.since = e.at; }
        else if (e.type === 'done' || e.type === 'closed' || e.type === 'approved') { it.stage = 'done'; it.since = e.at; }
        else if (e.type === 'nudged') it.nudges++;
        else if (e.type === 'delegated') { it.stage = 'delegated'; it.since = e.at; it.cap = e.cap; }
        else if (e.type === 'working') it.working = true;
        else if (e.type === 'delivered') { it.stage = 'ready'; it.since = e.at; }
        else if (e.type === 'taken_back' || e.type === 'promoted') { it.stage = 'action'; it.kind = 'action'; it.since = e.at; }
        if (MOVE.has(e.type) && it.project) { const p = S.projects.get(it.project); if (p) p.lastMove = Math.max(p.lastMove, e.at); }   // program-level items are not project movement
      }
    }
  }
  return S;
}
/** Wiki words per program at the folded state: sums S.wiki over the pages that belong to each program
 *  (PAGES is events.js's [page, owner] list — owners starting with 'P' are programs; person pages count nowhere). */
export function wikiByProgram(S, PAGES) {
  const out = new Map();
  for (const [page, owner] of PAGES) { if (!S.programs.has(owner)) continue; out.set(owner, (out.get(owner) || 0) + (S.wiki.get(page) || 0)); }
  return out;
}
/** True while an item is in the AI's hands — handed off and not yet approved or taken back. */
export const isCharged = (it) => it.stage === 'delegated' || it.stage === 'ready';
