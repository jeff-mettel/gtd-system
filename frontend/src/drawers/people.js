// Prep brief, nudge draft, 1:1 agenda.

import { items, meetings, wiki } from '../store.js';
import { days, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { by, msDate, person, pname, projHealth, projOf } from '../model.js';
import { openDrawer } from '../ui/drawer.js';
import { healthPill } from '../ui/fragments.js';

export function prepBrief(i) {
  const m = meetings[i];
  const open = items.filter(x => ((x.kind === 'action' && x.owner !== 'ai') || x.kind === 'waiting') && (m.projects.includes(x.project) || m.who.includes(x.owner)));
  const agenda = m.who.flatMap(w => person(w).agenda.slice(0, 2).map(a => `${pname(w)}: ${a}`));
  openDrawer(`Prep · ${esc(m.title)}`, `
    <div class="sec"><div class="eyebrow">${m.time} · ${m.dur} min · ${m.who.map(w => esc(person(w).name)).join(', ')}</div></div>
    <div class="sec"><h3>Projects in play</h3><ul>${m.projects.map(p => { const j = projOf(p), s = projHealth(j); return `<li><b>${esc(j.name)}</b> ${healthPill(j.health)}<br><span class="muted">${s.na ? 'Next: ' + esc(s.na.next) : s.w ? 'Waiting on ' + esc(pname(s.w.owner)) : 'No next action'}</span></li>`; }).join('')}</ul></div>
    <div class="sec"><h3>Open between you and attendees</h3><ul>${open.map(x => `<li>${x.kind === 'waiting' ? `<span class="chip">${esc(pname(x.owner))} owes</span> ` : ''}${esc(x.next)}${x.kind === 'waiting' ? ` <span class="age ${until(x.followUp) < 0 ? 'over' : ''}">${days(x.since)}d</span>` : ''}</li>`).join('') || '<li class="faint">Nothing open</li>'}</ul></div>
    <div class="sec"><h3>Raise</h3><ul>${agenda.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
    ${(() => { const ws = [...new Set(m.projects.map(p => projOf(p)?.program || p))].map(g => wiki[g]).filter(Boolean); const dec = ws.flatMap(w => w.decisions.slice(0, 2)); const rk = ws.flatMap(w => w.risks.filter(r => !r.owner || m.who.includes(r.owner))); const ms = ws.flatMap(w => w.milestones.map(x => ({ m:x, on:msDate(x), prog:w })).filter(x => x.on && until(x.on) >= -1 && until(x.on) <= 14 && x.m[2] !== 'done')).sort((a, b) => a.on - b.on); return `${dec.length ? `<div class="sec"><h3>Recent decisions <span class="faint" style="font-weight:400">· from the wiki</span></h3><ul>${dec.map(x => `<li><b>${esc(x.what)}</b> <span class="faint">${x.on}</span>${x.status !== 'decided' ? ` <span class="pill warn"><i></i>${esc(x.status)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${ms.length ? `<div class="sec"><h3>Milestones ahead <span class="faint" style="font-weight:400">· next 14 days, from the wiki</span></h3><ul>${ms.map(x => `<li><span class="mono num">${esc(x.m[0])}</span> ${esc(x.m[1])} <span class="pill ${x.m[2] === 'blocked' ? 'crit' : x.m[2] === 'at risk' ? 'warn' : 'neutral'}"><i></i>${esc(x.m[2])}</span></li>`).join('')}</ul></div>` : ''}
    ${rk.length ? `<div class="sec"><h3>Watch for <span class="faint" style="font-weight:400">· open risks with attendees</span></h3><ul>${rk.map(r => `<li><span class="pill ${r.level === 'high' ? 'crit' : r.level === 'medium' ? 'warn' : 'neutral'}"><i></i>${r.level}</span> ${esc(r.what)} <span class="faint">· ${r.owner ? esc(pname(r.owner)) : 'no owner'}</span></li>`).join('')}</ul></div>` : ''}`; })()}
    <div class="note">Commitments from the ledger; decisions and risks from the wiki. Notes you take after the meeting are captured back into the inbox.</div>`,
    `<button class="btn" data-close>Done</button>`);
}

export function nudgeDraft(id) {
  const w = items.find(x => x.id === id), p = person(w.owner) || { name: 'the owner' }, j = projOf(w.project) || { name: 'this', health: 'good' };
  const text = `Hi ${person(w.owner) ? pname(w.owner) : 'there'},\n\nQuick check-in on ${w.next.toLowerCase()} for ${j.name}. It's been ${days(w.since)} days${w.nudges ? ` and I've pinged once or twice already` : ''}, and it's now on the critical path${j.health === 'crit' ? ' — the project is blocked on it' : ''}.\n\nIs there anything I can do to make it easier — a 20-minute working session, or someone else I should loop in? A date, even a rough one, would help me plan around it.\n\nThanks,\nJeff`;
  openDrawer(`Nudge · ${esc(p.name)}`, `<div class="sec"><div class="eyebrow">Waiting ${days(w.since)} days · ${w.nudges || 0} previous nudge${w.nudges === 1 ? '' : 's'} · ${esc(j.name)}</div></div>
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
