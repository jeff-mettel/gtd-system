// The example ledger as an EVENT LOG. Named items come from their fields in data/example.js; a
// seeded background of ordinary items gives the eight weeks realistic volume. Everything the
// Replay shows is a fold over this array — see fold.js.
import { TODAY } from '../lib/dates.js';
import { programs, projects, people, items, wiki } from '../data/example.js';
import { pname } from '../model.js';

const DAY = 864e5, H = 36e5;
const at = (dayOff, hour = 9) => TODAY.getTime() + dayOff * DAY + (hour - 8) * H;
const T0 = at(-56, 6), T1 = TODAY.getTime();
let seed = 20260914; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], between = (a, b) => a + rnd() * (b - a);
export const hubPage = (pid) => { const j = projects.find(x => x.id === pid); const g = j ? j.program : pid; return wiki[g]?.page || null; };
const pageList = () => { const out = []; for (const g of programs) if (wiki[g.id]) { out.push([wiki[g.id].page, g.id]); for (const s of ['decisions', 'timeline', 'risks']) out.push([wiki[g.id].page + '-' + s, g.id]); } for (const p of people) out.push(['person-' + p.id, p.id]); return out; };

let EV = null, ITEMS = null, REVIEWS = null, PAGES = null;
/** Build (once) the event log for the example ledger. Returns { EV, ITEMS, REVIEWS, PAGES, T0, T1 }. */
export function buildEvents() {
  if (EV) return { EV, ITEMS, REVIEWS, PAGES, T0, T1 };
  EV = []; PAGES = pageList();
  const ev = (t, actor, type, item, payload = {}) => EV.push({ at: t, actor, type, item, ...payload });
  const src = (s) => 'ingest:' + (s || 'chat');
  // programs, projects, seeded wiki, health
  for (const g of programs) { const c = g.created ? +g.created : at(-57); ev(c, 'jeff', 'program_created', null, { program: g.id, text: g.name }); if (g.retired) ev(+g.retired, 'jeff', 'program_retired', null, { program: g.id, text: g.name }); }
  for (const j of projects) { const c = j.created ? +j.created : (programs.find(g => g.id === j.program)?.created ? +programs.find(g => g.id === j.program).created : at(-57)); ev(c, 'jeff', 'project_created', null, { project: j.id, program: j.program, text: j.name }); ev(c + H, 'jeff', 'health_set', null, { project: j.id, health: j.health || 'good' }); if (j.dropped) ev(T1 - H, 'jeff', 'project_dropped', null, { project: j.id }); }
  for (const [page, owner] of PAGES) { const g = programs.find(x => x.id === owner); const c = g ? (g.created ? +g.created : at(-57)) : at(-57); const words = g ? (page === wiki[owner].page ? (c > at(-56) ? 320 : 900) : (c > at(-56) ? 90 : 300)) : 180; ev(c + 0.5 * H, c > at(-56) ? 'ai:wiki' : 'jeff', 'wiki_changed', null, { page, words, text: (c > at(-56) ? 'Stubbed ' : 'Seeded ') + page }); }
  // weekly reviews (Fridays 15:00) and Friday compiles
  for (let d0 = -52; d0 <= -10; d0 += 7) { ev(at(d0, 15), 'jeff', 'review_completed', null, { text: 'Weekly review completed' }); for (const g of programs) { if (!wiki[g.id] || (g.created && +g.created > at(d0, 16))) continue; ev(at(d0, 16), 'ai:wiki', 'wiki_changed', null, { page: wiki[g.id].page, words: Math.round(between(60, 220)), text: 'Compiled status, commitments, history · ' + g.name }); } }
  for (const g of programs) if (wiki[g.id]?.compiled && +wiki[g.id].compiled > at(-9)) ev(+wiki[g.id].compiled + 8 * H, 'ai:wiki', 'wiki_changed', null, { page: wiki[g.id].page, words: Math.round(between(60, 220)), text: 'Compiled status, commitments, history · ' + g.name });
  // named items, from their fields
  const cap = (i, t, extra = {}) => ev(t, src(i.source), 'captured', i.id, { text: i.raw && i.raw !== i.next && i.kind === 'inbox' ? i.next || i.raw : i.next, source: i.source || 'chat', project: i.project || null, minutes: i.min || 15, ...extra });
  const clar = (i, t, kind, owner) => ev(t, 'ai:clarify', 'clarified', i.id, { kind, project: i.project || null, owner: owner || null, conf: i.p?.conf || .9 });
  const acc = (i, t, kind, owner) => ev(t, 'jeff', 'accepted', i.id, { kind, project: i.project || null, owner: owner || null, corrected: false });
  let k = 0;
  for (const i of items) {
    k++;
    if (i.kind === 'inbox') { const c = +i.captured; cap(i, c); if (i.p) { i.project = i.p.project; clar(i, Math.max(c, Math.min(c + 0.4 * H, T1 - 6e4)), i.p.kind, i.p.owner); } continue; }   // a proposal can't land after 'now'
    if (i.kind === 'waiting') { const s = +i.since; cap(i, s - H); clar(i, s - 0.5 * H, 'waiting', i.owner); acc(i, s, 'waiting', i.owner); if (i.lastNudged) for (let n = 0; n < (i.nudges || 1); n++) { const t = +i.lastNudged - n * 7 * DAY; if (t > s) { ev(t - 0.5 * H, 'ai:draft', 'nudge_drafted', i.id, { owner: i.owner }); ev(t, 'jeff', 'nudged', i.id, { owner: i.owner }); } } continue; }
    if (i.owner === 'ai' && i.del) { const d0 = +i.del.at; const dT = d0 >= T1 ? T1 - (10 + k * 3) * 6e4 : d0; cap(i, dT - 20 * H); clar(i, dT - 19.5 * H, 'action'); acc(i, dT - 19 * H, 'action'); ev(dT, 'jeff', 'delegated', i.id, { cap: i.cap }); if (i.del.status !== 'queued') ev(dT + 5 * 6e4, 'ai:' + i.cap, 'working', i.id, {}); if (i.del.readyAt) { const r = +i.del.readyAt; ev(Math.min(r >= T1 ? T1 - (5 + k) * 6e4 : r, T1), 'ai:' + i.cap, 'delivered', i.id, {}); } continue; }
    if (i.kind === 'action') { const c = +(i.createdAt || TODAY); cap(i, c - 18 * H); clar(i, c - 17 * H, 'action'); acc(i, c, 'action'); continue; }
    if (i.kind === 'someday') { const s = +i.since; cap(i, s); clar(i, s + 0.3 * H, 'someday'); acc(i, s + H, 'someday'); continue; }
    if (i.kind === 'reference') { const f = +i.filedAt; cap(i, f); clar(i, f + 0.2 * H, 'reference'); acc(i, f + 0.5 * H, 'reference'); ev(f + 0.6 * H, 'ai:file', 'wiki_changed', i.id, { page: wiki[i.refPage]?.page || 'person-' + i.refPage, words: 40 + (k % 5) * 12, text: 'Filed: ' + i.next }); continue; }
    if (i.kind === 'trash') { const tr = +i.trashedAt; cap(i, tr); clar(i, tr + 0.2 * H, 'trash'); acc(i, tr + H, 'trash'); ev(tr + H, 'jeff', 'dropped', i.id, {}); continue; }
    if (i.kind === 'done') { const dn = +i.doneAt, c = dn - (3 + (k % 5)) * DAY; cap(i, c); clar(i, c + 0.5 * H, 'action'); acc(i, c + H, 'action'); ev(dn, 'jeff', 'done', i.id, {}); continue; }
  }
  // background: ordinary weeks at the Flow view's captured-per-week volume
  const weekTargets = [31, 27, 35, 24, 40, 29, 33, 38];
  const verbs = ['Reply to', 'Send', 'Review', 'Confirm', 'Schedule', 'Update', 'Chase', 'Read', 'Summarise', 'Check'];
  const objs = ['the variance format', 'the dry-run checklist', 'the launch FAQ draft', 'the vendor pricing sheet', 'the steering agenda', 'the on-call rota', 'cutover runbook v2', 'the macro list', 'scorecard weighting', 'the contract notice period', 'the training room booking', 'the risk register', 'the sponsor one-pager', 'the release notes', 'the reconciliation export', 'the comms calendar'];
  const waits = ['Feedback on', 'Approval of', 'Numbers for', 'Decision on', 'Confirmation of', 'Review of'];
  const sources = ['email', 'email', 'email', 'chat', 'chat', 'meeting', 'meeting', 'calendar', 'voice'];
  const kinds = ['action', 'action', 'action', 'action', 'action', 'waiting', 'waiting', 'reference', 'trash', 'someday', 'delegate', 'action', 'waiting', 'reference'];
  const named = new Array(8).fill(0); for (const e of EV) if (e.type === 'captured') { const w = Math.floor((e.at - T0) / (7 * DAY)); if (w >= 0 && w < 8) named[w]++; }
  const baseProjects = projects.filter(j => /^J\d+$/.test(j.id)), quiet = { J6: at(-40), J7: at(-32) };
  let seq = 0;
  for (let w = 0; w < 8; w++) for (let i = 0, n = Math.max(0, weekTargets[w] - named[w]); i < n; i++) {
    const id = 'B' + (++seq), dow = pick([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]), capT = T0 + (w * 7 + dow) * DAY + between(2, 12) * H;
    if (capT >= T1) continue;
    const avail = baseProjects.filter(j => (j.created ? +j.created : (programs.find(g => g.id === j.program)?.created ? +programs.find(g => g.id === j.program).created : 0)) <= capT && !(quiet[j.id] && capT > quiet[j.id]));
    if (!avail.length) continue;
    const j = pick(avail), proj = rnd() < .2 ? j.program : j.id, source = pick(sources), person = pick(people).id;
    let kind = pick(kinds); const delegate = kind === 'delegate'; if (delegate) kind = 'action';
    const first = pname(person).split(' ')[0];
    const text = kind === 'waiting' ? `${pick(waits)} ${pick(objs)} from ${first}` : `${pick(verbs)} ${pick(objs)}` + (rnd() < .5 ? ` with ${first}` : '');
    ev(capT, src(source), 'captured', id, { text, source, project: proj, minutes: pick([5, 10, 10, 15, 20, 30, 45, 60, 90]) });
    const clarT = capT + between(0.2, 14) * H, corrected = rnd() < .13, pkind = corrected ? pick(kinds.filter(x => x !== kind && x !== 'delegate')) : kind;
    ev(clarT, 'ai:clarify', 'clarified', id, { kind: pkind, project: proj, owner: kind === 'waiting' ? person : null, conf: corrected ? between(.45, .7) : between(.7, .98) });
    const accT = clarT + between(0.5, 30) * H; if (accT >= T1) continue;
    ev(accT, 'jeff', 'accepted', id, { kind, project: proj, owner: kind === 'waiting' ? person : null, corrected });
    if (kind === 'trash') { ev(accT, 'jeff', 'dropped', id, {}); continue; }
    if (kind === 'reference') { ev(accT + 0.1 * H, 'ai:file', 'wiki_changed', id, { page: hubPage(proj), words: Math.round(between(20, 70)), text: 'Filed: ' + text }); continue; }
    if (kind === 'someday') { if (rnd() < .3) { const pT = accT + between(18, 40) * DAY; if (pT < T1) { ev(pT, 'jeff', 'promoted', id, { project: proj }); const dT = pT + between(2, 9) * DAY; if (dT < T1) ev(dT, 'jeff', 'done', id, {}); } } continue; }
    if (kind === 'waiting') { const close = accT + between(3, 26) * DAY; for (let q = 1; q <= 3; q++) { const nT = accT + 7 * q * DAY; if (nT < close && nT < T1) { ev(nT, 'ai:draft', 'nudge_drafted', id, { owner: person }); ev(nT + 0.5 * H, 'jeff', 'nudged', id, { owner: person }); } } if (close < T1) ev(close, src(source), 'closed', id, { owner: person }); continue; }
    if (delegate) { const dT = accT + between(0.2, 6) * H, c = pick(['draft', 'data', 'draft', 'calendar']); ev(dT, 'jeff', 'delegated', id, { cap: c }); ev(dT + 0.5 * H, 'ai:' + c, 'working', id, {}); const rT = dT + between(2, 30) * H; if (rT >= T1) continue; ev(rT, 'ai:' + c, 'delivered', id, {}); const aT = rT + between(1, 30) * H; if (aT >= T1) continue; if (rnd() < .1) { ev(aT, 'jeff', 'taken_back', id, {}); const dn = aT + between(1, 8) * DAY; if (dn < T1) ev(dn, 'jeff', 'done', id, {}); } else { ev(aT, 'jeff', 'approved', id, {}); ev(aT + 3 * 6e4, 'jeff', 'done', id, {}); } continue; }
    const dT = accT + ((accT < at(-14)) ? between(0.5, 12) : between(0.5, 20)) * DAY;
    if (dT < T1 && (accT < at(-14) || rnd() < .55)) ev(dT, 'jeff', 'done', id, {});
  }
  EV.sort((a, b) => a.at - b.at);
  REVIEWS = EV.filter(e => e.type === 'review_completed').map(e => e.at);
  ITEMS = [...new Set(EV.filter(e => e.type === 'captured').map(e => e.item))];
  return { EV, ITEMS, REVIEWS, PAGES, T0, T1 };
}
/** Captured / clarified / done per week, for the Flow bars. */
export const weeks = () => { buildEvents(); const out = []; for (let w = 0; w < 8; w++) { const a = T0 + w * 7 * DAY, b = a + 7 * DAY, wk = { w: new Date(a).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), c: 0, k: 0, d: 0 }; for (const e of EV) { if (e.at < a || e.at >= b) continue; if (e.type === 'captured') wk.c++; else if (e.type === 'clarified') wk.k++; else if (e.type === 'done' || e.type === 'closed') wk.d++; } out.push(wk); } return out; };
