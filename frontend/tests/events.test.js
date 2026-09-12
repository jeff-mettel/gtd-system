import { describe, it, expect } from 'vitest';
import { buildEvents, weeks } from '../src/replay/events.js';
import { items } from '../src/data/example.js';

const { EV, ITEMS, REVIEWS, T0, T1 } = buildEvents();

describe('event log', () => {
  it('is sorted and bounded by the demo window', () => {
    for (let i = 1; i < EV.length; i++) expect(EV[i].at).toBeGreaterThanOrEqual(EV[i - 1].at);
    expect(EV[0].at).toBeLessThanOrEqual(T0);
    expect(EV.at(-1).at).toBeLessThanOrEqual(T1);
  });
  it('captures every example item exactly once', () => {
    const captured = EV.filter(e => e.type === 'captured').map(e => e.item);
    for (const it of items) expect(captured.filter(id => id === it.id)).toHaveLength(1);
    expect(new Set(captured).size).toBe(ITEMS.length);
  });
  it('never lets an item skip capture', () => {
    const seen = new Set();
    for (const e of EV) { if (!e.item) continue; if (e.type === 'captured') seen.add(e.item); else expect(seen.has(e.item), `${e.type} before capture for ${e.item}`).toBe(true); }
  });
  it('tags every AI write with an ai: actor and every human write with jeff', () => {
    for (const e of EV) {
      if (['clarified', 'nudge_drafted', 'working', 'delivered'].includes(e.type)) expect(e.actor.startsWith('ai:')).toBe(true);
      if (['accepted', 'done', 'nudged', 'approved', 'delegated', 'review_completed'].includes(e.type)) expect(e.actor).toBe('jeff');
      if (e.type === 'captured') expect(e.actor.startsWith('ingest:')).toBe(true);
    }
  });
  it('holds a weekly review every Friday afternoon', () => {
    expect(REVIEWS.length).toBeGreaterThanOrEqual(6);
    for (const r of REVIEWS) expect(new Date(r).getDay()).toBe(5);
  });
  it('is deterministic', () => {
    const again = buildEvents();
    expect(again.EV).toBe(EV);                       // memoised
    expect(weeks().map(w => w.c)).toEqual([31, 27, 35, 24, 40, 29, 33, 38]);
  });
});
