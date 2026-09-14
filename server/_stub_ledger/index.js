// TEMPORARY stand-in for `packages/ledger` (being built in parallel). Same exports, same contract
// (docs/ledger-events.md v1). `server/ledger.js` prefers the real package and falls back to this
// file only while `packages/ledger/index.js` is absent. Delete this folder once the package lands.

export const LEDGER_VERSION = 1;

/* ---------- ids ---------- */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32(n, len) { let s = ''; for (let i = 0; i < len; i++) { s = B32[n % 32] + s; n = Math.floor(n / 32); } return s; }
/** ULID-ish: `<prefix>_<10 chars of ms time><8 random chars>`. Prefixes: i items, p programs, j projects, u people, r runs, e events. */
export function newId(prefix) {
  let r = ''; for (let i = 0; i < 8; i++) r += B32[Math.floor(Math.random() * 32)];
  return `${prefix}_${b32(Date.now(), 10)}${r}`;
}

/* ---------- upcasters ---------- */
/** Bring every event to the current envelope version. v1 is current: only fills a missing `v`. */
export function upcast(events) {
  return events.map(e => (e.v == null ? { ...e, v: 1 } : e));
}

/* ---------- contract tables ---------- */
const ENTITY = {
  program_created: ['program'], program_updated: ['id', 'fields'], program_retired: ['id'],
  project_created: ['project'], project_updated: ['id', 'fields'],
  person_created: ['person'], person_updated: ['id', 'fields'],
};
const ITEM = {
  captured: ['source', 'raw'], clarified: ['proposal'], accepted: ['kind', 'fields'], edited: ['fields'],
  done: [], undone: [], trashed: [], restored: [], parked: [], promoted: [], dropped: [],
  nudged: ['text'], handed_off: ['cap', 'what', 'effect'], delivered: ['deliverable'], approved: ['effect'],
  taken_back: [], next_action_set: ['project'], resurfaced: ['for'],
};
const SYSTEM = {
  milestone_added: ['program', 'milestone'], decision_recorded: ['program', 'decision'],
  wiki_changed: ['page', 'words'], review_completed: [], config_set: ['key', 'value'],
  job_started: ['job', 'run'], job_finished: ['job', 'run'], job_failed: ['job', 'run', 'error'],
  migrated: ['from', 'to'],
  // Proposed addition (see runbook / report): calendar ingest writes one of these per sync.
  calendar_synced: ['window', 'events'],
};
export const TYPES = { ...ENTITY, ...ITEM, ...SYSTEM };
export const KINDS = ['action', 'waiting', 'someday', 'reference', 'done', 'trash'];
const AI_MAY_WRITE = new Set(['captured', 'clarified', 'delivered', 'wiki_changed', 'job_started', 'job_finished', 'job_failed', 'milestone_added', 'decision_recorded']);
const INGEST_MAY_WRITE = new Set(['captured', 'calendar_synced', 'job_started', 'job_finished', 'job_failed']);

