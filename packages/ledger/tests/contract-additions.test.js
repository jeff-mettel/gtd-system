import { describe, it, expect } from 'vitest';
import { fold, validate, ACTOR_RULES, FOR_KINDS } from '../index.js';

let n = 0;
const T = (h = 0) => new Date(Date.UTC(2026, 8, 14, 8 + h)).toISOString();
const ev = (type, payload = {}, extra = {}) => Object.assign({ seq: ++n, id: 'e' + n, v: 1, at: T(n), actor: 'jeff', type, payload }, extra);
const base = () => [
  ev('program_created', { program: { id: 'p1', name: 'Alpha', purpose: 'Test' } }),
  ev('project_created', { project: { id: 'j1', program: 'p1', name: 'Proj', outcome: 'Done-ness', health: 'good' } }),
  ev('person_created', { person: { id: 'u1', name: 'Uma Person', role: 'Lead', channels: { email: ['uma@example.com'], slack: '@uma' } } }),
];

describe('calendar_synced', () => {
  const TODAY = new Date(2026, 8, 14, 8);
  const cal = () => ev('calendar_synced', { window: { from: '2026-09-07', to: '2026-09-28' }, source: 'macos', events: [
    { id: 'c1', title: 'Billing sync', start: new Date(2026, 8, 14, 9).toISOString(), end: new Date(2026, 8, 14, 9, 30).toISOString(), attendees: [{ name: 'Uma', email: 'uma@example.com' }], who: ['u1'], calendar: 'Work' },
    { id: 'c2', title: 'Steering', start: new Date(2026, 8, 17, 14).toISOString(), end: new Date(2026, 8, 17, 15).toISOString(), attendees: [], who: [], calendar: 'Work', location: 'Room 4' },
    { id: 'c0', title: 'Retro', start: new Date(2026, 8, 10, 11).toISOString(), end: new Date(2026, 8, 10, 12).toISOString(), attendees: [], who: ['u1'], calendar: 'Work' },
  ] }, { actor: 'ingest:calendar' });
  it('validates: ingest may write it, who must name people', () => {
    const S = fold(base());
    expect(ACTOR_RULES.ingest).toContain('calendar_synced');
    expect(validate(cal(), S).ok).toBe(true);
    const bad = cal(); bad.payload.events[0].who = ['nobody']; expect(validate(bad, S).errors.join()).toMatch(/unknown person/);
    const worse = cal(); worse.payload.events = 'x'; expect(validate(worse, S).errors.join()).toMatch(/array/);
    expect(validate(ev('calendar_synced', { window: { from: 'a', to: 'b' }, events: [], source: 'macos' }, { actor: 'ai:prep' }), S).ok).toBe(false);
  });
  it('folds into meetings (today), calendarAhead, pastMeetings with captured counts, calendarWindow; a later sync replaces', () => {
    const S = fold([...base(), cal(), ev('captured', { source: 'meeting', raw: 'Follow up', ref: 'cal:event/c0' }, { item: 'i1', actor: 'ingest:calendar' })], { today: TODAY });
    expect(S.calendarWindow.from).toBeInstanceOf(Date);
    expect(S.meetings).toEqual([{ id: 'c1', time: '09:00', dur: 30, title: 'Billing sync', who: ['u1'], projects: [], decisions: [], location: undefined, allDay: false }]);
    expect(S.calendarAhead).toHaveLength(1); expect(S.calendarAhead[0]).toMatchObject({ id: 'c2', time: '14:00', title: 'Steering' }); expect(S.calendarAhead[0].on).toBeInstanceOf(Date);
    expect(S.pastMeetings).toEqual([expect.objectContaining({ id: 'c0', title: 'Retro', captured: 1 })]);
    const S2 = fold([...base(), cal(), ev('calendar_synced', { window: { from: '2026-09-14', to: '2026-09-21' }, source: 'connector', events: [] }, { actor: 'ingest:calendar' })], { today: TODAY });
    expect(S2.meetings).toEqual([]); expect(S2.calendar.source).toBe('connector');
    expect(fold(base()).meetings).toBeNull();
  });
});

