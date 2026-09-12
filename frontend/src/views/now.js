import { capLabel, d, items, programs, projChip, projects } from '../data/example.js';
import { by, days, delegated, dueLabel, energyOf, esc, mine, pname, projOf, until } from '../model.js';
import { state } from '../state.js';
import { projHealth } from '../ui/nav.js';
import { ui } from '../ui/session.js';

}
export function readyRow(x) {
  return `<div class="row"><div class="t"><div>${esc(x.next)}</div><div class="m"><span class="chip aichip">AI · ${esc(capLabel[x.cap] || x.cap)}</span>${projChip(x.project)}<span class="effect">On approval: ${esc(x.del.effect)}</span></div></div><button class="btn sm primary" data-review="${x.id}">Review</button></div>`;
}
export function waitingRow(w, opts = {}) {
  const over = until(w.followUp) < 0;
  return `<div class="row"><div class="t clickable" data-item="${w.id}"><div>${esc(w.next)}</div><div class="m">${opts.showOwner ? `<span class="chip">${esc(pname(w.owner))}</span>` : ''}${projChip(w.project)}<span class="age">${days(w.since)}d waiting</span><span class="age ${over ? 'over' : ''}">follow up ${dueLabel(w.followUp)}</span>${w.nudges ? `<span class="faint num">${w.nudges} nudge${w.nudges > 1 ? 's' : ''}</span>` : ''}</div></div>
    <button class="btn sm" data-nudge="${w.id}">Draft nudge</button></div>`;
}

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
    <div class="tile ${by('inbox').length ? 'warn' : ''}"><div class="v">${by('inbox').length}</div><div class="l">in the inbox to clarify</div></div>
    <div class="tile ${over.length ? 'crit' : ''}"><div class="v">${over.length}</div><div class="l">waiting-fors past follow-up</div></div>
    <div class="tile ${dueSoon.length ? 'warn' : ''}"><div class="v">${dueSoon.length}</div><div class="l">actions due by tomorrow</div></div>
    <div class="tile ${noNext.length ? 'crit' : ''}"><div class="v">${noNext.length}</div><div class="l">projects with no next action</div></div>
  </div>
  ${ready.length ? `<div class="panel ready"><div class="ph"><h2>Ready for your review</h2><a href="#delegated" class="note">Delegated ledger →</a></div><div class="pb">${ready.map(readyRow).join('')}</div></div>` : ''}
