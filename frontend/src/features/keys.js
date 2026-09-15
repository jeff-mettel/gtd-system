// ONE keyboard router for the whole app (app.js installs it as the only document keydown listener).
//
// Everywhere:   ⌘K / Ctrl+K capture · ⌘P palette · / capture (outside fields) · ? guide · 1–9 0 , views ·
//               g then i/e/p/w/r/s/d/f/o/l (chord) · [ sidebar · Esc closes overlay → inline field → drawer → focus
// Any view with rows (.row with an item, .dcard, program tables' tr[data-drop]): a focus ring moves with j/k/↑/↓
//               (roving tabindex, .row.focus); ⏎ opens the drawer; x done; d defer (inline fuzzy field); p park;
//               n draft nudge; m move (inline project picker)
// Inbox:        j/k move the selection · a accept · w waiting · s someday · t trash · x do it now · e edit ·
//               d accept and hand to AI · Tab list → kinds → next action · ⌘⏎ accept from any field
// Drawers:      Esc closes · ⌘⏎ presses the primary button
// Never intercepted while typing in an input/textarea/select/contenteditable, except ⌘K / ⌘P / ⌘⏎ / ⌘[ / Esc.

import { $, toast } from '../lib/dom.js';
import { closeDrawer } from '../ui/drawer.js';
import { itemDrawer } from '../drawers/item.js';
import { projectDrawer } from '../drawers/project.js';
import { nudgeDraft } from '../drawers/people.js';
import { reviewDrawer } from '../drawers/ai.js';
import { withTx } from '../store.js';
import { prefs, savePrefs } from '../prefs.js';
import { guideDrawer, views } from '../ui/nav.js';
import { ui } from '../ui/session.js';
import { active, activeProjects } from '../model.js';
import { closeInline, inlineDate, inlinePick, inlineOpen } from '../ui/inline.js';
import { captureOpen, closeCapture, openCapture } from './captureOverlay.js';
import { closePalette, openPalette, paletteOpen } from './palette.js';
import { deferItem, doneItem, itemOf, moveItemTo, parkItem } from './rowActions.js';

let deps = {};                       // { render, acceptCurrent, moveSel } from app.js
let focusKey = null;                 // 'i:<item>' | 'p:<project>' — survives re-renders
let chord = null, chordTimer = null;

const drawerOpen = () => $('#drawer')?.classList.contains('open');
const curView = () => location.hash.slice(1) || 'now';
const isTyping = (el) => !!el && (el.matches?.('input,textarea,select') || el.isContentEditable);

/* ---------- rows ---------- */
const ROW_SEL = '#view .row, #view .dcard, #view tr[data-drop]';
const ID_ATTRS = ['review', 'takeback', 'promote', 'restore', 'nudge', 'drop'];

/** What a row stands for: { item } or { project }; null for decorative rows. */
export function targetOf(row) {
  if (!row) return null;
  if (row.tagName === 'TR') return row.dataset.drop ? { project: row.dataset.drop } : null;
  if (row.dataset.sel) return { item: row.dataset.sel, inbox: true };
  if (row.dataset.item) return { item: row.dataset.item };
  const t = row.querySelector('[data-item]'); if (t) return { item: t.dataset.item };
  for (const a of ID_ATTRS) { const b = row.querySelector(`[data-${a}]`); if (b && itemOf(b.dataset[a])) return { item: b.dataset[a] }; }
  return null;
}
const keyOf = (t) => t ? (t.item ? 'i:' + t.item : 'p:' + t.project) : null;
const rows = () => [...document.querySelectorAll(ROW_SEL)].filter(r => !r.closest('.ilist') && targetOf(r));

function applyFocus({ steal = true } = {}) {
  for (const r of document.querySelectorAll('.krow')) { r.classList.remove('krow'); r.removeAttribute('tabindex'); }
  if (!focusKey) return null;
  const r = rows().find(x => keyOf(targetOf(x)) === focusKey); if (!r) return null;
  r.classList.add('krow'); r.tabIndex = 0;
  if (steal && (document.activeElement === document.body || document.activeElement?.classList.contains('krow') || document.activeElement === null)) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); }
  return r;
}
export function clearFocus() { focusKey = null; applyFocus(); }
export function focusedTarget() { const r = document.querySelector('.krow'); return r ? targetOf(r) : null; }
/** The item the keys act on: the focused row, else the item open in the drawer. */
export function currentItemId() { const t = focusedTarget(); if (t?.item) return t.item; const d = $('#drawer.open [data-setfield], #drawer.open [data-markdone], #drawer.open [data-received]'); return d ? (d.dataset.id || d.dataset.markdone || d.dataset.received) : null; }
export function focusRow(t) { focusKey = keyOf(t); applyFocus(); }

