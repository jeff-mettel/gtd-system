// Small DOM helpers.

/* ---------- helpers ---------- */
export const $ = (s, el = document) => el.querySelector(s);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* Toast. With an undo function it grows an Undo button and stays up longer. Undo is a ledger operation: the
   store commits the compensating events (undone, restored, taken_back, an `edited` with the prior fields…). */
export function toast(msg, undo) {
  const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); t.classList.remove('undo');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
  if (undo) offerUndo(undo);
}

/* Upgrade the toast that is currently showing to an undo toast. No-op when nothing is showing. */
export function offerUndo(undo) {
  const t = $('#toast'); if (!t || !t.classList.contains('show') || t.classList.contains('undo')) return;
  t.classList.add('undo');
  const b = document.createElement('button'); b.type = 'button'; b.className = 'undo-btn'; b.textContent = 'Undo';
  b.addEventListener('click', (e) => { e.stopPropagation(); t.classList.remove('show', 'undo'); undo(); toast('Undone'); });
  t.appendChild(b);
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 4200);
}
