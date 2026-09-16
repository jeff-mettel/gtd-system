// Command palette: ⌘P / Ctrl+P. One input, a ranked list (features/match.js), ↑/↓ and ⏎ to run, Esc closes.
// Commands are built when it opens: navigation, actions on the focused or open item, items by title, projects and
// programs, people (agenda), jobs in server mode, settings toggles. Parameterized commands take the rest of the
// line — "defer fri", "move billing", "nudge sam", "go waiting", "capture …" — and show what they will do.
// The last 8 commands used come first (localStorage; per browser, like other preferences).

import { fmtDate } from '../lib/dates.js';
import { parseFuzzy } from '../lib/fuzzydate.js';
import { $, esc, toast } from '../lib/dom.js';
import { active, activeProjects, by, pname, projName } from '../model.js';
import { isServer, items, people, withTx } from '../store.js';
import { prefs, savePrefs } from '../prefs.js';
import { itemDrawer } from '../drawers/item.js';
import { projectDrawer, wikiDrawer } from '../drawers/project.js';
import { agendaDrawer, nudgeDraft } from '../drawers/people.js';
import { handOff } from '../drawers/ai.js';
import { guideDrawer, views } from '../ui/nav.js';
import { rank, score } from './match.js';
import { deferItem, doneItem, itemOf, moveItemTo, parkItem } from './rowActions.js';

const RECENT_KEY = 'gtd-palette-recent';   // pre-rename prefix kept on purpose (see store.js LEDGER_KEY)
let ovl = null, input = null, list = null, deps = {}, cmds = [], shown = [], idx = 0;

const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } };
const remember = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 8))); } catch (e) {} };

const VIEW_LABEL = { now: 'Engage', inbox: 'Inbox', programs: 'Programs', waiting: 'Waiting for', delegated: 'Delegated to AI', someday: 'Someday / maybe', reference: 'Reference', people: 'People', review: 'Weekly review', flow: 'Flow', settings: 'Settings' };
const KIND = { action: 'action', waiting: 'waiting for', someday: 'someday', reference: 'reference', inbox: 'inbox' };

