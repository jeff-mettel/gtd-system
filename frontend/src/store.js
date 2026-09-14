// The store: every entity the views read is a live binding over `fold(ledger.events)`; every mutation is
// `commit(type, payload, { item, actor })` — validated, appended through the backend, refolded, rendered.
//
// Backends. `server` when window.__GTD_SERVER__ is set or the page is served by the server (GET /api/health answers
// JSON { ok:true }): GET /api/events?since= to load, POST /api/events to write (optimistic: the event is applied
// locally at once and reconciled with the server's seq/at when the reply lands; the client's id is kept), then
// GET /api/stream (server-sent events) for everything other writers — the CLI, jobs — append, with a 60 s poll only
// while the stream is down. The last fold's events are cached under localStorage `gtd-cache-v1` so the next open
// paints at once and fetches only what is newer. `local` otherwise: the event array under localStorage
// `gtd-ledger-v1`, seeded with demoEvents() on first run (or with ?demo=1) — that is what keeps the published
// artifact working.
//
// Transactions and undo. A click handler runs inside withTx(); commits inside it do not render (the handler
// renders once), and when it ends the toast grows an Undo that commits the compensating events in reverse.

import { fold, validate, newId, demoEvents, LEDGER_VERSION, LedgerTooNew, defaultProposal } from '@gtd/ledger';
import { TODAY, clock, setToday } from './lib/dates.js';
import { isDeferred } from './features/defer.js';
import * as fixtures from './data/constants.js';
import { prefs, savePrefs } from './prefs.js';

export const LEDGER_KEY = 'gtd-ledger-v1';
export const CACHE_KEY = 'gtd-cache-v1';
export const CACHE_MAX = 4e6;        // serialized characters; above this the cache is skipped, not truncated
export const POLL_FALLBACK_MS = 60e3;

/* Demo background volume (packages/ledger/demo.js) is replay-only: it never reaches the lists. */
const isBackground = (i) => typeof i.ref === 'string' && i.ref.startsWith('demo:bg/');

/* ---------- live bindings ---------- */
export let S = fold([]);
export let items = S.items, projects = S.projects, programs = S.programs, people = S.people, wiki = S.wiki, config = S.config, runs = S.runs, deliverables = S.deliverables;
/* Calendar: from the latest calendar_synced when there is one, else the fixture constants (demo mode). */
export let meetings = fixtures.meetings, calendarAhead = fixtures.calendarAhead, pastMeetings = fixtures.pastMeetings, calendarLive = false;
/* `stream`: 'live' (SSE open) | 'polling' (SSE down, 60 s poll) | 'off' (local mode). `online` goes false when the server stops
   answering. `lastSync` is the last moment the server was heard from. `cached` says the first paint came from the fold cache. */
export const ledger = { mode: 'local', events: [], seq: 0, v: LEDGER_VERSION, dataDir: null, serverUrl: '', demo: false, pending: 0, error: null, tooNew: null, stub: false, stream: 'off', online: true, lastSync: null, cached: false, lastJob: null };

let backend = null, tx = null, depth = 0, renderFn = null, undoFn = null, pollTimer = null, navTimer = null;

export const lastReview = () => S.lastReview;

/** Rebuild every binding from the events. */
export function refold() {
  try { S = fold(ledger.events, { today: TODAY }); ledger.tooNew = null; }
  catch (err) { if (err instanceof LedgerTooNew) { ledger.tooNew = err.message; S = fold([]); } else throw err; }
  items = S.items.filter(i => !isBackground(i)); projects = S.projects; programs = S.programs; people = S.people; wiki = S.wiki; config = S.config; runs = S.runs; deliverables = S.deliverables;
  calendarLive = !!S.calendar; const fx = ledger.demo ? fixtures : { meetings: [], calendarAhead: [], pastMeetings: [] };
  meetings = S.calendar ? (S.meetings ?? []) : fx.meetings; calendarAhead = S.calendar ? (S.calendarAhead ?? []) : fx.calendarAhead; pastMeetings = S.calendar ? (S.pastMeetings ?? []) : fx.pastMeetings;
  ledger.seq = S.seq;
  for (const it of items) if (it.kind === 'inbox' && !it.p) it.p = defaultProposal(it);
  if (ledger.mode === 'server') scheduleCacheWrite();
}

