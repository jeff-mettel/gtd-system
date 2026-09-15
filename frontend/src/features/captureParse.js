// Inline capture grammar — pure, no DOM. One line of text becomes the fields of an item:
//
//   "Fix the export @Billing fri ~20m"   → next "Fix the export", project Billing, due Friday, 20 min
//   "Chase the vendor quote !"           → hard = today (pinned)
//   "Draft agenda @Sam next week"        → owner Sam, due next Monday
//   "Should we move the launch? @Alpha"  → a question: never filed straight to a list
//
// Tokens, anywhere in the text: `@Name` (resolved by the caller's `mentions` function — features/autocomplete.js),
// `!` pins to today, `~30m` / `~1h` / `~90min` sets the estimate. The date is one trailing token — a weekday, "today",
// "tomorrow", "next week", "+3", "in 2 weeks", "eom", "20 sep", "9/20", ISO — optionally preceded by by/on/due/before.
// Ambiguous short aliases (tom, now, nw…) are not treated as dates at the end of a sentence: "Call Tom" stays a name.

import { TODAY } from '../lib/dates.js';
import { parseFuzzy } from '../lib/fuzzydate.js';

const NOT_A_DATE = new Set(['now', 'tod', 'tom', 'tmr', 'tmrw', 'nw', 'nm', 'may', 'mar']);
const LEAD = /^(by|on|due|before|until|till|for)$/i;
const QUESTION = /\?\s*$|^(who|what|when|where|why|how|should|shall|can|could|would|is|are|do|does|did|will|which)\b/i;

const noMentions = () => ({ ids: [], project: null, owner: null, spans: [] });

/** Find a trailing date token (up to three words, an optional lead word before it). Returns { date, from } or null. */
export function trailingDate(text, base = TODAY) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const cand = words.slice(-n).join(' ').replace(/[.,;:!]+$/, '');
    const low = cand.toLowerCase();
    if (n === 1 && NOT_A_DATE.has(low)) continue;
    if (n === 1 && !/^(\+|t\+|\d|[a-z]{3,})/i.test(cand)) continue;
    const date = parseFuzzy(cand, base);
    if (!date) continue;
    let from = words.length - n;
    if (from > 0 && LEAD.test(words[from - 1])) from--;
    if (from === 0) continue;                                     // the whole text is a date: not a capture
    return { date, from, token: cand };
  }
  return null;
}

/** Estimate token: ~20m, ~1h, ~1.5h, ~90min. Returns minutes or null. */
export function estimateToken(s) {
  const m = /^~(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)?$/i.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]), u = (m[2] || 'm')[0].toLowerCase();
  return Math.max(1, Math.round(u === 'h' ? n * 60 : n));
}

export function isQuestion(text) { return QUESTION.test(String(text || '').trim()); }

/**
 * parseCapture(text, { today, mentions }) →
 *   { raw, next, due, hard, min, question, mentions:{ ids, project, owner }, filed }
 * `filed` is true when the text names a project or program and is not a question — the caller files it at once.
 */
export function parseCapture(text, { today = TODAY, mentions = noMentions } = {}) {
  const raw = String(text || '').trim();
  const m = Object.assign(noMentions(), mentions(raw) || {});
  let work = raw;
  /* strip the resolved mention text; people keep their name in the sentence, projects and programs leave it */
  for (const sp of m.spans || []) work = work.replace(sp.text, sp.type === 'person' ? sp.text.slice(1) : ' ');
  let hard = null, min = null;
  const words = work.split(/\s+/).filter(Boolean), keep = [];
  for (const w of words) {
    if (w === '!') { hard = today; continue; }
    const est = estimateToken(w); if (est != null) { min = est; continue; }
    keep.push(w);
  }
  let rest = keep.join(' ');
  if (/!$/.test(rest) && !/\?!$/.test(rest)) { hard = today; rest = rest.replace(/\s*!+$/, ''); }
  let due = null;
  const td = trailingDate(rest, today);
  if (td) { due = td.date; rest = rest.split(/\s+/).slice(0, td.from).join(' '); }
  const next = rest.replace(/^(todo|remember to|remind me to)\s*/i, '').replace(/[\s,;:]+$/, '').trim() || raw;
  const question = isQuestion(raw);
  return { raw, next, due, hard, min, question, mentions: { ids: m.ids, project: m.project, owner: m.owner }, filed: !!m.project && !question };
}