describe('people channels, next_action_proposed, delivered.for', () => {
  it('carries channels.email through', () => {
    const S = fold(base());
    expect(S.people[0].channels).toEqual({ email: ['uma@example.com'], slack: '@uma' });
    expect(fold([ev('person_created', { person: { id: 'u2', name: 'No Channels' } })]).people[0].channels.email).toEqual([]);
  });
  it('next_action_proposed is AI-writable and lands on the project (latest wins)', () => {
    const S0 = fold(base());
    expect(validate(ev('next_action_proposed', { project: 'j1', proposal: { next: 'Call Uma', ctx: '@quick', min: 10, why: 'Cheapest unblock' } }, { actor: 'ai:suggest' }), S0).ok).toBe(true);
    expect(validate(ev('next_action_proposed', { project: 'j9', proposal: { next: 'x', why: 'y' } }, { actor: 'ai:suggest' }), S0).errors.join()).toMatch(/unknown project/);
    expect(validate(ev('next_action_proposed', { project: 'j1', proposal: { next: 'x' } }, { actor: 'ai:suggest' }), S0).errors.join()).toMatch(/why/);
    const S = fold([...base(), ev('next_action_proposed', { project: 'j1', proposal: { next: 'Old', why: 'a' } }, { actor: 'ai:suggest' }), ev('next_action_proposed', { project: 'j1', proposal: { next: 'Call Uma', ctx: '@quick', min: 10, why: 'Cheapest unblock' } }, { actor: 'ai:suggest' })]);
    expect(S.projects[0].proposed).toMatchObject({ next: 'Call Uma', ctx: '@quick', min: 10, why: 'Cheapest unblock', actor: 'ai:suggest' }); expect(S.projects[0].proposed.at).toBeInstanceOf(Date);
  });
  it('delivered / approved / taken_back may name a `for` target instead of an item', () => {
    const S0 = fold(base());
    expect(FOR_KINDS).toContain('meeting');
    expect(validate(ev('delivered', { deliverable: 'Brief…' }, { actor: 'ai:prep' }), S0).errors.join()).toMatch(/needs an item, or payload.for/);
    expect(validate(ev('delivered', { deliverable: 'Brief…', for: { kind: 'meeting', id: 'c1' } }, { actor: 'ai:prep' }), S0).ok).toBe(true);
    expect(validate(ev('delivered', { deliverable: 'Brief…', for: { kind: 'lunch' } }, { actor: 'ai:prep' }), S0).ok).toBe(false);
    const S = fold([...base(),
      ev('delivered', { deliverable: 'Brief for Billing sync', for: { kind: 'meeting', id: 'c1' } }, { actor: 'ai:prep' }),
      ev('delivered', { deliverable: 'Status draft', for: { kind: 'status', id: 'p1' } }, { actor: 'ai:status' }),
      ev('approved', { effect: 'Nothing is sent', for: { kind: 'status', id: 'p1' }, deliverable: 'Status draft, edited' }),
      ev('delivered', { deliverable: 'Review prep', for: { kind: 'review' } }, { actor: 'ai:review' }),
      ev('taken_back', { for: { kind: 'review' } }),
    ]);
    expect(S.deliverables).toHaveLength(3);
    expect(S.deliverables[0]).toMatchObject({ key: 'meeting:c1', status: 'ready', cap: 'prep', deliverable: 'Brief for Billing sync' }); expect(S.deliverables[0].readyAt).toBeInstanceOf(Date);
    expect(S.deliverables[1]).toMatchObject({ key: 'status:p1', status: 'approved', deliverable: 'Status draft, edited' });
    expect(S.deliverables[2]).toMatchObject({ key: 'review:', status: 'taken' });
    expect(S.items).toHaveLength(0);
  });
  it('fold output holds no Maps', () => {
    const S = fold(base());
    const walk = (v) => { if (v instanceof Map || v instanceof Set) throw new Error('Map/Set in fold output'); if (v && typeof v === 'object' && !(v instanceof Date)) for (const k in v) walk(v[k]); };
    expect(() => walk(S)).not.toThrow();
  });
});
