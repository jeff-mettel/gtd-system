// Shared HTML fragments.

import { capLabel } from '../data/example.js';
import { days, dueLabel, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { isPrimary, pname, progIdx, progOfAny, projName } from '../model.js';
import { repeatChip } from '../features/repeat.js';
import { backChip, deferChip } from '../features/defer.js';

export const healthPill = (h) => ({ good:'<span class="pill good"><i></i>On track</span>', warn:'<span class="pill warn"><i></i>At risk</span>', crit:'<span class="pill crit"><i></i>Blocked</span>' })[h];

export const pcStyle = (pid) => `style="--pc:var(--c${progIdx(progOfAny(pid))})"`;

export const projChip = (pid, label) => pid ? `<span class="chip proj" ${pcStyle(pid)}>${esc(label ?? projName(pid))}</span>` : `<span class="chip">${esc(label ?? '—')}</span>`;

/* ---------- shared fragments ---------- */
export function actionRow(a) {
  return `<div class="row ${a.kind === 'done' ? 'done' : ''}"><label class="lab" style="flex:none"><input class="chk" type="checkbox" data-done="${a.id}" ${a.kind === 'done' ? 'checked' : ''}></label>
    <div class="t clickable" data-item="${a.id}"><div>${esc(a.next)}</div><div class="m">${a.project ? `${projChip(a.project)}` : ''}${repeatChip(a)}${backChip(a)}${deferChip(a)}${isPrimary(a) ? `<span class="chip" title="The action that unblocks this project">project next</span>` : ''}${a.ctx ? `<span class="chip ctx">${esc(a.ctx)}</span>` : ''}${a.hard ? `<span class="chip" style="color:var(--warn);background:var(--warn-soft)">on calendar · ${dueLabel(a.hard)}</span>` : ''}${a.min ? `<span class="num">${a.min} min</span>` : ''}${a.due ? `<span class="age ${until(a.due) < 0 ? 'over' : ''}">${dueLabel(a.due)}</span>` : ''}</div></div>${a.ai && a.kind !== 'done' ? `<button class="btn sm ghost" data-hand="${a.id}" title="${esc(a.ai.what)}">${a.ai.level === 'assist' ? 'AI prep' : 'Hand to AI'}</button>` : ''}</div>`;
}

export function readyRow(x) {
  return `<div class="row"><div class="t"><div>${esc(x.next)}</div><div class="m"><span class="chip aichip">AI · ${esc(capLabel[x.cap] || x.cap)}</span>${projChip(x.project)}<span class="effect">On approval: ${esc(x.del.effect)}</span></div></div><button class="btn sm primary" data-review="${x.id}">Review</button></div>`;
}

export function waitingRow(w, opts = {}) {
  const over = until(w.followUp) < 0;
  return `<div class="row"><div class="t clickable" data-item="${w.id}"><div>${esc(w.next)}</div><div class="m">${opts.showOwner ? `<span class="chip">${esc(pname(w.owner))}</span>` : ''}${projChip(w.project)}<span class="age">${days(w.since)}d waiting</span><span class="age ${over ? 'over' : ''}">follow up ${dueLabel(w.followUp)}</span>${w.nudges ? `<span class="faint num">${w.nudges} nudge${w.nudges > 1 ? 's' : ''}</span>` : ''}</div></div>
    <button class="btn sm" data-nudge="${w.id}">Draft nudge</button></div>`;
}
