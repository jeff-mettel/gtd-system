// "@" autocomplete in the capture box: programs, projects (under their program) and people.
// Selecting inserts "@<Name> "; on capture, parseMentions() turns those back into ids.

import { people, projects } from '../store.js';
import { $, esc } from '../lib/dom.js';
import { active } from '../model.js';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Everything that can be @-mentioned, in display order: programs, their projects, then people. */
export function mentionables() {
  const out = [];
  for (const g of active()) { out.push({ id:g.id, name:g.name, type:'program', label:'Program' }); for (const j of projects.filter(j => j.program === g.id && !j.dropped)) out.push({ id:j.id, name:j.name, type:'project', label:'Project · ' + g.name }); }
  for (const x of people) out.push({ id:x.id, name:x.name, type:'person', label:x.role });
  return out;
}

export function matchMentions(q) {
  const s = q.toLowerCase(), all = mentionables();
  if (!s) return all.slice(0, 12);
  const pre = all.filter(e => e.name.toLowerCase().startsWith(s) || (e.type === 'person' && e.name.toLowerCase().split(' ').some(w => w.startsWith(s))));
  const sub = all.filter(e => !pre.includes(e) && e.name.toLowerCase().includes(s));
  return pre.concat(sub).slice(0, 12);
}

/* "@Billing platform migration @Priya" → { ids, project, owner }. Longest names first so "@Sam" cannot eat "@Sam Reyes".
   A project beats a program for `project`; people also match on first name. */
export function parseMentions(text) {
  const found = [];
  const cands = mentionables().flatMap(e => e.type === 'person' ? [[e.name, e], [e.name.split(' ')[0], e]] : [[e.name, e]]).sort((a, b) => b[0].length - a[0].length);
  let rest = text;
  for (const [name, e] of cands) { const re = new RegExp('@' + escRe(name) + '(?![\\w-])', 'i'); if (re.test(rest)) { found.push(e); rest = rest.replace(re, ' '); } }
  const project = found.find(e => e.type === 'project') || found.find(e => e.type === 'program');
  const owner = found.find(e => e.type === 'person');
  return { ids:[...new Set(found.map(e => e.id))], project:project?.id ?? null, owner:owner?.id ?? null };
}

export function initAutocomplete() {
  const input = $('#captureInput'), form = $('#captureForm'), bar = $('.topbar');
  if (!input || !bar) return;
  const box = document.createElement('div'); box.className = 'ac'; box.hidden = true; bar.appendChild(box);
  let list = [], idx = 0, at = -1;      // `at` = index of the "@" being completed

  const close = () => { box.hidden = true; list = []; at = -1; };
  const place = () => { box.style.left = form.offsetLeft + 'px'; box.style.top = (form.offsetTop + form.offsetHeight + 4) + 'px'; box.style.minWidth = Math.min(form.offsetWidth, 420) + 'px'; };
  const paint = () => {
    if (!list.length) return close();
    box.innerHTML = list.map((e, i) => `<div class="aci ${i === idx ? 'on' : ''}" data-i="${i}"><b>${esc(e.name)}</b><span class="faint">${esc(e.label)}</span></div>`).join('');
    place(); box.hidden = false; box.querySelector('.aci.on')?.scrollIntoView({ block:'nearest' });
  };
  const pick = (i) => {
    const e = list[i]; if (!e) return;
    const v = input.value, caret = input.selectionStart ?? v.length;
    const nv = v.slice(0, at) + '@' + e.name + ' ' + v.slice(caret);
    input.value = nv; const pos = at + e.name.length + 2; input.setSelectionRange(pos, pos);
    close(); input.focus();
  };
  const update = () => {
    const caret = input.selectionStart ?? input.value.length, before = input.value.slice(0, caret), m = before.match(/(?:^|\s)@(\w*)$/);
    if (!m) return close();
    at = caret - m[1].length - 1; list = matchMentions(m[1]); idx = 0; paint();
  };

  input.addEventListener('input', update);
  input.addEventListener('click', update);
  input.addEventListener('blur', () => setTimeout(close, 120));
  form.addEventListener('submit', close);
  document.addEventListener('mousedown', (e) => { if (!box.hidden && !e.target.closest('#captureForm, .ac')) close(); });
  input.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.metaKey || e.ctrlKey) return;                                     // Cmd+Enter etc. pass through
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % list.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + list.length) % list.length; paint(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(idx); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  box.addEventListener('mousedown', (e) => e.preventDefault());              // keep the input focused
  box.addEventListener('click', (e) => { const t = e.target.closest('.aci'); if (t) pick(+t.dataset.i); });
}
