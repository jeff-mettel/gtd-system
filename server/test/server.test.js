// End-to-end tests over a temp SNOW_DATA: endpoints, actor rules, idempotent capture, job runner
// (claude mocked), scheduler parsing. Run: `npm test` in server/ (node --test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../index.js';
import { parseSpec, due, Scheduler } from '../schedule.js';
import { prepTargets, nudgeTargets } from '../jobs.js';
import { matchAttendees } from '../calendar-macos.js';
import { migrateLegacyDataDir, envVar } from '../datadir.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-test-'));
const port = 4700 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
let app;
const j = async (method, p, body, headers = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
const post = (p, body, headers) => j('POST', p, body, headers);
const SNOW = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'snow');
// Async on purpose: the server runs in this process, so a blocking spawnSync would deadlock on the fetch.
const cli = (args, env = {}) => new Promise((resolve) => {
  const e = Object.fromEntries(Object.entries({ ...process.env, SNOW_SERVER: base, SNOW_ACTOR: undefined, SNOW_RUN: undefined, GTD_ACTOR: undefined, GTD_RUN: undefined, GTD_SERVER: undefined, ...env }).filter(([, v]) => v !== undefined));
  execFile(process.execPath, [SNOW, ...args], { encoding: 'utf8', env: e }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout ? safe(stdout) : null, err: stderr ? safe(stderr) : null }));
});
const safe = (s) => { try { return JSON.parse(s); } catch { return s; } };

