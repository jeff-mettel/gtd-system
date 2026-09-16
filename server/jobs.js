// Job registry and runner. A job is a named Claude Code skill invocation (`claude -p "/snow-<job> …"`)
// spawned as a child process with SNOW_ACTOR=ai:<job> and a narrowed tool allowlist, or — for
// `ingest-calendar` on the macOS path — a plain Node function with no model at all.
// Concurrency 1. Every run writes job_started / job_finished / job_failed and a log under <data>/runs/.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { newId } from './ledger.js';
import { readCalendar, matchAttendees } from './calendar-macos.js';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where `claude` is. PATH first (`claude` as spawned), then the usual installs — the desktop app is launched
 *  by Finder with a minimal PATH, so the fallbacks matter there. Resolved per spawn so a later install is picked up. */
export function claudeBin(env = process.env) {
  const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) { const f = path.join(d, 'claude'); if (isExec(f)) return 'claude'; }
  for (const f of [path.join(os.homedir(), '.local', 'bin', 'claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude']) if (isExec(f)) return f;
  return 'claude';   // let spawn fail with the "is it on PATH?" message
}
function isExec(f) { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } }

/** Settings → Models per job stores `claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5`; `claude -p --model` takes an alias. */
export const MODEL_ALIAS = { 'claude-opus-5': 'opus', 'claude-sonnet-5': 'sonnet', 'claude-haiku-4-5': 'haiku' };
const DEFAULT_MODEL = { clarify: 'claude-haiku-4-5', suggest: 'claude-sonnet-5', nudge: 'claude-sonnet-5', prep: 'claude-opus-5', review: 'claude-opus-5', compile: 'claude-opus-5', 'ingest-calendar': 'claude-haiku-4-5' };
const DEFAULT_EFFORT = { clarify: 'low', suggest: 'medium', nudge: 'medium', prep: 'high', review: 'high', compile: 'high' };

const READ_TOOLS = ['Bash(snow *)', 'Read(wiki/**)', 'Read(docs/**)'];
const DRAFT_EFFECT = 'Nothing is sent — a draft for your review';

/* ---------- ahead-of-need helpers (prep and nudge run before you ask) ---------- */
const list = (a) => (Array.isArray(a) ? a : Object.values(a || {}));
/** Scheduled drafting respects Settings → Autonomy: `draft: never` means no unasked prep or nudge. */
const draftGate = (S) => ((S.config?.autonomy?.draft || 'draft') === 'never' ? 'autonomy.draft is "never"' : null);
/** A prep brief already delivered for this meeting: a deliverable keyed `for:{kind:'meeting',id}` or the CLI's carrier item (`ref: prep:<id>/…`). */
const prepDelivered = (S, id) => list(S.deliverables).some(d => d.for?.kind === 'meeting' && d.for.id === id) || list(S.items).some(i => typeof i.ref === 'string' && i.ref.startsWith(`prep:${id}/`) && i.del?.status !== 'taken');
/** A nudge draft already on this waiting-for (ready, approved or being worked on). */
const nudgeDelivered = (it) => !!it?.del && it.del.status !== 'taken';
export const PREP_AHEAD_MS = 40 * 60e3;
/** Meetings starting within the next 40 minutes (from the latest calendar_synced). */
export function prepTargets(S, now = new Date()) {
  const t = now.getTime(), evs = S.calendar?.events || [];
  return evs.filter(m => { const st = m.start ? new Date(m.start).getTime() : NaN; return st >= t - 60e3 && st - t <= PREP_AHEAD_MS && !m.allDay; }).map(m => ({ meeting: m.id }));
}
/** Waiting-fors whose follow-up passed in (sinceMs, now] and that have an owner to write to. */
export function nudgeTargets(S, now = new Date(), sinceMs = 0) {
  const t = now.getTime();
  return list(S.items).filter(i => i.kind === 'waiting' && i.owner && i.owner !== 'ai' && i.followUp && (() => { const f = new Date(i.followUp).getTime(); return f > sinceMs && f <= t; })()).map(i => ({ item: i.id }));
}
const CAL_READ = ['mcp__*__list_events', 'mcp__*__get_event', 'mcp__*__search_events', 'mcp__*__list_calendars'];

