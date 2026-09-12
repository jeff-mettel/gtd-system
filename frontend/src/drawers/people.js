// Prep brief, nudge draft, 1:1 agenda.

import { d, items, meetings, projects, wiki } from '../data/example.js';
import { by, days, esc, healthPill, person, pname, projOf, until } from '../model.js';
import { cycle } from '../state.js';
import { $ } from '../ui/fragments.js';
import { I, projHealth } from '../ui/nav.js';

  <div class="panel"><div class="ph"><h2>Cycle time by list</h2><span class="note">Where work waits</span></div><div class="tablewrap"><table><thead><tr><th>Stage</th><th>Median</th><th>P90</th><th>Note</th></tr></thead><tbody>${cycle.map(c => `<tr><td>${c.list}</td><td class="num">${c.median}</td><td class="num">${c.p90}</td><td class="muted">${c.note}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- drawer ---------- */
export function openDrawer(title, body, foot = '') {
  const dr = $('#drawer');
  dr.innerHTML = `<div class="dh"><h2>${title}</h2><button class="btn sm" data-close>Close</button></div><div class="db">${body}</div>${foot ? `<div class="df">${foot}</div>` : ''}`;
  dr.classList.add('open'); $('#drawerBg').classList.add('open');
  dr.querySelector('button, textarea, input')?.focus();
}
export function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerBg').classList.remove('open'); }
export function prepBrief(i) {
  const m = meetings[i];
  const open = items.filter(x => ((x.kind === 'action' && x.owner !== 'ai') || x.kind === 'waiting') && (m.projects.includes(x.project) || m.who.includes(x.owner)));
  const agenda = m.who.flatMap(w => person(w).agenda.slice(0, 2).map(a => `${pname(w)}: ${a}`));
  openDrawer(`Prep · ${esc(m.title)}`, `
    <div class="sec"><div class="eyebrow">${m.time} · ${m.dur} min · ${m.who.map(w => esc(person(w).name)).join(', ')}</div></div>
    <div class="sec"><h3>Projects in play</h3><ul>${m.projects.map(p => { const j = projOf(p), s = projHealth(j); return `<li><b>${esc(j.name)}</b> ${healthPill(j.health)}<br><span class="muted">${s.na ? 'Next: ' + esc(s.na.next) : s.w ? 'Waiting on ' + esc(pname(s.w.owner)) : 'No next action'}</span></li>`; }).join('')}</ul></div>
    <div class="sec"><h3>Open between you and attendees</h3><ul>${open.map(x => `<li>${x.kind === 'waiting' ? `<span class="chip">${esc(pname(x.owner))} owes</span> ` : ''}${esc(x.next)}${x.kind === 'waiting' ? ` <span class="age ${until(x.followUp) < 0 ? 'over' : ''}">${days(x.since)}d</span>` : ''}</li>`).join('') || '<li class="faint">Nothing open</li>'}</ul></div>
    <div class="sec"><h3>Raise</h3><ul>${agenda.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
    ${(() => { const ws = [...new Set(m.projects.map(p => projOf(p)?.program || p))].map(g => wiki[g]).filter(Boolean); const dec = ws.flatMap(w => w.decisions.slice(0, 2)); const rk = ws.flatMap(w => w.risks.filter(r => !r.owner || m.who.includes(r.owner))); return `${dec.length ? `<div class="sec"><h3>Recent decisions <span class="faint" style="font-weight:400">· from the wiki</span></h3><ul>${dec.map(x => `<li><b>${esc(x.what)}</b> <span class="faint">${x.on}</span>${x.status !== 'decided' ? ` <span class="pill warn"><i></i>${esc(x.status)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${rk.length ? `<div class="sec"><h3>Watch for <span class="faint" style="font-weight:400">· open risks with attendees</span></h3><ul>${rk.map(r => `<li><span class="pill ${r.level === 'high' ? 'crit' : r.level === 'medium' ? 'warn' : 'neutral'}"><i></i>${r.level}</span> ${esc(r.what)} <span class="faint">· ${r.owner ? esc(pname(r.owner)) : 'no owner'}</span></li>`).join('')}</ul></div>` : ''}`; })()}
    <div class="note">Commitments from the ledger; decisions and risks from the wiki. Notes you take after the meeting are captured back into the inbox.</div>`,
    `<button class="btn" data-close>Done</button>`);
}
export function nudgeDraft(id) {
  const w = items.find(x => x.id === id), p = person(w.owner), j = projOf(w.project);
  const text = `Hi ${pname(w.owner)},\n\nQuick check-in on ${w.next.toLowerCase()} for ${j.name}. It's been ${days(w.since)} days${w.nudges ? ` and I've pinged once or twice already` : ''}, and it's now on the critical path${j.health === 'crit' ? ' — the project is blocked on it' : ''}.\n\nIs there anything I can do to make it easier — a 20-minute working session, or someone else I should loop in? A date, even a rough one, would help me plan around it.\n\nThanks,\nJeff`;
  openDrawer(`Nudge · ${esc(p.name)}`, `<div class="sec"><div class="eyebrow">Waiting ${days(w.since)} days · ${w.nudges || 0} previous nudge${w.nudges === 1 ? '' : 's'} · ${esc(j.name)}</div></div>
