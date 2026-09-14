// The data folder (`GTD_DATA`, default ~/GTD-data): create, validate, read config. Shared by the
// server and `gtd init`, so both agree on the layout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const DEFAULT_CONFIG = {
  ledgerVersion: 1,
  schedule: { clarify: '*/15m', 'ingest-calendar': '1h', review: 'fri 15:00' },
  calendar: { source: 'macos', calendars: [] },
};

export function dataDir() {
  const d = process.env.GTD_DATA || path.join(os.homedir(), 'GTD-data');
  return path.resolve(d.replace(/^~(?=$|\/)/, os.homedir()));
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
export function ensureDataDir(dir = dataDir()) {
  const created = [];
  const mk = (p, content) => { const full = path.join(dir, p); if (fs.existsSync(full)) return; if (content == null) fs.mkdirSync(full, { recursive: true }); else { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); } created.push(p); };
  mk('ledger', null); mk('ledger/events.jsonl', ''); mk('wiki', null); mk('wiki/index.md', WIKI_INDEX); mk('wiki/log.md', WIKI_LOG);
  mk('attachments', null); mk('attachments/.gitkeep', ''); mk('runs', null);
  mk('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  if (!fs.existsSync(path.join(dir, '.git'))) {
    try { execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' }); created.push('.git'); } catch (err) { console.warn(`[gtd] git init failed in ${dir}: ${err.message}`); }
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

/** Validation summary for `gtd init` / health. */
export function inspectDataDir(dir = dataDir()) {
  const need = ['ledger/events.jsonl', 'wiki/index.md', 'wiki/log.md', 'attachments', 'config.json'];
  const missing = need.filter(p => !fs.existsSync(path.join(dir, p)));
  const isRepo = fs.existsSync(path.join(dir, '.git'));
  let lines = 0;
  try { const txt = fs.readFileSync(path.join(dir, 'ledger/events.jsonl'), 'utf8'); lines = txt.split('\n').filter(Boolean).length; } catch {}
  return { dir, missing, isRepo, events: lines };
}