/** The registry. `prompt(args)` builds the `-p` text; `tools` is the allowlist; `writes` says which paths the job may edit. */
export const JOBS = {
  clarify: { agent: 'snow-clarify', what: 'Propose a clarification for every inbox item without one', prompt: () => '/snow-clarify', tools: READ_TOOLS,
    // Scheduled runs skip when there is nothing to clarify — every run is a Claude call against the subscription's quota.
    skipIf: (S) => (Array.isArray(S.items) ? S.items : Object.values(S.items || {})).some(i => !i.p && !i.aiReviewed && (i.kind === 'inbox' || ((i.kind === 'action' || i.kind === 'waiting') && i.source === 'capture'))) ? null : 'inbox has nothing to clarify' },
  suggest: { agent: 'snow-reviewer', what: 'Propose the next physical action for a project', prompt: a => `/snow-suggest ${need(a, 'project')}`, tools: READ_TOOLS },
  nudge: { agent: 'snow-drafter', what: 'Draft a follow-up for a waiting-for item', prompt: a => `/snow-nudge ${need(a, 'item')}`, tools: READ_TOOLS,
    // Ahead of need: the scheduler lists waiting-fors whose follow-up just passed; each target runs once, gated by autonomy.draft.
    target: a => `nudge:${a.item}`,
    targets: (S, now, r) => nudgeTargets(S, now, r.state.nudgeCheckedAt ? Date.parse(r.state.nudgeCheckedAt) : 0),
    skipIf: (S, a, r) => draftGate(S) || (r.isDone(`nudge:${a.item}`) ? 'already drafted once for this item' : null) || (nudgeDelivered(list(S.items).find(i => i.id === a.item)) ? 'a draft is already on the item' : null),
    // The draft lands on the item as a deliverable only if the item was handed off; a scheduled nudge hands it off as `system` first.
    before: async (S, a, r) => { const it = list(S.items).find(i => i.id === a.item); if (it && it.kind === 'waiting' && !it.del) await r.store.append({ type: 'handed_off', actor: 'system', item: it.id, payload: { cap: 'draft', what: `Draft a follow-up on "${it.next || it.raw}"`, effect: DRAFT_EFFECT, minutes: 5 } }); } },
  prep: { agent: 'snow-drafter', what: 'Assemble a prep brief for a meeting', prompt: a => `/snow-prep ${need(a, 'meeting')}`, tools: READ_TOOLS,
    target: a => `prep:${a.meeting}`,
    targets: (S, now) => prepTargets(S, now),
    skipIf: (S, a, r) => draftGate(S) || (r.isDone(`prep:${a.meeting}`) ? 'already prepared once for this meeting' : null) || (prepDelivered(S, a.meeting) ? 'a brief is already delivered for this meeting' : null) },
  review: { agent: 'snow-reviewer', what: 'Gather the evidence for the weekly review', prompt: () => '/snow-review', tools: READ_TOOLS },
  compile: { agent: 'snow-reviewer', what: 'Rewrite the compiled sections of the program wikis', prompt: a => `/snow-compile ${a?.program || ''}`.trim(), tools: READ_TOOLS, writesWiki: true },
  'ingest-calendar': { agent: 'snow-ingest', what: 'Sync the calendar window into the ledger', prompt: () => '/snow-ingest-calendar', tools: [...READ_TOOLS, ...CAL_READ], native: 'calendar' },
};
function need(a, k) { if (!a || !a[k]) throw new Error(`job needs args.${k}`); return String(a[k]); }

export class JobRunner {
  constructor({ store, dataDir, config, port, log = console }) {
    Object.assign(this, { store, dataDir, config, port, log });
    this.queue = []; this.current = null; this.recent = []; this.listeners = new Set();
    fs.mkdirSync(path.join(dataDir, 'runs'), { recursive: true });
    // <data>/runs/done.json: which ahead-of-need targets already ran (at most once per target) and when nudges were last checked.
    this.doneFile = path.join(dataDir, 'runs', 'done.json');
    this.state = { done: {}, nudgeCheckedAt: null };
    try { if (fs.existsSync(this.doneFile)) Object.assign(this.state, JSON.parse(fs.readFileSync(this.doneFile, 'utf8'))); } catch (err) { log.warn(`[snow] runs/done.json unreadable (${err.message}); starting fresh`); }
  }