/* ---------- validate ---------- */
/** Validate one event against the contract and the current fold. Returns { ok, errors }. */
export function validate(e, S) {
  const errors = [];
  if (!e || typeof e !== 'object') return { ok: false, errors: ['event must be an object'] };
  if (!e.type || !(e.type in TYPES)) errors.push(`unknown type: ${e.type}`);
  if (!e.actor || typeof e.actor !== 'string') errors.push('actor required');
  const p = e.payload;
  if (!p || typeof p !== 'object') errors.push('payload must be an object');
  if (errors.length) return { ok: false, errors };
  for (const f of TYPES[e.type]) if (p[f] === undefined || p[f] === null) errors.push(`payload.${f} required for ${e.type}`);
  if (e.type in ITEM && !e.item) errors.push(`item required for ${e.type}`);
  if (e.type in ITEM && e.type !== 'captured' && e.item && !S.items[e.item]) errors.push(`unknown item: ${e.item}`);
  if (e.actor.startsWith('ai:') && !AI_MAY_WRITE.has(e.type)) errors.push(`actor ${e.actor} may not write ${e.type}`);
  if (e.actor.startsWith('ingest:') && !INGEST_MAY_WRITE.has(e.type)) errors.push(`actor ${e.actor} may not write ${e.type}`);
  const projOk = (id) => id == null || S.projects[id] || S.programs[id];
  const ownerOk = (id) => id == null || id === 'me' || id === 'ai' || S.people[id];
  if (e.type === 'clarified') {
    const q = p.proposal || {};
    if (!KINDS.includes(q.kind) && q.kind !== 'project' && q.kind !== 'program') errors.push(`proposal.kind must be one of ${KINDS.join('|')}`);
    if (typeof q.conf !== 'number' || q.conf < 0 || q.conf > 1) errors.push('proposal.conf must be a number in [0,1]');
    if (!q.why) errors.push('proposal.why required');
    if (!projOk(q.project)) errors.push(`proposal.project names no known project/program: ${q.project}`);
    if (!ownerOk(q.owner)) errors.push(`proposal.owner names no known person: ${q.owner}`);
  }
  if (e.type === 'accepted') {
    if (!KINDS.includes(p.kind)) errors.push(`kind must be one of ${KINDS.join('|')}`);
    if (!projOk(p.fields?.project)) errors.push(`fields.project names no known project/program: ${p.fields?.project}`);
    if (!ownerOk(p.fields?.owner)) errors.push(`fields.owner names no known person: ${p.fields?.owner}`);
  }
  if (e.type === 'edited' && !projOk(p.fields?.project)) errors.push(`fields.project names no known project/program: ${p.fields?.project}`);
  if (e.type === 'next_action_set' && !projOk(p.project)) errors.push(`unknown project: ${p.project}`);
  if (e.type === 'project_created' && p.project && !S.programs[p.project.program]) errors.push(`project.program names no known program: ${p.project.program}`);
  if ((e.type === 'milestone_added' || e.type === 'decision_recorded') && !S.programs[p.program]) errors.push(`unknown program: ${p.program}`);
  if (e.type === 'calendar_synced' && !Array.isArray(p.events)) errors.push('events must be an array');
  return { ok: errors.length === 0, errors };
}