/* ---------- fold cache (server mode): { events, seq, dataDir } so the next open paints before the network answers ---------- */
let cacheTimer = null;
function scheduleCacheWrite() { if (typeof localStorage === 'undefined') return; clearTimeout(cacheTimer); cacheTimer = setTimeout(writeCache, 400); }
export function writeCache() {
  if (typeof localStorage === 'undefined' || ledger.mode !== 'server') return false;
  try {
    const s = JSON.stringify({ events: ledger.events, seq: ledger.seq, dataDir: ledger.dataDir, v: LEDGER_VERSION });
    if (s.length > CACHE_MAX) { localStorage.removeItem(CACHE_KEY); return false; }
    localStorage.setItem(CACHE_KEY, s); return true;
  } catch (e) { return false; }
}
/** The cached fold for this data folder, or null (missing, another data folder, or unreadable). */
export function readCache(dataDir) {
  if (typeof localStorage === 'undefined') return null;
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && Array.isArray(c.events) && c.events.length && c.dataDir === dataDir ? c : null; } catch (e) { return null; }
}
export function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }

/* ---------- rendering (lazy, to avoid the import cycle with app.js) ---------- */
export function setRenderer(fn) { renderFn = fn; }
export function setUndoOffer(fn) { undoFn = fn; }
async function render() { if (!renderFn) { try { renderFn = (await import('./app.js')).render; } catch (e) { return; } } renderFn(); }
/* The footer and health strip only (sync status, AI status): cheaper than a full render, and it never disturbs a form in progress. */
async function renderNav() { if (typeof document === 'undefined') return; try { (await import('./ui/nav.js')).renderNav(); } catch (e) { /* not mounted */ } }
const heard = () => { ledger.lastSync = new Date(); ledger.online = true; };

/* ---------- commit ---------- */
const plain = (v) => JSON.parse(JSON.stringify(v ?? {}));          // Dates → ISO strings, undefined dropped

export class LedgerError extends Error { constructor(errors) { super(errors.join('; ')); this.name = 'LedgerError'; this.errors = errors; } }

/**
 * Append one event. Validates against the current fold; throws LedgerError when rejected. Returns the event.
 * `captured` with a `ref` already in the ledger is a no-op that returns the existing capture event.
 */
/* Server mode only: ask the server to run a Claude job (clarify, nudge, prep, suggest, review, compile, ingest-calendar).
   The job writes its own events through the gtd CLI; the poll picks them up. Local mode has no jobs — callers simulate. */
export async function runJob(job, args = {}) {
  if (ledger.mode !== 'server') return null;
  const r = await fetch(ledger.serverUrl + '/api/jobs/' + job, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ args }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || j.errors?.join('; ') || `server said ${r.status}`);
  return j.run;
}
export const activeRuns = () => (S.runs || []).filter(r => r.status === 'running' || r.status === 'queued');
export const isServer = () => ledger.mode === 'server';

export function commit(type, payload = {}, { item, actor = 'jeff', at } = {}) {
  if (type === 'captured' && payload.ref) { const dup = ledger.events.find(e => e.type === 'captured' && e.payload?.ref === payload.ref); if (dup) return dup; }
  const e = { seq: ledger.seq + 1, id: newId('e'), v: LEDGER_VERSION, at: at || clock(), actor, type, payload: plain(payload) };
  if (item) e.item = item;
  const r = validate(e, S);
  if (!r.ok) throw new LedgerError(r.errors);
  const before = tx ? snapshot(e) : null;
  ledger.events.push(e); refold();
  if (tx) tx.steps.push({ e, before, after: snapshot(e) });
  backend?.append(e);
  if (!tx && depth === 0) render();
  return e;
}

