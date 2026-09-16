import { items, programs, wiki } from '../store.js';
import { days, fmtDate, until, dueLabel } from '../lib/dates.js';
import { $, esc } from '../lib/dom.js';
import { active, activeProjects, openActions, pname, progIdx, projHealth } from '../model.js';
import { prefs } from '../prefs.js';
import { healthPill, pcStyle } from '../ui/fragments.js';

const chev = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

export function viewPrograms() {
  return `<div class="vhead"><div><h1>Programs</h1><p>Every project must have a next action or a waiting-for. Last movement is computed from ledger activity — accepted, done, nudged — never typed in. Stalled means nothing has moved in more than 7 days. Click a project for its history.</p></div><div style="display:flex;gap:10px;align-items:center"><span class="note">Health rolls up: any blocked project blocks the program</span><button class="btn" data-addprog>Add program</button></div></div>
  ${active().map(g => { const js = activeProjects(g.id); const h = js.some(j => j.health === 'crit') ? 'crit' : js.some(j => j.health === 'warn') ? 'warn' : 'good'; const folded = !!prefs.collapsed['prog:' + g.id];
    return `<div class="prog ${folded ? 'folded' : ''}" ${pcStyle(g.id)}><div class="head"><button class="btn sm ghost fold-btn" data-collapse="prog:${g.id}" title="${folded ? 'Expand' : 'Collapse'} ${esc(g.name)}" aria-expanded="${!folded}">${chev}</button>${healthPill(h)}<div class="pname"><h2><button class="pdot" data-colorpick="${g.id}" title="Program color" aria-label="Change color of ${esc(g.name)}"></button>${esc(g.name)}</h2></div><div class="purpose">${esc(g.purpose)}</div><span class="note">${esc(g.cadence)}</span><button class="btn sm" data-wiki="${g.id}">Wiki</button><button class="btn sm" data-addproj="${g.id}">Add project</button><button class="btn sm ghost" data-retire="${g.id}" title="Retire this program">Retire</button></div>
    ${wiki[g.id] ? `<div class="wstatus"><span class="eyebrow">Status · ${wiki[g.id].compiled ? 'compiled ' + fmtDate(wiki[g.id].compiled) + (days(wiki[g.id].compiled) > 7 ? ' <span class="flag">stale</span>' : '') : 'not compiled yet'}</span><p>${esc(wiki[g.id].status)}</p>${folded ? '' : `<div class="wlinks">${wiki[g.id].links.map(l => l[1] ? `<a class="chip" href="${l[1]}">${esc(l[0])}</a>` : `<span class="chip">${esc(l[0])}</span>`).join('')}</div>`}</div>` : ''}
    ${folded ? '' : `<div class="tablewrap"><table><thead><tr><th>Project</th><th>Health</th><th>Next action</th><th>Last movement</th><th>Flags</th></tr></thead><tbody>
    ${js.map(j => { const s = projHealth(j); const open = openActions(j.id), n = open.length;
      /* Next-action cell: the text opens the item; when more actions are open, "+N more open" expands to list them all inline. */
      const naCell = s.na ? `<span class="linkish" data-item="${s.na.id}">${esc(s.na.next)}</span><div class="sub"><span class="chip ctx">${esc(s.na.ctx)}</span>${n > 1 ? `<details class="more"><summary>+${n - 1} more open</summary><ul>${open.filter(a => a.id !== s.na.id).map(a => `<li><span class="linkish" data-item="${a.id}">${esc(a.next)}</span> <span class="chip ctx">${esc(a.ctx)}</span></li>`).join('')}</ul></details>` : ''}</div>`
        : s.dl ? `<span class="muted">Delegated to AI</span><div class="sub"><span class="linkish" data-item="${s.dl.id}">${esc(s.dl.next)}</span> · ${s.dl.del.status === 'ready' ? '<b>ready for review</b>' : s.dl.del.status}</div>`
        : s.w ? `<span class="muted">Waiting on ${esc(pname(s.w.owner))}</span><div class="sub"><span class="linkish" data-item="${s.w.id}">${esc(s.w.next)}</span></div>`
        : `<button class="btn sm" data-proj="${j.id}">Decide next action</button>`;
      return `<tr data-drop="${j.id}"><td><button class="linkish" data-proj="${j.id}">${esc(j.name)}</button><div class="sub">${esc(j.outcome)}</div></td><td>${healthPill(j.health)}</td>
      <td>${naCell}</td>
      <td class="num"><span class="age ${s.stalled ? 'over' : ''}">${s.lm ? s.age + 'd' : '—'}</span>${s.lm ? `<div class="sub">${esc(s.lm.what)}</div>` : '<div class="sub">No activity</div>'}</td><td>${[s.stalled ? '<span class="flag">Stalled</span>' : '', s.noNext ? '<span class="flag">No next action</span>' : ''].filter(Boolean).join('<br>') || '<span class="faint">—</span>'}</td></tr>`; }).join('') || `<tr><td colspan="5" class="muted">No projects yet.</td></tr>`}
    </tbody></table></div>
    <div class="note" style="padding:8px 18px">Every project shows the one action that moves it, or who it's waiting on. Click a project for its history; drag program-level items onto a project to re-home them.</div>
    ${(() => { /* Program-level items: filed against the program, not a project. The method wants every action inside a project (a program has no next action of its own), so these are shown, not hidden — they are the ones to re-home or to spin a project out of. */
      const loose = items.filter(i => i.project === g.id && ((i.kind === 'action' && i.owner !== 'ai') || i.kind === 'waiting' || (i.owner === 'ai' && i.del && i.kind === 'action')));
      if (!loose.length) return '';
      return `<div class="pb" style="border-top:1px solid var(--line)"><div class="ctxgroup"><span class="chip">Program-level · not in a project</span><span class="n">${loose.length}</span><span class="faint" style="font-size:11px">· cadence work and asks filed against the program itself. Drag one onto a project row (any program) to move it, or open it and pick a project.</span></div>
        ${loose.map(i => `<div class="row draggable" draggable="true" data-drag="${i.id}"><span class="grip" aria-hidden="true">⠿</span><div class="t clickable" data-item="${i.id}"><div>${esc(i.next)}</div><div class="m">${i.kind === 'waiting' ? `<span class="chip">${esc(pname(i.owner))}</span><span class="age ${until(i.followUp) < 0 ? 'over' : ''}">${days(i.since)}d waiting</span>` : i.owner === 'ai' ? `<span class="chip aichip">AI · ${i.del.status}</span>` : `<span class="chip ctx">${esc(i.ctx || '—')}</span>${i.hard ? `<span class="chip" style="color:var(--warn);background:var(--warn-soft)">on calendar · ${dueLabel(i.hard)}</span>` : ''}${i.due ? `<span class="age ${until(i.due) < 0 ? 'over' : ''}">${dueLabel(i.due)}</span>` : ''}`}</div></div></div>`).join('')}</div>`; })()}`}</div>`; }).join('')}
  ${!active().length ? `<div class="panel"><div class="empty"><b>No programs yet</b>Add the first one — an area of responsibility with a purpose every project must answer to.</div></div>` : ''}
  ${programs.some(g => g.retired) ? `<div class="panel"><div class="ph"><h2>Retired</h2><span class="note">Purpose met or superseded. Wiki pages kept as history.</span></div><div class="pb">${programs.filter(g => g.retired).map(g => `<div class="row"><div class="t"><div class="muted">${esc(g.name)}</div><div class="m"><span class="faint">retired ${fmtDate(g.retired)}</span><span class="chip mono">wiki/${esc(wiki[g.id]?.page || '')}.md</span></div></div><button class="btn sm ghost" data-wiki="${g.id}">Wiki</button></div>`).join('')}</div></div>` : ''}`;
}

