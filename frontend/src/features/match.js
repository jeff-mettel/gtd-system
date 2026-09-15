// A small scored matcher for the command palette and inline pickers. No dependencies, no DOM.
//
// score(query, text) → a number (higher is better) or -1 for no match. Tiers, best first: exact, prefix,
// word prefix ("wait" → "Go to Waiting for"), initials ("gw" → "Go to Waiting for"), substring, then a
// subsequence with every query character in order. Shorter targets win ties inside a tier.

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9@ ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function score(query, text) {
  const q = norm(query), t = norm(text);
  if (!q) return 0;
  if (!t) return -1;
  const tie = 1 - Math.min(t.length, 200) / 1000;                  // shorter target wins inside a tier
  if (t === q) return 1000 + tie;
  if (t.startsWith(q)) return 800 + tie;
  const words = t.split(' ');
  if (words.some(w => w.startsWith(q))) return 700 + tie;
  /* every query word is the prefix of some target word, in order */
  const qw = q.split(' ');
  if (qw.length > 1) { let i = 0; for (const w of words) if (w.startsWith(qw[i])) { i++; if (i === qw.length) break; } if (i === qw.length) return 650 + tie; }
  if (!q.includes(' ') && q.length >= 2 && words.map(w => w[0]).join('').includes(q)) return 600 + tie;
  if (t.includes(q)) return 500 + tie;
  /* subsequence: characters in order, penalised by how spread out they are */
  let i = 0, first = -1, last = -1;
  for (let j = 0; j < t.length && i < q.length; j++) if (t[j] === q[i]) { if (first < 0) first = j; last = j; i++; }
  if (i < q.length) return -1;
  if (q.length < 2) return -1;
  return 100 + tie - Math.min(99, (last - first + 1 - q.length));
}

/** Rank `list` by `score(query, keyOf(x))`; drops non-matches. Stable for equal scores. */
export function rank(query, list, keyOf = (x) => x.label, limit = 50) {
  const out = [];
  list.forEach((x, i) => { const s = score(query, keyOf(x)); if (s >= 0) out.push({ x, s, i }); });
  out.sort((a, b) => b.s - a.s || a.i - b.i);
  return out.slice(0, limit).map(o => o.x);
}
