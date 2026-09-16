// The data folder (`SNOW_DATA`, default ~/Snowball): create, validate, read config. Shared by the
// server and `snow init`, so both agree on the layout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const DEFAULT_CONFIG = {
  ledgerVersion: 1,
  schedule: { clarify: '*/15m', 'ingest-calendar': '1h', review: 'fri 15:00', prep: '5m', nudge: '30m' },
  calendar: { source: 'macos', calendars: [] },
};

/** `SNOW_<name>`, else the pre-0.2 `GTD_<name>` with a one-time deprecation warning (kept for one release). */
const warned = new Set();
export function envVar(name) {
  const v = process.env[`SNOW_${name}`];
  if (v != null && v !== '') return v;
  const old = process.env[`GTD_${name}`];
  if (old != null && old !== '') {
    if (!warned.has(name)) { warned.add(name); console.warn(`[snow] GTD_${name} is deprecated; use SNOW_${name} (the old name stops working after 0.2)`); }
    return old;
  }
  return undefined;
}

export const LEGACY_DIR_NAME = 'GTD-data';   // the pre-0.2 default; moved to ~/Snowball once, see migrateLegacyDataDir()

export function dataDir() {
  const d = envVar('DATA') || path.join(os.homedir(), 'Snowball');
  return path.resolve(d.replace(/^~(?=$|\/)/, os.homedir()));
}

/**
 * One-time move of the pre-0.2 default folder: if `dir` is the default `~/Snowball`, does not exist, and
 * `~/GTD-data` does, rename it (same volume — never copy-then-delete). Both present → leave both alone and
 * use `~/Snowball`. An explicit SNOW_DATA / --data is never migrated. Returns what happened, for the log.
 */
export function migrateLegacyDataDir(dir = dataDir(), { home = os.homedir(), log = console } = {}) {
  const target = path.resolve(path.join(home, 'Snowball'));
  const legacy = path.resolve(path.join(home, LEGACY_DIR_NAME));
  if (path.resolve(dir) !== target) return { moved: false, reason: 'not the default folder' };
  if (!fs.existsSync(legacy)) return { moved: false, reason: 'no legacy folder' };
  if (fs.existsSync(target)) { log.warn(`[snow] both ${target} and ${legacy} exist; using ${target} — merge or remove ${legacy} by hand`); return { moved: false, reason: 'both exist' }; }
  fs.renameSync(legacy, target);
  log.log(`[snow] moved ${legacy} → ${target}`);
  return { moved: true, from: legacy, to: target };
}

const WIKI_INDEX = `---
title: Wiki index
kind: index
---
# Wiki index

One line per page; the compile and ingest jobs keep this current.
`;
const WIKI_LOG = `---
title: Wiki log
kind: log
---
# Wiki log

Newest first. One entry per page change.
`;

/** Create the folder layout if missing; returns { dir, created:[...] }. Never overwrites. */
export function ensureDataDir(dir = dataDir(), opts = {}) {
  migrateLegacyDataDir(dir, opts);
  const created = [];
  const mk = (p, content) => { const full = path.join(dir, p); if (fs.existsSync(full)) return; if (content == null) fs.mkdirSync(full, { recursive: true }); else { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); } created.push(p); };
  mk('ledger', null); mk('ledger/events.jsonl', ''); mk('wiki', null); mk('wiki/index.md', WIKI_INDEX); mk('wiki/log.md', WIKI_LOG);
  mk('attachments', null); mk('attachments/.gitkeep', ''); mk('runs', null);
  mk('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  if (!fs.existsSync(path.join(dir, '.git'))) {
    try { execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' }); created.push('.git'); } catch (err) { console.warn(`[snow] git init failed in ${dir}: ${err.message}`); }
  }
  mk('.gitignore', 'runs/\n.DS_Store\n');
  return { dir, created };
}

export function readConfig(dir = dataDir()) {
  const f = path.join(dir, 'config.json');
  if (!fs.existsSync(f)) return { ...DEFAULT_CONFIG };
  const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { ...DEFAULT_CONFIG, ...cfg, schedule: { ...DEFAULT_CONFIG.schedule, ...(cfg.schedule || {}) }, calendar: { ...DEFAULT_CONFIG.calendar, ...(cfg.calendar || {}) } };
}

/** Throws if the data folder was written by a newer ledger than this build understands. */
export function assertLedgerVersion(cfg, understood) {
  const v = Number(cfg.ledgerVersion ?? 1);
  if (v > understood) throw new Error(`data folder ledgerVersion ${v} is newer than this build understands (${understood}); upgrade the app before starting`);
}

/** Validation summary for `snow init` / health. */
export function inspectDataDir(dir = dataDir()) {
  const need = ['ledger/events.jsonl', 'wiki/index.md', 'wiki/log.md', 'attachments', 'config.json'];
  const missing = need.filter(p => !fs.existsSync(path.join(dir, p)));
  const isRepo = fs.existsSync(path.join(dir, '.git'));
  let lines = 0;
  try { const txt = fs.readFileSync(path.join(dir, 'ledger/events.jsonl'), 'utf8'); lines = txt.split('\n').filter(Boolean).length; } catch {}
  return { dir, missing, isRepo, events: lines };
}
