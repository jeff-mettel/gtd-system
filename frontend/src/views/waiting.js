import { d, pcStyle, programs, projects, wiki } from '../data/example.js';
import { activity, by, days, esc, fmtDate, healthPill, openActions, pname, until } from '../model.js';
import { projHealth } from '../ui/nav.js';

    return `<div class="prog" ${pcStyle(g.id)}><div class="head">${healthPill(h)}<div><h2><i class="pdot"></i>${esc(g.name)}</h2></div><div class="purpose">${esc(g.purpose)}</div><span class="note">${esc(g.cadence)}</span><button class="btn sm" data-wiki="${g.id}">Wiki</button><button class="btn sm" data-addproj="${g.id}">Add project</button><button class="btn sm ghost" data-retire="${g.id}" title="Retire this program">Retire</button></div>
    ${wiki[g.id] ? `<div class="wstatus"><span class="eyebrow">Status · compiled ${fmtDate(wiki[g.id].compiled)}${days(wiki[g.id].compiled) > 7 ? ' <span class="flag">stale</span>' : ''}</span><p>${esc(wiki[g.id].status)}</p><div class="wlinks">${wiki[g.id].links.map(l => l[1] ? `<a class="chip" href="${l[1]}">${esc(l[0])}</a>` : `<span class="chip">${esc(l[0])}</span>`).join('')}</div></div>` : ''}
    <div class="tablewrap"><table><thead><tr><th>Project</th><th>Health</th><th>Next action</th><th>Last movement</th><th>Flags</th></tr></thead><tbody>
    ${js.map(j => { const s = projHealth(j); const n = openActions(j.id).length;
      return `<tr><td><button class="linkish" data-proj="${j.id}">${esc(j.name)}</button><div class="sub">${esc(j.outcome)}</div></td><td>${healthPill(j.health)}</td>
      <td>${s.na ? esc(s.na.next) + `<div class="sub"><span class="chip ctx">${esc(s.na.ctx)}</span>${n > 1 ? ` <span class="faint">+${n - 1} more open</span>` : ''}</div>` : s.dl ? `<span class="muted">Delegated to AI</span><div class="sub">${esc(s.dl.next)} · ${s.dl.del.status === 'ready' ? '<b>ready for review</b>' : s.dl.del.status}</div>` : s.w ? `<span class="muted">Waiting on ${esc(pname(s.w.owner))}</span><div class="sub">${esc(s.w.next)}</div>` : `<button class="btn sm" data-proj="${j.id}">Decide next action</button>`}</td>
      <td class="num"><span class="age ${s.stalled ? 'over' : ''}">${s.lm ? s.age + 'd' : '—'}</span>${s.lm ? `<div class="sub">${esc(s.lm.what)}</div>` : '<div class="sub">No activity</div>'}</td><td>${[s.stalled ? '<span class="flag">Stalled</span>' : '', s.noNext ? '<span class="flag">No next action</span>' : ''].filter(Boolean).join('<br>') || '<span class="faint">—</span>'}</td></tr>`; }).join('') || `<tr><td colspan="5" class="muted">No projects yet.</td></tr>`}
    </tbody></table></div></div>`; }).join('')}
  ${programs.some(g => g.retired) ? `<div class="panel"><div class="ph"><h2>Retired</h2><span class="note">Purpose met or superseded. Wiki pages kept as history.</span></div><div class="pb">${programs.filter(g => g.retired).map(g => `<div class="row"><div class="t"><div class="muted">${esc(g.name)}</div><div class="m"><span class="faint">retired ${fmtDate(g.retired)}</span><span class="chip mono">wiki/${esc(wiki[g.id]?.page || '')}.md</span></div></div><button class="btn sm ghost" data-wiki="${g.id}">Wiki</button></div>`).join('')}</div></div>` : ''}`;
}

export function viewWaiting() {
  const ws = by('waiting');
  const buckets = [['0–7 d', w => days(w.since) <= 7, 'var(--o1)'], ['8–14 d', w => days(w.since) > 7 && days(w.since) <= 14, 'var(--o2)'], ['15–30 d', w => days(w.since) > 14 && days(w.since) <= 30, 'var(--o3)'], ['30+ d', w => days(w.since) > 30, 'var(--o4)']];
  const max = Math.max(1, ...buckets.map(b => ws.filter(b[1]).length));
  const byPerson = {};
  for (const w of ws) (byPerson[w.owner] ||= []).push(w);
  const ppl = Object.keys(byPerson).sort((a, b) => Math.max(...byPerson[b].map(w => days(w.since))) - Math.max(...byPerson[a].map(w => days(w.since))));
  return `<div class="vhead"><div><h1>Waiting for</h1><p>The ledger of what's owed to you. Aged like receivables; nudges are drafted by AI and sent only when you approve.</p></div></div>
  ${(() => { const overdue = ws.filter(w => until(w.followUp) < 0); const daysAhead = [...Array(14)].map((_, i) => d(i)); const later = ws.filter(w => until(w.followUp) >= 14);
    const cell = (list, cls) => list.map(w => `<button class="cal-item ${cls}" data-nudge="${w.id}" title="${esc(w.next)} — draft nudge">${esc(pname(w.owner))}<span>${esc(w.next)}</span></button>`).join('');
    return `<div class="panel"><div class="ph"><h2>Follow-ups, next 14 days</h2><span class="note">When you'll be chasing whom — follow-up dates are ticklers, not appointments. Click one to draft the nudge.</span></div>
    <div class="cal"><div class="cal-col over"><div class="cal-h"><b>Overdue</b><span>${overdue.length}</span></div>${cell(overdue, 'over')}</div>
    ${daysAhead.map((day, i) => { const list = ws.filter(w => until(w.followUp) === i); const dow = day.getDay(), wk = dow === 0 || dow === 6; return `<div class="cal-col ${i === 0 ? 'today' : ''} ${wk ? 'wk' : ''}"><div class="cal-h"><b>${i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday:'short' })}</b><span>${day.getDate()}</span></div>${cell(list, '')}</div>`; }).join('')}
    <div class="cal-col later"><div class="cal-h"><b>Later</b><span>${later.length}</span></div>${cell(later, '')}</div></div></div>`; })()}
  <div class="cols">
