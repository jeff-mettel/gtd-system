// Fold the event log into state-at-time-t for the scene: which station each item sits at, project movement,
// wiki words per page. No rendering here. Reads contract events (docs/ledger-events.md) with `at` in ms.

const MOVE = new Set(['accepted', 'done', 'nudged', 'handed_off', 'delivered', 'approved', 'taken_back', 'promoted', 'parked']);
const STAGE = { action: 'action', waiting: 'waiting', someday: 'someday', reference: 'reference', trash: 'trash', done: 'done' };
/** State of the whole system at time t: a left fold over events ≤ t. Pure; call as often as you like. */
export function fold(EV, t) {
  const S = { items: new Map(), programs: new Map(), projects: new Map(), wiki: new Map(), last: null, aiTouched: new Map(), reviews: 0 };
  for (const e of EV) {
    if (e.at > t) break;
    const p = e.payload || {};
    S.last = e; if (e.actor.startsWith('ai:') && e.item) S.aiTouched.set(e.item, e.at);
    switch (e.type) {
      case 'program_created': S.programs.set(p.program.id, { id: p.program.id, name: p.program.name, created: e.at, retired: null }); break;
      case 'program_retired': { const g = S.programs.get(p.id); if (g) g.retired = e.at; break; }
      case 'program_updated': { const g = S.programs.get(p.id); if (g && p.fields && 'retired' in p.fields) g.retired = p.fields.retired ? Date.parse(p.fields.retired) : null; break; }
      case 'project_created': S.projects.set(p.project.id, { id: p.project.id, program: p.project.program, name: p.project.name, created: e.at, health: p.project.health || 'good', lastMove: e.at, dropped: false }); break;
      case 'project_updated': { const j = S.projects.get(p.id); if (j && p.fields) { if ('dropped' in p.fields) j.dropped = !!p.fields.dropped; if (p.fields.health) j.health = p.fields.health; if (p.fields.program) j.program = p.fields.program; } break; }
      case 'wiki_changed': S.wiki.set(p.page, (S.wiki.get(p.page) || 0) + (+p.words || 0)); { const it = p.item ? S.items.get(p.item) : null; if (it) { it.stage = 'wiki'; it.since = e.at; it.page = p.page; } } break;
      case 'review_completed': S.reviews++; break;
      case 'captured': if (e.item && !S.items.has(e.item)) S.items.set(e.item, { id: e.item, text: p.raw, source: p.source, project: null, minutes: p.minutes, stage: 'inbox', kind: null, proposed: false, since: e.at, owner: null, nudges: 0, lastEv: e.at, hist: [e] }); break;
      default: {
        const it = e.item ? S.items.get(e.item) : null; if (!it) break;
        it.hist.push(e); it.lastEv = e.at;
        if (e.type === 'clarified') { it.proposed = true; it.pkind = p.proposal?.kind; it.stage = 'gate'; it.since = e.at; if (p.proposal?.project) it.project = p.proposal.project; if (p.proposal?.next) it.text = p.proposal.next; }
        else if (e.type === 'accepted') { it.kind = p.kind; const f = p.fields || {}; if (f.project !== undefined) it.project = f.project; if (f.next) it.text = f.next; if (f.owner !== undefined) it.owner = f.owner; if (f.min) it.minutes = f.min; if (it.pkind && it.pkind !== p.kind && !(it.pkind === 'project' && p.kind === 'action')) it.corrected = e.at; it.stage = STAGE[p.kind] || 'action'; it.since = e.at; }
        else if (e.type === 'edited') { const f = p.fields || {}; if (f.project !== undefined) it.project = f.project; if (f.next) it.text = f.next; }
        else if (e.type === 'dropped' || e.type === 'trashed') { it.stage = 'trash'; it.since = e.at; }
        else if (e.type === 'restored') { it.stage = 'inbox'; it.since = e.at; }
        else if (e.type === 'done' || e.type === 'approved') { it.stage = 'done'; it.since = e.at; }
        else if (e.type === 'undone') { it.stage = STAGE[it.kind] || 'action'; it.since = e.at; }
        else if (e.type === 'nudged') it.nudges++;
        else if (e.type === 'handed_off') { it.stage = 'delegated'; it.since = e.at; it.cap = p.cap; }
        else if (e.type === 'job_started') it.working = true;
        else if (e.type === 'delivered') { it.stage = 'ready'; it.since = e.at; }
        else if (e.type === 'taken_back' || e.type === 'promoted') { it.stage = 'action'; it.kind = 'action'; it.since = e.at; }
        else if (e.type === 'parked') { it.stage = 'someday'; it.kind = 'someday'; it.since = e.at; }
        else if (e.type === 'resurfaced') { if (it.stage === 'someday' || it.stage === 'reference' || it.stage === 'wiki') { it.stage = 'inbox'; it.since = e.at; } }
        if (MOVE.has(e.type) && it.project) { const pj = S.projects.get(it.project); if (pj) pj.lastMove = Math.max(pj.lastMove, e.at); }   // program-level items are not project movement
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

/** One line for the caption: what the event was, in words. */
export function describe(e, pname) {
  const p = e.payload || {};
  const who = (id) => pname ? pname(id) : id;
  return ({ captured: 'Captured', clarified: 'Proposed ' + (p.proposal?.kind || ''), accepted: 'Accepted as ' + p.kind, edited: 'Edited', done: 'Done', undone: 'Reopened', nudged: 'Nudged ' + (p.owner ? who(p.owner) : ''), handed_off: 'Handed to the AI (' + p.cap + ')', job_started: 'AI working', job_finished: 'AI job finished' + (p.summary ? ' · ' + p.summary : ''), job_failed: 'AI job failed', delivered: 'Ready for review', approved: 'Approved', taken_back: 'Taken back', promoted: 'Promoted from someday', parked: 'Parked in someday', dropped: 'Dropped', trashed: 'Trashed', restored: 'Restored to inbox', resurfaced: 'Tickler resurfaced', wiki_changed: 'Wiki · ' + (p.summary || p.page), review_completed: 'Weekly review completed', program_created: 'Program created · ' + (p.program?.name || ''), program_retired: 'Program retired', program_updated: 'Program updated', project_created: 'Project created · ' + (p.project?.name || ''), project_updated: 'Project updated', person_created: 'Person added · ' + (p.person?.name || ''), milestone_added: 'Milestone · ' + (p.milestone?.what || ''), decision_recorded: 'Decision · ' + (p.decision?.what || ''), config_set: 'Setting changed · ' + p.key, next_action_set: 'Next action chosen', next_action_proposed: 'Next action proposed', calendar_synced: 'Calendar synced', migrated: 'Ledger migrated' })[e.type] || e.type;
}
