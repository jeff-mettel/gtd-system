import { describe, it, expect, beforeAll } from 'vitest';
import { demoEvents } from '@gtd/ledger';
import { load, items } from '../src/store.js';
import { buildEvents, weeks } from '../src/replay/events.js';
import { fold, wikiByProgram, isCharged, describe as describeEvent } from '../src/replay/fold.js';

const DAY = 864e5;
let EV, T0, T1, PAGES;
beforeAll(async () => { await load({ seed: demoEvents() }); ({ EV, T0, T1, PAGES } = buildEvents()); });

describe('replay events from the store', () => {
  it('is sorted, bounded by the window, and memoised per ledger length', () => {
    for (let i = 1; i < EV.length; i++) expect(EV[i].at).toBeGreaterThanOrEqual(EV[i - 1].at);
    expect(EV[0].at).toBeGreaterThanOrEqual(T0); expect(EV.at(-1).at).toBeLessThanOrEqual(T1);
    expect(buildEvents().EV).toBe(EV);
  });
  it('captures every item exactly once and never lets an item skip capture', () => {
    const seen = new Set();
    for (const e of EV) { if (!e.item) continue; if (e.type === 'captured') { expect(seen.has(e.item)).toBe(false); seen.add(e.item); } else expect(seen.has(e.item), `${e.type} before capture for ${e.item}`).toBe(true); }
    for (const it of items) expect(seen.has(it.id)).toBe(true);
  });
  it('tags every AI write with an ai: actor and every human write with jeff', () => {
    for (const e of EV) {
      if (['clarified', 'delivered', 'job_started'].includes(e.type)) expect(e.actor.startsWith('ai:')).toBe(true);
      if (['accepted', 'done', 'nudged', 'approved', 'handed_off', 'review_completed'].includes(e.type)) expect(e.actor).toBe('jeff');
    }
  });
  it('holds a weekly review every Friday afternoon and keeps the Flow volumes', () => {
    const reviews = EV.filter(e => e.type === 'review_completed');
    expect(reviews.length).toBeGreaterThanOrEqual(6);
    for (const r of reviews) expect(new Date(r.at).getDay()).toBe(5);
    expect(weeks().map(w => w.c)).toEqual([31, 27, 35, 24, 40, 29, 33, 38]);
  });
});

describe('replay fold', () => {
  it('starts empty and ends with the ledger', () => {
    expect(fold(EV, T0 - DAY).items.size).toBe(0);
    const end = fold(EV, T1), stage = (id) => end.items.get(id)?.stage;
    for (const it of items) {
      if (it.kind === 'inbox') expect(['inbox', 'gate']).toContain(stage(it.id));
      if (it.kind === 'waiting') expect(stage(it.id)).toBe('waiting');
      if (it.kind === 'done') expect(stage(it.id)).toBe('done');
      if (it.kind === 'someday') expect(stage(it.id)).toBe('someday');
      if (it.owner === 'ai' && it.del) expect(['delegated', 'ready']).toContain(stage(it.id));
    }
    expect(end.items.get('A1').text).toBe('Confirm dry-run window with Priya');
  });
  it('derives last movement from events; puts P3 on the board only after it is created', () => {
    const end = fold(EV, T1);
    expect((T1 - end.projects.get('J6').lastMove) / DAY).toBeGreaterThan(7);
    expect(fold(EV, T0 + 3 * DAY).programs.has('P3')).toBe(false); expect(fold(EV, T0 + 10 * DAY).programs.has('P3')).toBe(true);
  });
  it('is monotonic in reviews and wiki words; wikiByProgram sums program pages only', () => {
    let prevR = 0, prevW = 0;
    for (let t = T0; t <= T1; t += 3 * DAY) { const S = fold(EV, t); let w = 0; for (const v of S.wiki.values()) w += v; expect(S.reviews).toBeGreaterThanOrEqual(prevR); expect(w).toBeGreaterThanOrEqual(prevW); prevR = S.reviews; prevW = w; }
    const end = fold(EV, T1), byProg = wikiByProgram(end, PAGES);
    expect(byProg.size).toBe(3); for (const g of end.programs.keys()) expect(byProg.get(g)).toBeGreaterThan(0);
  });
  it('isCharged is on from hand-off until approval or take-back; describe names every type', () => {
    const end = fold(EV, T1);
    for (const it of end.items.values()) { const types = it.hist.map(h => h.type), lastHand = types.lastIndexOf('handed_off'), lastBack = Math.max(types.lastIndexOf('approved'), types.lastIndexOf('taken_back'), types.lastIndexOf('done')); expect(isCharged(it)).toBe(lastHand >= 0 && lastHand > lastBack); }
    expect([...end.items.values()].filter(isCharged).length).toBeGreaterThan(0);
    expect(describeEvent(EV.find(e => e.type === 'accepted'))).toMatch(/Accepted as/);
  });
});
