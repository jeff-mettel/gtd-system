import { iso, items, programs, wiki } from '../data/example.js';
import { openDrawer } from './people.js';
import { activity, by, days, esc, fmtDate, healthPill, person, pname, projOf, srcLabel } from '../model.js';

  openDrawer(esc(g.name), `
    <div class="sec"><div class="eyebrow">wiki/${esc(w.page)}.md · living doc · compiled ${fmtDate(w.compiled)}</div></div>
    <div class="sec"><h3>Purpose</h3><p class="muted" style="margin:0">${esc(g.purpose)}</p></div>
    <div class="sec"><h3>Key links</h3><div class="wlinks">${w.links.map(l => l[1] ? `<a class="chip" href="${l[1]}">${esc(l[0])}</a>` : `<span class="chip">${esc(l[0])}</span>`).join('')}</div></div>
    <div class="sec"><h3>Current status <span class="faint" style="font-weight:400">· compiled</span></h3><p class="muted" style="margin:0">${healthPill(w.health)} ${esc(w.status)}</p></div>
    <div class="sec"><h3>Milestones</h3><div class="tablewrap"><table class="mini"><tbody>${w.milestones.map(m => `<tr><td class="mono num">${esc(m[0])}</td><td>${esc(m[1])}</td><td><span class="pill ${st(m[2])}"><i></i>${esc(m[2])}</span></td></tr>`).join('')}</tbody></table></div></div>
    <div class="sec"><h3>Decisions</h3>${w.decisions.map(x => `<div class="wrow"><span class="mono num faint">${x.on}</span><div><b>${esc(x.what)}</b> <span class="faint">· ${esc(x.who)}</span><div class="muted">${esc(x.why)}</div>${x.status !== 'decided' ? `<span class="pill warn" style="margin-top:4px"><i></i>${esc(x.status)}</span>` : ''}</div></div>`).join('')}${w.pending.length ? `<div class="wrow"><span class="eyebrow">Pending</span><ul style="margin:0">${w.pending.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>
    <div class="sec"><h3>Risks</h3><ul>${w.risks.map(r => `<li><span class="pill ${r.level === 'high' ? 'crit' : r.level === 'medium' ? 'warn' : 'neutral'}"><i></i>${r.level}</span> ${esc(r.what)} <span class="faint">· ${r.owner ? esc(pname(r.owner)) : 'no owner'}</span></li>`).join('')}</ul></div>
    <div class="note">Compiled sections are rewritten from the ledger; purpose, links, decisions and risks are written by you or by reviewed ingests. Full page and history in the repo.</div>`,
    `<button class="btn" data-close>Close</button><button class="btn primary" data-ingest="${pid}">Ingest notes into this page</button>`);
}
export function itemDrawer(id) {
  const x = items.find(i => i.id === id); if (!x) return;
  const isW = x.kind === 'waiting', j = x.project ? projOf(x.project) : null, g = j ? (programs.find(p => p.id === (j.program || j.id))) : null;
  const ev = x.project ? activity(x.project).filter(e => e.item.id === id) : [];
  const date = (label, field, val) => `<div class="wrow"><span class="eyebrow">${label}</span><input type="date" class="in" style="width:auto;padding:4px 8px" value="${val ? iso(val) : ''}" data-setdate="${field}" data-id="${id}"></div>`;
  openDrawer(esc(x.next), `
    <div class="sec"><div class="eyebrow">${isW ? 'Waiting for' : x.kind === 'done' ? 'Done' : 'Next action'}${x.source ? ' · from ' + (srcLabel[x.source] || x.source) : ''}${x.raw && x.raw !== x.next ? `</div><p class="muted" style="margin:6px 0 0">"${esc(x.raw)}"</p><div>` : ''}</div></div>
    <div class="sec">
      ${isW ? `<div class="wrow"><span class="eyebrow">Owed by</span><div><button class="linkish" data-agenda="${x.owner}">${esc(person(x.owner)?.name || '—')}</button> <span class="faint">· ${esc(person(x.owner)?.role || '')}</span></div></div>
      <div class="wrow"><span class="eyebrow">Waiting</span><div><span class="age ${days(x.since) > 14 ? 'over' : ''}">${days(x.since)} days</span> since ${fmtDate(x.since)} · ${x.nudges || 0} nudge${x.nudges === 1 ? '' : 's'}${x.lastNudged ? `, last ${fmtDate(x.lastNudged)}` : ''}</div></div>