  /** Status changes (queued → running → finished | failed). Used by the SSE stream. */
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(run) { for (const fn of this.listeners) { try { fn(run); } catch {} } }

  isDone(key) { return !!this.state.done[key]; }
  markDone(key) { this.state.done[key] = new Date().toISOString(); this.saveState(); }
  saveState() { try { fs.writeFileSync(this.doneFile, JSON.stringify(this.state, null, 2) + '\n'); } catch (err) { this.log.warn(`[snow] could not write runs/done.json: ${err.message}`); } }

  /** Ahead-of-need targets for a derived job (prep, nudge) at `now`, or null when the job is not derived. Nudge remembers the check time. */
  targets(job, now = new Date()) {
    const def = JOBS[job]; if (!def?.targets) return null;
    const out = def.targets(this.store.S, now, this);
    if (job === 'nudge') { this.state.nudgeCheckedAt = now.toISOString(); this.saveState(); }
    return out;
  }

  list() { return { current: this.current ? pub(this.current) : null, queued: this.queue.map(pub), recent: this.recent.map(pub) }; }

  /** Model tier for a job from the fold's config.models[job] (Settings → Models per job). */
  tier(job) {
    const cfg = (this.store.S.config?.models || {})[job] || {};
    let { provider = 'claude', model, effort } = cfg;
    let note = null;
    if (provider === 'local') { note = `provider "local" (${model}) is not supported in beta; falling back to Claude`; model = null; }
    model = model && MODEL_ALIAS[model] ? model : (DEFAULT_MODEL[job] || 'claude-sonnet-5');
    effort = /haiku/.test(model) ? null : (effort || DEFAULT_EFFORT[job] || null);
    return { model, alias: MODEL_ALIAS[model], effort, note };
  }

  /** Enqueue a run; resolves immediately with the run record. */
  start(job, args = {}, { by = 'jeff' } = {}) {
    const def = JOBS[job];
    if (!def) throw Object.assign(new Error(`unknown job: ${job}`), { status: 404 });
    if (by === 'schedule' && def.skipIf) { const why = def.skipIf(this.store.S, args, this); if (why) { this.log.log(`[snow] schedule: ${job}${def.target ? ' ' + def.target(args) : ''} skipped — ${why}`); return null; } }
    let prompt; try { prompt = def.prompt(args); } catch (err) { throw Object.assign(err, { status: 400 }); }
    const run = { run: newId('r'), job, args, prompt, by, status: 'queued', queuedAt: new Date().toISOString(), log: path.join(this.dataDir, 'runs', '') };
    run.log = path.join(this.dataDir, 'runs', `${run.run}.log`);
    if (by === 'schedule' && def.target) this.markDone(def.target(args));   // once per target, even if the run fails
    this.queue.push(run);
    this.emit(run);
    this.drain();
    return run;
  }

  async drain() {
    if (this.current || !this.queue.length) return;
    const run = this.current = this.queue.shift();
    const out = fs.createWriteStream(run.log, { flags: 'a' });
    const say = (s) => { out.write(`[${new Date().toISOString()}] ${s}\n`); };
    try {
      run.status = 'running'; run.startedAt = new Date().toISOString(); this.emit(run);
      const def = JOBS[run.job];
      if (def.before) await def.before(this.store.S, run.args, this);
      await this.store.append({ type: 'job_started', actor: 'system', item: run.args?.item, payload: { job: run.job, run: run.run, args: run.args } });
      const before = this.store.seq;
      say(`start ${run.job} ${JSON.stringify(run.args)}`);
      let summary;
      if (def.native === 'calendar' && (this.config.calendar?.source || 'macos') === 'macos') summary = await this.runCalendarNative(run, say);
      else summary = await this.runClaude(run, def, say);
      run.status = 'finished'; run.finishedAt = new Date().toISOString(); run.summary = summary;
      await this.store.append({ type: 'job_finished', actor: 'system', payload: { job: run.job, run: run.run, summary, events: this.store.seq - before } });
      say(`finished: ${summary}`);
    } catch (err) {
      run.status = 'failed'; run.finishedAt = new Date().toISOString(); run.error = err.message;
      say(`FAILED: ${err.message}`);
      try { await this.store.append({ type: 'job_failed', actor: 'system', payload: { job: run.job, run: run.run, error: err.message } }); } catch (e2) { this.log.error(`[snow] could not record job_failed: ${e2.message}`); }
    } finally {
      out.end();
      this.recent.unshift(run); this.recent.length = Math.min(this.recent.length, 50);
      this.current = null; this.emit(run);
      setImmediate(() => this.drain());
    }
  }

