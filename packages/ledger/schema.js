// Event schema v1 — the contract in docs/ledger-events.md, as code. `validate()` is the door every writer
// (server, CLI, front-end store) passes an event through before appending it.

export const LEDGER_VERSION = 1;

/** Per-type spec: `item` — the envelope must name an item; `required` — payload paths that must be present. */
export const SPEC = {
  // entities
  program_created:   { required: ['program.id', 'program.name', 'program.purpose'] },
  program_updated:   { required: ['id', 'fields'] },
  program_retired:   { required: ['id'] },
  project_created:   { required: ['project.id', 'project.program', 'project.name', 'project.outcome', 'project.health'] },
  project_updated:   { required: ['id', 'fields'] },
  person_created:    { required: ['person.id', 'person.name'] },
  person_updated:    { required: ['id', 'fields'] },
  // items
  captured:          { item: true, required: ['source', 'raw'] },
  clarified:         { item: true, required: ['proposal.kind', 'proposal.next', 'proposal.conf', 'proposal.why'] },
  accepted:          { item: true, required: ['kind', 'fields'] },
  edited:            { item: true, required: ['fields'] },
  done:              { item: true, required: [] },
  undone:            { item: true, required: [] },
  trashed:           { item: true, required: [] },
  restored:          { item: true, required: [] },
  parked:            { item: true, required: [] },
  promoted:          { item: true, required: [] },
  dropped:           { item: true, required: [] },
  nudged:            { item: true, required: ['text'] },
  handed_off:        { item: true, required: ['cap', 'what', 'effect'] },
  delivered:         { item: 'or-for', required: ['deliverable'] },
  approved:          { item: 'or-for', required: ['effect'] },
  taken_back:        { item: 'or-for', required: [] },
  next_action_set:   { item: true, required: ['project'] },
  next_action_proposed: { required: ['project', 'proposal.next', 'proposal.why'] },
  resurfaced:        { item: true, required: ['for'] },
  // knowledge and system
  milestone_added:   { required: ['program', 'milestone.label', 'milestone.what', 'milestone.state'] },
  decision_recorded: { required: ['program', 'decision.what'] },
  wiki_changed:      { required: ['page', 'words'] },
  review_completed:  { required: [] },
  config_set:        { required: ['key'] },
  job_started:       { required: ['job', 'run'] },
  job_finished:      { required: ['job', 'run'] },
  job_failed:        { required: ['job', 'run', 'error'] },
  calendar_synced:   { required: ['window.from', 'window.to', 'events', 'source'] },
  migrated:          { required: ['from', 'to'] },
};

export const EVENT_TYPES = Object.freeze(Object.keys(SPEC));

/** Kinds an `accepted` event may file an item as. */
export const ACCEPT_KINDS = Object.freeze(['action', 'waiting', 'someday', 'reference', 'done', 'trash']);

/** What each actor class may write. `null` = anything. AI actors propose; they never approve, accept, nudge or finish. */
export const ACTOR_RULES = Object.freeze({
  jeff: null,
  system: null,
  ai: Object.freeze(['captured', 'clarified', 'delivered', 'next_action_proposed', 'wiki_changed', 'job_started', 'job_finished', 'job_failed', 'milestone_added', 'decision_recorded']),
  ingest: Object.freeze(['captured', 'calendar_synced', 'job_started', 'job_finished', 'job_failed']),
});

export const ACTOR_RE = /^(jeff|system|ai:[\w.-]+|ingest:[\w.-]+)$/;

/** Targets a `delivered` (and `approved` / `taken_back`) may name instead of an item. */
export const FOR_KINDS = Object.freeze(['meeting', 'status', 'review', 'wiki']);

/** Config keys `config_set` accepts, by prefix. */
export const CONFIG_KEY_RE = /^(autonomy|models|prompts|progColor)\.[\w.-]+$/;

