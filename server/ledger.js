// Resolves the ledger package. Import target is `../packages/ledger/index.js` (built in parallel);
// until that file exists we fall back to the local stand-in in `./_stub_ledger/`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const real = path.join(here, '..', 'packages', 'ledger', 'index.js');
export const LEDGER_SOURCE = existsSync(real) ? 'packages/ledger' : 'server/_stub_ledger';
const mod = await import(LEDGER_SOURCE === 'packages/ledger' ? real : path.join(here, '_stub_ledger', 'index.js'));

export const fold = mod.fold;
export const validate = mod.validate;
export const upcast = mod.upcast;
export const newId = mod.newId;
export const demoEvents = mod.demoEvents;
export const LEDGER_VERSION = mod.LEDGER_VERSION ?? 1;