before(async () => { app = createApp({ dir: tmp, port, log: { log() {}, warn() {}, error: console.error }, schedule: false }); await app.listen(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('data folder is created with the documented layout', () => {
  for (const p of ['ledger/events.jsonl', 'wiki/index.md', 'wiki/log.md', 'attachments', 'config.json', '.git', '.gitignore']) assert.ok(fs.existsSync(path.join(tmp, p)), p);
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8')).ledgerVersion, 1);
});

test('health', async () => {
  const { status, body } = await j('GET', '/api/health');
  assert.equal(status, 200); assert.equal(body.ok, true); assert.equal(body.mode, 'server'); assert.equal(body.seq, 0); assert.equal(body.dataDir, tmp); assert.equal(body.ledgerVersion, 1);
});

test('rejects unknown types and unknown ids; accepts valid entities', async () => {
  assert.equal((await post('/api/events', { type: 'bogus', payload: {} })).status, 400);
  const bad = await post('/api/events', { type: 'project_created', payload: { project: { id: 'j_1', program: 'p_nope', name: 'x', outcome: 'y', health: 'good' } } });
  assert.equal(bad.status, 400); assert.match(bad.body.errors[0], /unknown program/);
  const p = await post('/api/events', { type: 'program_created', payload: { program: { id: 'p_1', name: 'Billing', purpose: 'Move billing' } } });
  assert.equal(p.status, 200); assert.equal(p.body.seq, 1); assert.equal(p.body.event.actor, 'jeff');
  assert.equal((await post('/api/events', { type: 'project_created', payload: { project: { id: 'j_1', program: 'p_1', name: 'Cutover', outcome: 'Done', health: 'good' } } })).status, 200);
  assert.equal((await post('/api/events', { type: 'person_created', payload: { person: { id: 'u_priya', name: 'Priya Natarajan', channels: { email: ['priya@example.com'] } } } })).status, 200);
});

test('captured is idempotent on ref and returns the existing item', async () => {
  const a = await post('/api/events', { type: 'captured', payload: { source: 'email', ref: 'gmail:thread/1', raw: 'hello' } });
  assert.equal(a.status, 200); assert.ok(a.body.event.item.startsWith('i_'));
  const b = await post('/api/events', { type: 'captured', payload: { source: 'email', ref: 'gmail:thread/1', raw: 'dup' } });
  assert.equal(b.status, 200); assert.equal(b.body.existing, true); assert.equal(b.body.item.id, a.body.event.item);
  assert.equal((await j('GET', '/api/health')).body.seq, a.body.seq);
});

test('ai actors need the header and may only write their types', async () => {
  const S = (await j('GET', '/api/state')).body; const item = Object.keys(S.items)[0];
  const noHdr = await post('/api/events', { type: 'clarified', item, actor: 'ai:clarify', payload: { proposal: { kind: 'action', next: 'x', conf: 0.9, why: 'y' } } });
  assert.equal(noHdr.status, 400); assert.match(noHdr.body.error, /X-Snow-Actor/);
  const acc = await post('/api/events', { type: 'accepted', item, payload: { kind: 'action', fields: {} } }, { 'x-snow-actor': 'ai:clarify' });
  assert.equal(acc.status, 400); assert.match(acc.body.errors[0], /may not write accepted/);
  const badProj = await post('/api/events', { type: 'clarified', item, payload: { proposal: { kind: 'action', next: 'x', project: 'j_zzz', conf: 0.9, why: 'y' } } }, { 'x-snow-actor': 'ai:clarify' });
  assert.equal(badProj.status, 400);
  const ok = await post('/api/events', { type: 'clarified', item, payload: { proposal: { kind: 'action', next: 'Email Priya', project: 'j_1', conf: 0.9, why: 'y' } } }, { 'x-snow-actor': 'ai:clarify' });
  assert.equal(ok.status, 200); assert.equal(ok.body.event.actor, 'ai:clarify');
  assert.equal((await j('GET', '/api/state')).body.items[item].p.next, 'Email Priya');
});

test('events?since, export, import append/replace with backup', async () => {
  const seq = (await j('GET', '/api/health')).body.seq;
  assert.equal((await j('GET', `/api/events?since=${seq - 1}`)).body.events.length, 1);
  assert.equal((await j('GET', '/api/export')).body.length, seq);
  const imp = await post('/api/import', { mode: 'append', events: [{ type: 'review_completed', payload: {} }, { type: 'nope', payload: {} }] });
  assert.equal(imp.body.written, 1); assert.equal(imp.body.rejected.length, 1);
  const all = (await j('GET', '/api/export')).body;
  const rep = await post('/api/import', { mode: 'replace', events: all });
  assert.equal(rep.status, 200); assert.match(rep.body.backup, /^events\..*\.bak\.jsonl$/);
  assert.ok(fs.existsSync(path.join(tmp, 'ledger', rep.body.backup)));
  assert.equal((await j('GET', '/api/health')).body.seq, all.length);
});

test('backup commits the data repo', async () => {
  const r = await post('/api/backup', {});
  assert.equal(r.body.ok, true); assert.equal(r.body.committed, true); assert.equal(r.body.pushed, false);
  assert.equal((await post('/api/backup', {})).body.committed, false);   // nothing new
});

test('snow CLI: health, headless writes need SNOW_ACTOR, capture/inbox/propose/guard', async () => {
  assert.equal((await cli(['health'])).out.ok, true);
  const noActor = await cli(['capture', '--source', 'chat', '--raw', 'x']);
  assert.equal(noActor.code, 4); assert.match(noActor.err.error, /SNOW_ACTOR/);
  const cap = await cli(['capture', '--source', 'chat', '--ref', 'chat:1', '--raw', 'Send the deck to Priya', '--minutes', '15'], { SNOW_ACTOR: 'ingest:chat' });
  assert.equal(cap.code, 0); const item = cap.out.item;
  assert.equal((await cli(['capture', '--source', 'chat', '--ref', 'chat:1', '--raw', 'dup'], { SNOW_ACTOR: 'ingest:chat' })).out.existing, true);
  assert.ok((await cli(['inbox'])).out.some(i => i.id === item));
  const snap = (await cli(['snapshot'])).out; assert.ok(snap.projects.j_1); assert.ok(snap.people.u_priya);
  const prop = await cli(['propose-clarify', '--item', item, '--json', JSON.stringify({ kind: 'action', next: 'Email Priya the deck', project: 'j_1', ctx: '@quick', min: 5, conf: 0.9, why: 'direct ask' })], { SNOW_ACTOR: 'ai:clarify' });
  assert.equal(prop.code, 0, JSON.stringify(prop.err));
  assert.ok(!(await cli(['inbox'])).out.some(i => i.id === item));
  assert.equal((await cli(['guard', '--tool', 'mcp__gmail__send_message', '--item', item], { SNOW_ACTOR: 'ai:nudge' })).code, 2);
  await post('/api/events', { type: 'accepted', item, payload: { kind: 'action', fields: { next: 'Email Priya the deck', project: 'j_1' } } });
  await post('/api/events', { type: 'handed_off', item, payload: { cap: 'draft', what: 'Draft it', effect: 'none' } });
  const d = await cli(['draft', '--kind', 'nudge', '--for', item, '--json', '{"text":"hi"}'], { SNOW_ACTOR: 'ai:nudge' });
  assert.equal(d.code, 0, JSON.stringify(d.err));
  assert.equal((await j('GET', '/api/state')).body.items[item].del.status, 'ready');
  await post('/api/events', { type: 'approved', item, payload: { effect: 'sends the draft' } });
  const g = await cli(['guard', '--tool', 'mcp__gmail__send_message', '--item', item], { SNOW_ACTOR: 'ai:nudge' });
  assert.equal(g.code, 0); assert.equal(g.out.allowed, true);
  const pa = await cli(['propose-action', '--project', 'j_1', '--json', '{"next":"Book the room","conf":0.8,"why":"nothing scheduled"}'], { SNOW_ACTOR: 'ai:suggest', SNOW_RUN: 'r_t' });
  assert.equal(pa.code, 0, JSON.stringify(pa.err));
  assert.equal((await j('GET', '/api/state')).body.items[pa.out.item].p.project, 'j_1');
  const ex = (await cli(['export'])).out; assert.ok(Array.isArray(ex) && ex.length > 5);
});

test('legacy ~/GTD-data is renamed to ~/Snowball once; never when both exist or the folder is explicit', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-home-'));
  const quiet = { log() {}, warn() {} };
  const legacy = path.join(home, 'GTD-data'), target = path.join(home, 'Snowball');
  assert.equal(migrateLegacyDataDir(target, { home, log: quiet }).reason, 'no legacy folder');
  fs.mkdirSync(path.join(legacy, 'ledger'), { recursive: true }); fs.writeFileSync(path.join(legacy, 'ledger', 'events.jsonl'), '{"x":1}\n');
  assert.equal(migrateLegacyDataDir(path.join(home, 'elsewhere'), { home, log: quiet }).reason, 'not the default folder');   // explicit SNOW_DATA: untouched
  assert.ok(fs.existsSync(legacy));
  const logged = []; const r = migrateLegacyDataDir(target, { home, log: { log: (m) => logged.push(m), warn() {} } });
  assert.equal(r.moved, true); assert.ok(!fs.existsSync(legacy)); assert.equal(fs.readFileSync(path.join(target, 'ledger', 'events.jsonl'), 'utf8'), '{"x":1}\n');
  assert.match(logged[0], /moved .*GTD-data → .*Snowball/);
  fs.mkdirSync(legacy); fs.writeFileSync(path.join(legacy, 'stray'), '');
  assert.equal(migrateLegacyDataDir(target, { home, log: quiet }).reason, 'both exist'); assert.ok(fs.existsSync(path.join(legacy, 'stray')));   // both present: hands off
  fs.rmSync(home, { recursive: true, force: true });
});

test('GTD_* env names still work as fallbacks for SNOW_*', () => {
  const saved = { ...process.env };
  delete process.env.SNOW_DATA; process.env.GTD_DATA = '/tmp/legacy-env';
  const warn = console.warn; const warned = []; console.warn = (m) => warned.push(m);
  try { assert.equal(envVar('DATA'), '/tmp/legacy-env'); process.env.SNOW_DATA = '/tmp/new-env'; assert.equal(envVar('DATA'), '/tmp/new-env'); }
  finally { console.warn = warn; process.env = saved; }
  assert.match(warned[0], /GTD_DATA is deprecated/);
});

test('snow init creates and validates a data dir without the server', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-init-'));
  const r = await cli(['init'], { SNOW_DATA: d });
  assert.equal(r.code, 0); assert.equal(r.out.ok, true); assert.ok(r.out.created.includes('config.json'));
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ ledgerVersion: 99 }));
  assert.equal((await cli(['init'], { SNOW_DATA: d })).code, 5);
  assert.throws(() => createApp({ dir: d, port: port + 1, log: { log() {}, warn() {} }, schedule: false }), /newer than this build/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('job runner: unknown job 404, missing args 400, mocked claude run writes job_started/finished, local provider falls back', async () => {
  assert.equal((await post('/api/jobs/bogus', {})).status, 404);
  assert.equal((await post('/api/jobs/nudge', { args: {} })).status, 400);
  await post('/api/events', { type: 'config_set', payload: { key: 'models.review', value: { provider: 'local', model: 'qwen3-14b' } } });
  const t = app.runner.tier('review'); assert.equal(t.alias, 'opus'); assert.match(t.note, /local/);
  const calls = [];
  app.runner.spawnClaude = async (args, env) => { calls.push({ args, env }); return { code: 0, stdout: JSON.stringify({ type: 'result', is_error: false, result: 'review drafted' }), stderr: '' }; };
  const r = await post('/api/jobs/review', { args: {} });
  assert.equal(r.status, 200); assert.ok(['queued', 'running'].includes(r.body.run.status));
  await new Promise(res => { const t0 = Date.now(); (function poll() { const done = app.runner.recent.find(x => x.run === r.body.run.run); if (done || Date.now() - t0 > 5000) return res(); setTimeout(poll, 20); })(); });
  const run = app.runner.recent.find(x => x.run === r.body.run.run);
  assert.equal(run.status, 'finished'); assert.equal(run.summary, 'review drafted');
  assert.equal(calls[0].env.SNOW_ACTOR, 'ai:review'); assert.equal(calls[0].env.SNOW_SERVER, `http://localhost:${port}`);
  assert.deepEqual(calls[0].args.slice(0, 4), ['-p', '/snow-review', '--model', 'opus']);
  assert.ok(calls[0].args.includes('Bash(snow *)'));
  const ev = (await j('GET', '/api/export')).body.filter(e => e.payload?.run === run.run).map(e => e.type);
  assert.deepEqual(ev, ['job_started', 'job_finished']);
  assert.ok(fs.existsSync(run.log));
  app.runner.spawnClaude = async () => ({ code: 0, stdout: JSON.stringify({ result: 'CALENDAR_CONNECTOR_UNAVAILABLE' }), stderr: '' });
  app.runner.config.calendar.source = 'connector';
  const r2 = await post('/api/jobs/ingest-calendar', {});
  await new Promise(res => { const t0 = Date.now(); (function poll() { if (app.runner.recent.find(x => x.run === r2.body.run.run) || Date.now() - t0 > 5000) return res(); setTimeout(poll, 20); })(); });
  const run2 = app.runner.recent.find(x => x.run === r2.body.run.run);
  assert.equal(run2.status, 'failed'); assert.match(run2.error, /calendar\.source/);
  const jobs = (await j('GET', '/api/jobs')).body; assert.ok(jobs.jobs.clarify); assert.equal(jobs.recent[0].run, run2.run);
});

test('calendar_synced folds into meetings / calendarAhead / pastMeetings with attendee matching', async () => {
  const now = Date.now(), iso = (ms) => new Date(ms).toISOString();
  const people = (await j('GET', '/api/state')).body.people;
  const mk = (id, start, attendees) => ({ id, title: id, start: iso(start), end: iso(start + 36e5), attendees, who: matchAttendees(attendees, people), calendar: 'Work' });
  const events = [mk('past', now - 2 * 864e5, [{ name: 'Priya Natarajan', email: 'PRIYA@example.com' }]), mk('today', now + 60e3, [{ name: 'Nobody', email: 'x@y' }]), mk('ahead', now + 3 * 864e5, [{ name: 'Priya Natarajan', email: null }])];
  const r = await post('/api/events', { type: 'calendar_synced', payload: { window: { from: iso(now - 7 * 864e5), to: iso(now + 14 * 864e5) }, events, source: 'macos' } }, { 'x-snow-actor': 'ingest:calendar' });
  assert.equal(r.status, 200);
  const S = (await j('GET', '/api/state')).body;
  assert.deepEqual(S.pastMeetings.map(m => m.id), ['past']); assert.deepEqual(S.pastMeetings[0].who, ['u_priya']);
  assert.deepEqual(S.calendarAhead.map(m => m.id), ['ahead']); assert.deepEqual(S.calendarAhead[0].who, ['u_priya']);
  assert.ok(S.meetings.some(m => m.id === 'today'));
});

test('schedule specs', () => {
  assert.deepEqual(parseSpec('*/15m'), { kind: 'every', ms: 15 * 60e3 });
  assert.deepEqual(parseSpec('1h'), { kind: 'every', ms: 3600e3 });
  assert.deepEqual(parseSpec('fri 15:00'), { kind: 'at', dow: 5, h: 15, m: 0 });
  assert.equal(parseSpec('off'), null); assert.equal(parseSpec('weird'), null);
  const fri = new Date(2026, 8, 18, 15, 0, 10);   // Fri 18 Sep 2026
  assert.equal(due(parseSpec('fri 15:00'), null, fri), true);
  assert.equal(due(parseSpec('fri 15:00'), fri.getTime() - 30e3, fri), false);
  assert.equal(due(parseSpec('fri 15:00'), null, new Date(2026, 8, 17, 15, 0)), false);
  assert.equal(due(parseSpec('15m'), Date.now() - 16 * 60e3, new Date()), true);
  const started = []; const s = new Scheduler({ schedule: { clarify: '15m', review: 'fri 15:00', x: 'bad' }, start: (job) => started.push(job), log: { warn() {}, log() {} } });
  s.tick(fri); assert.deepEqual(started.sort(), ['clarify', 'review']);
  s.tick(new Date(fri.getTime() + 20e3)); assert.equal(started.length, 2);
});

test('GET /api/stream: hello, then every append and job status change as SSE', async () => {
  const ac = new AbortController();
  const r = await fetch(base + '/api/stream', { signal: ac.signal });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/event-stream/);
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  const readUntil = async (re) => { const t0 = Date.now(); while (!re.test(buf) && Date.now() - t0 < 4000) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value); } return buf; };
  await readUntil(/event: hello/);
  assert.match(buf, /^retry: 2000/); assert.match(buf, /event: hello\ndata: \{"seq":\d+,"dataDir":/);
  await post('/api/events', { type: 'review_completed', payload: {} });
  await readUntil(/event: append/);
  const line = buf.split('\n').find(l => l.startsWith('data:') && l.includes('review_completed'));
  assert.ok(line, 'append event carries the JSON event'); const ev = JSON.parse(line.slice(5)); assert.equal(ev.type, 'review_completed'); assert.equal(ev.seq, (await j('GET', '/api/health')).body.seq);
  app.runner.spawnClaude = async () => ({ code: 0, stdout: JSON.stringify({ result: 'ok' }), stderr: '' });
  await post('/api/jobs/review', { args: {} });
  await readUntil(/"status":"finished"/);
  assert.match(buf, /event: job\ndata: \{"run":"r_[^"]+","job":"review".*"status":"queued"/);
  assert.match(buf, /"status":"running"/); assert.match(buf, /"status":"finished"/);
  ac.abort();
});

