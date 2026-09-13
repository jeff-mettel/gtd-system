import { describe, it, expect } from 'vitest';
import { fold, DEFAULT_CONFIG } from '../index.js';

let n = 0;
const T = (h = 0) => new Date(Date.UTC(2026, 8, 14, 8 + h)).toISOString();
const ev = (type, payload = {}, extra = {}) => Object.assign({ seq: ++n, id: 'e' + n, v: 1, at: T(n), actor: 'jeff', type, payload }, extra);
const base = () => [
  ev('program_created', { program: { id: 'p1', name: 'Alpha program', purpose: 'Test' } }),
  ev('project_created', { project: { id: 'j1', program: 'p1', name: 'Proj', outcome: 'Done-ness', health: 'good' } }),
  ev('person_created', { person: { id: 'u1', name: 'Uma Person', role: 'Lead' } }),
];

describe('fold — entities', () => {
  it('creates programs with a wiki stub, projects, people; retires and drops', () => {
    const S = fold([...base(), ev('program_retired', { id: 'p1' }), ev('project_updated', { id: 'j1', fields: { dropped: true, health: 'crit' } })]);
    expect(S.programs).toHaveLength(1); expect(S.programs[0].retired).toBeInstanceOf(Date); expect(S.programs[0].created).toBeInstanceOf(Date);
    expect(S.wiki.p1.page).toBe('program-alpha-program'); expect(S.wiki.p1.links).toEqual([]);
    expect(S.projects[0]).toMatchObject({ id: 'j1', program: 'p1', dropped: true, health: 'crit', primary: null });
    expect(S.people[0]).toMatchObject({ id: 'u1', name: 'Uma Person', agenda: [] });
    expect(S.seq).toBe(n); expect(S.v).toBe(1);
  });
  it('starts from the default config and folds config_set (null deletes)', () => {
    const S = fold([ev('config_set', { key: 'autonomy.file', value: 'never' }), ev('config_set', { key: 'prompts.clarify', value: 'Be brief.' }), ev('config_set', { key: 'progColor.p1', value: 4 }), ev('config_set', { key: 'prompts.clarify', value: null })]);
    expect(S.config.autonomy.file).toBe('never'); expect(S.config.autonomy.send).toBe(DEFAULT_CONFIG.autonomy.send);
    expect(S.config.prompts.clarify).toBeUndefined(); expect(S.config.progColor.p1).toBe(4);
    expect(S.config.models.clarify.model).toBe(DEFAULT_CONFIG.models.clarify.model);
  });
  it('an empty ledger folds to an empty, well-formed state', () => {
    const S = fold([]);
    expect(S).toMatchObject({ v: 1, seq: 0, programs: [], projects: [], people: [], items: [], wiki: {}, runs: [], lastReview: null, reviews: 0 });
  });
});

