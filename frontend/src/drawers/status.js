import { levelLabel } from '../data/example.js';
import { energyOf, esc, fmtDate } from '../model.js';
import { save } from '../state.js';

      ${date('Follow up on', 'followUp', x.followUp)}` : `
      <div class="wrow"><span class="eyebrow">Context</span><div><span class="chip ctx">${esc(x.ctx || '—')}</span> ${x.min ? `<span class="num">${x.min} min</span>` : ''} <span class="faint">· ${energyOf(x)} energy</span></div></div>
      ${date('Due (soft)', 'due', x.due)}${date('Pinned to a day', 'hard', x.hard)}
      ${x.ai ? `<div class="wrow"><span class="eyebrow">AI can</span><div><span class="chip aichip">${levelLabel[x.ai.level]}</span> ${esc(x.ai.what)}</div></div>` : ''}`}
      ${j ? `<div class="wrow"><span class="eyebrow">Project</span><div><button class="linkish" data-proj="${j.id}">${esc(j.name)}</button>${g && g.id !== j.id ? ` <span class="faint">· ${esc(g.name)}</span>` : ''}${j.outcome ? `<div class="muted" style="font-size:12px">${esc(j.outcome)}</div>` : ''}</div></div>` : ''}
    </div>
    <div class="sec"><h3>History</h3>${ev.length ? `<ul class="hist">${ev.map(e => `<li><span class="mono num">${fmtDate(e.when)}</span> <span class="muted">${esc(e.what)}</span></li>`).join('')}</ul>` : '<div class="note">No ledger events yet.</div>'}</div>
    <div class="note">Dates save as you change them. ${isW ? '"Received" closes the waiting-for as done and logs movement on the project.' : 'Pinning to a day moves this out of the context lists onto the calendar.'}</div>`,
    isW ? `<button class="btn ghost" data-drop="${id}">Drop</button><button class="btn" data-nudge="${id}">Draft nudge</button><button class="btn primary" data-received="${id}">Received — done</button>`
