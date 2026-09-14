import { levelLabel } from '../data/constants.js';
import { items, people, programs } from '../store.js';
import { REPEATS } from '../features/repeat.js';
import { days, fmtDate, iso } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, activeProjects, activity, energyOf, person, projOf, srcLabel } from '../model.js';
import { deferField } from '../features/defer.js';
import { openDrawer } from '../ui/drawer.js';

export function itemDrawer(id) {
  const x = items.find(i => i.id === id); if (!x) return;
  const isW = x.kind === 'waiting', j = x.project ? projOf(x.project) : null, g = j ? (programs.find(p => p.id === (j.program || j.id))) : null;
  const ev = x.project ? activity(x.project).filter(e => e.item.id === id) : [];
  const date = (label, field, val) => `<div class="wrow"><span class="eyebrow">${label}</span><div class="datewrap"><input type="date" class="in" style="width:auto;padding:4px 8px" value="${val ? iso(val) : ''}" data-setdate="${field}" data-id="${id}"><input class="fuzzy in" data-for-sel="[data-setdate]" placeholder="or: tomorrow, fri, +3" aria-label="${label} — fuzzy date"></div></div>`;
  openDrawer(esc(x.next), `
    <div class="sec"><div class="eyebrow">${isW ? 'Waiting for' : x.kind === 'done' ? 'Done' : 'Next action'}${x.source ? ' · from ' + (srcLabel[x.source] || x.source) : ''}${x.raw && x.raw !== x.next ? `</div><p class="muted" style="margin:6px 0 0">"${esc(x.raw)}"</p><div>` : ''}</div></div>
    <div class="sec">
      <div class="wrow"><span class="eyebrow">${isW ? 'Waiting on' : 'Action'}</span><div><input class="in" value="${esc(x.next)}" data-setfield="next" data-id="${id}" aria-label="Rename" style="width:100%"></div></div>
      ${isW ? `<div class="wrow"><span class="eyebrow">Owed by</span><div><select class="in" style="width:auto;padding:4px 8px" data-setfield="owner" data-id="${id}"><option value="" ${!x.owner ? 'selected' : ''}>— no owner yet —</option>${people.map(u => `<option value="${u.id}" ${u.id === x.owner ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>${person(x.owner) ? ` <button class="btn sm ghost" data-agenda="${x.owner}">1:1 agenda</button>` : ''}</div></div>
      <div class="wrow"><span class="eyebrow">Waiting</span><div><span class="age ${days(x.since) > 14 ? 'over' : ''}">${days(x.since)} days</span> since ${fmtDate(x.since)} · ${x.nudges || 0} nudge${x.nudges === 1 ? '' : 's'}${x.lastNudged ? `, last ${fmtDate(x.lastNudged)}` : ''}</div></div>
      ${date('Follow up on', 'followUp', x.followUp)}` : `
      <div class="wrow"><span class="eyebrow">Context</span><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select class="in" style="width:auto;padding:4px 8px" data-setfield="ctx" data-id="${id}">${['@quick', '@deep', ...people.map(u => '@1:1/' + u.id), '@agenda/steering', '@errand'].map(c => `<option ${c === x.ctx ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label class="faint" style="display:flex;gap:6px;align-items:center">estimate <input type="number" class="in" style="width:72px;padding:4px 8px" value="${x.min ?? ''}" min="1" data-setfield="min" data-id="${id}" aria-label="Estimate in minutes"> min</label>
        <label class="faint" style="display:flex;gap:6px;align-items:center">energy <select class="in" style="width:auto;padding:4px 8px" data-setfield="energy" data-id="${id}"><option value="" ${!x.energy ? 'selected' : ''}>auto (${energyOf(x)})</option><option value="low" ${x.energy === 'low' ? 'selected' : ''}>low</option><option value="high" ${x.energy === 'high' ? 'selected' : ''}>high</option></select></label>
        <label class="faint" style="display:flex;gap:6px;align-items:center">repeats <select class="in" style="width:auto;padding:4px 8px" data-setfield="repeat" data-id="${id}"><option value="" ${!x.repeat ? 'selected' : ''}>never</option>${REPEATS.filter(r => r[0]).map(r => `<option value="${r[0]}" ${x.repeat === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}</select></label></div></div>
      ${date('Due (soft)', 'due', x.due)}${date('Pinned to a day', 'hard', x.hard)}${deferField(x)}
      `}
      <div class="wrow"><span class="eyebrow">Project</span><div>${j ? `<button class="linkish" data-proj="${j.id}">${esc(j.name)}</button>${g && g.id !== j.id ? ` <span class="faint">· ${esc(g.name)}</span>` : ''}${j.outcome ? `<div class="muted" style="font-size:12px">${esc(j.outcome)}</div>` : ''}` : '<span class="faint">None</span>'}
        ${x.kind !== 'done' ? `<div style="margin-top:6px"><select class="in" style="width:auto;padding:4px 8px;font-size:12px" data-moveitem="${id}" aria-label="Move to project"><option value="">Move to project…</option>${active().map(p => `<optgroup label="${esc(p.name)}"><option value="${p.id}" ${x.project === p.id ? 'disabled' : ''}>${esc(p.name)} — program level</option>${activeProjects(p.id).map(pj => `<option value="${pj.id}" ${x.project === pj.id ? 'disabled' : ''}>${esc(pj.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>` : ''}</div></div>
    </div>
    ${x.ai && !isW ? `<details class="fold"><summary>What the AI can do</summary><div class="wrow"><span class="eyebrow">AI can</span><div><span class="chip aichip">${levelLabel[x.ai.level]}</span> ${esc(x.ai.what)}</div></div></details>` : ''}
    <details class="fold"><summary>History · ${ev.length}</summary>${ev.length ? `<ul class="hist">${ev.map(e => `<li><span class="mono num">${fmtDate(e.when)}</span> <span class="muted">${esc(e.what)}</span></li>`).join('')}</ul>` : '<div class="note">No ledger events yet.</div>'}</details>
    <div class="note">Everything above saves as you change it. ${isW ? '"Received" closes the waiting-for as done and logs movement on the project.' : 'Pinning to a day moves this out of the context lists onto the calendar.'}</div>`,
    isW ? `<button class="btn ghost" data-drop="${id}">Drop</button><button class="btn" data-nudge="${id}">Draft nudge</button><button class="btn primary" data-received="${id}">Received — done</button>`
        : `<button class="btn ghost" data-park="${id}">Park in someday</button>${x.ai && x.kind !== 'done' ? `<button class="btn" data-hand="${id}">Hand to AI</button>` : ''}${x.kind !== 'done' ? `<button class="btn primary" data-markdone="${id}">Done</button>` : '<button class="btn" data-close>Close</button>'}`);
}
