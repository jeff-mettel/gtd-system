// Job registry and runner. A job is a named Claude Code skill invocation (`claude -p "/gtd-<job> …"`)
// spawned as a child process with GTD_ACTOR=ai:<job> and a narrowed tool allowlist, or — for
// `ingest-calendar` on the macOS path — a plain Node function with no model at all.
// Concurrency 1. Every run writes job_started / job_finished / job_failed and a log under <data>/runs/.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newId } from './ledger.js';
import { readCalendar, matchAttendees } from './calendar-macos.js';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Settings → Models per job stores `claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5`; `claude -p --model` takes an alias. */
export const MODEL_ALIAS = { 'claude-opus-5': 'opus', 'claude-sonnet-5': 'sonnet', 'claude-haiku-4-5': 'haiku' };
const DEFAULT_MODEL = { clarify: 'claude-haiku-4-5', suggest: 'claude-sonnet-5', nudge: 'claude-sonnet-5', prep: 'claude-opus-5', review: 'claude-opus-5', compile: 'claude-opus-5', 'ingest-calendar': 'claude-haiku-4-5' };
const DEFAULT_EFFORT = { clarify: 'low', suggest: 'medium', nudge: 'medium', prep: 'high', review: 'high', compile: 'high' };

const READ_TOOLS = ['Bash(gtd *)', 'Read(wiki/**)', 'Read(docs/**)'];
const CAL_READ = ['mcp__*__list_events', 'mcp__*__get_event', 'mcp__*__search_events', 'mcp__*__list_calendars'];

/** The registry. `prompt(args)` builds the `-p` text; `tools` is the allowlist; `writes` says which paths the job may edit. */
export const JOBS = {
  clarify: { agent: 'gtd-clarify', what: 'Propose a clarification for every inbox item without one', prompt: () => '/gtd-clarify', tools: READ_TOOLS },
  suggest: { agent: 'gtd-reviewer', what: 'Propose the next physical action for a project', prompt: a => `/gtd-suggest ${need(a, 'project')}`, tools: READ_TOOLS },
  nudge: { agent: 'gtd-drafter', what: 'Draft a follow-up for a waiting-for item', prompt: a => `/gtd-nudge ${need(a, 'item')}`, tools: READ_TOOLS },
  prep: { agent: 'gtd-drafter', what: 'Assemble a prep brief for a meeting', prompt: a => `/gtd-prep ${need(a, 'meeting')}`, tools: READ_TOOLS },
  review: { agent: 'gtd-reviewer', what: 'Gather the evidence for the weekly review', prompt: () => '/gtd-review', tools: READ_TOOLS },
  compile: { agent: 'gtd-reviewer', what: 'Rewrite the compiled sections of the program wikis', prompt: a => `/gtd-compile ${a?.program || ''}`.trim(), tools: READ_TOOLS, writesWiki: true },
  'ingest-calendar': { agent: 'gtd-ingest', what: 'Sync the calendar window into the ledger', prompt: () => '/gtd-ingest-calendar', tools: [...READ_TOOLS, ...CAL_READ], native: 'calendar' },
};
function need(a, k) { if (!a || !a[k]) throw new Error(`job needs args.${k}`); return String(a[k]); }

export class JobRunner {
  constructor({ store, dataDir, config, port, log = console }) {
    Object.assign(this, { store, dataDir, config, port, log });
    this.queue = []; this.current = null; this.recent = [];
    fs.mkdirSync(path.join(dataDir, 'runs'), { recursive: true });
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
    let prompt; try { prompt = def.prompt(args); } catch (err) { throw Object.assign(err, { status: 400 }); }
    const run = { run: newId('r'), job, args, prompt, by, status: 'queued', queuedAt: new Date().toISOString(), log: path.join(this.dataDir, 'runs', '') };
    run.log = path.join(this.dataDir, 'runs', `${run.run}.log`);
    this.queue.push(run);
    this.drain();
    return run;
  }

  async drain() {
    if (this.current || !this.queue.length) return;
    const run = this.current = this.queue.shift();
    const out = fs.createWriteStream(run.log, { flags: 'a' });
    const say = (s) => { out.write(`[${new Date().toISOString()}] ${s}\n`); };
    try {
      run.status = 'running'; run.startedAt = new Date().toISOString();
      await this.store.append({ type: 'job_started', actor: 'system', payload: { job: run.job, run: run.run, args: run.args } });
      const before = this.store.seq;
      const def = JOBS[run.job];
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
      try { await this.store.append({ type: 'job_failed', actor: 'system', payload: { job: run.job, run: run.run, error: err.message } }); } catch (e2) { this.log.error(`[gtd] could not record job_failed: ${e2.message}`); }
    } finally {
      out.end();
      this.recent.unshift(run); this.recent.length = Math.min(this.recent.length, 50);
      this.current = null;
      setImmediate(() => this.drain());
    }
  }

  /** Spawn `claude -p`. Overridable (tests replace `spawnClaude`). */
  runClaude(run, def, say) {
    const t = this.tier(run.job);
    if (t.note) { say(t.note); this.log.warn(`[gtd] ${run.job}: ${t.note}`); }
    const args = ['-p', run.prompt, '--model', t.alias, '--output-format', 'json', '--permission-mode', 'default'];
    if (t.effort) args.push('--effort', t.effort);
    const tools = [...def.tools];
    if (def.writesWiki) {   // compile edits the data wiki; the path is absolute so the pattern is too
      const wiki = path.join(this.dataDir, 'wiki');
      args.push('--add-dir', wiki);
      tools.push(`Read(//${wiki}/**)`, `Edit(//${wiki}/**)`, `Write(//${wiki}/**)`);
    }
    args.push('--allowedTools', ...tools);   // variadic: keep it last so nothing is swallowed
    const env = { ...process.env, GTD_ACTOR: `ai:${run.job}`, GTD_SERVER: `http://localhost:${this.port}`, GTD_DATA: this.dataDir, GTD_RUN: run.run, PATH: `${path.join(APP_ROOT, 'bin')}:${process.env.PATH || ''}` };
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
      const child = spawn('claude', args, { cwd: APP_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
