// Fuzzy-date companion fields.
//
// Pattern: next to any <input type="date"> put a text input with class "fuzzy" that points at it:
//   <div class="datewrap"><input type="date" id="pDue"><input class="fuzzy" data-for="pDue" placeholder="or: tomorrow, fri, +3, next week"></div>
// Targeting works two ways —
//   data-for="<id>"        the date input with that id (inbox fields), or
//   data-for-sel="<css>"   the first match of that selector inside the .fuzzy's parent (drawers, where ids are
//                          not unique; e.g. data-for-sel="[data-setdate]" next to the item drawer's date inputs).
// On change or Enter the text is parsed (lib/fuzzydate.js), the date input gets the ISO value and a bubbling
// `change` event — so whatever already listens on the date input (data-setdate, data-revisit…) fires as if the
// user had picked the date. A small hint under the field confirms the parsed date or marks the text as unparsed.
// Delegated on document, so fields rendered later (drawers, re-renders) just work.

import { fmtDate, iso } from '../lib/dates.js';
import { parseFuzzy } from '../lib/fuzzydate.js';
import { $ } from '../lib/dom.js';

function targetOf(f) {
  if (f.dataset.for) return document.getElementById(f.dataset.for);
  if (f.dataset.forSel) return f.parentElement?.querySelector(f.dataset.forSel) || $(f.dataset.forSel);
  return null;
}

function hintOf(f) {
  let h = f.nextElementSibling;
  if (!h || !h.classList.contains('fzhint')) { h = document.createElement('span'); h.className = 'fzhint'; f.insertAdjacentElement('afterend', h); }
  return h;
}

export function applyFuzzy(f) {
  const t = targetOf(f), txt = f.value.trim(), h = hintOf(f);
  if (!t) return;
  if (!txt) { h.textContent = ''; f.classList.remove('bad'); return; }
  const dt = parseFuzzy(txt);
  if (!dt) { f.classList.add('bad'); h.textContent = `Couldn't read "${txt}" — try tomorrow, fri, +3, 20 sep`; h.classList.add('bad'); return; }
  f.classList.remove('bad'); h.classList.remove('bad');
  t.value = iso(dt); f.value = ''; h.textContent = `→ ${fmtDate(dt)}`;
  t.dispatchEvent(new Event('change', { bubbles:true }));
}

export function initFuzzyInputs() {
  document.addEventListener('change', (e) => { if (e.target.matches?.('input.fuzzy')) applyFuzzy(e.target); });
  document.addEventListener('keydown', (e) => {
    if (!e.target.matches?.('input.fuzzy')) return;
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); applyFuzzy(e.target); }
  });
  /* Typing again clears a stale error so the field never looks stuck. */
  document.addEventListener('input', (e) => { if (e.target.matches?.('input.fuzzy') && e.target.classList.contains('bad')) { e.target.classList.remove('bad'); const h = e.target.nextElementSibling; if (h?.classList.contains('fzhint')) h.textContent = ''; } });
}
