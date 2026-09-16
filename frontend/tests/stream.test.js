// Server-mode reconciliation without a server: applying events that arrive on the stream, and the fold cache.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { demoEvents, newId } from '@snowball/ledger';
import * as store from '../src/store.js';
import { applyRemote, commit, ledger, load, readCache, writeCache, CACHE_KEY, CACHE_MAX } from '../src/store.js';

store.setNotifier(() => {});
const ev = (seq, type = 'review_completed', payload = {}) => ({ seq, id: newId('e'), v: 1, at: new Date().toISOString(), actor: 'jeff', type, payload });

describe('applyRemote — events from other writers', () => {
  beforeEach(async () => { await load({ seed: demoEvents() }); ledger.serverSeq = ledger.seq; });

  it('applies new events in seq order and refolds', () => {
    const n = ledger.seq, before = store.lastReview();
    const r = applyRemote([ev(n + 2), ev(n + 1, 'config_set', { key: 'autonomy.send', value: 'never' })]);
    expect(r).toEqual({ applied: 2, gap: false });
    expect(ledger.events.at(-1).seq).toBe(n + 2); expect(ledger.events.at(-2).seq).toBe(n + 1);
    expect(store.config.autonomy.send).toBe('never'); expect(store.lastReview()).not.toBe(before);
    expect(ledger.serverSeq).toBe(n + 2);
  });
  it('ignores events already present (our own optimistic appends come back by id)', () => {
    const mine = commit('config_set', { key: 'autonomy.send', value: 'never' });
    const n = ledger.events.length;
    const r = applyRemote([{ ...mine }]);
    expect(r).toEqual({ applied: 0, gap: false }); expect(ledger.events.length).toBe(n);
  });
  it('reports a gap instead of applying out-of-sequence events', () => {
    const n = ledger.seq;
    const r = applyRemote([ev(n + 3)]);
    expect(r).toEqual({ applied: 0, gap: true }); expect(ledger.events.length).toBe(n);
  });
});

describe('fold cache', () => {
  const mem = {};
  beforeEach(() => { globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } }; for (const k in mem) delete mem[k]; });
  afterEach(() => { delete globalThis.localStorage; });

  it('writes { events, seq, dataDir } in server mode only and reads it back for the same data folder', async () => {
    await load({ seed: demoEvents() });
    expect(writeCache()).toBe(false);                                  // local mode never caches
    ledger.mode = 'server'; ledger.dataDir = '/tmp/snow-a';
    expect(writeCache()).toBe(true);
    const c = JSON.parse(mem[CACHE_KEY]); expect(c.seq).toBe(ledger.seq); expect(c.dataDir).toBe('/tmp/snow-a'); expect(c.events.length).toBe(ledger.events.length);
    expect(readCache('/tmp/snow-a').seq).toBe(ledger.seq);
    expect(readCache('/tmp/snow-b')).toBeNull();                        // another data folder: never reuse
    ledger.mode = 'local';
  });
  it('skips the cache above the size cap', async () => {
    await load({ seed: demoEvents() });
    ledger.mode = 'server'; ledger.dataDir = '/tmp/snow-a';
    ledger.events.push(ev(ledger.seq + 1, 'review_completed', { pad: 'x'.repeat(CACHE_MAX) }));
    expect(writeCache()).toBe(false); expect(mem[CACHE_KEY]).toBeUndefined();
    ledger.mode = 'local';
  });
});
