#!/usr/bin/env node
// Copies the freshly built dmg (Tauri names it "Snowball_<version>_<arch>.dmg") to a deterministic
// name next to it, so the README can link to
// https://github.com/jeff-mettel/snowball/releases/latest/download/Snowball-macOS.dmg
// without editing per release. The release workflow uploads this copy.
// Looks in target/release/bundle/dmg and target/<triple>/release/bundle/dmg (a `tauri build --target` run);
// an explicit folder can be passed as the first argument.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STABLE_NAME = 'Snowball-macOS.dmg';
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', 'src-tauri', 'target');
const candidates = process.argv[2] ? [process.argv[2]] : [path.join(target, 'release', 'bundle', 'dmg'), ...safeList(target).map(t => path.join(target, t, 'release', 'bundle', 'dmg'))];
const dir = candidates.find(d => fs.existsSync(d) && fs.readdirSync(d).some(f => f.endsWith('.dmg') && f !== STABLE_NAME));
if (!dir) { console.error(`[desktop] no built dmg under ${target}`); process.exit(1); }
const built = fs.readdirSync(dir).filter(f => f.endsWith('.dmg') && f !== STABLE_NAME).sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
fs.copyFileSync(path.join(dir, built[0]), path.join(dir, STABLE_NAME));
console.log(`[desktop] ${path.join(dir, built[0])}\n[desktop] → ${STABLE_NAME} (${(fs.statSync(path.join(dir, STABLE_NAME)).size / 1e6).toFixed(1)} MB)`);

function safeList(d) { try { return fs.readdirSync(d).filter(n => fs.statSync(path.join(d, n)).isDirectory()); } catch { return []; } }
