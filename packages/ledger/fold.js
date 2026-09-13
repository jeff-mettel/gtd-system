// fold(events) → S: the whole system as a left fold over the ledger. Deterministic, pure, fast enough to run on
// every write. Items, programs, projects, people and wiki come out in exactly the shape the front-end views read
// (dates as Date objects; see the item field list in the README). `fold` runs `upcast()` first.

import { upcast } from './upcast.js';
import { DEFAULT_CONFIG, LEDGER_VERSION } from './schema.js';

const DAY = 864e5;
const DATE_FIELDS = ['captured', 'due', 'hard', 'start', 'revisit', 'since', 'followUp', 'lastNudged', 'createdAt', 'doneAt', 'trashedAt', 'movedAt', 'resurfacedAt', 'filedAt', 'lastTouched', 'created', 'retired', 'compiled', 'at', 'readyAt'];
const isDateField = new Set(DATE_FIELDS);

export const toDate = (v) => (v == null || v === '' ? null : v instanceof Date ? new Date(v) : new Date(v));
const plus = (d, days) => new Date(d.getTime() + days * DAY);
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Copy `fields` converting known date fields to Date. `null` clears; `undefined` is skipped. */
function dated(fields) {
  const out = {};
  for (const k in fields) { const v = fields[k]; if (v === undefined) continue; out[k] = isDateField.has(k) ? toDate(v) : (v && typeof v === 'object' ? clone(v) : v); }
  return out;
}

export const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The wiki entry a new program starts with. `page` is the hub slug; the compile job fills the rest. */
export const wikiStub = (g) => ({ page: g.page || 'program-' + slug(g.name), compiled: null, health: 'good', status: 'Not compiled yet — the compile job runs Friday, or on the first health change.', links: [], milestones: [], decisions: [], pending: [], risks: [], words: 0, pages: {} });

const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Proposal an unclarified inbox item shows until the clarify job (or the person) has a say. */
export const defaultProposal = (it) => ({ kind: 'action', next: it.raw, project: null, ctx: '@quick', min: it.min || 15, conf: 0.5, why: 'Not clarified yet — a first guess from the wording alone.' });

/**
 * @param {object[]} input  events (any version; upcast runs first), in writer order
 * @returns {{ v:number, seq:number, programs:object[], projects:object[], people:object[], items:object[], wiki:object, config:object, runs:object[], lastReview:Date|null, reviews:number, migrations:object[], count:number }}
 */