/** Run `fn` as one undoable step: no renders inside, one Undo offer after. Errors are reported, not thrown. */
export function withTx(fn, { undoable = true } = {}) {
  if (tx) return fn();
  tx = { steps: [] }; depth++;
  try { return fn(); }
  catch (err) { console.error(err); notify(err instanceof LedgerError ? `Ledger rejected that: ${err.errors[0]}` : `Something went wrong: ${err.message}`); }
  finally { const t = tx; tx = null; depth--; if (undoable && t.steps.length && undoFn) undoFn(() => undo(t)); }
}

let notifyFn = null; export function setNotifier(fn) { notifyFn = fn; }
const notify = (msg) => { if (notifyFn) notifyFn(msg); else console.warn(msg); };

/* ---------- undo: compensating events ---------- */
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const getPath = (o, key) => { const [h, ...r] = key.split('.'); return o?.[h]?.[r.join('.')]; };
function snapshot(e) {
  const p = e.payload;
  if (e.item) return clone(items.find(i => i.id === e.item)) ?? null;
  if (e.type.startsWith('project_')) return clone(projects.find(j => j.id === (p.id || p.project?.id))) ?? null;
  if (e.type.startsWith('program_')) return clone(programs.find(g => g.id === (p.id || p.program?.id))) ?? null;
  if (e.type === 'config_set') return { value: clone(getPath(config, p.key)) ?? null };
  return null;
}
const SKIP = new Set(['confirmedBy', 'prevKind', 'resurfacedFor', 'p']);
function itemDiff(before, after) {
  const fields = {}; let n = 0;
  for (const k of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) { if (SKIP.has(k) || k === 'id') continue; if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) { fields[k] = before?.[k] ?? null; n++; } }
  return n ? fields : null;
}
function compensation({ e, before, after }) {
  const p = e.payload, item = e.item;
  switch (e.type) {
    case 'captured': return { type: 'trashed', payload: {}, item };
    case 'done': return { type: 'undone', payload: {}, item };
    case 'undone': return { type: 'done', payload: {}, item };
    case 'approved': return { type: 'undone', payload: {}, item };
    case 'trashed': case 'dropped': return before?.kind === 'inbox' ? { type: 'restored', payload: {}, item } : { type: 'edited', payload: { fields: itemDiff(before, after) || {} }, item };
    case 'restored': return { type: 'trashed', payload: {}, item };
    case 'handed_off': return { type: 'taken_back', payload: {}, item };
    case 'project_created': return { type: 'project_updated', payload: { id: p.project.id, fields: { dropped: true } } };
    case 'project_updated': return before ? { type: 'project_updated', payload: { id: p.id, fields: Object.fromEntries(Object.keys(p.fields || {}).map(k => [k, before[k] ?? null])) } } : null;
    case 'program_created': return { type: 'program_retired', payload: { id: p.program.id } };
    case 'program_retired': return { type: 'program_updated', payload: { id: p.id, fields: { retired: null } } };
    case 'program_updated': return before ? { type: 'program_updated', payload: { id: p.id, fields: Object.fromEntries(Object.keys(p.fields || {}).map(k => [k, before[k] ?? null])) } } : null;
    case 'next_action_set': { const prev = (projects.find(j => j.id === p.project) || programs.find(g => g.id === p.project)); return prev && before?.primary ? { type: 'next_action_set', payload: { project: p.project }, item: before.primary } : null; }
    case 'config_set': return { type: 'config_set', payload: { key: p.key, value: before?.value ?? null } };
    case 'review_completed': case 'milestone_added': case 'decision_recorded': case 'wiki_changed': case 'job_started': case 'job_finished': case 'job_failed': case 'migrated': case 'person_created': case 'person_updated': return null;
    default: { if (!item) return null; const fields = itemDiff(before, after); return fields ? { type: 'edited', payload: { fields }, item } : null; }
  }
}
function undo(t) {
  withTx(() => { for (const step of [...t.steps].reverse()) { const c = compensation(step); if (c) commit(c.type, c.payload, { item: c.item }); } }, { undoable: false });
  render();
}