/** Defaults the fold starts from; the demo seeds the same values as explicit `config_set` events. */
export const DEFAULT_CONFIG = Object.freeze({
  autonomy: { file: 'auto', draft: 'draft', data: 'draft', send: 'ask', calendar: 'ask', delete: 'never' },
  models: {
    clarify: { provider: 'claude', model: 'claude-haiku-4-5' },
    suggest: { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium' },
    nudge:   { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium' },
    prep:    { provider: 'claude', model: 'claude-opus-5', effort: 'high' },
    review:  { provider: 'claude', model: 'claude-opus-5', effort: 'high' },
    compile: { provider: 'claude', model: 'claude-opus-5', effort: 'high' },
    ingest:  { provider: 'claude', model: 'claude-opus-5', effort: 'high' },
    enrich:  { provider: 'claude', model: 'claude-haiku-4-5' },
  },
  prompts: {},
  progColor: {},
});

const get = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const actorClass = (a) => (a === 'jeff' || a === 'system') ? a : a.startsWith('ai:') ? 'ai' : a.startsWith('ingest:') ? 'ingest' : null;

/**
 * Validate one event. `foldState` (the current fold, optional) enables reference checks: the item exists for item
 * events, `project` / `owner` / `program` name known ids, entity ids are not created twice.
 * Returns { ok, errors }.
 */
export function validate(e, foldState = null) {
  const errors = [];
  if (!e || typeof e !== 'object') return { ok: false, errors: ['event must be an object'] };
  const spec = SPEC[e.type];
  if (typeof e.type !== 'string' || !spec) errors.push(`unknown type: ${e.type}`);
  if (e.v != null && e.v !== LEDGER_VERSION) errors.push(`unsupported event version ${e.v} (this app writes v${LEDGER_VERSION})`);
  if (typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at))) errors.push('at must be an ISO timestamp');
  if (typeof e.actor !== 'string' || !ACTOR_RE.test(e.actor)) errors.push(`actor must be jeff, system, ai:<job> or ingest:<source> (got ${e.actor})`);
  if (e.payload == null || typeof e.payload !== 'object' || Array.isArray(e.payload)) errors.push('payload must be an object');
  if (e.item != null && typeof e.item !== 'string') errors.push('item must be a string id');
  if (!spec || errors.length) return { ok: false, errors };

  const p = e.payload;
  if (spec.item === true && !e.item) errors.push(`${e.type} needs an item`);
  if (spec.item === 'or-for' && !e.item && !(p.for && typeof p.for === 'object' && FOR_KINDS.includes(p.for.kind))) errors.push(`${e.type} needs an item, or payload.for:{ kind:${FOR_KINDS.join('|')}, id? }`);
  if (e.type === 'calendar_synced' && !Array.isArray(p.events)) errors.push('calendar_synced.events must be an array');
  if (e.type === 'calendar_synced' && Array.isArray(p.events) && p.events.some(x => !x || typeof x.id !== 'string' || typeof x.title !== 'string' || !x.start)) errors.push('calendar_synced.events entries need id, title, start');
  for (const f of spec.required) if (get(p, f) === undefined || get(p, f) === null) errors.push(`payload.${f} is required for ${e.type}`);
  if (e.type === 'accepted' && p.kind != null && !ACCEPT_KINDS.includes(p.kind)) errors.push(`accepted.kind must be one of ${ACCEPT_KINDS.join(', ')} (got ${p.kind})`);
  if (e.type === 'config_set' && typeof p.key === 'string' && !CONFIG_KEY_RE.test(p.key)) errors.push(`config_set.key must look like autonomy.<cap>, models.<job>, prompts.<job> or progColor.<program> (got ${p.key})`);
  for (const k of ['fields', 'proposal', 'program', 'project', 'person', 'milestone', 'decision']) if (k in p && p[k] != null && typeof p[k] !== 'object' && !(k === 'program' && typeof p.program === 'string') && !(k === 'project' && typeof p.project === 'string')) errors.push(`payload.${k} must be an object`);

  const cls = actorClass(e.actor), allowed = ACTOR_RULES[cls];
  if (allowed && !allowed.includes(e.type)) errors.push(`${cls} actors may not write ${e.type}`);

  if (foldState) {
    const S = foldState;
    const programs = new Set(S.programs.map(g => g.id)), projects = new Set(S.projects.map(j => j.id)), people = new Set(S.people.map(u => u.id)), items = new Set(S.items.map(i => i.id));
    const projectRef = (v, where) => { if (v == null || v === '') return; if (!projects.has(v) && !programs.has(v)) errors.push(`${where} names an unknown project or program: ${v}`); };
    const programRef = (v, where) => { if (v == null) return; if (!programs.has(v)) errors.push(`${where} names an unknown program: ${v}`); };
    const ownerRef = (v, where) => { if (v == null || v === '' || v === 'ai') return; if (!people.has(v)) errors.push(`${where} names an unknown person: ${v}`); };
    if (spec.item && e.item) {
      if (e.type === 'captured') { if (items.has(e.item)) errors.push(`item ${e.item} already exists`); }
      else if (!items.has(e.item)) errors.push(`unknown item: ${e.item}`);
    }
    switch (e.type) {
      case 'program_created': if (programs.has(p.program.id)) errors.push(`program ${p.program.id} already exists`); ownerRef(p.program.sponsor, 'program.sponsor'); break;
      case 'program_updated': case 'program_retired': programRef(p.id, 'id'); if (p.fields) ownerRef(p.fields.sponsor, 'fields.sponsor'); break;
      case 'project_created': if (projects.has(p.project.id)) errors.push(`project ${p.project.id} already exists`); programRef(p.project.program, 'project.program'); break;
      case 'project_updated': if (!projects.has(p.id)) errors.push(`unknown project: ${p.id}`); if (p.fields) programRef(p.fields.program, 'fields.program'); break;
      case 'person_created': if (people.has(p.person.id)) errors.push(`person ${p.person.id} already exists`); break;
      case 'person_updated': if (!people.has(p.id)) errors.push(`unknown person: ${p.id}`); break;
      case 'captured': ownerRef(p.from, 'from'); break;
      case 'clarified': projectRef(p.proposal.project, 'proposal.project'); ownerRef(p.proposal.owner, 'proposal.owner'); break;
      case 'accepted': case 'edited': if (p.fields) { projectRef(p.fields.project, 'fields.project'); ownerRef(p.fields.owner, 'fields.owner'); } break;
      case 'next_action_set': case 'next_action_proposed': projectRef(p.project, 'project'); break;
      case 'calendar_synced': for (const x of p.events || []) for (const w of x.who || []) ownerRef(w, `events[${x.id}].who`); break;
      case 'milestone_added': case 'decision_recorded': programRef(p.program, 'program'); break;
      case 'wiki_changed': programRef(p.program, 'program'); if (p.item && !items.has(p.item)) errors.push(`unknown item: ${p.item}`); break;
      case 'config_set': if (typeof p.key === 'string' && p.key.startsWith('progColor.')) programRef(p.key.slice('progColor.'.length), 'key'); break;
    }
  }
  return { ok: errors.length === 0, errors };
}
