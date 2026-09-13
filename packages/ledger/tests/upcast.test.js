import { describe, it, expect } from 'vitest';
import { upcast, LedgerTooNew, fold, LEDGER_VERSION } from '../index.js';
import { MIGRATIONS } from '../migrations/index.js';

const e1 = { seq: 1, id: 'e1', v: 1, at: '2026-09-14T08:00:00.000Z', actor: 'jeff', type: 'review_completed', payload: {} };

describe('upcast', () => {
  it('returns the same array when every event is current', () => {
    const evs = [e1]; expect(upcast(evs)).toBe(evs);
  });
  it('ships v1 = the v0 → v1 identity stamp, and runs it on events without a version', () => {
    expect(MIGRATIONS.map(m => m.to)).toEqual([1]);
    const v0 = { ...e1, v: undefined }; delete v0.v;
    const out = upcast([v0, e1]);
    expect(out).not.toBe([v0, e1]); expect(out[0].v).toBe(1); expect(out[1]).toBe(e1);
    expect(v0.v).toBeUndefined();                                                   // input untouched
    expect(fold([v0]).reviews).toBe(1);                                             // fold upcasts first
  });
  it('runs a fake upcaster chain in order (v1 → v2 renames a field, v2 → v3 splits an event)', () => {
    const migrations = [...MIGRATIONS,
      { to: 2, up: (e) => e.type === 'nudged' ? { ...e, v: 2, payload: { body: e.payload.text } } : { ...e, v: 2 } },
      { to: 3, up: (e) => e.type === 'nudged' ? [{ ...e, v: 3 }, { ...e, v: 3, type: 'edited', payload: { fields: { lastNudge: e.payload.body } } }] : { ...e, v: 3 } },
    ];
    const old = { seq: 2, id: 'e2', v: 1, at: e1.at, actor: 'jeff', type: 'nudged', item: 'i1', payload: { text: 'hi' } };
    const out = upcast([e1, old], { migrations, version: 3 });
    expect(out.map(e => e.v)).toEqual([3, 3, 3]);
    expect(out[1].payload).toEqual({ body: 'hi' }); expect(out[2].type).toBe('edited');
    const dropped = upcast([e1], { migrations: [...MIGRATIONS, { to: 2, up: () => null }], version: 2 });
    expect(dropped).toEqual([]);
  });
  it('refuses a ledger newer than it understands, and a gap in the chain', () => {
    expect(() => upcast([{ ...e1, v: LEDGER_VERSION + 1 }])).toThrow(LedgerTooNew);
    expect(() => upcast([{ ...e1, v: 1 }], { migrations: [...MIGRATIONS, { to: 3, up: (e) => e }], version: 3 })).toThrow(/no upcaster/);
  });
});