/* ---------- fold ---------- */
const DAY = 864e5;
function blank() {
  return {
    ledgerVersion: LEDGER_VERSION, seq: 0, last: null,
    programs: {}, projects: {}, people: {}, items: {}, wiki: {}, milestones: [], decisions: [], reviews: [],
    config: { autonomy: {}, models: {}, prompts: {}, progColor: {} },
    runs: {}, meetings: [], calendarAhead: [], pastMeetings: [], calendarWindow: null, refs: {},
  };
}
function setPath(obj, key, value) { const parts = key.split('.'); let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {}; o[parts.at(-1)] = value; }
function applyCalendar(S, p, at) {
  const now = new Date(at).getTime(), today = new Date(at); today.setHours(0, 0, 0, 0);
  const meetings = [], ahead = [], past = [];
  for (const ev of p.events || []) {
    const start = new Date(ev.start).getTime();
    const m = { id: ev.id, title: ev.title, start: ev.start, end: ev.end, who: ev.who || [], attendees: ev.attendees || [], calendar: ev.calendar };
    if (start >= today.getTime() && start < today.getTime() + DAY) meetings.push(m);
    else if (start >= today.getTime() + DAY) ahead.push(m);
    else if (start < now) past.push(m);
  }
  S.meetings = meetings; S.calendarAhead = ahead; S.pastMeetings = past; S.calendarWindow = p.window || null;
}
/** Left fold over the whole log (runs `upcast` first). Plain JSON-able objects; dates are ISO strings. */
export function fold(events) {
  const S = blank();
  for (const e of upcast(events)) {
    S.last = e; if (e.seq > S.seq) S.seq = e.seq;
    const p = e.payload || {};
    const it = e.item ? S.items[e.item] : null;
    const move = () => { if (it?.project && S.projects[it.project]) S.projects[it.project].lastMove = e.at; };
    switch (e.type) {
      case 'program_created': S.programs[p.program.id] = { ...p.program, created: e.at, retired: null }; break;
      case 'program_updated': Object.assign(S.programs[p.id] ??= { id: p.id }, p.fields); break;
      case 'program_retired': if (S.programs[p.id]) S.programs[p.id].retired = e.at; break;
      case 'project_created': S.projects[p.project.id] = { health: 'good', dropped: false, ...p.project, created: e.at, lastMove: e.at }; break;
      case 'project_updated': Object.assign(S.projects[p.id] ??= { id: p.id }, p.fields); break;
      case 'person_created': S.people[p.person.id] = { channels: {}, ...p.person, created: e.at }; break;
      case 'person_updated': Object.assign(S.people[p.id] ??= { id: p.id }, p.fields); break;
      case 'captured':
        S.items[e.item] = { id: e.item, kind: 'inbox', source: p.source, ref: p.ref || null, raw: p.raw, from: p.from || null, image: p.image || null, mentions: p.mentions || [], min: p.minutes ?? null, captured: e.at, actor: e.actor, p: null, project: null, owner: null, nudges: 0, hist: [] };
        if (p.ref) S.refs[p.ref] = e.item;
        break;
      case 'clarified': if (it) { it.p = { ...p.proposal, at: e.at, by: e.actor }; if (p.proposal.project) it.project = p.proposal.project; } break;
      case 'accepted': if (it) { it.prev = it.kind; it.kind = p.kind; Object.assign(it, p.fields || {}); it.confirmed_by = e.actor; it.since = e.at; move(); } break;
      case 'edited': if (it) { if (p.fields?.project && p.fields.project !== it.project) it.movedAt = e.at; Object.assign(it, p.fields || {}); } break;
      case 'done': if (it) { it.prev = it.kind; it.kind = 'done'; it.doneAt = e.at; move(); } break;
      case 'undone': if (it) { it.kind = it.prev || 'action'; it.doneAt = null; } break;
      case 'trashed': if (it) { it.prev = it.kind; it.kind = 'trash'; it.trashedAt = e.at; } break;
      case 'restored': if (it) { it.kind = 'inbox'; it.trashedAt = null; } break;
      case 'parked': if (it) { it.kind = 'someday'; it.since = e.at; if (p.revisit) it.revisit = p.revisit; } break;
      case 'promoted': if (it) { it.kind = 'action'; it.since = e.at; move(); } break;
      case 'dropped': if (it) { it.kind = 'trash'; it.trashedAt = e.at; } break;
      case 'nudged': if (it) { it.nudges++; it.lastNudged = e.at; it.followUp = new Date(new Date(e.at).getTime() + 5 * DAY).toISOString(); move(); } break;
      case 'handed_off': if (it) { it.owner = 'ai'; it.cap = p.cap; it.del = { status: 'queued', at: e.at, what: p.what, effect: p.effect, minutes: p.minutes ?? null }; move(); } break;
      case 'delivered': if (it) { it.del = { ...(it.del || {}), status: 'ready', readyAt: e.at, deliverable: p.deliverable }; move(); } break;
      case 'approved': if (it) { it.del = { ...(it.del || {}), status: 'approved', approvedAt: e.at, effect: p.effect }; it.prev = it.kind; it.kind = 'done'; it.doneAt = e.at; move(); } break;
      case 'taken_back': if (it) { it.owner = null; it.del = { ...(it.del || {}), status: 'taken_back' }; move(); } break;
      case 'next_action_set': if (it) { it.primary = true; for (const o of Object.values(S.items)) if (o !== it && o.project === p.project) o.primary = false; } break;
      case 'resurfaced': if (it) { it.resurfaced = e.at; if (p.for === 'revisit') it.kind = 'inbox'; } break;
      case 'milestone_added': S.milestones.push({ program: p.program, ...p.milestone, at: e.at, by: e.actor }); break;
      case 'decision_recorded': S.decisions.push({ program: p.program, ...p.decision, at: e.at, by: e.actor }); break;
      case 'wiki_changed': S.wiki[p.page] = (S.wiki[p.page] || 0) + (p.words || 0); if (it) { it.refPage = p.page; } break;
      case 'review_completed': S.reviews.push({ at: e.at, steps: p.steps || null }); break;
      case 'config_set': setPath(S.config, p.key, p.value); break;
      case 'job_started': S.runs[p.run] = { run: p.run, job: p.job, args: p.args || null, started: e.at, status: 'running' }; break;
      case 'job_finished': Object.assign(S.runs[p.run] ??= { run: p.run, job: p.job }, { finished: e.at, status: 'finished', summary: p.summary || null, events: p.events ?? null }); break;
      case 'job_failed': Object.assign(S.runs[p.run] ??= { run: p.run, job: p.job }, { finished: e.at, status: 'failed', error: p.error }); break;
      case 'calendar_synced': applyCalendar(S, p, e.at); break;
      case 'migrated': S.migrated = p; break;
      default: break;
    }
    if (it) it.hist.push({ seq: e.seq, at: e.at, actor: e.actor, type: e.type });
  }
  return S;
}

/** The example ledger as events. The stub ships none: the beta starts empty. */
export function demoEvents() { return []; }