test('ahead of need: prep and nudge targets, once per target, autonomy gate, done.json', async () => {
  const now = new Date(), iso = (ms) => new Date(ms).toISOString();
  assert.deepEqual(prepTargets({ calendar: { events: [{ id: 'soon', start: iso(now.getTime() + 20 * 60e3) }, { id: 'later', start: iso(now.getTime() + 60 * 60e3) }, { id: 'gone', start: iso(now.getTime() - 5 * 60e3) }, { id: 'allday', start: iso(now.getTime() + 10 * 60e3), allDay: true }] } }, now), [{ meeting: 'soon' }]);
  assert.deepEqual(prepTargets({ calendar: null }, now), []);
  // a waiting-for whose follow-up passed a minute ago, one owed by nobody (skipped), one still ahead
  const cap = async (raw) => (await post('/api/events', { type: 'captured', payload: { source: 'chat', raw } })).body.event.item;
  const w1 = await cap('Priya: send the numbers'), w2 = await cap('nobody owes this'), w3 = await cap('Priya: later');
  await post('/api/events', { type: 'accepted', item: w1, payload: { kind: 'waiting', fields: { next: 'Numbers from Priya', owner: 'u_priya', followUp: iso(now.getTime() - 60e3) } } });
  await post('/api/events', { type: 'accepted', item: w2, payload: { kind: 'waiting', fields: { next: 'No owner', followUp: iso(now.getTime() - 60e3) } } });
  await post('/api/events', { type: 'accepted', item: w3, payload: { kind: 'waiting', fields: { next: 'Later', owner: 'u_priya', followUp: iso(now.getTime() + 3600e3) } } });
  const S1 = app.store.S;
  assert.deepEqual(nudgeTargets(S1, now, 0), [{ item: w1 }]);
  assert.deepEqual(nudgeTargets(S1, now, now.getTime() - 30e3), []);   // passed before the last check
  // the scheduler's derived tick: one nudge run for w1, handed off as system first so the draft lands in the Ready lane
  const started = [];
  app.runner.spawnClaude = async (args) => { started.push(args[1]); return { code: 0, stdout: JSON.stringify({ result: 'nudge drafted' }), stderr: '' }; };
  app.runner.state.nudgeCheckedAt = null;
  const sch = new Scheduler({ schedule: { nudge: '30m', prep: '5m' }, start: (jb, a, o) => app.runner.start(jb, a, o), targets: (jb, n) => app.runner.targets(jb, n), log: { log() {}, warn() {} } });
  sch.tick(now);
  await new Promise(res => { const t0 = Date.now(); (function poll() { if ((app.runner.recent.some(x => x.job === 'nudge') && !app.runner.current && !app.runner.queue.length) || Date.now() - t0 > 5000) return res(); setTimeout(poll, 20); })(); });
  assert.deepEqual(started.sort(), [`/snow-nudge ${w1}`, '/snow-prep today']);   // 'today' starts in 60 s (calendar test above)
  const done = JSON.parse(fs.readFileSync(path.join(tmp, 'runs', 'done.json'), 'utf8'));
  assert.ok(done.done[`nudge:${w1}`]); assert.ok(done.done['prep:today']); assert.ok(done.nudgeCheckedAt);
  const it = (await j('GET', '/api/state')).body.items[w1]; assert.equal(it.owner, 'ai'); assert.ok(it.del);
  // once per target: a second tick with the check time rewound does not run it again
  app.runner.state.nudgeCheckedAt = null; sch.entries.forEach(e => { e.last = null; });
  sch.tick(new Date(now.getTime() + 31 * 60e3)); assert.equal(app.runner.queue.length, 0); assert.equal(app.runner.current, null);
  // autonomy.draft = never gates both
  await post('/api/events', { type: 'config_set', payload: { key: 'autonomy.draft', value: 'never' } });
  assert.equal(app.runner.start('prep', { meeting: 'm_x' }, { by: 'schedule' }), null);
  await post('/api/events', { type: 'config_set', payload: { key: 'autonomy.draft', value: 'draft' } });
  assert.ok(app.runner.start('prep', { meeting: 'm_x' }, { by: 'schedule' }));
  assert.equal(app.runner.start('prep', { meeting: 'm_x' }, { by: 'schedule' }), null);   // done.json remembers
  assert.ok(app.runner.start('prep', { meeting: 'm_x' }, { by: 'jeff' }));                 // an explicit ask always runs
  await new Promise(res => { const t0 = Date.now(); (function poll() { if ((!app.runner.current && !app.runner.queue.length) || Date.now() - t0 > 5000) return res(); setTimeout(poll, 20); })(); });
});

test('static: / says dist is missing when it is', async () => {
  const r = await fetch(base + '/'); const t = await r.text();
  assert.equal(r.status, 200); assert.ok(/dist/.test(t) || /<div id="app">|<script/.test(t));
});
