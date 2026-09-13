// Small DOM helpers.
import { STORE } from '../state.js';

/* ---------- helpers ---------- */
export const $ = (s, el = document) => el.querySelector(s);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* Toast. With an undo snapshot (JSON of `state` taken before the action) it grows an Undo button and stays up longer.
   Undo writes the snapshot straight back to localStorage and reloads: persisted state is applied over the example
   data once at load, so in this prototype a reload is the one reliable way to revert every derived field. */
export function toast(msg, undoSnapshot) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show'); t.classList.remove('undo');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
  if (undoSnapshot) offerUndo(undoSnapshot);
}

/* Upgrade the toast that is currently showing to an undo toast. No-op when nothing is showing. */
export function offerUndo(snapshot) {
  const t = $('#toast'); if (!t.classList.contains('show') || t.classList.contains('undo')) return;
  t.classList.add('undo');
  const b = document.createElement('button'); b.type = 'button'; b.className = 'undo-btn'; b.textContent = 'Undo';
  b.addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem(STORE, snapshot); } catch (x) {} location.reload(); });
  t.appendChild(b);
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 4200);
}
