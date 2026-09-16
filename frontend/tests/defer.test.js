import { describe, it, expect, beforeEach } from 'vitest';
import { demoEvents } from '@snowball/ledger';
import { isBackToday, isDeferred, resurfaceDeferred, untilStart } from '../src/features/defer.js';
import { commit, load, projects } from '../src/store.js';
import { TODAY, d } from '../src/lib/dates.js';
import { mine, openActions, projHealth } from '../src/model.js';

describe('deferred actions', () => {
  it('is deferred while the start date is ahead, by whole days', () => {
    expect(isDeferred({ start:d(5) })).toBe(true);
    expect(isDeferred({ start:d(1) })).toBe(true);
    expect(isDeferred({ start:d(0) })).toBe(false);
    expect(isDeferred({ start:d(-2) })).toBe(false);
    expect(isDeferred({})).toBe(false);
    expect(untilStart({ start:d(3) })).toBe(3); expect(untilStart({})).toBeNull();
  });

  it('accepts ISO strings (persisted overrides) and ignores the time of day', () => {
    const late = new Date(TODAY); late.setHours(23, 30);
    expect(isDeferred({ start:late.toISOString() })).toBe(false);
    expect(isDeferred({ start:d(1).toISOString() })).toBe(true);
  });

  it('is "back today" only on the day it resurfaced', () => {
    expect(isBackToday({ start:d(0), resurfacedAt:d(0) })).toBe(true);
    expect(isBackToday({ start:d(-1), resurfacedAt:d(0) })).toBe(true);
    expect(isBackToday({ start:d(-3), resurfacedAt:d(-3) })).toBe(false);
    expect(isBackToday({ start:d(0) })).toBe(false);            // not stamped yet
    expect(isBackToday({ start:d(2), resurfacedAt:d(0) })).toBe(false);  // still parked
    expect(isBackToday({ resurfacedAt:d(0) })).toBe(false);     // never deferred
  });

  it('resurfaceDeferred stamps arrivals once and re-stamps after a fresh deferral', () => {
    const a = { id:'t1', kind:'action', start:d(0) }, b = { id:'t2', kind:'action', start:d(4) }, c = { id:'t3', kind:'someday', start:d(0) };
    expect(resurfaceDeferred([a, b, c])).toEqual(['t1']);
    expect(isBackToday(a)).toBe(true); expect(b.resurfacedAt).toBeUndefined(); expect(c.resurfacedAt).toBeUndefined();
    expect(resurfaceDeferred([a, b, c])).toEqual([]);           // idempotent
    a.start = d(-6); a.resurfacedAt = d(-6);                    // came back a week ago…
    expect(resurfaceDeferred([a])).toEqual([]); expect(isBackToday(a)).toBe(false);
    a.start = d(0);                                             // …deferred again and due back today
    expect(resurfaceDeferred([a])).toEqual(['t1']); expect(isBackToday(a)).toBe(true);
  });
});

describe('deferred actions in the model (over the demo ledger)', () => {
  beforeEach(async () => { await load({ seed: demoEvents() }); });

  it('A14 is parked: off my open list and off its project, but the project still counts as covered', () => {
    expect(mine().some(a => a.id === 'A14')).toBe(false);
    expect(openActions('J2').some(a => a.id === 'A14')).toBe(false);
    commit('done', {}, { item: 'W7' });                        // take away the waiting-for so only the deferred action covers J2
    const h = projHealth(projects.find(j => j.id === 'J2'));
    expect(h.na).toBeNull(); expect(h.w).toBeNull(); expect(h.deferred?.id).toBe('A14'); expect(h.noNext).toBe(false);
    commit('parked', {}, { item: 'A14' });                     // and with the deferred action gone too, it is uncovered
    expect(projHealth(projects.find(j => j.id === 'J2')).noNext).toBe(true);
  });

  it('re-enters the open list on its start day', () => {
    commit('edited', { fields: { start: d(0) } }, { item: 'A14' });
    expect(mine().some(a => a.id === 'A14')).toBe(true);
    expect(projHealth(projects.find(j => j.id === 'J2')).na?.id).toBe('A14');
  });
});
