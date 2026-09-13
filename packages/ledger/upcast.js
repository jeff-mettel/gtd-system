// Upcasting: bring every event in a ledger to the version this code understands, by running the migrations in
// `migrations/` in order. Pure — returns a new array when anything changed, the same array when nothing did.
// A ledger newer than LEDGER_VERSION is refused (the app must be upgraded, never the data downgraded).

import { LEDGER_VERSION } from './schema.js';
import { MIGRATIONS } from './migrations/index.js';

export class LedgerTooNew extends Error {
  constructor(found, supported) { super(`ledger has v${found} events; this app understands up to v${supported}`); this.name = 'LedgerTooNew'; this.found = found; this.supported = supported; }
}

/**
 * @param {object[]} events   raw events, any versions ≤ `version`
 * @param {object} [opts]     { migrations = MIGRATIONS, version = LEDGER_VERSION } — overridable for tests
 * @returns {object[]}        events at `version`
 */
export function upcast(events, { migrations = MIGRATIONS, version = LEDGER_VERSION } = {}) {
  const steps = [...migrations].sort((a, b) => a.to - b.to);
  let changed = false;
  const out = [];
  for (const e of events) {
    let v = e.v == null ? 0 : e.v;
    if (v > version) throw new LedgerTooNew(v, version);
    if (v === version) { out.push(e); continue; }
    let cur = [e];
    for (const m of steps) {
      if (m.to <= v) continue;
      if (m.to > version) break;
      if (m.to !== v + 1) throw new Error(`no upcaster from v${v} to v${v + 1}`);
      const next = [];
      for (const x of cur) { const r = m.up(x); if (r == null) continue; if (Array.isArray(r)) next.push(...r); else next.push(r); }
      cur = next; v = m.to;
    }
    if (v !== version) throw new Error(`no upcaster from v${v} to v${version}`);
    changed = true;
    out.push(...cur);
  }
  return changed ? out : events;
}
