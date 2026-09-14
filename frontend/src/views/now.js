import { calendarAhead, items, ledger, meetings, programs, projects } from '../store.js';
import { backFirst, untilStart } from '../features/defer.js';
import { d, fmtDate, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, activeProjects, by, deferredActions, delegated, energyOf, mine, projHealth, projName, projOf } from '../model.js';
import { prefs } from '../prefs.js';
import { actionRow, projChip, readyRow, waitingRow } from '../ui/fragments.js';
import { ui } from '../ui/session.js';


/* Parked rows for the "Deferred · N" fold: what it is, where it belongs, and when it comes back. */
const deferredRow = (a) => `<div class="row"><div class="t clickable" data-item="${a.id}"><div>${esc(a.next)}</div><div class="m">${a.project ? projChip(a.project) : ''}${a.ctx ? `<span class="chip ctx">${esc(a.ctx)}</span>` : ''}<span class="chip defer">⏸ starts ${esc(fmtDate(a.start))}</span>${a.min ? `<span class="num">${a.min} min</span>` : ''}</div></div></div>`;

/* ---------- views ---------- */
export function viewNow() {
  if (!programs.length && !items.length) return welcome();
  const all = mine(), ready = delegated('ready'), parked = deferredActions();
  const hardToday = all.filter(a => a.hard && until(a.hard) === 0);
  const actions = all.filter(a => !a.hard || until(a.hard) < 0).filter(a => (ui.nowTime === 0 || (a.min || 15) <= ui.nowTime || (ui.nowTime === 60 && (a.min || 15) >= 60)) && (ui.nowEnergy === '' || energyOf(a) === ui.nowEnergy)).filter(a => ui.nowScope === '' || a.project === ui.nowScope || projOf(a.project)?.program === ui.nowScope).sort(backFirst);
  const over = by('waiting').filter(w => until(w.followUp) < 0);
  const dueSoon = all.filter(a => a.due && until(a.due) <= 1);
  const noNext = projects.filter(p => !p.dropped && !programs.find(g => g.id === p.program)?.retired && projHealth(p).noNext);
  const groups = {};
  const byProg = prefs.nowGroup === 'program';
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
  ${ready.length ? `<div class="panel ready"><div class="ph"><h2>Ready for your review from AI</h2><a href="#delegated" class="note">Delegated ledger →</a></div><div class="pb">${ready.map(readyRow).join('')}</div></div>` : ''}
  ${(() => { const days7 = [...Array(7)].map((_, i) => d(i)); return `<div class="panel"><div class="ph"><h2>Hard landscape · next 7 days</h2><div style="display:flex;gap:10px;align-items:center"><span class="note">${prefs.collapsed.strip ? '' : 'Meetings and day-specific actions — click a meeting today for its prep brief. Ticklers resurface into the inbox on their day.'}</span><button class="btn sm ghost" data-collapse="strip">${prefs.collapsed.strip ? 'Expand' : 'Collapse'}</button></div></div>
    ${prefs.collapsed.strip ? '' : `<div class="cal week">${days7.map((day, i) => {
      /* Two groups per column: what I do (pinned actions, then deferred starts and ticklers), then the calendar (meetings). */
      const ms = i === 0 ? meetings.map(m => ({ time:m.time, title:m.title })) : calendarAhead.filter(c => until(c.on) === i);
      const hs = all.filter(a => a.hard && until(a.hard) === i);
      const ds = items.filter(x => x.kind === 'action' && x.owner !== 'ai' && x.start && untilStart(x) === i);
      const ts = items.filter(x => (x.kind === 'someday' || x.kind === 'reference') && x.revisit && until(x.revisit) === i);
      const dow = day.getDay(), wk = dow === 0 || dow === 6, both = ms.length && (hs.length + ds.length + ts.length);
      const acts = `${hs.map(a => `<button class="cal-item hard" data-proj="${a.project}" title="${esc(a.next)}">${esc(a.next)}<span>${esc(projName(a.project))}</span></button>`).join('')}${ds.map(a => `<button class="cal-item defer ${i === 0 ? 'back' : ''}" data-item="${a.id}" title="${i === 0 ? 'Back in your lists today' : 'Deferred: starts this day'}: ${esc(a.next)}">${i === 0 ? '↩' : '⏸'} ${esc(a.next)}<span>${i === 0 ? 'back' : 'starts'} · ${esc(projName(a.project))}</span></button>`).join('')}${ts.map(t => `<div class="cal-item tick" title="Tickler: ${esc(t.next)}">↺ ${esc(t.next)}<span>resurfaces</span></div>`).join('')}`;
      const cal = ms.map((m, k) => i === 0 ? `<button class="cal-item mtg" data-prep="${k}" title="Prep brief">${m.time}<span>${esc(m.title)}</span></button>` : `<div class="cal-item mtg">${m.time}<span>${esc(m.title)}</span></div>`).join('');
      return `<div class="cal-col ${i === 0 ? 'today' : ''} ${wk ? 'wk' : ''}"><div class="cal-h"><b>${i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday:'short' })}</b><span>${day.getDate()}</span></div>${both ? '<div class="cal-lab">actions</div>' : ''}${acts}${both ? '<div class="cal-div"></div><div class="cal-lab">calendar</div>' : ''}${cal}</div>`; }).join('')}</div>`}</div>`; })()}

    <div class="panel"><div class="ph"><h2>Next actions by ${byProg ? 'program' : 'context'}</h2><span class="note num">${actions.length} shown · ${delegated().length} with AI${parked.length ? ` · ${parked.length} deferred` : ''}</span></div>
      <div class="note lhelp">What you can do as soon as it fits — grouped by ${byProg ? 'program' : 'context'}; pinned-to-today items are pulled to the top</div>
      <div class="filters"><span class="faint">group</span><span class="seg"><button data-group="context" class="${byProg ? '' : 'on'}">by context</button><button data-group="program" class="${byProg ? 'on' : ''}">by program</button></span><span class="faint">I have</span><span class="seg">${[[0, 'any time'], [15, '≤ 15 min'], [30, '≤ 30 min'], [60, '60+ min']].map(f => `<button data-ftime="${f[0]}" class="${ui.nowTime === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">energy</span><span class="seg">${[['', 'any'], ['low', 'low'], ['high', 'high']].map(f => `<button data-fenergy="${f[0]}" class="${ui.nowEnergy === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">scope</span><select class="in" style="width:auto;padding:3px 8px;font-size:12px" data-fscope aria-label="Program or project"><option value="">all programs</option>${active().map(g => `<optgroup label="${esc(g.name)}"><option value="${g.id}" ${ui.nowScope === g.id ? 'selected' : ''}>${esc(g.name)} — whole program</option>${activeProjects(g.id).map(j => `<option value="${j.id}" ${ui.nowScope === j.id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</optgroup>`).join('')}</select>${ui.nowScope || ui.nowTime || ui.nowEnergy ? `<button class="btn sm ghost" data-fclear>Clear</button>` : ''}</div>
      <div class="pb">${hardToday.length ? `<div class="pinned"><div class="ph2"><span class="pin-label">Must happen today</span><span class="n">${hardToday.length}</span><span class="pin-why">pulled to the top from every ${byProg ? 'program' : 'context'} — day-specific, so it is not in the lists below</span></div>${hardToday.map(actionRow).join('')}</div><div class="pin-rest">Everything below can be done whenever it fits · by ${byProg ? 'program' : 'context'}</div>` : ''}${keys.map(k => `<div class="ctxgroup">${byProg ? `${k === '—' ? '<span class="chip">No project</span>' : projChip(k)}` : `<span class="chip ctx">${esc(k)}</span>`}<span class="n">${groups[k].length}</span></div>${groups[k].map(actionRow).join('')}`).join('')}
      ${parked.length ? `<details class="fold deferred"><summary>Deferred · ${parked.length}<span class="note" style="font-weight:400;margin-left:6px">parked until their start date — off the lists, but their projects count as covered</span></summary>${parked.map(deferredRow).join('')}</details>` : ''}</div>
    </div>
  ${over.length ? `<div class="panel"><div class="ph"><h2>Past follow-up</h2><a href="#waiting" class="note">Full ledger →</a></div><div class="pb">${over.map(w => waitingRow(w, { showOwner:true })).join('')}</div></div>` : ''}`;
}

/* Empty ledger (a fresh server): the first thing to do is name an area of responsibility. */
function welcome() {
  return `<div class="vhead"><div><h1>Monday, 14 September</h1><p>Your ledger is empty. Add your first program to start.</p></div></div>
  <div class="panel"><div class="empty" style="text-align:left;display:grid;gap:10px;max-width:640px">
    <b>Start with a program</b>
    <span>A program is an area of responsibility — one of the handful of things you are accountable for over a long period. Projects live under it; every next action lives in a project. Name one, write its purpose, and give it a first project and a first action.</span>
    <span class="note">${ledger.mode === 'server' ? `This is your live ledger${ledger.dataDir ? ' in <code class="mono">' + esc(ledger.dataDir) + '</code>' : ''}. Every change from here on is an event in it.` : 'This browser keeps its own ledger; Settings → Data can export it.'}</span>
    <div><button class="btn primary" data-addprog>Add your first program</button> <span class="note">Or capture anything with <span class="kbd">/</span> — it waits in the inbox until a program exists to file it under.</span></div>
  </div></div>`;
}
