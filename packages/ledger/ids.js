// Ids and clocks. `newId(prefix)` is ULID-ish: 10 chars of millisecond time (Crockford base32, so ids sort by
// creation time as strings), a 2-char per-millisecond counter (monotonic inside one process), 6 random chars.
// Prefixes per the contract: i_ items, p_ programs, j_ projects, u_ people, r_ job runs, e_ events.

const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastMs = 0, counter = 0;

const enc = (n, len) => { let s = ''; for (let i = 0; i < len; i++) { s = ENC[n % 32] + s; n = Math.floor(n / 32); } return s; };

const rand = (len) => {
  let s = '';
  const c = globalThis.crypto;
  if (c?.getRandomValues) { const b = new Uint8Array(len); c.getRandomValues(b); for (let i = 0; i < len; i++) s += ENC[b[i] % 32]; return s; }
  for (let i = 0; i < len; i++) s += ENC[Math.floor(Math.random() * 32)];
  return s;
};

export function newId(prefix = 'e') {
  const ms = Date.now();
  if (ms === lastMs) counter = (counter + 1) % 1024; else { lastMs = ms; counter = 0; }
  return `${prefix}_${enc(ms, 10)}${enc(counter, 2)}${rand(6)}`;
}

/** ISO timestamp for `at`. */
export const now = () => new Date().toISOString();
