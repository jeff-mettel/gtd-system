// In-process scheduler. config.json → { schedule: { clarify:'*/15m', 'ingest-calendar':'1h', review:'fri 15:00' } }
// Specs: `Nm` / `*/Nm` every N minutes · `Nh` / `*/Nh` every N hours · `<dow> HH:MM` weekly (mon…sun) ·
// `daily HH:MM` · `off`. Ticks every 30 s; interval jobs run when their period has elapsed since the
// last start, clock jobs run once in the matching minute.
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Parse one spec → { kind:'every', ms } | { kind:'at', dow|null, h, m } | null (off/invalid). */
export function parseSpec(spec) {
  if (spec == null) return null;
  const s = String(spec).trim().toLowerCase();
  if (!s || s === 'off' || s === 'never') return null;
  let m = s.match(/^(?:\*\/)?(\d+)\s*([mh])$/);
  if (m) { const n = +m[1]; if (!n) return null; return { kind: 'every', ms: n * (m[2] === 'm' ? 60e3 : 3600e3) }; }
  m = s.match(/^(sun|mon|tue|wed|thu|fri|sat|daily)\s+(\d{1,2}):(\d{2})$/);
  if (m) { const h = +m[2], mm = +m[3]; if (h > 23 || mm > 59) return null; return { kind: 'at', dow: m[1] === 'daily' ? null : DOW.indexOf(m[1]), h, m: mm }; }
  return null;
}

/** Given the parsed spec, the last start time (ms or null) and now (Date): should it fire? */
export function due(parsed, last, now) {
  if (!parsed) return false;
  if (parsed.kind === 'every') return last == null || now.getTime() - last >= parsed.ms;
  if (parsed.kind === 'at') {
    if (parsed.dow != null && now.getDay() !== parsed.dow) return false;
    if (now.getHours() !== parsed.h || now.getMinutes() !== parsed.m) return false;
    return last == null || now.getTime() - last > 90e3;   // once per matching minute
  }
  return false;
}

export class Scheduler {
  constructor({ schedule = {}, start, log = console, tickMs = 30e3 }) {
    this.entries = Object.entries(schedule).map(([job, spec]) => ({ job, spec, parsed: parseSpec(spec), last: null }));
    for (const e of this.entries) if (e.spec && !e.parsed && !/^(off|never)$/i.test(String(e.spec))) log.warn(`[gtd] schedule: cannot parse "${e.spec}" for ${e.job}; ignored`);
    this.start = start; this.log = log; this.tickMs = tickMs; this.timer = null;
  }
  tick(now = new Date()) {
    for (const e of this.entries) {
      if (!due(e.parsed, e.last, now)) continue;
      e.last = now.getTime();
      try { const r = this.start(e.job, {}, { by: 'schedule' }); if (r) this.log.log(`[gtd] schedule → ${e.job} (${e.spec})`); }
      catch (err) { this.log.warn(`[gtd] schedule: ${e.job} not started: ${err.message}`); }
    }
  }
  run() {
    // interval jobs start one period after boot rather than immediately (a restart must not re-run everything)
    const t0 = Date.now(); for (const e of this.entries) if (e.parsed?.kind === 'every') e.last = t0;
    this.timer = setInterval(() => this.tick(), this.tickMs); this.timer.unref?.();
    return this;
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  describe() { return this.entries.map(e => ({ job: e.job, spec: e.spec, active: !!e.parsed, last: e.last ? new Date(e.last).toISOString() : null })); }
}