/* ---------- ticklers: what is due today becomes an event ---------- */
const ymd = (x) => { const t = new Date(x); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
/** Resurface every someday/reference tickler whose revisit day has come and every deferred action whose start day has. Idempotent. */
export function tick() {
  const due = [];
  for (const it of items) {
    if ((it.kind === 'someday' || it.kind === 'reference') && it.revisit && new Date(it.revisit) <= TODAY) { const key = ymd(it.revisit); if (!it.resurfacedFor?.includes(key)) due.push([it.id, key]); }
    if (it.kind === 'action' && it.owner !== 'ai' && it.start && !isDeferred(it) && !it.resurfacedFor?.includes(ymd(it.start))) due.push([it.id, ymd(it.start)]);
  }
  if (!due.length) return false;
  depth++; try { for (const [id, key] of due) commit('resurfaced', { for: key }, { item: id, actor: 'system' }); } catch (e) { console.error(e); } finally { depth--; }
  return true;
}

/* ---------- backends ---------- */
function memoryBackend(seed = null) { return { mode: 'local', exists: seed != null, load: async () => seed || [], append() {}, replace() {}, backup: async () => ({ ok: false, note: 'In-memory ledger: nothing to back up.' }) }; }

function localBackend() {
  const read = () => { try { const s = localStorage.getItem(LEDGER_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const write = (events) => { try { localStorage.setItem(LEDGER_KEY, JSON.stringify({ v: LEDGER_VERSION, events })); ledger.error = null; } catch (e) { ledger.error = 'This browser refused to save the ledger (storage full or blocked). Export it from Settings → Data.'; notify(ledger.error); } };
  const stored = read();
  return { mode: 'local', exists: !!(stored?.events?.length), load: async () => stored?.events || [], append: () => write(ledger.events), replace: (evs) => write(evs), backup: async () => ({ ok: false, note: 'Local mode keeps the ledger in this browser. Use Export JSON to take a copy; the server backs up to the data folder.' }) };
}

/**
 * Apply events another writer appended (from the stream or a poll), in seq order. Ones already present (our own
 * optimistic appends come back with the same id) are ignored; a gap in seq means something was missed, so the caller
 * reloads from `since`. Returns { applied, gap }.
 */
export function applyRemote(incoming) {
  const list = [...incoming].sort((a, b) => a.seq - b.seq);
  const have = new Set(ledger.events.map(e => e.id));
  let applied = 0, gap = false;
  for (const e of list) {
    if (have.has(e.id)) { const mine = ledger.events.find(x => x.id === e.id); if (mine && mine.seq !== e.seq) mine.seq = e.seq; ledger.serverSeq = Math.max(ledger.serverSeq ?? 0, e.seq); continue; }
    const expected = (ledger.serverSeq ?? 0) + 1;
    if (e.seq > expected + ledger.pending) { gap = true; break; }
    ledger.events.push(e); have.add(e.id); applied++; ledger.serverSeq = Math.max(ledger.serverSeq ?? 0, e.seq);
  }
  if (applied) { ledger.events.sort((a, b) => a.seq - b.seq); refold(); }
  return { applied, gap };
}

function serverBackend(base, health) {
  const url = (p) => base + p;
  const q = []; let busy = false, es = null, renderTimer = null;
  const get = async (p) => { const r = await fetch(url(p), { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`server said ${r.status}`); const j = await r.json(); heard(); return j; };
  const post = async (e) => {
    const r = await fetch(url('/api/events'), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id: e.id, type: e.type, payload: e.payload, item: e.item, actor: e.actor }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new LedgerError(j.errors || [`server said ${r.status}`]);
    heard(); return j;
  };
  const flush = async () => {
    if (busy || !q.length) return; busy = true; const e = q[0];
    try { const j = await post(e); Object.assign(e, j.event); q.shift(); ledger.pending = q.length; if (typeof j.seq === 'number') ledger.serverSeq = j.seq; }
    catch (err) { q.shift(); ledger.pending = q.length; ledger.error = err.message; if (err instanceof LedgerError) notify(`Server rejected "${e.type}": ${err.message} — reloading from the server`); else { ledger.online = false; notify(`Could not reach the server: ${err.message}`); } await reload().catch(() => {}); }
    finally { busy = false; if (q.length) flush(); else if (ledger.events.some((x, i) => i && x.seq < ledger.events[i - 1].seq)) { ledger.events.sort((a, b) => a.seq - b.seq); refold(); } }
  };
  /* Coalesce a burst of stream events into one render. */
  const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { tick(); render(); }, 40); };
  const reload = async () => { const j = await get('/api/events?since=0'); ledger.events = j.events || []; ledger.serverSeq = j.seq; refold(); render(); };
  /* Fetch what is newer than the last confirmed seq (a gap on the stream, a poll, the reconcile after a cached paint). */
  const catchUp = async () => {
    if (busy || q.length) return;
    try {
      const since = ledger.serverSeq ?? 0;
      const j = await get(`/api/events?since=${since}`);
      if (typeof j.seq === 'number' && j.seq < since) return reload();                       // the log shrank: replaced
      const evs = j.events || [];
      if (evs.length && evs[0].seq !== since + 1) return reload();                         // not a continuation of what we hold
      const { applied, gap } = applyRemote(evs);
      if (typeof j.seq === 'number') ledger.serverSeq = j.seq;
      if (gap) return reload();
      if (applied) renderSoon(); else renderNav();
    } catch (e) { ledger.online = false; renderNav(); }
  };
  const stopPoll = () => { if (pollTimer) clearInterval(pollTimer); pollTimer = null; };
  const startPoll = () => { if (pollTimer) return; pollTimer = setInterval(catchUp, POLL_FALLBACK_MS); };
  const subscribe = () => {
    if (typeof EventSource === 'undefined') { ledger.stream = 'polling'; startPoll(); return; }
    es = new EventSource(url('/api/stream'));
    es.addEventListener('hello', (ev) => {
      ledger.stream = 'live'; heard(); stopPoll();
      let h = null; try { h = JSON.parse(ev.data); } catch (e) {}
      if (h && typeof h.seq === 'number' && h.seq !== (ledger.serverSeq ?? 0)) catchUp(); else renderNav();
    });
    es.addEventListener('append', (ev) => {
      let e = null; try { e = JSON.parse(ev.data); } catch (x) { return; }
      heard();
      const { applied, gap } = applyRemote([e]);
      if (gap) catchUp(); else if (applied) renderSoon(); else renderNav();
    });
    es.addEventListener('job', (ev) => { try { ledger.lastJob = JSON.parse(ev.data); } catch (e) {} heard(); renderNav(); });
    es.addEventListener('reset', () => reload().catch(() => {}));
    es.onerror = () => { if (ledger.stream !== 'polling') { ledger.stream = 'polling'; startPoll(); renderNav(); } };   // EventSource reconnects by itself (retry: 2000)
  };
  return {
    mode: 'server', exists: true, health,
    load: async () => { const j = await get('/api/events?since=0'); ledger.serverSeq = j.seq; return j.events || []; },
    append: (e) => { q.push(e); ledger.pending = q.length; flush(); },
    replace: () => { throw new Error('Replacing the ledger is a server-side operation'); },
    backup: async () => (await fetch(url('/api/backup'), { method: 'POST', headers: { accept: 'application/json' } })).json(),
    poll: catchUp, reload, subscribe, catchUp,
    close: () => { if (es) es.close(); es = null; stopPoll(); ledger.stream = 'off'; },
  };
}

async function pickBackend() {
  if (typeof window === 'undefined') return memoryBackend();
  const forced = window.__GTD_SERVER__;
  const base = typeof forced === 'string' ? forced.replace(/\/$/, '') : '';
  if (forced || location.protocol.startsWith('http')) {
    try {
      const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000), headers: { accept: 'application/json' } });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const h = await r.json(); if (h?.ok) return serverBackend(base, h); }
    } catch (e) { /* no server: local */ }
  }
  return typeof localStorage === 'undefined' ? memoryBackend() : localBackend();
}

