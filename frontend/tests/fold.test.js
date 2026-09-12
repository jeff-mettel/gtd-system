import { describe, it, expect } from 'vitest';
import { buildEvents } from '../src/replay/events.js';
import { fold } from '../src/replay/fold.js';
import { items } from '../src/data/example.js';

const { EV, T0, T1 } = buildEvents();
const DAY = 864e5;

describe('fold', () => {
  it('starts empty and ends with the example ledger', () => {
    const start = fold(EV, T0 - DAY);
    expect(start.items.size).toBe(0);
    const end = fold(EV, T1);
    const stage = (id) => end.items.get(id)?.stage;
    for (const it of items) {
      if (it.kind === 'inbox') expect(['inbox', 'gate']).toContain(stage(it.id));
      if (it.kind === 'waiting') expect(stage(it.id)).toBe('waiting');
      if (it.kind === 'done') expect(stage(it.id)).toBe('done');
      if (it.kind === 'someday') expect(stage(it.id)).toBe('someday');
      if (it.owner === 'ai' && it.del) expect(['delegated', 'ready']).toContain(stage(it.id));
    }
  });
  it('derives last movement from events, never from a stored field', () => {
    const end = fold(EV, T1);
    const j6 = end.projects.get('J6');
    expect((T1 - j6.lastMove) / DAY).toBeGreaterThan(7);           // Go/no-go criteria is the stalled project in the demo
    const moving = [...end.projects.values()].filter(p => (T1 - p.lastMove) / DAY <= 7);
    expect(moving.length).toBeGreaterThan(4);
  });
  it('is monotonic in reviews and wiki words', () => {
    let prevR = 0, prevW = 0;
    for (let t = T0; t <= T1; t += 3 * DAY) {
      const S = fold(EV, t); let w = 0; for (const v of S.wiki.values()) w += v;
      expect(S.reviews).toBeGreaterThanOrEqual(prevR); expect(w).toBeGreaterThanOrEqual(prevW);
      prevR = S.reviews; prevW = w;
    }
  });
  it('puts P3 on the board only after it is created', () => {
    expect(fold(EV, T0 + 3 * DAY).programs.has('P3')).toBe(false);
    expect(fold(EV, T0 + 10 * DAY).programs.has('P3')).toBe(true);
    expect(fold(EV, T0 + 10 * DAY).projects.has('J8')).toBe(false);
    expect(fold(EV, T1).projects.has('J8')).toBe(true);
  });
});
