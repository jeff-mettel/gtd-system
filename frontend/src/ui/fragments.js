// Shared HTML fragments.

import { capLabel } from '../data/constants.js';
import { days, dueLabel, fmtDate, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { isPrimary, pname, progIdx, progOfAny, projName } from '../model.js';
import { repeatChip } from '../features/repeat.js';
import { isBackToday, isDeferred } from '../features/defer.js';
import { aiSuggestion } from '../features/aiSuggest.js';

export const healthPill = (h) => ({ good:'<span class="pill good"><i></i>On track</span>', warn:'<span class="pill warn"><i></i>At risk</span>', crit:'<span class="pill crit"><i></i>Blocked</span>' })[h];

export const pcStyle = (pid) => `style="--pc:var(--c${progIdx(progOfAny(pid))})"`;

export const projChip = (pid, label) => pid ? `<span class="chip proj" ${pcStyle(pid)}>${esc(label ?? projName(pid))}</span>` : `<span class="chip">${esc(label ?? '—')}</span>`;

/* ---------- one "when" per row ---------- */
/* Short day label: today / tomorrow / Fri (within the week) / 18 Sep. */
export const shortDay = (x) => { const u = until(x); return u === 0 ? 'today' : u === 1 ? 'tomorrow' : u > 1 && u < 7 ? new Date(x).toLocaleDateString('en-GB', { weekday:'short' }) : new Date(x).toLocaleDateString('en-GB', { day:'numeric', month:'short' }); };

/* Which date field the chip edits for this item: the pin if it has one, else the field its kind lives by. */
export const whenField = (it) => it.hard ? 'hard' : it.kind === 'waiting' ? 'followUp' : (it.kind === 'someday' || it.kind === 'reference') ? 'revisit' : 'due';

/** ONE chip for the row's date: hard → "today"/"Fri" (warn) · due → "due Fri" (red if past) · start → "↩ Tue" ·
    revisit → "↺ Tue" · follow-up → "follow up Thu" (red if past). Clicking opens an inline fuzzy field (app.js data-when). */
export function whenChip(it) {
  const f = whenField(it), btn = (cls, text, title) => `<button type="button" class="chip when ${cls}" data-when="${it.id}" data-wfield="${f}" title="${esc(title)} · click to change">${text}</button>`;
  if (it.hard) return btn('warn', `${until(it.hard) < 0 ? '⚠ ' : '📌 '}${esc(shortDay(it.hard))}`, `Pinned to ${fmtDate(it.hard)}`);
  if (it.kind === 'waiting') { if (!it.followUp) return btn('nodate', 'follow up…', 'No follow-up date'); const over = until(it.followUp) < 0; return btn(over ? 'over' : '', `follow up ${esc(over ? dueLabel(it.followUp) : shortDay(it.followUp))}`, `Follow up ${fmtDate(it.followUp)}`); }
  if (it.due) { const over = until(it.due) < 0; return btn(over ? 'over' : '', `due ${esc(over ? dueLabel(it.due) : shortDay(it.due))}`, `Due ${fmtDate(it.due)}`); }
  if (it.start && (isDeferred(it) || isBackToday(it))) return btn(isBackToday(it) ? 'back' : 'defer', `↩ ${esc(isBackToday(it) ? 'back today' : shortDay(it.start))}`, `Deferred until ${fmtDate(it.start)}`);
  if (it.revisit) return btn('tick', `↺ ${esc(shortDay(it.revisit))}`, `Resurfaces ${fmtDate(it.revisit)}`);
  return btn('nodate', f === 'revisit' ? 'revisit…' : 'when…', 'No date');
}

/* The AI's late second opinion on a filed item (features/aiSuggest.js): Accept applies it, Keep dismisses. */
export const aiChip = (it) => { const s = aiSuggestion(it); return s ? `<span class="aisug" title="${esc(s.why)}"><span class="chip aichip">AI suggests: ${esc(s.label)}</span><button type="button" class="lnk" data-aiaccept="${it.id}">Accept</button><button type="button" class="lnk" data-aikeep="${it.id}">Keep</button></span>` : ''; };

/* ---------- shared fragments ---------- */
export function actionRow(a) {
  return `<div class="row ${a.kind === 'done' ? 'done' : ''}"><label class="lab" style="flex:none"><input class="chk" type="checkbox" data-done="${a.id}" ${a.kind === 'done' ? 'checked' : ''}></label>
    <div class="t clickable" data-item="${a.id}"><div>${esc(a.next)}</div><div class="m">${a.project ? `${projChip(a.project)}` : ''}${repeatChip(a)}${isPrimary(a) ? `<span class="chip" title="The action that unblocks this project">project next</span>` : ''}${a.ctx ? `<span class="chip ctx">${esc(a.ctx)}</span>` : ''}${a.min ? `<span class="num">${a.min} min</span>` : ''}${a.kind === 'done' ? '' : whenChip(a)}${aiChip(a)}</div></div>${a.ai && a.kind !== 'done' ? `<button class="btn sm ghost" data-hand="${a.id}" title="${esc(a.ai.what)}">${a.ai.level === 'assist' ? 'AI prep' : 'Hand to AI'}</button>` : ''}</div>`;
}

export function readyRow(x) {
  return `<div class="row"><div class="t"><div>${esc(x.next)}</div><div class="m"><span class="chip aichip">AI · ${esc(capLabel[x.cap] || x.cap)}</span>${projChip(x.project)}<span class="effect">On approval: ${esc(x.del.effect)}</span></div></div><button class="btn sm primary" data-review="${x.id}">Review</button></div>`;
}

export function waitingRow(w, opts = {}) {
  return `<div class="row"><div class="t clickable" data-item="${w.id}"><div>${esc(w.next)}</div><div class="m">${opts.showOwner ? `<span class="chip">${esc(pname(w.owner))}</span>` : ''}${projChip(w.project)}<span class="age">${days(w.since)}d waiting</span>${whenChip(w)}${w.nudges ? `<span class="faint num">${w.nudges} nudge${w.nudges > 1 ? 's' : ''}</span>` : ''}${aiChip(w)}</div></div>
    <button class="btn sm" data-nudge="${w.id}">Draft nudge</button></div>`;
}
