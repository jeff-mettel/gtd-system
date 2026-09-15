// Optimistic filing, second opinion. A capture that names a project is filed at once (captured + accepted by jeff);
// the clarify job still runs and its `clarified` lands on an item that is no longer in the inbox. The fold keeps
// that proposal on `item.p` without moving the item — this module decides when it is worth a chip on the row:
// the proposal arrived AFTER the accept, differs in kind or project, and has not been reviewed
// (`edited { fields:{ aiReviewed:true } }` — front-end only; the ledger accepts arbitrary edited fields).

import { ledger } from '../store.js';
import { pname, projName } from '../model.js';

const ACCEPTABLE = { action: 'action', project: 'action', program: 'action', waiting: 'waiting', someday: 'someday', reference: 'reference', done: 'done', trash: 'trash' };

let memoSeq = -1, memoLen = -1, late = new Map();     // item id → seq of the last clarified that came after the last accepted
function index() {
  if (memoSeq === ledger.seq && memoLen === ledger.events.length) return late;
  const lastAccept = new Map(), lastClar = new Map();
  for (const e of ledger.events) { if (!e.item) continue; if (e.type === 'accepted') lastAccept.set(e.item, e.seq); else if (e.type === 'clarified') lastClar.set(e.item, e.seq); }
  late = new Map();
  for (const [id, seq] of lastClar) if (lastAccept.has(id) && seq > lastAccept.get(id)) late.set(id, seq);
  memoSeq = ledger.seq; memoLen = ledger.events.length;
  return late;
}

/** The AI's late proposal for a filed item when it disagrees, else null. */
export function aiSuggestion(it) {
  if (!it || !it.p || it.kind === 'inbox' || it.kind === 'done' || it.kind === 'trash' || it.aiReviewed) return null;
  if (!index().has(it.id)) return null;
  const p = it.p, kind = ACCEPTABLE[p.kind] || 'action';
  const kindDiff = kind !== it.kind, projDiff = (p.project || null) !== (it.project || null);
  if (!kindDiff && !projDiff) return null;
  const parts = [];
  if (kindDiff) parts.push(kind === 'waiting' ? `waiting for ${(p.owner || it.from) ? pname(p.owner || it.from) : 'someone'}` : kind === 'someday' ? 'someday / maybe' : kind === 'reference' ? 'reference' : kind === 'done' ? 'already done' : kind === 'trash' ? 'trash' : 'next action');
  if (projDiff) parts.push(p.project ? `in ${projName(p.project)}` : 'no project');
  return { kind, project: p.project || null, label: parts.join(' · '), why: p.why || '' };
}

/** The events that apply a suggestion: an `accepted` with the proposal's kind and fields, then the review stamp. */
export function applySuggestion(it, s) {
  const p = it.p, fields = { next: it.next || p.next, project: s.project };
  if (s.kind === 'action') { fields.ctx = p.ctx || it.ctx || '@quick'; fields.min = p.min || it.min || 15; if (p.due) fields.due = p.due; if (it.due) fields.due = it.due; if (it.hard) fields.hard = it.hard; }
  if (s.kind === 'waiting') { fields.owner = p.owner || it.owner || it.from || null; if (!fields.owner) delete fields.owner; if (p.followUp) fields.followUp = p.followUp; }
  if (s.kind === 'someday' || s.kind === 'reference') { if (p.revisit) fields.revisit = p.revisit; }
  if (s.kind === 'reference') fields.refPage = p.refPage || s.project || null;
  fields.aiReviewed = true;
  return [{ type: 'accepted', payload: { kind: s.kind, fields } }];
}
