import { calendarAhead, items, meetings, programs, projects } from '../data/example.js';
import { d, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, activeProjects, by, delegated, energyOf, mine, projHealth, projName, projOf } from '../model.js';
import { state } from '../state.js';
import { actionRow, projChip, readyRow, waitingRow } from '../ui/fragments.js';
import { ui } from '../ui/session.js';

/* ---------- views ---------- */
export function viewNow() {
  const all = mine(), ready = delegated('ready');
  const hardToday = all.filter(a => a.hard && until(a.hard) === 0);
  const actions = all.filter(a => !a.hard || until(a.hard) < 0).filter(a => (ui.nowTime === 0 || (a.min || 15) <= ui.nowTime || (ui.nowTime === 60 && (a.min || 15) >= 60)) && (ui.nowEnergy === '' || energyOf(a) === ui.nowEnergy)).filter(a => ui.nowScope === '' || a.project === ui.nowScope || projOf(a.project)?.program === ui.nowScope);
  const over = by('waiting').filter(w => until(w.followUp) < 0);
  const dueSoon = all.filter(a => a.due && until(a.due) <= 1);
  const noNext = projects.filter(p => !p.dropped && !programs.find(g => g.id === p.program)?.retired && projHealth(p).noNext);
  const groups = {};
  const byProg = state.nowGroup === 'program';
  const gkey = (a) => byProg ? (a.project ? (projOf(a.project)?.program || a.project) : '—') : a.ctx;
  for (const a of actions) (groups[gkey(a)] ||= []).push(a);
  const order = ['@quick', '@deep', '@1:1/priya', '@1:1/leo', '@agenda/steering'];
  const keys = byProg ? [...programs.map(g => g.id), '—'].filter(k => groups[k]) : Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const free = 'Free 11:00–13:00 (2 h) · 14:00–15:30 (1.5 h)';
  return `<div class="vhead"><div><h1>Monday, 14 September</h1><p>${free}. Deep-work items fit the morning block; the two quick reviews fit before the 1:1.</p></div><div class="shortcuts"><span>Calendar items are the <b>hard landscape</b> — they must happen on the day, so they live in Today and the week strip, not in the context lists.</span></div></div>
  <div class="attn">
    <a href="#inbox" class="tile link ${by('inbox').length ? 'warn' : ''}"><div class="v">${by('inbox').length}</div><div class="l">in the inbox to clarify</div><div class="go">Clarify →</div></a>
    <a href="#waiting" class="tile link ${over.length ? 'crit' : ''}"><div class="v">${over.length}</div><div class="l">waiting-fors past follow-up</div><div class="go">Chase →</div></a>
    <button class="tile link ${dueSoon.length ? 'warn' : ''}" data-duelist><div class="v">${dueSoon.length}</div><div class="l">actions due by tomorrow</div><div class="go">See them →</div></button>
    <a href="#programs" class="tile link ${noNext.length ? 'crit' : ''}"><div class="v">${noNext.length}</div><div class="l">projects with no next action</div><div class="go">Decide →</div></a>
  </div>
  ${ready.length ? `<div class="panel ready"><div class="ph"><h2>Ready for your review</h2><a href="#delegated" class="note">Delegated ledger →</a></div><div class="pb">${ready.map(readyRow).join('')}</div></div>` : ''}
  ${(() => { const days7 = [...Array(7)].map((_, i) => d(i)); return `<div class="panel"><div class="ph"><h2>Hard landscape · next 7 days</h2><div style="display:flex;gap:10px;align-items:center"><span class="note">${state.collapsed.strip ? '' : 'Meetings and day-specific actions — click a meeting today for its prep brief. Ticklers resurface into the inbox on their day.'}</span><button class="btn sm ghost" data-collapse="strip">${state.collapsed.strip ? 'Expand' : 'Collapse'}</button></div></div>
    ${state.collapsed.strip ? '' : `<div class="cal week">${days7.map((day, i) => { const ms = i === 0 ? meetings.map(m => ({ time:m.time, title:m.title })) : calendarAhead.filter(c => until(c.on) === i); const hs = all.filter(a => a.hard && until(a.hard) === i); const ts = items.filter(x => (x.kind === 'someday' || x.kind === 'reference') && x.revisit && until(x.revisit) === i); const dow = day.getDay(), wk = dow === 0 || dow === 6;
      return `<div class="cal-col ${i === 0 ? 'today' : ''} ${wk ? 'wk' : ''}"><div class="cal-h"><b>${i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday:'short' })}</b><span>${day.getDate()}</span></div>${ms.map((m, k) => i === 0 ? `<button class="cal-item mtg" data-prep="${k}" title="Prep brief">${m.time}<span>${esc(m.title)}</span></button>` : `<div class="cal-item mtg">${m.time}<span>${esc(m.title)}</span></div>`).join('')}${hs.map(a => `<button class="cal-item hard" data-proj="${a.project}" title="${esc(a.next)}">${esc(a.next)}<span>${esc(projName(a.project))}</span></button>`).join('')}${ts.map(t => `<div class="cal-item tick" title="Tickler: ${esc(t.next)}">↺ ${esc(t.next)}<span>resurfaces</span></div>`).join('')}</div>`; }).join('')}</div>`}</div>`; })()}

    <div class="panel"><div class="ph"><h2>Next actions by ${byProg ? 'program' : 'context'}</h2><span class="seg" style="margin-left:6px"><button data-group="context" class="${byProg ? '' : 'on'}">by context</button><button data-group="program" class="${byProg ? 'on' : ''}">by program</button></span><span class="sp" style="flex:1"></span><span class="note num">${actions.length} shown · ${delegated().length} with AI</span></div>
      <div class="filters"><span class="faint">I have</span><span class="seg">${[[0, 'any time'], [15, '≤ 15 min'], [30, '≤ 30 min'], [60, '60+ min']].map(f => `<button data-ftime="${f[0]}" class="${ui.nowTime === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">energy</span><span class="seg">${[['', 'any'], ['low', 'low'], ['high', 'high']].map(f => `<button data-fenergy="${f[0]}" class="${ui.nowEnergy === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">scope</span><select class="in" style="width:auto;padding:3px 8px;font-size:12px" data-fscope aria-label="Program or project"><option value="">all programs</option>${active().map(g => `<optgroup label="${esc(g.name)}"><option value="${g.id}" ${ui.nowScope === g.id ? 'selected' : ''}>${esc(g.name)} — whole program</option>${activeProjects(g.id).map(j => `<option value="${j.id}" ${ui.nowScope === j.id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</optgroup>`).join('')}</select>${ui.nowScope || ui.nowTime || ui.nowEnergy ? `<button class="btn sm ghost" data-fclear>Clear</button>` : ''}</div>
      <div class="pb">${hardToday.length ? `<div class="pinned"><div class="ph2"><span class="pin-label">Must happen today</span><span class="n">${hardToday.length}</span><span class="pin-why">pulled to the top from every ${byProg ? 'program' : 'context'} — day-specific, so it is not in the lists below</span></div>${hardToday.map(actionRow).join('')}</div><div class="pin-rest">Everything below can be done whenever it fits · by ${byProg ? 'program' : 'context'}</div>` : ''}${keys.map(k => `<div class="ctxgroup">${byProg ? `${k === '—' ? '<span class="chip">No project</span>' : projChip(k)}` : `<span class="chip ctx">${esc(k)}</span>`}<span class="n">${groups[k].length}</span></div>${groups[k].map(actionRow).join('')}`).join('')}</div>
    </div>
  ${over.length ? `<div class="panel"><div class="ph"><h2>Past follow-up</h2><a href="#waiting" class="note">Full ledger →</a></div><div class="pb">${over.map(w => waitingRow(w, { showOwner:true })).join('')}</div></div>` : ''}`;
}
