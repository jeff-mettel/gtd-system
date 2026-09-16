#!/usr/bin/env node
// Copies the Node binary that runs this script into desktop/src-tauri/binaries/node-<target-triple>,
// where Tauri picks it up as the `node` sidecar (tauri.conf.json → bundle.externalBin).
//
// This PINS THE BUILD MACHINE'S NODE VERSION into the app: whatever `node` runs `npm run desktop:build`
// is what ships. Build with the Node you want users to have (>= 20; the server and CLI need nothing
// else). The copy is gitignored; run this before every `tauri build` (the desktop:build script does).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(here, '..', 'src-tauri', 'binaries');
const triple = process.env.TAURI_TARGET_TRIPLE || execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)[1];
const src = fs.realpathSync(process.execPath);
const out = path.join(dest, `node-${triple}`);
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(src, out);
fs.chmodSync(out, 0o755);
const mb = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`[desktop] sidecar ${out}\n[desktop] node ${process.version} from ${src} (${mb} MB) — the app pins this Node version`);
