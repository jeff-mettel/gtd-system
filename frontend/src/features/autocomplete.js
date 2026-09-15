// "@" autocomplete for any text input: programs, projects (under their program) and people.
// Selecting inserts "@<Name> "; on capture, parseMentions() turns those back into ids.
// attachAutocomplete(input, { host }) wires one input; initAutocomplete() wires the top-bar capture box.

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

/* "@Billing platform migration @Priya" → { ids, project, owner, spans }. Longest names first so "@Sam" cannot eat
   "@Sam Reyes". A project beats a program for `project`; people also match on first name. `spans` lists the matched
   text of each mention (with its "@") so a parser can lift it out of the sentence. */
export function parseMentions(text) {
  const found = [], spans = [];
  const cands = mentionables().flatMap(e => e.type === 'person' ? [[e.name, e], [e.name.split(' ')[0], e]] : [[e.name, e]]).sort((a, b) => b[0].length - a[0].length);
  let rest = text;
  for (const [name, e] of cands) { const re = new RegExp('@' + escRe(name) + '(?![\\w-])', 'i'); const m = re.exec(rest); if (m) { found.push(e); spans.push({ text: m[0], id: e.id, type: e.type }); rest = rest.replace(re, ' '); } }
  const project = found.find(e => e.type === 'project') || found.find(e => e.type === 'program');
  const owner = found.find(e => e.type === 'person');
  return { ids:[...new Set(found.map(e => e.id))], project:project?.id ?? null, owner:owner?.id ?? null, spans };
}

/**
 * Wire "@" completion onto one input. `host` is the positioned element the list is appended to (defaults to the
 * input's parent form's parent); the list sits under the input. Returns { close }.
 */
export function attachAutocomplete(input, { host } = {}) {
  const form = input.form || input.closest('form');
  host = host || form?.parentElement || input.parentElement;
  const box = document.createElement('div'); box.className = 'ac'; box.hidden = true; host.appendChild(box);
  let list = [], idx = 0, at = -1;      // `at` = index of the "@" being completed

  const close = () => { box.hidden = true; list = []; at = -1; };
  const place = () => {
    const ir = input.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const ref = form && host.contains(form) ? form.getBoundingClientRect() : ir;
    box.style.left = (ref.left - hr.left + host.scrollLeft) + 'px'; box.style.top = (ref.bottom - hr.top + host.scrollTop + 4) + 'px'; box.style.minWidth = Math.min(ref.width, 420) + 'px';
  };
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
    close(); input.focus(); input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const update = () => {
    const caret = input.selectionStart ?? input.value.length, before = input.value.slice(0, caret), m = before.match(/(?:^|\s)@(\w*)$/);
    if (!m) return close();
    at = caret - m[1].length - 1; list = matchMentions(m[1]); idx = 0; paint();
  };

  input.addEventListener('input', update);
  input.addEventListener('click', update);
  input.addEventListener('blur', () => setTimeout(close, 120));
  form?.addEventListener('submit', close);
  document.addEventListener('mousedown', (e) => { if (!box.hidden && e.target !== input && !e.target.closest('.ac')) close(); });
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
  return { close, isOpen: () => !box.hidden };
}

export function initAutocomplete() {
  const input = $('#captureInput'), bar = $('.topbar');
  if (!input || !bar) return;
  attachAutocomplete(input, { host: bar });
}