export function fold(input) {
  const events = upcast(input);
  const P = new Map(), J = new Map(), U = new Map(), I = new Map(), R = new Map();
  const S = { v: LEDGER_VERSION, seq: 0, programs: [], projects: [], people: [], items: [], wiki: {}, config: clone(DEFAULT_CONFIG), runs: [], lastReview: null, reviews: 0, migrations: [], count: events.length };
  const touch = (pid, at) => { const j = J.get(pid) || P.get(pid); if (j && (!j.lastMove || j.lastMove < at)) j.lastMove = at; };
  const wikiOfPage = (page) => { for (const g of P.values()) { const w = S.wiki[g.id]; if (w && (page === w.page || page.startsWith(w.page + '-'))) return w; } return null; };

  for (const e of events) {
    if (typeof e.seq === 'number' && e.seq > S.seq) S.seq = e.seq;
    const at = toDate(e.at) || new Date(0), p = e.payload || {};
    const it = e.item ? I.get(e.item) : null;
    switch (e.type) {
      case 'program_created': { if (P.has(p.program.id)) break; const g = Object.assign({ sponsor: null, cadence: '' }, dated(p.program), { created: at, retired: null, lastMove: null }); delete g.page; P.set(g.id, g); S.wiki[g.id] = wikiStub(p.program); break; }
      case 'program_updated': { const g = P.get(p.id); if (g) Object.assign(g, dated(p.fields || {})); break; }
      case 'program_retired': { const g = P.get(p.id); if (g) g.retired = at; break; }
      case 'project_created': { if (J.has(p.project.id)) break; const j = Object.assign({ suggest: '' }, dated(p.project), { created: at, dropped: false, primary: null, lastMove: null }); J.set(j.id, j); break; }
      case 'project_updated': { const j = J.get(p.id); if (j) Object.assign(j, dated(p.fields || {})); break; }
      case 'person_created': { if (U.has(p.person.id)) break; const u = Object.assign({ role: '', agenda: [] }, dated(p.person)); U.set(u.id, u); break; }
      case 'person_updated': { const u = U.get(p.id); if (u) Object.assign(u, dated(p.fields || {})); break; }

      case 'captured': {
        if (!e.item || I.has(e.item)) break;                                   // duplicate capture is a no-op (idempotent on writer side too)
        const n = { id: e.item, kind: 'inbox', source: p.source || 'capture', from: p.from ?? null, raw: p.raw, captured: at };
        if (p.ref) n.ref = p.ref; if (p.image) n.image = p.image; if (p.mentions) n.mentions = clone(p.mentions); if (p.minutes) n.min = p.minutes;
        I.set(n.id, n); break;
      }
      case 'clarified': { if (!it) break; it.p = dated(p.proposal); if (it.p.ai) it.p.ai = clone(p.proposal.ai); break; }
      case 'accepted': {
        if (!it) break;
        const f = dated(p.fields || {}), kind = p.kind;
        Object.assign(it, f); it.kind = kind; it.confirmedBy = e.actor;
        delete it.wasKind; delete it.tickledFor; delete it.resurfacedAt;
        if (kind === 'action') { it.createdAt = f.createdAt || at; if (!it.ctx) it.ctx = (it.min || 0) <= 15 ? '@quick' : '@deep'; }
        if (kind === 'waiting') { if (!it.since) it.since = at; if (it.nudges == null) it.nudges = 0; if (!it.followUp) it.followUp = plus(at, 3); }
        if (kind === 'someday') { if (!it.since) it.since = at; }
        if (kind === 'reference') { if (!it.filedAt) it.filedAt = at; }
        if (kind === 'done') { it.doneAt = f.doneAt || at; if (!it.createdAt) it.createdAt = at; }
        if (kind === 'trash') { it.trashedAt = f.trashedAt || at; }
        if (it.project) touch(it.project, at);
        break;
      }
      case 'edited': { if (!it) break; const f = dated(p.fields || {}); if ('project' in f && f.project !== it.project) it.movedAt = at; Object.assign(it, f); break; }
      case 'done': { if (!it) break; it.prevKind = it.kind; it.kind = 'done'; it.doneAt = at; if (it.project) touch(it.project, at); break; }
      case 'undone': { if (!it) break; it.kind = it.prevKind && it.prevKind !== 'done' ? it.prevKind : 'action'; delete it.doneAt; if (it.del?.status === 'approved') it.del.status = 'ready'; break; }
      case 'trashed': { if (!it) break; it.prevKind = it.kind; it.kind = 'trash'; it.trashedAt = at; break; }
      case 'restored': { if (!it) break; it.kind = 'inbox'; it.captured = at; if (!it.p) it.p = Object.assign(defaultProposal(it), { next: it.next || it.raw, why: 'Restored from trash — clarify again.' }); break; }
      case 'parked': { if (!it) break; it.prevKind = it.kind; it.kind = 'someday'; it.since = at; if ('revisit' in p) it.revisit = toDate(p.revisit); if (it.project) touch(it.project, at); break; }
      case 'promoted': { if (!it) break; it.kind = 'action'; if (!it.ctx) it.ctx = '@deep'; if (!it.min) it.min = 30; it.createdAt = at; if (it.project) touch(it.project, at); break; }
      case 'dropped': { if (!it) break; it.prevKind = it.kind; it.kind = 'trash'; it.trashedAt = at; break; }
      case 'nudged': { if (!it) break; it.nudges = (it.nudges || 0) + 1; it.lastNudged = at; it.followUp = toDate(p.followUp) || plus(at, 5); if (p.text) it.lastNudge = p.text; if (it.project) touch(it.project, at); break; }
      case 'handed_off': { if (!it) break; it.owner = 'ai'; it.cap = p.cap; it.del = { status: 'queued', at, minutes: p.minutes ?? it.min ?? 20, progress: 0, effect: p.effect, what: p.what }; if (it.project) touch(it.project, at); break; }
      case 'delivered': { if (!it || !it.del) break; it.del.status = 'ready'; it.del.readyAt = at; it.del.progress = 1; it.del.deliverable = p.deliverable; if (it.project) touch(it.project, at); break; }
      case 'approved': { if (!it) break; if (it.del) { it.del.status = 'approved'; if (p.deliverable != null) it.del.deliverable = p.deliverable; if (p.effect) it.del.effect = p.effect; } it.prevKind = it.kind; it.kind = 'done'; it.doneAt = at; if (it.project) touch(it.project, at); break; }
      case 'taken_back': { if (!it) break; delete it.owner; delete it.del; delete it.cap; if (!it.ctx) it.ctx = '@quick'; if (it.project) touch(it.project, at); break; }
      case 'next_action_set': { const j = J.get(p.project) || P.get(p.project); if (j && e.item) j.primary = e.item; break; }
      case 'resurfaced': {
        if (!it) break;
        (it.resurfacedFor ||= []).push(p.for);
        if ((it.kind === 'someday' || it.kind === 'reference') && it.revisit) {
          it.wasKind = it.kind; it.tickledFor = p.for; it.kind = 'inbox'; it.source = 'tickler'; it.from = null; it.captured = at; it.raw = it.next;
          it.p = { kind: 'action', next: it.next, project: it.project || (S.wiki[it.refPage] ? it.refPage : null), ctx: '@quick', min: 15, conf: 0.7, why: `Tickler — you asked to revisit this on ${fmtDay(it.revisit)}. Decide now: act on it, park it again with a new date, or drop it.` };
        } else if (it.kind === 'action' && it.start) it.resurfacedAt = at;
        break;
      }

      case 'milestone_added': { const w = S.wiki[p.program]; if (!w) break; const m = p.milestone; w.milestones.push([m.label, m.what, m.state, m.iso || null]); break; }
      case 'decision_recorded': { const w = S.wiki[p.program]; if (!w) break; w.decisions.push(Object.assign({ projects: [] }, clone(p.decision))); break; }
      case 'wiki_changed': {
        const w = (p.program && S.wiki[p.program]) || wikiOfPage(p.page); if (!w) break;
        const words = +p.words || 0; w.words += words; w.pages[p.page] = (w.pages[p.page] || 0) + words;
        if (p.fields) { const f = { ...p.fields }; if (f.compiled === true) f.compiled = at; Object.assign(w, dated(f)); }
        break;
      }
      case 'review_completed': S.lastReview = at; S.reviews++; break;
      case 'config_set': {
        const [head, ...rest] = String(p.key).split('.'), key = rest.join('.');
        if (!S.config[head] || !key) break;
        if (p.value == null) delete S.config[head][key]; else S.config[head][key] = clone(p.value);
        break;
      }
      case 'job_started': {
        const r = { run: p.run, job: p.job, item: e.item || null, actor: e.actor, startedAt: at, status: 'running', args: clone(p.args) };
        R.set(p.run, r);
        if (it?.del) { it.del.status = 'working'; it.del.progress = p.args?.progress ?? 0.5; it.del.run = p.run; }
        break;
      }
      case 'job_finished': { const r = R.get(p.run) || (R.set(p.run, { run: p.run, job: p.job, item: e.item || null, actor: e.actor, startedAt: at, status: 'running' }), R.get(p.run)); r.status = 'finished'; r.finishedAt = at; r.summary = p.summary; r.events = p.events; break; }
      case 'job_failed': { const r = R.get(p.run) || (R.set(p.run, { run: p.run, job: p.job, item: e.item || null, actor: e.actor, startedAt: at, status: 'running' }), R.get(p.run)); r.status = 'failed'; r.finishedAt = at; r.error = p.error; break; }
      case 'migrated': S.migrations.push({ from: p.from, to: p.to, at }); break;
      default: break;                                                              // unknown types are skipped, never fatal
    }
  }

  S.programs = [...P.values()]; S.projects = [...J.values()]; S.people = [...U.values()]; S.items = [...I.values()]; S.runs = [...R.values()];
  /* Reference items filed under a program appear in that program's key links (derived, like today's linkReferences). */
  for (const it of S.items) if (it.kind === 'reference' && S.wiki[it.refPage] && !S.wiki[it.refPage].links.some(l => l[0] === it.next)) S.wiki[it.refPage].links.push([it.next, '']);
  return S;
}