/* ---------- the command set (rebuilt on open) ---------- */
export function buildCommands({ itemId } = {}) {
  const out = [];
  const it = itemId ? itemOf(itemId) : null;
  const go = (id) => () => { location.hash = '#' + id; };
  for (const v of views) out.push({ id: 'go:' + v.id, label: `Go to ${VIEW_LABEL[v.id] || v.label}`, sub: `key ${v.key}`, group: 'Navigate', run: go(v.id) });
  out.push({ id: 'go', label: 'Go to…', sub: 'go waiting', group: 'Navigate', param: 'view', verbs: ['go', 'g'],
    preview: (a) => { const v = rank(a, views, (x) => VIEW_LABEL[x.id] + ' ' + x.label, 1)[0]; return v ? `→ ${VIEW_LABEL[v.id]}` : 'no such view'; },
    run: (a) => { const v = rank(a, views, (x) => VIEW_LABEL[x.id] + ' ' + x.label, 1)[0]; if (v) location.hash = '#' + v.id; } });
  /* the item in hand */
  if (it && it.kind !== 'done' && it.kind !== 'trash') {
    const name = it.next || it.raw, sub = `${KIND[it.kind] || it.kind} · ${String(name).slice(0, 48)}`, tx = (fn) => () => withTx(() => { if (fn() !== false) deps.render(); });
    out.push({ id: 'item:open', label: 'Open item', sub, group: 'This item', run: () => itemDrawer(it.id) });
    out.push({ id: 'item:done', label: 'Mark done', sub, group: 'This item', run: tx(() => doneItem(it.id)) });
    out.push({ id: 'item:defer', label: it.kind === 'waiting' ? 'Follow up on…' : 'Defer until…', sub: 'defer fri · defer +3 · defer next week', group: 'This item', param: 'date', verbs: ['defer', 'd', 'until', 'followup', 'follow'],
      preview: (a) => { const d = parseFuzzy(a); return d ? `→ ${fmtDate(d)}` : a ? `can't read "${a}"` : 'tomorrow · fri · +3 · 20 sep'; },
      run: (a) => { const d = parseFuzzy(a); if (!d) { toast(`Couldn't read "${a}" as a date`); return; } withTx(() => { deferItem(it.id, d); deps.render(); }); } });
    out.push({ id: 'item:move', label: 'Move to project…', sub: 'move billing', group: 'This item', param: 'project', verbs: ['move', 'm', 'mv'],
      preview: (a) => { const o = rank(a, projectOptions(), (x) => x.label + ' ' + x.sub, 1)[0]; return o ? `→ ${o.label}${o.sub ? ' · ' + o.sub : ''}` : 'no match'; },
      run: (a) => { const o = rank(a, projectOptions(), (x) => x.label + ' ' + x.sub, 1)[0]; if (!o) { toast('No project matches'); return; } withTx(() => { if (moveItemTo(it.id, o.id)) deps.render(); }); } });
    if (it.kind !== 'someday') out.push({ id: 'item:park', label: 'Park in someday', sub, group: 'This item', run: tx(() => parkItem(it.id)) });
    if (it.kind === 'waiting') out.push({ id: 'item:nudge', label: 'Draft nudge', sub, group: 'This item', run: () => nudgeDraft(it.id) });
    if (it.kind === 'action' && it.owner !== 'ai') out.push({ id: 'item:hand', label: 'Hand to AI', sub, group: 'This item', run: tx(() => { handOff(it.id, it.ai?.cap, it.ai?.what); toast(`Handed to AI · "${name}" — you'll be asked before anything is sent`); }) });
  }
  /* nudge <person>: the oldest thing they owe you */
  out.push({ id: 'nudge', label: 'Draft nudge for…', sub: 'nudge sam', group: 'Waiting for', param: 'person', verbs: ['nudge', 'n', 'chase'],
    preview: (a) => { const w = oldestOwed(a); return w ? `→ ${pname(w.owner)}: ${w.next}` : 'nobody matches'; },
    run: (a) => { const w = oldestOwed(a); if (w) nudgeDraft(w.id); else toast('No open waiting-for for that person'); } });
  /* capture <text> */
  out.push({ id: 'capture', label: 'Capture…', sub: 'capture Fix the export @Billing fri', group: 'Capture', param: 'text', verbs: ['capture', 'c', 'add', '+'], preview: (a) => a ? `→ "${a}"` : 'anything, with @project / fri / ! / ~30m', run: (a) => { if (a) deps.capture(a); } });
  /* jobs */
  if (isServer()) for (const [job, label] of [['clarify', 'Run clarify'], ['ingest-calendar', 'Sync calendar'], ['review', 'Prepare weekly review'], ['compile', 'Compile the wiki']]) out.push({ id: 'job:' + job, label, sub: 'AI job on the server', group: 'Jobs', run: () => deps.runJob(job) });
  /* settings toggles */
  out.push({ id: 'set:rail', label: prefs.collapsed.rail ? 'Expand sidebar' : 'Collapse sidebar', sub: 'key [', group: 'Settings', run: () => { prefs.collapsed.rail = !prefs.collapsed.rail; savePrefs(); deps.render(); } });
  out.push({ id: 'set:tips', label: 'Show view tips', sub: 'bring back the instruction cards', group: 'Settings', run: () => { prefs.guides = {}; savePrefs(); deps.render(); toast('View tips are back'); } });
  out.push({ id: 'set:group', label: `Group Engage by ${prefs.nowGroup === 'program' ? 'context' : 'program'}`, sub: 'the next-actions panel', group: 'Settings', run: () => { prefs.nowGroup = prefs.nowGroup === 'program' ? 'context' : 'program'; savePrefs(); deps.render(); } });
  out.push({ id: 'guide', label: 'Guide and keys', sub: 'key ?', group: 'Help', run: () => guideDrawer() });
  /* entities */
  for (const g of active()) { out.push({ id: 'prog:' + g.id, label: g.name, sub: 'program · open', group: 'Programs', run: () => projectDrawer(g.id) }); out.push({ id: 'wiki:' + g.id, label: `Wiki · ${g.name}`, sub: 'program hub page', group: 'Programs', run: () => wikiDrawer(g.id) }); for (const j of activeProjects(g.id)) out.push({ id: 'proj:' + j.id, label: j.name, sub: `project · ${g.name}`, group: 'Projects', run: () => projectDrawer(j.id) }); }
  for (const u of people) out.push({ id: 'person:' + u.id, label: u.name, sub: `${u.role || 'person'} · 1:1 agenda`, group: 'People', run: () => agendaDrawer(u.id) });
  for (const x of items) if (x.kind !== 'done' && x.kind !== 'trash' && (x.next || x.raw)) out.push({ id: 'open:' + x.id, label: x.next || x.raw, sub: `${KIND[x.kind] || x.kind}${x.project ? ' · ' + projName(x.project) : ''}`, group: 'Items', run: () => { if (x.kind === 'inbox') { location.hash = '#inbox'; } else itemDrawer(x.id); } });
  return out;
}