function move(dir) {
  const list = rows(); if (!list.length) return false;
  const i = list.findIndex(r => keyOf(targetOf(r)) === focusKey);
  const n = i < 0 ? (dir > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + dir));
  focusKey = keyOf(targetOf(list[n])); applyFocus(); return true;
}

/* ---------- row actions ---------- */
export function openTarget(t) {
  if (!t) return;
  if (t.project) return projectDrawer(t.project);
  const it = itemOf(t.item); if (!it) return;
  if (it.owner === 'ai' && it.del?.status === 'ready') return reviewDrawer(it.id);
  if (it.kind === 'inbox') { ui.sel = it.id; location.hash = '#inbox'; return; }
  itemDrawer(it.id);
}
const done = (id) => withTx(() => { if (doneItem(id)) deps.render(); });
const park = (id) => withTx(() => { if (parkItem(id)) deps.render(); });
function deferPrompt(anchor, id) {
  const it = itemOf(id); if (!it) return;
  const label = it.kind === 'waiting' ? 'Follow up on…' : (it.kind === 'someday' || it.kind === 'reference') ? 'Revisit on…' : 'Defer until…';
  inlineDate(anchor, { label, value: it.start || it.followUp || it.revisit || null, onPick: (dt) => withTx(() => { deferItem(id, dt); deps.render(); }) });
}
export const projectOptions = () => active().flatMap(g => [{ id: g.id, label: g.name, sub: 'program level' }, ...activeProjects(g.id).map(j => ({ id: j.id, label: j.name, sub: g.name }))]);
function movePrompt(anchor, id) {
  const it = itemOf(id); if (!it) return;
  inlinePick(anchor, { label: 'Move to…', options: projectOptions().filter(o => o.id !== it.project), placeholder: 'project or program', onPick: (o) => withTx(() => { if (moveItemTo(id, o.id)) deps.render(); }) });
}
function nudge(id) { const it = itemOf(id); if (it?.kind === 'waiting') nudgeDraft(id); else toast('Nudge is for waiting-fors — n on a row in Waiting for'); }

/* ---------- inbox (ported from the inbox-only handler) ---------- */
const focusKg = (kg) => (kg?.querySelector('button.on') || kg?.querySelector('button'))?.focus();

/* Tab (no shift) and Shift+Tab across the four stops. Past either end the browser's own order takes over. */
export function inboxTab(e) {
  const det = $('.inbox .detail'); if (!det) return false;
  const a = document.activeElement, kgs = [...det.querySelectorAll('.kg')], next = $('#pNext');
  const kg = a?.closest?.('.kg');
  const where = kg ? (kgs.indexOf(kg) === 0 ? 'kg1' : 'kg2') : a === next ? 'next' : (a === document.body || a?.closest?.('.ilist, .vhead, .guide')) ? 'list' : null;
  if (!where) return false;
  const order = ['list', 'kg1', 'kg2', 'next'], i = order.indexOf(where) + (e.shiftKey ? -1 : 1);
  if (i < 0 || i >= order.length) return false;
  e.preventDefault();
  const to = order[i];
  if (to === 'list') $('.ilist .row.sel')?.focus();
  else if (to === 'kg1') focusKg(kgs[0]);
  else if (to === 'kg2') focusKg(kgs[1]);
  else { next?.focus(); next?.select(); }
  return true;
}

/* Inside a kind group: ArrowDown/ArrowUp move between its buttons; Enter/Space select and keep focus on the chosen button after the re-render. */
export function kgKeys(e) {
  const btn = e.target.closest?.('.kg button'); if (!btn) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const bs = [...btn.closest('.kg').querySelectorAll('button')], i = bs.indexOf(btn);
    e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus(); return true;
  }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const k = btn.dataset.kind; btn.click(); $(`.kg button[data-kind="${k}"]`)?.focus(); return true; }
  return false;
}

function inboxKeys(e) {
  if (e.key === 'Tab' && inboxTab(e)) return true;
  if (kgKeys(e)) return true;
  if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const inList = !!document.activeElement?.closest?.('.ilist'); deps.moveSel(e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1); if (inList || e.key.startsWith('Arrow')) $('.ilist .row.sel')?.focus({ preventScroll: false }); return true; }
  if ('axwst'.includes(e.key) && e.key.length === 1) { withTx(() => deps.acceptCurrent({ a: undefined, x: 'done', w: 'waiting', s: 'someday', t: 'trash' }[e.key])); return true; }
  if (e.key === 'e') { e.preventDefault(); $('#pNext')?.focus(); $('#pNext')?.select(); return true; }
  if (e.key === 'd') { const it = itemOf(ui.sel); if (it?.p?.ai) { ui.delegateOnAccept = true; withTx(() => deps.acceptCurrent()); } return true; }
  return false;
}