describe('fold — items', () => {
  it('captured → inbox; clarified sets p; accepted files with the view shape and Date fields', () => {
    const S = fold([...base(),
      ev('captured', { source: 'email', raw: 'Send the numbers', from: 'u1', minutes: 20 }, { item: 'i1', actor: 'ingest:gmail' }),
      ev('clarified', { proposal: { kind: 'action', next: 'Send numbers to Uma', project: 'j1', ctx: '@quick', min: 20, due: '2026-09-16', conf: .9, why: 'Direct ask.' } }, { item: 'i1', actor: 'ai:clarify' }),
    ]);
    const it = S.items[0];
    expect(it).toMatchObject({ id: 'i1', kind: 'inbox', source: 'email', from: 'u1', raw: 'Send the numbers', min: 20 });
    expect(it.captured).toBeInstanceOf(Date); expect(it.p.due).toBeInstanceOf(Date); expect(it.p.kind).toBe('action');
    const S2 = fold([...base(),
      ev('captured', { source: 'email', raw: 'Send the numbers' }, { item: 'i1' }),
      ev('accepted', { kind: 'action', fields: { next: 'Send numbers to Uma', project: 'j1', ctx: '@deep', min: 45, due: '2026-09-16', hard: null, repeat: 'weekly' } }, { item: 'i1' }),
    ]);
    const a = S2.items[0];
    expect(a).toMatchObject({ kind: 'action', next: 'Send numbers to Uma', project: 'j1', ctx: '@deep', min: 45, repeat: 'weekly', confirmedBy: 'jeff' });
    expect(a.createdAt).toBeInstanceOf(Date); expect(a.due).toBeInstanceOf(Date); expect(a.hard).toBeNull();
    expect(S2.projects[0].lastMove).toEqual(a.createdAt);
  });
  it('waiting gets since, followUp, nudges; nudged bumps the count and moves follow-up', () => {
    const S = fold([...base(),
      ev('captured', { source: 'meeting', raw: 'Uma will send the plan' }, { item: 'i1' }),
      ev('accepted', { kind: 'waiting', fields: { next: 'Plan from Uma', owner: 'u1', project: 'j1' } }, { item: 'i1' }),
      ev('nudged', { text: 'Hi Uma…', channel: 'email' }, { item: 'i1' }),
    ]);
    const w = S.items[0];
    expect(w).toMatchObject({ kind: 'waiting', owner: 'u1', nudges: 1 });
    expect(w.since).toBeInstanceOf(Date); expect(w.lastNudged).toBeInstanceOf(Date);
    expect((w.followUp - w.lastNudged) / 864e5).toBeCloseTo(5, 5);
  });
  it('done/undone, trashed/restored, parked/promoted, dropped move kind and remember the previous one', () => {
    const cap = () => [...base(), ev('captured', { source: 'chat', raw: 'x' }, { item: 'i1' }), ev('accepted', { kind: 'action', fields: { next: 'x', project: 'j1' } }, { item: 'i1' })];
    const one = (...more) => fold([...cap(), ...more]).items[0];
    expect(one(ev('done', {}, { item: 'i1' }))).toMatchObject({ kind: 'done', prevKind: 'action' });
    expect(one(ev('done', {}, { item: 'i1' }), ev('undone', {}, { item: 'i1' })).kind).toBe('action');
    expect(one(ev('trashed', {}, { item: 'i1' })).kind).toBe('trash');
    const restored = one(ev('trashed', {}, { item: 'i1' }), ev('restored', {}, { item: 'i1' }));
    expect(restored.kind).toBe('inbox'); expect(restored.p.kind).toBe('action');
    expect(one(ev('parked', { revisit: '2026-10-01' }, { item: 'i1' }))).toMatchObject({ kind: 'someday' });
    expect(one(ev('parked', {}, { item: 'i1' }), ev('promoted', {}, { item: 'i1' })).kind).toBe('action');
    expect(one(ev('dropped', {}, { item: 'i1' })).kind).toBe('trash');
    expect(one(ev('edited', { fields: { project: 'p1', energy: 'high' } }, { item: 'i1' }))).toMatchObject({ project: 'p1', energy: 'high' });
    expect(one(ev('edited', { fields: { project: 'p1' } }, { item: 'i1' })).movedAt).toBeInstanceOf(Date);
  });
  it('delegation: handed_off → queued, job_started → working, delivered → ready, approved → done, taken_back clears', () => {
    const cap = () => [...base(), ev('captured', { source: 'chat', raw: 'x' }, { item: 'i1' }), ev('accepted', { kind: 'action', fields: { next: 'x', project: 'j1', min: 20 } }, { item: 'i1' })];
    const hand = () => ev('handed_off', { cap: 'draft', what: 'Draft it', effect: 'Nothing is sent' }, { item: 'i1' });
    const one = (...more) => fold([...cap(), ...more]).items[0];
    expect(one(hand())).toMatchObject({ owner: 'ai', cap: 'draft', del: { status: 'queued', minutes: 20, effect: 'Nothing is sent' } });
    expect(one(hand(), ev('job_started', { job: 'draft', run: 'r1' }, { item: 'i1', actor: 'ai:draft' })).del.status).toBe('working');
    const ready = one(hand(), ev('delivered', { deliverable: 'The draft' }, { item: 'i1', actor: 'ai:draft' }));
    expect(ready.del).toMatchObject({ status: 'ready', deliverable: 'The draft', progress: 1 }); expect(ready.del.readyAt).toBeInstanceOf(Date);
    expect(one(hand(), ev('delivered', { deliverable: 'd' }, { item: 'i1', actor: 'ai:draft' }), ev('approved', { effect: 'Nothing is sent', deliverable: 'edited' }, { item: 'i1' }))).toMatchObject({ kind: 'done', del: { status: 'approved', deliverable: 'edited' } });
    const back = one(hand(), ev('taken_back', {}, { item: 'i1' }));
    expect(back.owner).toBeUndefined(); expect(back.del).toBeUndefined(); expect(back.kind).toBe('action');
    const S = fold([...cap(), hand(), ev('job_started', { job: 'draft', run: 'r1' }, { item: 'i1', actor: 'ai:draft' }), ev('job_finished', { job: 'draft', run: 'r1', summary: 'ok' }, { actor: 'ai:draft' })]);
    expect(S.runs[0]).toMatchObject({ run: 'r1', job: 'draft', item: 'i1', status: 'finished', summary: 'ok' });
  });
  it('next_action_set marks the project primary; resurfaced brings a tickler back and stamps a deferred action', () => {
    const S = fold([...base(),
      ev('captured', { source: 'chat', raw: 'a' }, { item: 'i1' }), ev('accepted', { kind: 'action', fields: { next: 'a', project: 'j1' } }, { item: 'i1' }),
      ev('captured', { source: 'chat', raw: 'b' }, { item: 'i2' }), ev('accepted', { kind: 'action', fields: { next: 'b', project: 'j1' } }, { item: 'i2' }),
      ev('next_action_set', { project: 'j1' }, { item: 'i2' }),
      ev('captured', { source: 'chat', raw: 'later' }, { item: 'i3' }), ev('accepted', { kind: 'someday', fields: { next: 'later', revisit: '2026-09-14' } }, { item: 'i3' }),
      ev('resurfaced', { for: '2026-09-14' }, { item: 'i3', actor: 'system' }),
      ev('captured', { source: 'chat', raw: 'deferred' }, { item: 'i4' }), ev('accepted', { kind: 'action', fields: { next: 'deferred', project: 'j1', start: '2026-09-14' } }, { item: 'i4' }),
      ev('resurfaced', { for: '2026-09-14' }, { item: 'i4', actor: 'system' }),
    ]);
    expect(S.projects[0].primary).toBe('i2');
    const t = S.items.find(i => i.id === 'i3');
    expect(t).toMatchObject({ kind: 'inbox', source: 'tickler', wasKind: 'someday', tickledFor: '2026-09-14', resurfacedFor: ['2026-09-14'] }); expect(t.p.why).toMatch(/Tickler/);
    expect(S.items.find(i => i.id === 'i4').resurfacedAt).toBeInstanceOf(Date);
  });
  it('a second captured for the same id is a no-op; unknown types are skipped', () => {
    const S = fold([...base(), ev('captured', { source: 'chat', raw: 'first' }, { item: 'i1' }), ev('captured', { source: 'chat', raw: 'again' }, { item: 'i1' }), ev('teleported', {}, { item: 'i1' })]);
    expect(S.items).toHaveLength(1); expect(S.items[0].raw).toBe('first');
  });
});