/* ---------- load / reset / import ---------- */
export async function load({ seed } = {}) {
  backend?.close?.();
  backend = seed ? memoryBackend(seed) : await pickBackend();      // an explicit seed (tests) is authoritative, even when empty
  ledger.mode = backend.mode; ledger.serverUrl = backend.mode === 'server' ? (typeof window !== 'undefined' && typeof window.__GTD_SERVER__ === 'string' ? window.__GTD_SERVER__ : location.origin) : '';
  ledger.dataDir = backend.health?.dataDir || null; ledger.stub = !!backend.health?.stub; ledger.demo = false; ledger.cached = false;
  ledger.stream = 'off'; ledger.online = true; ledger.lastSync = backend.mode === 'server' ? new Date() : null;
  const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';
  if (pollTimer) clearInterval(pollTimer); pollTimer = null;
  if (navTimer) clearInterval(navTimer); navTimer = null;
  if (backend.mode === 'server') {
    setToday(false);
    /* Live mode is for working, not learning: the instruction cards start folded to their one-line form. */
    if (!prefs.guidesInit) { prefs.guidesInit = true; for (const v of ['now', 'inbox', 'programs', 'waiting', 'delegated', 'someday', 'reference', 'people', 'review', 'flow', 'settings']) prefs.guides[v] = true; savePrefs(); }
    /* Instant paint: fold the cached events first, then fetch only what is newer and reconcile. */
    const cache = readCache(ledger.dataDir);
    if (cache) {
      ledger.events = cache.events; ledger.serverSeq = cache.seq; ledger.cached = true; refold();
      await render();
      await backend.catchUp();
      if (ledger.online === false) ledger.stream = 'polling';
    } else {
      ledger.events = await backend.load(); refold();
    }
    tick();
    ledger.stream = 'polling';                                             // until the stream's hello lands (or its error starts the 60 s poll)
    backend.subscribe();
    navTimer = setInterval(renderNav, 30e3); navTimer.unref?.();          // "Synced · 2 min ago" keeps counting
    return S;
  }
  let events = await backend.load();
  if (backend.mode === 'local' && (demo || !backend.exists)) { events = demoEvents(); backend.replace(events); ledger.demo = true; }
  else if (backend.mode === 'local' && events.some(e => e.id?.startsWith('e_demo'))) ledger.demo = true;
  setToday(ledger.demo);                                                 // demo anchor vs. the real date, before the first fold
  ledger.events = events; refold(); tick();
  return S;
}

