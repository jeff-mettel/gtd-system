#!/usr/bin/env node
// A stand-in for server/ while it is being built: the HTTP contract in README.md over one JSON file.
//   node packages/ledger/scripts/devserver.js [--port 8787] [--data ./ledger.json] [--demo]
// --demo seeds the file with demoEvents() when it is empty. CORS is open so `npm run dev` (Vite proxy) or a
// page with window.__SNOW_SERVER__ = 'http://localhost:8787' can talk to it.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fold, validate, newId, now, demoEvents, LEDGER_VERSION } from '../index.js';

const arg = (k, dflt) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : dflt; };
const PORT = +arg('--port', 8787), FILE = resolve(arg('--data', './ledger.json')), DEMO = process.argv.includes('--demo');

let events = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')).events || [] : [];
if (!events.length && DEMO) events = demoEvents();
const save = () => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify({ v: LEDGER_VERSION, events }, null, 0)); };
save();
let S = fold(events);
const seq = () => (events.length ? events[events.length - 1].seq : 0);

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((ok, no) => { let s = ''; req.on('data', c => s += c); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, v: LEDGER_VERSION, seq: seq(), dataDir: dirname(FILE), file: FILE, stub: true });
  if (url.pathname === '/api/state') return json(res, 200, S);
  if (url.pathname === '/api/events' && req.method === 'GET') { const since = +(url.searchParams.get('since') || 0); return json(res, 200, { events: events.filter(e => e.seq > since), seq: seq() }); }
  if (url.pathname === '/api/events' && req.method === 'POST') {
    let b; try { b = await body(req); } catch (e) { return json(res, 400, { errors: ['invalid JSON'] }); }
    if (b.type === 'captured' && b.payload?.ref) { const dup = events.find(e => e.type === 'captured' && e.payload?.ref === b.payload.ref); if (dup) return json(res, 200, { event: dup, seq: seq(), duplicate: true }); }
    const e = { seq: seq() + 1, id: newId('e'), v: LEDGER_VERSION, at: now(), actor: b.actor || 'jeff', type: b.type, payload: b.payload || {} };
    if (b.item) e.item = b.item;
    const r = validate(e, S); if (!r.ok) return json(res, 400, { errors: r.errors });
    events.push(e); save(); S = fold(events);
    return json(res, 201, { event: e, seq: e.seq });
  }
  if (url.pathname === '/api/backup' && req.method === 'POST') { const path = FILE.replace(/\.json$/, '') + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '.bak.json'; copyFileSync(FILE, path); return json(res, 200, { ok: true, path }); }
  json(res, 404, { errors: ['not found'] });
}).listen(PORT, () => console.log(`ledger devserver on http://localhost:${PORT} · ${events.length} events · ${FILE}`));
