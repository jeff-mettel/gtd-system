// The single in-process writer. Loads events.jsonl, keeps the fold in memory, serialises appends
// through a promise queue: each event gets seq = last + 1 (and an id if missing), is validated
// against the current fold, appended as one JSON line, then folded in.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fold, validate, upcast, newId } from './ledger.js';

/** The item already captured with this `ref`, or null. Tolerates either fold shape (objects or Maps). */
export function findByRef(S, ref) {
  const items = S.items instanceof Map ? S.items : new Map(Object.entries(S.items || {}));
  if (S.refs && S.refs[ref] && items.get(S.refs[ref])) return items.get(S.refs[ref]);
  for (const it of items.values()) if (it && it.ref === ref) return it;
  return null;
}

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'ledger', 'events.jsonl');
    this.events = [];
    this.S = fold([]);
    this.queue = Promise.resolve();
    this.listeners = new Set();
  }

  /** Read the whole file and refold. Malformed lines are skipped with a warning (never edited). */
  load() {
    const txt = fs.existsSync(this.file) ? fs.readFileSync(this.file, 'utf8') : '';
    const out = [];
    let n = 0;
    for (const line of txt.split('\n')) {
      n++;
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { console.warn(`[gtd] skipping malformed line ${n} of ${this.file}`); }
    }
    this.events = upcast(out);
    this.S = fold(this.events);
    return this;
  }

  get seq() { return this.events.length ? this.events[this.events.length - 1].seq : 0; }

  since(seq) { return this.events.filter(e => e.seq > seq); }

  onAppend(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Build the envelope from a request body; returns { event } or { errors }. */
  envelope({ type, payload, item, actor, at, id, v }) {
    const e = { seq: 0, id: id || newId('e'), v: v ?? 1, at: at || new Date().toISOString(), actor: actor || 'jeff', type, payload: payload ?? {} };
    if (item) e.item = item;
    return e;
  }

  /**
   * Append one event. Resolves { event, seq } or { existing } (idempotent capture) ; rejects with
   * an Error carrying `.errors` on validation failure. Serialised: two concurrent appends never
   * interleave, and the second sees the first in the fold.
   */
  append(body) {
    const run = async () => {
      const e = this.envelope(body);
      if (e.type === 'captured') {
        const ref = e.payload?.ref;
        const dup = ref ? findByRef(this.S, ref) : null;
        if (dup) return { existing: dup, seq: this.seq };
        if (!e.item) e.item = newId('i');
      }
      const v = validate(e, this.S);
      if (!v.ok) { const err = new Error('invalid event'); err.errors = v.errors; err.status = 400; throw err; }
      e.seq = this.seq + 1;
      await fsp.appendFile(this.file, JSON.stringify(e) + '\n');
      this.events.push(e);
      this.S = fold(this.events);   // incremental would be nicer; the log is small in beta and fold is pure
      for (const fn of this.listeners) { try { fn(e); } catch {} }
      return { event: e, seq: e.seq };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** Replace the whole log (after writing a .bak). Used by POST /api/import mode=replace. */
  replaceAll(events) {
    const run = async () => {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      if (fs.existsSync(this.file)) await fsp.copyFile(this.file, path.join(this.dir, 'ledger', `events.${ts}.bak.jsonl`));
      const out = []; let seq = 0;
      for (const raw of events) { const e = { ...raw }; e.seq = ++seq; e.id ||= newId('e'); e.v ??= 1; e.at ||= new Date().toISOString(); e.actor ||= 'jeff'; e.payload ??= {}; out.push(e); }
      await fsp.writeFile(this.file, out.map(e => JSON.stringify(e)).join('\n') + (out.length ? '\n' : ''));
      this.events = upcast(out); this.S = fold(this.events);
      return { seq: this.seq, backup: `events.${ts}.bak.jsonl` };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** Append many (import mode=append). Envelope fields on the input are kept except seq. Invalid ones are reported, not written. */
  async appendMany(events) {
    const written = [], rejected = [];
    for (const raw of events) {
      try { const r = await this.append(raw); if (r.event) written.push(r.seq); } catch (err) { rejected.push({ event: raw, errors: err.errors || [err.message] }); }
    }
    return { written: written.length, rejected };
  }
}

/** JSON-safe copy of the fold: Maps → objects, Dates → ISO strings (the stub already uses plain objects). */
/* The API view of the fold: entity collections keyed by id (the CLI and jobs address items/projects/people by id;
   the front-end folds client-side from /api/events and never reads this). Dates become ISO strings. */
export function serialize(S) {
  const byId = (a) => Array.isArray(a) ? Object.fromEntries(a.map(x => [x.id, x])) : (a || {});
  const out = { ...S, items: byId(S.items), projects: byId(S.projects), programs: byId(S.programs), people: byId(S.people), deliverables: byId(S.deliverables), runs: byId(S.runs) };
  return JSON.parse(JSON.stringify(out, (k, v) => (v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : v)));
}
