#!/usr/bin/env node
// Fill the plist template and load it as a LaunchAgent (or unload with --uninstall).
// Env honoured: SNOW_DATA, PORT. Node and claude must be reachable from the PATH baked into the plist.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dataDir, ensureDataDir } from '../datadir.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..', '..');
const LABEL = 'com.jeffmettel.snowball';
const dest = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const uid = process.getuid();
const lctl = (...a) => { try { return execFileSync('launchctl', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (err) { return err.stdout + err.stderr; } };

if (process.argv.includes('--uninstall')) {
  lctl('bootout', `gui/${uid}/${LABEL}`);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  console.log(`[snow] unloaded ${LABEL} and removed ${dest}`);
  process.exit(0);
}

const data = dataDir(); ensureDataDir(data);
const claudeDir = (() => { try { return path.dirname(execFileSync('which', ['claude'], { encoding: 'utf8' }).trim()); } catch { return null; } })();
if (!claudeDir) console.warn('[snow] warning: `claude` is not on PATH; jobs will fail until it is (the plist bakes in the current PATH)');
const PATH = [path.dirname(process.execPath), claudeDir, path.join(APP, 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean).join(':');
const xml = fs.readFileSync(path.join(here, `${LABEL}.plist`), 'utf8')
  .replace(/__NODE__/g, process.execPath).replace(/__APP__/g, APP).replace(/__DATA__/g, data)
  .replace(/__PORT__/g, process.env.PORT || '4310').replace(/__PATH__/g, PATH).replace(/__HOME__/g, os.homedir());
fs.mkdirSync(path.dirname(dest), { recursive: true });
lctl('bootout', `gui/${uid}/${LABEL}`);
fs.writeFileSync(dest, xml);
const out = lctl('bootstrap', `gui/${uid}`, dest);
console.log(`[snow] wrote ${dest}\n[snow] data ${data} · port ${process.env.PORT || 4310}\n[snow] launchctl bootstrap: ${out.trim() || 'ok'}\n[snow] logs: ${path.join(data, 'runs', 'server.log')}`);
