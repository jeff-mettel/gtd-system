// Project, program and wiki drawers.

import { active, activeProjects, aiLog, autonomyLabel, capLabel, d, iso, items, people, programs, projects, slug, wiki, wikiOf, wikiStub } from '../data/example.js';
import { openDrawer } from './people.js';
import { TODAY } from '../lib/dates.js';
import { activity, by, days, dueLabel, esc, fmtDate, healthPill, openActions, person, pname, projName, projOf, until } from '../model.js';
import { save, state } from '../state.js';
import { $ } from '../ui/fragments.js';
import { projHealth } from '../ui/nav.js';
import { waitingRow } from '../views/now.js';

    <textarea class="draft" id="nudgeText">${esc(text)}</textarea>
    <div class="note">Drafted by AI from the ledger. Nothing is sent until you approve; approving logs the nudge and moves follow-up out 5 days.</div>`,
    `<button class="btn" data-close>Discard</button><button class="btn primary" data-send="${id}">Approve and send</button>`);
}
export function agendaDrawer(pid) {
  const p = person(pid);
  openDrawer(`1:1 agenda · ${esc(p.name)}`, `<div class="sec"><div class="eyebrow">${esc(p.role)} · last touched ${days(p.lastTouched)}d ago</div></div>
    <div class="sec"><h3>Queued to raise</h3><ul>${p.agenda.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
    <div class="sec"><h3>They owe me</h3><ul>${by('waiting').filter(w => w.owner === pid).map(w => `<li>${esc(w.next)} <span class="age ${until(w.followUp) < 0 ? 'over' : ''}">${days(w.since)}d</span></li>`).join('') || '<li class="faint">Nothing open</li>'}</ul></div>
    <div class="note">Items tagged <code class="mono">@1:1/${pid}</code> and anything captured with their name queue here automatically.</div>`, `<button class="btn" data-close>Close</button>`);
}
export function projectDrawer(pid) {
  const j = projOf(pid), isProg = !!programs.find(g => g.id === pid), s = projHealth(j), open = openActions(pid), waits = items.filter(i => i.kind === 'waiting' && i.project === pid), done = items.filter(i => i.kind === 'done' && i.project === pid), ev = activity(pid);
  const ctxs = ['@quick', '@deep', '@1:1/priya', '@1:1/leo', '@1:1/marcus', '@agenda/steering'];
  openDrawer(esc(j.name), `
    <div class="sec"><div class="eyebrow">${isProg ? 'Program' : esc(projName(j.program))} · ${healthPill(j.health)}</div>${j.outcome ? `<p class="muted" style="margin:8px 0 0"><b class="eyebrow" style="display:block;margin-bottom:2px">Outcome</b>${esc(j.outcome)}</p>` : ''}</div>
    <div class="sec"><h3>Last movement</h3>${s.lm ? `<div><span class="age ${s.stalled ? 'over' : ''}">${s.age}d ago</span> · ${esc(s.lm.what)}: ${esc(s.lm.item.next)}</div>` : '<div class="flag">No activity recorded</div>'}${s.stalled ? '<div class="note" style="margin-top:4px">Stalled — nothing in the ledger has moved in over 7 days.</div>' : ''}</div>
    <div class="sec"><h3>Open actions · ${open.length}</h3>${open.length ? `<div class="panel"><div class="pb">${open.map(a => { const prim = s.na?.id === a.id; return `<div class="row"><div class="t"><div>${esc(a.next)}${prim ? ' <span class="chip" style="color:var(--accent-text);background:var(--accent-soft)">next</span>' : ''}</div><div class="m"><span class="chip ctx">${esc(a.ctx)}</span>${a.min ? `<span class="num">${a.min} min</span>` : ''}${a.due ? `<span class="age ${until(a.due) < 0 ? 'over' : ''}">${dueLabel(a.due)}</span>` : ''}</div></div>${!prim && open.length > 1 ? `<button class="btn sm" data-primary="${a.id}">Make it the next action</button>` : ''}</div>`; }).join('')}</div></div>` : `<div class="note">None. ${waits.length ? 'Covered by a waiting-for below.' : 'This project cannot move until you decide one.'}</div>`}
      ${open.length > 1 ? '<div class="note" style="margin-top:6px">Several actions are open; the one marked <b>next</b> is what the Programs table and the morning brief lead with.</div>' : ''}</div>
    <div class="sec"><h3>${open.length ? 'Add another action' : 'Decide the next action'}</h3><div class="note" style="margin-bottom:6px">AI suggestion from the outcome and recent activity — edit freely, then confirm.</div>
      <input id="suggestText" class="draft" style="min-height:0;padding:9px 12px" value="${esc(j.suggest || 'Book 20 minutes with the owner to agree the next step')}" aria-label="Next action">
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><select id="suggestCtx" style="border:1px solid var(--line);background:var(--ground);border-radius:6px;padding:6px 9px">${ctxs.map(c => `<option ${c === '@deep' ? 'selected' : ''}>${c}</option>`).join('')}</select><button class="btn primary sm" data-addnext="${pid}">Add as next action</button><span id="suggestErr" class="note" style="color:var(--crit)"></span></div></div>
    ${waits.length ? `<div class="sec"><h3>Waiting for · ${waits.length}</h3><div class="panel"><div class="pb">${waits.map(w => waitingRow(w, { showOwner:true })).join('')}</div></div></div>` : ''}
    ${(() => { const w = wikiOf(pid); if (!w) return ''; const dec = w.decisions.filter(x => isProg || x.projects.includes(pid)); const rk = w.risks.filter(x => isProg || x.projects.includes(pid)); return `<div class="sec"><h3>From the wiki</h3><div class="wlinks">${w.links.slice(0, 3).map(l => l[1] ? `<a class="chip" href="${l[1]}">${esc(l[0])}</a>` : `<span class="chip">${esc(l[0])}</span>`).join('')}<button class="btn sm ghost" data-wiki="${isProg ? pid : j.program}">Open ${esc(w.page)}</button></div>
      ${dec.length ? `<div class="wrow"><span class="eyebrow">Latest decision</span><div><b>${esc(dec[0].what)}</b> <span class="faint">${dec[0].on} · ${esc(dec[0].who)}</span><div class="muted">${esc(dec[0].why)}</div></div></div>` : ''}
      ${rk.length ? `<div class="wrow"><span class="eyebrow">Open risk</span><div><span class="pill ${rk[0].level === 'high' ? 'crit' : rk[0].level === 'medium' ? 'warn' : 'neutral'}"><i></i>${rk[0].level}</span> ${esc(rk[0].what)} <span class="faint">· ${rk[0].owner ? esc(pname(rk[0].owner)) : 'no owner'}</span></div></div>` : ''}</div>`; })()}
    <div class="sec"><h3>History</h3>${ev.length ? `<ul class="hist">${ev.map(e => `<li><span class="mono num">${fmtDate(e.when)}</span> <span class="muted">${esc(e.what)}</span> · ${esc(e.item.next)}</li>`).join('')}</ul>` : '<div class="note">Nothing yet.</div>'}</div>
    <div class="note">Movement is derived from these events. Nothing on this page is a status field someone remembered to update.</div>`,
    `<button class="btn" data-close>Close</button>`);
}
export function createProgram(g, firstProject, firstAction, ctx) {
  g.id = 'PN' + Date.now(); programs.push(g); state.programs.push(g); wiki[g.id] = wikiStub(g);
  if (firstProject) {
    const j = { id:'JN' + Date.now(), program:g.id, name:firstProject, outcome:'', health:'good', suggest:'Write the outcome — what does done look like?' };
    projects.push(j); state.projects.push(j);
    if (firstAction) { const aid = 'N' + Date.now(); const a = { id:aid, kind:'action', next:firstAction, project:j.id, ctx:ctx || '@deep', min:30, createdAt:TODAY }; items.push(a); state.captured.push(Object.assign({}, a, { createdAt:iso(TODAY) })); state.primary[j.id] = aid; }
  } else if (firstAction) { const aid = 'N' + Date.now(); const a = { id:aid, kind:'action', next:firstAction, project:g.id, ctx:ctx || '@deep', min:30, createdAt:TODAY }; items.push(a); state.captured.push(Object.assign({}, a, { createdAt:iso(TODAY) })); }
  save(); return g;
}
export function addProgramDrawer() {
  const field = (id, label, html) => `<div class="fld"><label for="${id}">${label}</label>${html}</div>`;
  openDrawer('New program', `
    <div class="note">A program is an <b>area of responsibility</b> — one of the handful of things you are accountable for over a long period. Projects come and go weekly; programs change a few times a year. Its purpose is the question every project underneath must answer.</div>
    <div class="form">
      ${field('ngName', 'Program', `<input id="ngName" class="in" placeholder="e.g. Vendor risk function" autocomplete="off">`)}
      ${field('ngPurpose', 'Purpose — why does this exist?', `<textarea id="ngPurpose" class="in" rows="2" placeholder="One checkable sentence: 'Every tooling vendor has a risk rating and an owner by Q2, reviewed quarterly'"></textarea>`)}
      ${field('ngSponsor', 'Sponsor', `<select id="ngSponsor" class="in">${people.map(x => `<option value="${x.id}" ${x.id === 'ingrid' ? 'selected' : ''}>${esc(x.name)} — ${esc(x.role)}</option>`).join('')}</select>`)}
      ${field('ngCadence', 'Cadence', `<input id="ngCadence" class="in" value="Status Fri" placeholder="e.g. Steering Thu · status Fri">`)}
      ${field('ngProj', 'First project (optional)', `<input id="ngProj" class="in" placeholder="Short name" autocomplete="off">`)}
      ${field('ngNext', 'Its first next action', `<input id="ngNext" class="in" placeholder="Verb first" autocomplete="off">`)}
      <div id="npErr" class="note" style="color:var(--crit)"></div>
    </div>
    <div class="sec"><h3>What creating does</h3><ul><li>Adds the program to the rail counts and every project picker</li><li>Creates <code class="mono">wiki/program-&lt;slug&gt;.md</code> with the purpose and empty compiled sections, plus its <code class="mono">index.md</code> line</li><li>Creates the <code class="mono">@agenda/&lt;program&gt;</code> context from the cadence</li></ul></div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" data-saveprog>Create program</button>`);
  $('#ngName').focus();
}
export function retireDrawer(gid) {
  const g = programs.find(x => x.id === gid), js = activeProjects(gid), others = active().filter(x => x.id !== gid);
  openDrawer(`Retire · ${esc(g.name)}`, `
    <div class="sec"><div class="eyebrow">Purpose</div><p class="muted" style="margin:4px 0 0">${esc(g.purpose)}</p></div>
    <div class="sec"><h3>Open projects · ${js.length}</h3>${js.length ? `<div class="panel"><div class="pb">${js.map(j => `<div class="row"><div class="t"><div>${esc(j.name)}</div><div class="m">${healthPill(j.health)}</div></div><select class="in" style="width:auto" data-moveproj="${j.id}"><option value="">Move to…</option>${others.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select><button class="btn sm ghost" data-dropproj="${j.id}">Drop</button></div>`).join('')}</div></div><div class="note" style="margin-top:6px">A program can't retire with open projects. Move each to another program or drop it — dropping keeps its history.</div>` : '<div class="note">None. This program can be retired.</div>'}</div>
    <div class="sec"><h3>What retiring does</h3><ul><li>Marks the program retired today; it leaves the rail counts and pickers</li><li>Keeps <code class="mono">wiki/${esc(wiki[gid]?.page || '')}.md</code> and its decisions and timeline as history</li><li>Nothing is deleted; a compensating event can un-retire it</li></ul></div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" data-doretire="${gid}" ${js.length ? 'disabled' : ''}>Retire program</button>`);
}
export function addProjectDrawer(gid) {
  const g = programs.find(x => x.id === gid);
  const ctxs = ['@deep', '@quick', '@1:1/priya', '@1:1/leo', '@1:1/marcus', '@agenda/steering'];
  const field = (id, label, html) => `<div class="fld"><label for="${id}">${label}</label>${html}</div>`;
  openDrawer(`New project · ${esc(g.name)}`, `
    <div class="sec"><div class="eyebrow">Program purpose</div><p class="muted" style="margin:4px 0 0">${esc(g.purpose)}</p></div>
    <div class="form">

  <div class="lanes">${lane('Queued', q, 'Nothing queued')}${lane('Working', w, 'Idle')}${lane('Ready for review', r, 'Nothing waiting on you')}</div>
  <div class="cols">
    <div class="panel"><div class="ph"><h2>Autonomy</h2><span class="note">What the assistant may do without asking</span></div>
      <div class="tablewrap"><table><tbody>${Object.keys(capLabel).filter(c => c !== 'clarify').map(c => `<tr><td>${esc(capLabel[c])}</td><td style="width:210px"><select class="in" data-autonomy="${c}">${opts(c).map(o => `<option value="${o}" ${(state.autonomy[c] || 'ask') === o ? 'selected' : ''}>${autonomyLabel[o]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <div class="note" style="padding:10px 18px">Sending, booking and deleting can never go above "Always ask first". Everything the assistant does — including at "Do it" — is logged and shows up in the weekly review.</div>
    </div>
    <div class="panel"><div class="ph"><h2>This week's log</h2><span class="note">Every AI action, asked or automatic</span></div>
      <div class="pb">${aiLog.map(l => `<div class="row"><div class="t"><div>${esc(l.what)}</div><div class="m"><span class="chip">${esc(capLabel[l.cap] || l.cap)}</span><span class="chip ${l.mode === 'auto' ? 'aichip' : ''}">${l.mode === 'auto' ? 'automatic' : 'you approved'}</span><span class="faint">${fmtDate(l.at)}</span></div></div></div>`).join('')}</div>
    </div>
  </div>`;
}
export function wikiDrawer(pid) {
  const g = programs.find(x => x.id === pid), w = wiki[pid]; if (!w) return;
  const st = (x) => ({ done:'good', 'on track':'good', locked:'good', 'at risk':'warn', 'room clash':'warn', 'pending window':'warn', blocked:'crit', undecided:'crit' })[x] || 'neutral';