  /** Spawn `claude -p`. Overridable (tests replace `spawnClaude`). */
  runClaude(run, def, say) {
    const t = this.tier(run.job);
    if (t.note) { say(t.note); this.log.warn(`[snow] ${run.job}: ${t.note}`); }
    const args = ['-p', run.prompt, '--model', t.alias, '--output-format', 'json', '--permission-mode', 'default'];
    if (t.effort) args.push('--effort', t.effort);
    const tools = [...def.tools];
    if (def.writesWiki) {   // compile edits the data wiki; the path is absolute so the pattern is too
      const wiki = path.join(this.dataDir, 'wiki');
      args.push('--add-dir', wiki);
      tools.push(`Read(//${wiki}/**)`, `Edit(//${wiki}/**)`, `Write(//${wiki}/**)`);
    }
    args.push('--allowedTools', ...tools);   // variadic: keep it last so nothing is swallowed
    const env = { ...process.env, SNOW_ACTOR: `ai:${run.job}`, SNOW_SERVER: `http://localhost:${this.port}`, SNOW_DATA: this.dataDir, SNOW_RUN: run.run, PATH: `${path.join(APP_ROOT, 'bin')}:${process.env.PATH || ''}` };
    delete env.CLAUDECODE;   // allow spawning from inside a Claude session
    say(`claude ${args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}  (model ${t.model}${t.effort ? ', effort ' + t.effort : ''})`);
    return this.spawnClaude(args, env, say).then(res => {
      if (res.code !== 0) throw new Error(`claude exited ${res.code}: ${(res.stderr || res.text || '').slice(0, 400)}`);
      let json = null; try { json = JSON.parse(res.stdout); } catch {}
      const text = json?.result ?? res.stdout;
      if (json?.is_error) throw new Error(`claude reported an error: ${String(text).slice(0, 400)}`);
      if (/CALENDAR_CONNECTOR_UNAVAILABLE/.test(text)) throw new Error('the Google Calendar connector tools are not exposed to headless `claude -p` runs; set config.json → calendar.source to "macos"');
      return String(text).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 300) || 'ok';
    });
  }

  spawnClaude(args, env, say) {
    return new Promise((resolve, reject) => {
      const child = spawn(claudeBin(env), args, { cwd: APP_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; say(`stderr: ${String(d).trim()}`); });
      child.on('error', err => reject(new Error(`could not start claude: ${err.message} (is it on PATH?)`)));
      child.on('close', code => { say(`exit ${code}`); if (stdout) say(`stdout: ${stdout.slice(0, 4000)}`); resolve({ code, stdout, stderr }); });
    });
  }

  /** ingest-calendar on the macOS path: no model. Reads Calendar.app, matches attendees to People, writes one calendar_synced. */
  async runCalendarNative(run, say) {
    const cal = this.config.calendar || {};
    say(`reading macOS Calendar (calendars: ${(cal.calendars || []).join(', ') || 'all'})`);
    const { window, events } = await readCalendar({ calendars: cal.calendars || [] });
    const people = this.store.S.people || {};
    const norm = events.map(ev => ({ id: ev.id, title: ev.title, start: ev.start, end: ev.end, attendees: ev.attendees, who: matchAttendees(ev.attendees, people), calendar: ev.calendar, location: ev.location || null, allDay: !!ev.allDay }));
    await this.store.append({ type: 'calendar_synced', actor: 'ingest:calendar', payload: { window, events: norm, source: 'macos' } });
    return `${norm.length} events in ${window.from.slice(0, 10)}..${window.to.slice(0, 10)}`;
  }
}

function pub(r) { const { run, job, args, status, queuedAt, startedAt, finishedAt, summary, error, by } = r; return { run, job, args, status, queuedAt, startedAt, finishedAt, summary, error, by, log: r.log }; }