const projectOptions = () => active().flatMap(g => [{ id: g.id, label: g.name, sub: 'program level' }, ...activeProjects(g.id).map(j => ({ id: j.id, label: j.name, sub: g.name }))]);
function oldestOwed(q) { const ws = by('waiting').filter(w => w.owner && score(q, pname(w.owner) + ' ' + (people.find(u => u.id === w.owner)?.name || '')) >= 0); return ws.sort((a, b) => new Date(a.since) - new Date(b.since))[0] || null; }

/* ---------- matching: a verb + argument first, else ranked search with recents on top ---------- */
export function matchCommands(query, all, recents = []) {
  const q = query.trim();
  const m = /^(\S+)\s+(.*)$/.exec(q);
  if (m) { const verb = m[1].toLowerCase(), arg = m[2].trim(); const c = all.find(c => c.verbs?.includes(verb)); if (c) return [{ cmd: c, arg }]; }
  if (!q) { const rs = recents.map(id => all.find(c => c.id === id)).filter(Boolean); const rest = all.filter(c => !rs.includes(c) && c.group !== 'Items'); return [...rs, ...rest].slice(0, 12).map(cmd => ({ cmd, arg: '' })); }
  const ranked = rank(q, all, (c) => c.label + ' ' + (c.group === 'Items' || c.group === 'Projects' || c.group === 'People' || c.group === 'Programs' ? '' : c.sub || ''), 40);
  const rs = recents.filter(id => ranked.some(c => c.id === id));
  return [...rs.map(id => ranked.find(c => c.id === id)), ...ranked.filter(c => !rs.includes(c.id))].slice(0, 12).map(cmd => ({ cmd, arg: '' }));
}

/* ---------- DOM ---------- */
function build() {
  ovl = document.createElement('div'); ovl.className = 'ovl'; ovl.id = 'paletteOvl'; ovl.hidden = true;
  ovl.innerHTML = `<div class="ovl-box pal" role="dialog" aria-label="Commands"><div class="ovl-row"><span class="ovl-plus">›</span><input id="palInput" placeholder="Type a command, an item, a project, a person…" aria-label="Command" autocomplete="off" spellcheck="false"></div><div class="pal-list" id="palList" role="listbox"></div><div class="ovl-hint"><span class="kbd">↑</span>/<span class="kbd">↓</span> choose · <span class="kbd">⏎</span> run · <b>defer fri</b> · <b>move billing</b> · <b>nudge sam</b> · <b>go waiting</b> · <span class="kbd">Esc</span></div></div>`;
  document.body.appendChild(ovl);
  input = $('#palInput'); list = $('#palList');
  ovl.addEventListener('mousedown', (e) => { if (e.target === ovl) closePalette(); });
  input.addEventListener('input', () => { idx = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); run(shown[idx]); }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => { const t = e.target.closest('.pal-i'); if (t) run(shown[+t.dataset.i]); });
}

function paint() {
  shown = matchCommands(input.value, cmds, recent());
  idx = Math.min(idx, Math.max(0, shown.length - 1));
  const rs = recent();
  list.innerHTML = shown.map(({ cmd, arg }, i) => `<div class="pal-i ${i === idx ? 'on' : ''}" data-i="${i}" role="option" aria-selected="${i === idx}"><span class="pal-g">${esc(cmd.group)}</span><b>${esc(cmd.label)}</b><span class="faint">${cmd.param && (arg || input.value.trim().split(/\s+/).length > 1) ? esc(cmd.preview ? cmd.preview(arg) : arg) : esc(cmd.sub || '')}</span>${!input.value.trim() && rs.includes(cmd.id) ? '<span class="pal-r">recent</span>' : ''}</div>`).join('') || '<div class="pal-empty">Nothing matches</div>';
  list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}

function run(entry) {
  if (!entry) return;
  const { cmd, arg } = entry;
  if (cmd.param && !arg) { input.value = (cmd.verbs?.[0] || cmd.label.toLowerCase()) + ' '; idx = 0; paint(); return; }   // ask for the argument
  closePalette(); remember(cmd.id);
  cmd.run(arg);
}

export function initPalette(d) { deps = d; if (!ovl) build(); }
export function openPalette() {
  if (!ovl) build();
  cmds = buildCommands({ itemId: deps.currentItemId?.() });
  input.value = ''; idx = 0; ovl.hidden = false; paint(); input.focus();
}
export function closePalette() { if (ovl) ovl.hidden = true; }
export const paletteOpen = () => !!ovl && !ovl.hidden;
