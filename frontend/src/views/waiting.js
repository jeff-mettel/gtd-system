import { d, days, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { by, initials, person, pname } from '../model.js';
import { waitingRow } from '../ui/fragments.js';

export function viewWaiting() {
  const ws = by('waiting');
  const buckets = [['0–7 d', w => days(w.since) <= 7, 'var(--o1)'], ['8–14 d', w => days(w.since) > 7 && days(w.since) <= 14, 'var(--o2)'], ['15–30 d', w => days(w.since) > 14 && days(w.since) <= 30, 'var(--o3)'], ['30+ d', w => days(w.since) > 30, 'var(--o4)']];
  /* Bars are scaled to the total open waiting-fors, not the largest bucket — otherwise equal counts all read as full. */
  const total = Math.max(1, ws.length);
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
    <div class="panel"><div class="ph"><h2>Aging</h2><span class="note num">${ws.length} open · ${ws.filter(w => until(w.followUp) < 0).length} past follow-up</span></div>
      <div class="aging">${buckets.map(b => { const n = ws.filter(b[1]).length; return `<div class="bar"><span class="lbl">${b[0]}</span><div class="trk"><i style="width:${n / total * 100}%;background:${b[2]}"></i></div><span class="n">${n} · ${Math.round(n / total * 100)}%</span></div>`; }).join('')}</div>
      <div class="ph" style="border-top:1px solid var(--line);border-bottom:0"><h2>Oldest</h2></div>
      <div class="pb">${[...ws].sort((a, b) => days(b.since) - days(a.since)).slice(0, 3).map(w => `<div class="row"><div class="t clickable" data-item="${w.id}"><div>${esc(w.next)}</div><div class="m"><span class="chip">${esc(pname(w.owner))}</span><span class="age over">${days(w.since)}d</span></div></div></div>`).join('')}</div>
    </div>
    <div class="panel"><div class="ph"><h2>By person</h2><span class="note">Sorted by oldest item</span></div>
      <div class="note" style="padding:8px 18px 0">Sorted by the oldest thing each person owes you. Draft nudge writes from the history; nothing sends until you approve.</div>
      <div class="pb">${ppl.map(pid => `<div class="person-h"><span class="av">${initials(pid)}</span><b>${esc(person(pid)?.name || 'No owner yet')}</b><span class="note">${esc(person(pid)?.role || 'open the item to say who owes it')}</span></div>${byPerson[pid].map(w => waitingRow(w)).join('')}`).join('')}</div>
    </div>
  </div>`;
}