/* Color picker: a vertical popover of the 8 swatches anchored to the program's dot. No state — it lives in the DOM
   until an outside click, Esc, or a re-render (choosing a swatch re-renders). One popover at a time. */
export function closeColorPopover() { $('.pcpop')?.remove(); }
export function colorPopover(gid, anchor) {
  const open = $('.pcpop'); const same = open && open.dataset.for === gid; closeColorPopover(); if (same) return;
  const cur = progIdx(gid);
  const pop = document.createElement('div'); pop.className = 'pcpop'; pop.dataset.for = gid; pop.setAttribute('role', 'listbox'); pop.setAttribute('aria-label', 'Program color');
  pop.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(c => `<button class="sw ${cur === c ? 'on' : ''}" style="--sw:var(--c${c})" data-pcolor="${gid}|${c}" title="Color ${c}" aria-label="Color ${c}" role="option" aria-selected="${cur === c}"></button>`).join('');
  anchor.insertAdjacentElement('afterend', pop);
  pop.querySelector('.sw.on, .sw')?.focus();
}
document.addEventListener('click', (e) => { const pop = $('.pcpop'); if (pop && !pop.contains(e.target) && !e.target.closest('[data-colorpick]')) closeColorPopover(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('.pcpop')) { closeColorPopover(); e.stopPropagation(); } }, true);