/** Local mode: throw the browser ledger away and reseed the demo (or start empty). */
export function resetLocal({ demo = true } = {}) {
  if (backend?.mode !== 'local') return false;
  ledger.events = demo ? demoEvents() : []; ledger.demo = demo; setToday(demo); backend.replace(ledger.events); refold(); tick(); render(); return true;
}

/** Validate a candidate event array (an import) against a running fold. Returns { ok, errors:[[index, msgs]], count, v }. */
export function checkImport(events) {
  if (!Array.isArray(events)) return { ok: false, errors: [[0, ['expected a JSON array of events (or { events: [...] })']]], count: 0 };
  const errors = []; const prefix = [];
  for (let i = 0; i < events.length; i++) { const r = validate(events[i], fold(prefix, { today: TODAY })); if (!r.ok) errors.push([i, r.errors]); prefix.push(events[i]); if (errors.length > 20) break; }
  return { ok: errors.length === 0, errors, count: events.length, v: Math.max(0, ...events.map(e => e.v ?? 0)) };
}

/** Import: `replace` (local only) swaps the ledger; otherwise appends (re-sequenced, re-stamped ids kept). */
export async function importEvents(events, { replace = false } = {}) {
  if (replace) { if (backend.mode !== 'local') throw new Error('Replace is only available in local mode'); ledger.events = events.map((e, i) => ({ ...e, seq: i + 1 })); ledger.demo = false; backend.replace(ledger.events); refold(); tick(); render(); return events.length; }
  let n = 0;
  depth++;
  try { for (const e of events) { commit(e.type, e.payload, { item: e.item, actor: e.actor, at: e.at }); n++; } }
  finally { depth--; }
  render(); return n;
}

export const backup = () => backend.backup();
export const exportJSON = () => JSON.stringify({ v: LEDGER_VERSION, exportedAt: new Date().toISOString(), events: ledger.events }, null, 1);