/* ---------- the chord: g then a view key ---------- */
const CHORD = { i: 'inbox', e: 'now', n: 'now', p: 'programs', w: 'waiting', r: 'review', s: 'settings', d: 'delegated', f: 'flow', o: 'someday', l: 'reference', h: 'people' };
function armChord() { chord = 'g'; clearTimeout(chordTimer); chordTimer = setTimeout(() => { chord = null; }, 1500); }

/* ---------- the router ---------- */
function onKey(e) {
  const mod = e.metaKey || e.ctrlKey, typing = isTyping(e.target), k = e.key;
  /* universal, even while typing */
  if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === 'k') { e.preventDefault(); if (captureOpen()) closeCapture(); else { closePalette(); openCapture(); } return; }
  if (mod && !e.shiftKey && !e.altKey && k.toLowerCase() === 'p') { e.preventDefault(); if (paletteOpen()) closePalette(); else { closeCapture(); openPalette(); } return; }
  if (k === '[' && (mod || !typing)) { e.preventDefault(); prefs.collapsed.rail = !prefs.collapsed.rail; savePrefs(); deps.render(); return; }
  if (mod && k === 'Enter') {
    if (curView() === 'inbox' && !drawerOpen()) { e.preventDefault(); withTx(() => deps.acceptCurrent()); return; }
    const b = $('#drawer.open .df .btn.primary'); if (b) { e.preventDefault(); b.click(); }
    return;
  }
  if (k === 'Escape') {
    if (typing) { if (e.target.closest('#drawer')) { closeDrawer(); applyFocus(); } else e.target.blur(); return; }
    if (inlineOpen()) { closeInline(); return; }
    if (captureOpen()) { closeCapture(); return; }
    if (paletteOpen()) { closePalette(); return; }
    if (drawerOpen()) { closeDrawer(); applyFocus(); return; }
    clearFocus(); return;
  }
  if (typing) return;
  if (mod || e.altKey) return;
  /* chord */
  if (chord === 'g') { chord = null; clearTimeout(chordTimer); const v = CHORD[k]; if (v) { e.preventDefault(); location.hash = '#' + v; return; } }
  if (k === 'g') { armChord(); return; }
  /* the inbox keeps its own grammar while no drawer is open */
  if (curView() === 'inbox' && !drawerOpen() && inboxKeys(e)) return;
  /* views */
  const v = views.find(x => x.key === k); if (v) { location.hash = '#' + v.id; return; }
  if (k === '/') { e.preventDefault(); openCapture(); return; }
  if (k === '?') { guideDrawer(); return; }
  /* buttons and links keep Enter / Space for themselves */
  if ((k === 'Enter' || k === ' ') && e.target.matches?.('button,a,summary,[role=button]')) return;
  /* rows */
  if (k === 'j' || k === 'ArrowDown') { if (move(1)) e.preventDefault(); return; }
  if (k === 'k' || k === 'ArrowUp') { if (move(-1)) e.preventDefault(); return; }
  const row = document.querySelector('.krow'), t = targetOf(row);
  if (!t) return;
  if (k === 'Enter') { e.preventDefault(); openTarget(t); return; }
  if (!t.item) return;
  if (k === 'x') { e.preventDefault(); done(t.item); return; }
  if (k === 'd') { e.preventDefault(); deferPrompt(row, t.item); return; }
  if (k === 'p') { e.preventDefault(); park(t.item); return; }
  if (k === 'n') { e.preventDefault(); nudge(t.item); return; }
  if (k === 'm') { e.preventDefault(); movePrompt(row, t.item); return; }
}

export function initKeys(d) {
  deps = d;
  document.addEventListener('keydown', onKey);
  /* a click on a row moves the ring there, so keys continue from the mouse */
  document.addEventListener('mousedown', (e) => { const r = e.target.closest?.(ROW_SEL); if (r && !r.closest('.ilist') && targetOf(r)) { focusKey = keyOf(targetOf(r)); applyFocus({ steal: false }); } }, true);
  /* re-apply the ring after every render */
  const view = $('#view'); if (view) new MutationObserver(() => { closeInline(); applyFocus({ steal: !isTyping(document.activeElement) && !captureOpen() && !paletteOpen() && !drawerOpen() }); }).observe(view, { childList: true });
  window.addEventListener('hashchange', () => { focusKey = null; chord = null; });
}
