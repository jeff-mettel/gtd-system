// Inbox keyboard: Tab cycles list → "Yes" kinds → "No" kinds → next-action field; arrows walk a kind group.
// Called from app.js's keydown listener; each returns true when it handled the key.

import { $ } from '../lib/dom.js';

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

/* Inside a kind group: ArrowDown/ArrowUp move between its buttons; Enter/Space select and keep focus on the
   chosen button after the re-render. */
export function kgKeys(e) {
  const btn = e.target.closest?.('.kg button'); if (!btn) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const bs = [...btn.closest('.kg').querySelectorAll('button')], i = bs.indexOf(btn);
    e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus(); return true;
  }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const k = btn.dataset.kind; btn.click(); $(`.kg button[data-kind="${k}"]`)?.focus(); return true; }
  return false;
}
