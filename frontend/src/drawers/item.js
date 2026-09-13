import { items, levelLabel, programs } from '../data/example.js';
import { days, fmtDate, iso } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, activeProjects, activity, energyOf, person, projOf, srcLabel } from '../model.js';
import { openDrawer } from '../ui/drawer.js';

export function itemDrawer(id) {
  const x = items.find(i => i.id === id); if (!x) return;
  const isW = x.kind === 'waiting', j = x.project ? projOf(x.project) : null, g = j ? (programs.find(p => p.id === (j.program || j.id))) : null;
  const ev = x.project ? activity(x.project).filter(e => e.item.id === id) : [];
  const date = (label, field, val) => `<div class="wrow"><span class="eyebrow">${label}</span><div class="datewrap"><input type="date" class="in" style="width:auto;padding:4px 8px" value="${val ? iso(val) : ''}" data-setdate="${field}" data-id="${id}"><input class="fuzzy in" data-for-sel="[data-setdate]" placeholder="or: tomorrow, fri, +3" aria-label="${label} — fuzzy date"></div></div>`;
  openDrawer(esc(x.next), `
    <div class="sec"><div class="eyebrow">${isW ? 'Waiting for' : x.kind === 'done' ? 'Done' : 'Next action'}${x.source ? ' · from ' + (srcLabel[x.source] || x.source) : ''}${x.raw && x.raw !== x.next ? `</div><p class="muted" style="margin:6px 0 0">"${esc(x.raw)}"</p><div>` : ''}</div></div>
    <div class="sec">
      ${isW ? `<div class="wrow"><span class="eyebrow">Owed by</span><div><button class="linkish" data-agenda="${x.owner}">${esc(person(x.owner)?.name || '—')}</button> <span class="faint">· ${esc(person(x.owner)?.role || '')}</span></div></div>
      <div class="wrow"><span class="eyebrow">Waiting</span><div><span class="age ${days(x.since) > 14 ? 'over' : ''}">${days(x.since)} days</span> since ${fmtDate(x.since)} · ${x.nudges || 0} nudge${x.nudges === 1 ? '' : 's'}${x.lastNudged ? `, last ${fmtDate(x.lastNudged)}` : ''}</div></div>
      ${date('Follow up on', 'followUp', x.followUp)}` : `
      <div class="wrow"><span class="eyebrow">Context</span><div><span class="chip ctx">${esc(x.ctx || '—')}</span> ${x.min ? `<span class="num">${x.min} min</span>` : ''} <span class="faint">· ${energyOf(x)} energy</span></div></div>
      ${date('Due (soft)', 'due', x.due)}${date('Pinned to a day', 'hard', x.hard)}
      `}
      <div class="wrow"><span class="eyebrow">Project</span><div>${j ? `<button class="linkish" data-proj="${j.id}">${esc(j.name)}</button>${g && g.id !== j.id ? ` <span class="faint">· ${esc(g.name)}</span>` : ''}${j.outcome ? `<div class="muted" style="font-size:12px">${esc(j.outcome)}</div>` : ''}` : '<span class="faint">None</span>'}
        ${x.kind !== 'done' ? `<div style="margin-top:6px"><select class="in" style="width:auto;padding:4px 8px;font-size:12px" data-moveitem="${id}" aria-label="Move to project"><option value="">Move to project…</option>${active().map(p => `<optgroup label="${esc(p.name)}"><option value="${p.id}" ${x.project === p.id ? 'disabled' : ''}>${esc(p.name)} — program level</option>${activeProjects(p.id).map(pj => `<option value="${pj.id}" ${x.project === pj.id ? 'disabled' : ''}>${esc(pj.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>` : ''}</div></div>
    </div>
    ${x.ai && !isW ? `<details class="fold"><summary>What the AI can do</summary><div class="wrow"><span class="eyebrow">AI can</span><div><span class="chip aichip">${levelLabel[x.ai.level]}</span> ${esc(x.ai.what)}</div></div></details>` : ''}
    <details class="fold"><summary>History · ${ev.length}</summary>${ev.length ? `<ul class="hist">${ev.map(e => `<li><span class="mono num">${fmtDate(e.when)}</span> <span class="muted">${esc(e.what)}</span></li>`).join('')}</ul>` : '<div class="note">No ledger events yet.</div>'}</details>
    <div class="note">Dates save as you change them. ${isW ? '"Received" closes the waiting-for as done and logs movement on the project.' : 'Pinning to a day moves this out of the context lists onto the calendar.'}</div>`,
    isW ? `<button class="btn ghost" data-drop="${id}">Drop</button><button class="btn" data-nudge="${id}">Draft nudge</button><button class="btn primary" data-received="${id}">Received — done</button>`
        : `<button class="btn ghost" data-park="${id}">Park in someday</button>${x.ai && x.kind !== 'done' ? `<button class="btn" data-hand="${id}">Hand to AI</button>` : ''}${x.kind !== 'done' ? `<button class="btn primary" data-markdone="${id}">Done</button>` : '<button class="btn" data-close>Close</button>'}`);
}
