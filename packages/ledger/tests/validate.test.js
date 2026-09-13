import { describe, it, expect } from 'vitest';
import { validate, EVENT_TYPES, ACTOR_RULES, fold, demoEvents } from '../index.js';

const S = fold(demoEvents());
const ev = (o) => Object.assign({ v: 1, at: '2026-09-14T09:00:00.000Z', actor: 'jeff', payload: {} }, o);

describe('validate — envelope', () => {
  it('accepts a well-formed event', () => {
    expect(validate(ev({ type: 'done', item: 'A1' }), S)).toEqual({ ok: true, errors: [] });
  });
  it('rejects unknown types, bad timestamps, bad actors, non-object payloads', () => {
    expect(validate(ev({ type: 'exploded', item: 'A1' })).ok).toBe(false);
    expect(validate(ev({ type: 'done', item: 'A1', at: 'yesterday' })).errors.join()).toMatch(/ISO/);
    expect(validate(ev({ type: 'done', item: 'A1', actor: 'bob' })).errors.join()).toMatch(/actor/);
    expect(validate(ev({ type: 'done', item: 'A1', payload: [] })).errors.join()).toMatch(/payload/);
    expect(validate(null).ok).toBe(false);
  });
  it('refuses events from a newer schema version', () => {
    expect(validate(ev({ type: 'done', item: 'A1', v: 2 })).errors.join()).toMatch(/version/);
  });
  it('every contract type has a spec', () => {
    for (const t of ['program_created', 'captured', 'clarified', 'accepted', 'edited', 'done', 'undone', 'trashed', 'restored', 'parked', 'promoted', 'dropped', 'nudged', 'handed_off', 'delivered', 'approved', 'taken_back', 'next_action_set', 'resurfaced', 'milestone_added', 'decision_recorded', 'wiki_changed', 'review_completed', 'config_set', 'job_started', 'job_finished', 'job_failed', 'migrated']) expect(EVENT_TYPES).toContain(t);
  });
});

describe('validate — payloads', () => {
  it('item events need an item', () => {
    expect(validate(ev({ type: 'done' })).errors.join()).toMatch(/needs an item/);
  });
  it('checks required payload fields, including nested paths', () => {
    expect(validate(ev({ type: 'captured', item: 'i_x', payload: { source: 'email' } })).errors.join()).toMatch(/raw/);
    expect(validate(ev({ type: 'program_created', payload: { program: { id: 'p_x', name: 'X' } } })).errors.join()).toMatch(/purpose/);
    expect(validate(ev({ type: 'clarified', item: 'A1', payload: { proposal: { kind: 'action', next: 'x', conf: .5 } } })).errors.join()).toMatch(/why/);
    expect(validate(ev({ type: 'handed_off', item: 'A1', payload: { cap: 'draft', what: 'x' } })).errors.join()).toMatch(/effect/);
  });
  it('limits accepted.kind and config keys', () => {
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'project', fields: {} } }), S).errors.join()).toMatch(/accepted.kind/);
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'action', fields: {} } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'config_set', payload: { key: 'theme', value: 'dark' } })).errors.join()).toMatch(/config_set.key/);
    expect(validate(ev({ type: 'config_set', payload: { key: 'autonomy.file', value: 'auto' } })).ok).toBe(true);
  });
});

describe('validate — actor rules', () => {
  it('AI actors may propose but never approve, accept, nudge or finish', () => {
    for (const t of ['approved', 'accepted', 'nudged', 'done']) {
      const r = validate(ev({ type: t, item: 'A1', actor: 'ai:clarify', payload: { kind: 'action', fields: {}, effect: 'x', text: 'x' } }), S);
      expect(r.ok, t).toBe(false); expect(r.errors.join()).toMatch(/ai actors may not/);
    }
    for (const t of ACTOR_RULES.ai) expect(ACTOR_RULES.ai).toContain(t);
    expect(validate(ev({ type: 'clarified', item: 'I1', actor: 'ai:clarify', payload: { proposal: { kind: 'action', next: 'x', conf: .8, why: 'y' } } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'delivered', item: 'X5', actor: 'ai:draft', payload: { deliverable: 'text' } }), S).ok).toBe(true);
  });
  it('ingest actors may only capture and log jobs', () => {
    expect(validate(ev({ type: 'captured', item: 'i_new', actor: 'ingest:calendar', payload: { source: 'calendar', raw: 'x' } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'accepted', item: 'I1', actor: 'ingest:calendar', payload: { kind: 'action', fields: {} } }), S).ok).toBe(false);
  });
  it('jeff and system may write anything', () => {
    expect(validate(ev({ type: 'approved', item: 'X1', payload: { effect: 'x' } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'migrated', actor: 'system', payload: { from: 1, to: 2 } }), S).ok).toBe(true);
  });
});

describe('validate — references against the fold', () => {
  it('the item must exist (and must not be captured twice)', () => {
    expect(validate(ev({ type: 'done', item: 'nope' }), S).errors.join()).toMatch(/unknown item/);
    expect(validate(ev({ type: 'captured', item: 'A1', payload: { source: 'email', raw: 'x' } }), S).errors.join()).toMatch(/already exists/);
  });
  it('project, owner and program must name known ids or be null', () => {
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'action', fields: { project: 'J99' } } }), S).errors.join()).toMatch(/unknown project/);
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'action', fields: { project: 'P1' } } }), S).ok).toBe(true);        // program-level is fine
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'waiting', fields: { owner: 'zed' } } }), S).errors.join()).toMatch(/unknown person/);
    expect(validate(ev({ type: 'accepted', item: 'I1', payload: { kind: 'waiting', fields: { owner: 'priya', project: null } } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'edited', item: 'A1', payload: { fields: { owner: 'ai' } } }), S).ok).toBe(true);
    expect(validate(ev({ type: 'project_created', payload: { project: { id: 'j_x', program: 'P9', name: 'n', outcome: 'o', health: 'good' } } }), S).errors.join()).toMatch(/unknown program/);
    expect(validate(ev({ type: 'milestone_added', payload: { program: 'P9', milestone: { label: 'a', what: 'b', state: 'planned' } } }), S).errors.join()).toMatch(/unknown program/);
    expect(validate(ev({ type: 'next_action_set', item: 'A1', payload: { project: 'nope' } }), S).errors.join()).toMatch(/unknown project/);
    expect(validate(ev({ type: 'config_set', payload: { key: 'progColor.P9', value: 3 } }), S).errors.join()).toMatch(/unknown program/);
  });
  it('entities are not created twice', () => {
    expect(validate(ev({ type: 'program_created', payload: { program: { id: 'P1', name: 'x', purpose: 'y' } } }), S).errors.join()).toMatch(/already exists/);
    expect(validate(ev({ type: 'person_created', payload: { person: { id: 'priya', name: 'x' } } }), S).errors.join()).toMatch(/already exists/);
  });
  it('without a fold state only the shape is checked', () => {
    expect(validate(ev({ type: 'done', item: 'nope' })).ok).toBe(true);
  });
});
