import { active, items, people, wiki } from '../data/example.js';
import { TODAY } from '../lib/dates.js';
import { by, dueLabel, esc, fmtDate, person } from '../model.js';

export function viewReference() {
  const refs = by('reference');
  const group = (pid) => refs.filter(r => r.refPage === pid);
  const refRow = (r) => `<div class="row"><div class="t"><div>${esc(r.next)}</div><div class="m"><span class="faint">filed ${fmtDate(r.filedAt || TODAY)}</span>${r.revisit ? `<span class="chip" style="color:var(--accent-text);background:var(--accent-soft)">↺ tickler ${dueLabel(r.revisit)}</span>` : ''}</div></div><button class="btn sm ghost" data-drop="${r.id}">Drop</button></div>`;
  return `<div class="vhead"><div><h1>Reference</h1><p>Not actionable, worth keeping. Reference lives in the wiki, so this list is the wiki index: program hubs with their key links and filed items, people pages, and standalone reference pages.</p></div><span class="note num">${refs.length} filed items · ${Object.keys(wiki).length + people.length} pages</span></div>
  ${active().map(g => { const w = wiki[g.id]; const rs = group(g.id); return `<div class="panel"><div class="ph"><h2>${esc(g.name)}</h2><div style="display:flex;gap:8px;align-items:center"><span class="chip mono">wiki/${esc(w.page)}.md</span><button class="btn sm" data-wiki="${g.id}">Open hub</button></div></div>
    <div class="wstatus" style="border-bottom:0"><span class="eyebrow">Key links</span><div class="wlinks">${w.links.filter(l => l[1]).map(l => `<a class="chip" href="${l[1]}">${esc(l[0])}</a>`).join('') || '<span class="faint">none yet</span>'}</div></div>
    ${rs.length ? `<div class="pb" style="border-top:1px solid var(--line)">${rs.map(refRow).join('')}</div>` : ''}</div>`; }).join('')}
  <div class="panel"><div class="ph"><h2>People pages</h2><span class="note">wiki/person-*.md</span></div><div class="pb">${people.map(x => { const rs = group(x.id); return `<div class="row"><div class="t"><div>${esc(x.name)} <span class="faint">· ${esc(x.role)}</span></div>${rs.length ? `<div class="m">${rs.map(r => `<span class="chip">${esc(r.next)}</span>`).join('')}</div>` : ''}</div><button class="btn sm ghost" data-agenda="${x.id}">Open</button></div>`; }).join('')}</div></div>
  ${group('new').length ? `<div class="panel"><div class="ph"><h2>Reference pages</h2><span class="note">wiki/ref-*.md</span></div><div class="pb">${group('new').map(refRow).join('')}</div></div>` : ''}`;
}
export function viewPeople() {
  return `<div class="vhead"><div><h1>People</h1><p>Each stakeholder in both directions: what they owe you, what you owe them, and the queue for your next conversation.</p></div></div>