describe('fold — wiki, review, determinism', () => {
  it('folds milestones, decisions, wiki_changed words and fields; reference items link into the hub', () => {
    const S = fold([...base(),
      ev('milestone_added', { program: 'p1', milestone: { label: '7 Oct', what: 'Sign-off', state: 'at risk', iso: '2026-10-07' } }),
      ev('decision_recorded', { program: 'p1', decision: { on: '1 Sep', what: 'Go', who: 'Uma', why: 'Because', status: 'decided' } }),
      ev('wiki_changed', { page: 'program-alpha-program', words: 120, fields: { status: 'All good.', health: 'good', compiled: true, links: [['Plan', 'https://x']] } }, { actor: 'ai:wiki' }),
      ev('wiki_changed', { page: 'program-alpha-program-decisions', words: 30 }, { actor: 'ai:wiki' }),
      ev('captured', { source: 'chat', raw: 'memo' }, { item: 'i1' }), ev('accepted', { kind: 'reference', fields: { next: 'Auditor memo', refPage: 'p1' } }, { item: 'i1' }),
      ev('review_completed', { steps: ['inbox'] }),
    ]);
    const w = S.wiki.p1;
    expect(w.milestones).toEqual([['7 Oct', 'Sign-off', 'at risk', '2026-10-07']]);
    expect(w.decisions[0]).toMatchObject({ what: 'Go', projects: [] });
    expect(w.words).toBe(150); expect(w.pages).toEqual({ 'program-alpha-program': 120, 'program-alpha-program-decisions': 30 });
    expect(w.status).toBe('All good.'); expect(w.compiled).toBeInstanceOf(Date);
    expect(w.links).toEqual([['Plan', 'https://x'], ['Auditor memo', '']]);
    expect(S.items[0].filedAt).toBeInstanceOf(Date);
    expect(S.lastReview).toBeInstanceOf(Date); expect(S.reviews).toBe(1);
  });
  it('is deterministic and idempotent, and order-sensitive where it should be', () => {
    const evs = [...base(), ev('captured', { source: 'chat', raw: 'x' }, { item: 'i1' }), ev('accepted', { kind: 'action', fields: { next: 'x' } }, { item: 'i1' }), ev('done', {}, { item: 'i1' }), ev('undone', {}, { item: 'i1' })];
    const a = fold(evs), b = fold(evs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.items[0].kind).toBe('action');
    const swapped = [...evs.slice(0, -2), evs.at(-1), evs.at(-2)];              // undone before done → ends done
    expect(fold(swapped).items[0].kind).toBe('done');
    expect(fold(a.items.length ? evs : [])).toBeTruthy();
  });
  it('never mutates the events it is given', () => {
    const evs = [...base(), ev('captured', { source: 'chat', raw: 'x' }, { item: 'i1' })];
    const before = JSON.stringify(evs); fold(evs); expect(JSON.stringify(evs)).toBe(before);
  });
});
