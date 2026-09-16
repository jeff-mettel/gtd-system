#!/usr/bin/env node
// The local service: JSON API over the ledger + static front-end + job runner + scheduler.
// Env: SNOW_DATA (default ~/Snowball), PORT (default 4310). No dependencies beyond node:*.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { dataDir, ensureDataDir, readConfig, assertLedgerVersion } from './datadir.js';
import { Store, serialize } from './store.js';
import { JobRunner, JOBS, APP_ROOT } from './jobs.js';
import { Scheduler } from './schedule.js';
import { LEDGER_VERSION, LEDGER_SOURCE } from './ledger.js';

const execFileP = promisify(execFile);
export const VERSION = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'server', 'package.json'), 'utf8')).version;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.map': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

/** Build the app (store, runner, scheduler, http server) without listening. Tests call this with a temp SNOW_DATA. */
export function createApp({ dir = dataDir(), port = Number(process.env.PORT) || 4310, log = console, schedule = true } = {}) {
  const { created } = ensureDataDir(dir, { log });
  if (created.length) log.log(`[snow] data folder ${dir}: created ${created.join(', ')}`);
  const config = readConfig(dir);
  assertLedgerVersion(config, LEDGER_VERSION);
  const store = new Store(dir).load();
  const runner = new JobRunner({ store, dataDir: dir, config, port, log });
  const scheduler = new Scheduler({ schedule: schedule ? config.schedule : {}, start: (j, a, o) => runner.start(j, a, o), targets: (j, now) => runner.targets(j, now), log });
  const dist = path.join(APP_ROOT, 'frontend', 'dist');

  /* GET /api/stream — server-sent events: `append` (every ledger event, in seq order), `job` (run status changes),
     `reset` (the log was replaced; reload), `: ping` every 25 s. `hello` carries seq + dataDir so a client can reconcile. */
  const clients = new Set();
  const broadcast = (event, data) => { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(msg); };
  store.onAppend(e => broadcast('append', e));
  runner.onChange(r => broadcast('job', publicRun(r)));
  const ping = setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25e3); ping.unref?.();
  function stream(req, res) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no', 'access-control-allow-origin': '*' });
    res.write(`retry: 2000\n\n`);
    res.write(`event: hello\ndata: ${JSON.stringify({ seq: store.seq, dataDir: dir, version: VERSION })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  const send = (res, code, body, headers = {}) => { const s = JSON.stringify(body); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s), 'access-control-allow-origin': '*', ...headers }); res.end(s); };
  const readBody = (req) => new Promise((resolve, reject) => { let b = ''; req.on('data', d => { b += d; if (b.length > 64e6) reject(Object.assign(new Error('body too large'), { status: 413 })); }); req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); } }); req.on('error', reject); });

  const routes = [
    ['GET', /^\/api\/health$/, () => ({ ok: true, version: VERSION, ledgerVersion: LEDGER_VERSION, ledgerSource: LEDGER_SOURCE, seq: store.seq, dataDir: dir, mode: 'server', schedule: scheduler.describe() })],
    ['GET', /^\/api\/state$/, () => serialize(store.S)],
    ['GET', /^\/api\/events$/, (req, url) => ({ events: store.since(Number(url.searchParams.get('since') || 0)), seq: store.seq })],
    ['GET', /^\/api\/export$/, () => store.events],
    ['GET', /^\/api\/jobs$/, () => ({ jobs: Object.fromEntries(Object.entries(JOBS).map(([k, v]) => [k, { what: v.what, agent: v.agent, tier: runner.tier(k) }])), ...runner.list() })],
    ['POST', /^\/api\/events$/, async (req) => {
      const body = await readBody(req);
      const hdr = req.headers['x-snow-actor'] || req.headers['x-gtd-actor'];   // x-gtd-actor: pre-0.2 CLI, accepted for one release
      let actor = body.actor || 'jeff';
      if (hdr) { if (!/^(ai:[\w-]+|ingest:[\w-]+|system)$/.test(hdr)) throw Object.assign(new Error(`X-Snow-Actor must be ai:<job>, ingest:<source> or system; got ${hdr}`), { status: 400 }); actor = hdr; }
      else if (/^(ai:|ingest:)/.test(actor)) throw Object.assign(new Error('ai:/ingest: actors must be set with the X-Snow-Actor header (the snow CLI does this)'), { status: 400 });
      // A client may send its own event id (the front-end's optimistic append) so it recognises the event when it comes back on the stream.
      const id = typeof body.id === 'string' && /^e_[\w-]{4,40}$/.test(body.id) && !store.events.some(e => e.id === body.id) ? body.id : undefined;
      const r = await store.append({ type: body.type, payload: body.payload, item: body.item, actor, at: body.at, id });
      return r.existing ? { existing: true, item: r.existing, seq: r.seq } : { event: r.event, seq: r.seq };
    }],
    ['POST', /^\/api\/backup$/, async () => {
      const git = (...a) => execFileP('git', a, { cwd: dir });
      await git('add', '-A');
      let committed = false, pushed = false, error = null;
      try { await git('commit', '-q', '-m', `backup ${new Date().toISOString()}`); committed = true; } catch (err) { if (!/nothing to commit/.test(err.stdout + err.stderr)) throw err; }
      try { const { stdout } = await git('remote'); if (stdout.trim()) { await git('push', '-q'); pushed = true; } } catch (err) { error = `push failed: ${(err.stderr || err.message).trim()}`; log.warn(`[snow] backup: ${error}`); }
      return { ok: true, committed, pushed, error };
    }],
    ['POST', /^\/api\/import$/, async (req) => {
      const body = await readBody(req);
      if (!Array.isArray(body.events)) throw Object.assign(new Error('events must be an array'), { status: 400 });
      if (body.mode === 'replace') { const r = await store.replaceAll(body.events); broadcast('reset', { seq: store.seq }); return { ok: true, mode: 'replace', ...r }; }
      if (body.mode === 'append' || !body.mode) return { ok: true, mode: 'append', ...(await store.appendMany(body.events)), seq: store.seq };
      throw Object.assign(new Error('mode must be append or replace'), { status: 400 });
    }],
    ['POST', /^\/api\/jobs\/([\w-]+)$/, async (req, url, m) => { const body = await readBody(req); return { run: publicRun(runner.start(m[1], body.args || {}, { by: req.headers['x-snow-actor'] || 'jeff' })) }; }],
  ];

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-snow-actor, x-gtd-actor', 'access-control-allow-methods': 'GET, POST, OPTIONS' }); return res.end(); }
    if (req.method === 'GET' && url.pathname === '/api/stream') return stream(req, res);
    for (const [method, re, fn] of routes) {
      const m = url.pathname.match(re); if (!m || req.method !== method) continue;
      try { return send(res, 200, await fn(req, url, m)); }
      catch (err) { const code = err.status || 500; if (code === 500) log.error(err); return send(res, code, err.errors ? { errors: err.errors } : { error: err.message }); }
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: `no route ${req.method} ${url.pathname}` });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
    return serveStatic(url.pathname, res);
  }

  function serveStatic(p, res) {
    if (!fs.existsSync(path.join(dist, 'index.html'))) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><meta charset="utf-8"><title>Snowball server</title><body style="font:15px/1.5 system-ui;padding:2em;max-width:44em"><h1>Snowball server is running</h1><p><code>frontend/dist</code> is missing, so there is nothing to show yet. Build it with <code>npm run build</code> (from <code>${APP_ROOT}</code>) and reload.</p><p>API: <a href="/api/health">/api/health</a> · <a href="/api/state">/api/state</a> · <a href="/api/jobs">/api/jobs</a></p>`); }
    let file = path.normalize(path.join(dist, decodeURIComponent(p)));
    if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');   // SPA fallback
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer((req, res) => { handle(req, res).catch(err => { log.error(err); try { send(res, 500, { error: err.message }); } catch {} }); });
  return { server, store, runner, scheduler, config, dir, port, listen: () => new Promise(r => server.listen(port, '127.0.0.1', () => { if (schedule) scheduler.run(); r(server); })), close: () => { scheduler.stop(); clearInterval(ping); for (const c of clients) c.end(); clients.clear(); return new Promise(r => server.close(r)); } };
}
function publicRun(r) { const { run, job, args, status, queuedAt, by, log } = r; return { run, job, args, status, queuedAt, by, log }; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

async function main() {
  try {
    const app = createApp();
    await app.listen();
    console.log(`[snow] v${VERSION} · ledger v${LEDGER_VERSION} (${LEDGER_SOURCE}) · data ${app.dir} · seq ${app.store.seq}\n[snow] http://localhost:${app.port}`);
    const stop = async () => { console.log('[snow] stopping'); await app.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  } catch (err) { console.error(`[snow] refusing to start: ${err.message}`); process.exit(1); }
}
