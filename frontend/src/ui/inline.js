// A tiny inline field anchored to a row or a chip: one text input, an optional option list, Esc to dismiss.
// Two shapes —
//   inlineDate(anchor, { label, value, onPick(date|null) })      fuzzy text → a Date (lib/fuzzydate.js); "clear" empties
//   inlinePick(anchor, { label, options:[{id,label,sub}], onPick(option) })   typed filter over options (features/match.js)
// One field at a time; it lives in the DOM until picked, dismissed (Esc / outside click) or the view re-renders.

import { fmtDate } from '../lib/dates.js';
import { parseFuzzy } from '../lib/fuzzydate.js';
import { $, esc } from '../lib/dom.js';
import { rank } from '../features/match.js';

export function closeInline() { const el = $('.inl'); if (el) { el._cleanup?.(); el.remove(); } }
export const inlineOpen = () => !!$('.inl');

function mount(anchor, label, hint) {
  closeInline();
  const el = document.createElement('div'); el.className = 'inl'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', label);
  el.innerHTML = `<div class="inl-h">${esc(label)}</div><input class="in" aria-label="${esc(label)}"><div class="inl-list" hidden></div><div class="inl-hint">${hint}</div>`;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect(), w = 300;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
  el.style.top = (r.bottom + 6 > window.innerHeight - 140 ? r.top - el.offsetHeight - 6 : r.bottom + 6) + 'px';
  const onDoc = (e) => { if (!el.contains(e.target)) closeInline(); };
  setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
  el._cleanup = () => document.removeEventListener('mousedown', onDoc);
  const input = el.querySelector('input'); input.focus();
  return { el, input, list: el.querySelector('.inl-list'), hint: el.querySelector('.inl-hint') };
}

export function inlineDate(anchor, { label = 'When', value = null, placeholder = 'tomorrow, fri, +3, 20 sep', onPick }) {
  const f = mount(anchor, label, `<span class="kbd">⏎</span> set · <span class="kbd">Esc</span> · ${value ? '"clear" removes it' : 'fuzzy dates work'}`);
  f.input.placeholder = placeholder;
  const preview = () => { const v = f.input.value.trim(); if (!v) { f.hint.innerHTML = value ? `now ${esc(fmtDate(value))} · type "clear" to remove` : 'tomorrow · fri · +3 · next week · 20 sep'; f.input.classList.remove('bad'); return; } if (/^(clear|none|-)$/i.test(v)) { f.hint.textContent = '→ cleared'; f.input.classList.remove('bad'); return; } const dt = parseFuzzy(v); f.input.classList.toggle('bad', !dt); f.hint.textContent = dt ? `→ ${fmtDate(dt)}` : `Couldn't read "${v}"`; };
  f.input.addEventListener('input', preview); preview();
  f.input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInline(); anchor.focus?.(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault(); e.stopPropagation();
    const v = f.input.value.trim();
    if (/^(clear|none|-)$/i.test(v)) { closeInline(); onPick(null); return; }
    const dt = parseFuzzy(v); if (!dt) { f.input.classList.add('bad'); return; }
    closeInline(); onPick(dt);
  });
}

export function inlinePick(anchor, { label = 'Pick', options = [], placeholder = 'type to filter', onPick }) {
  const f = mount(anchor, label, '<span class="kbd">↑</span>/<span class="kbd">↓</span> choose · <span class="kbd">⏎</span> pick · <span class="kbd">Esc</span>');
  f.input.placeholder = placeholder;
  let shown = [], idx = 0;
  const paint = () => {
    shown = rank(f.input.value, options, (o) => o.label + ' ' + (o.sub || ''), 8);
    idx = Math.min(idx, Math.max(0, shown.length - 1));
    f.list.hidden = !shown.length;
    f.list.innerHTML = shown.map((o, i) => `<div class="inl-opt ${i === idx ? 'on' : ''}" data-i="${i}"><b>${esc(o.label)}</b>${o.sub ? `<span class="faint">${esc(o.sub)}</span>` : ''}</div>`).join('');
    f.list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  f.input.addEventListener('input', () => { idx = 0; paint(); }); paint();
  f.list.addEventListener('mousedown', (e) => e.preventDefault());
  f.list.addEventListener('click', (e) => { const t = e.target.closest('.inl-opt'); if (t) { const o = shown[+t.dataset.i]; closeInline(); onPick(o); } });
  f.input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInline(); anchor.focus?.(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const o = shown[idx]; if (o) { closeInline(); onPick(o); } }
  });
}
