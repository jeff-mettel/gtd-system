import { days, dueLabel, iso, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { by } from '../model.js';
import { projChip } from '../ui/fragments.js';

export function viewSomeday() {
  const some = by('someday').sort((a, b) => (a.revisit ? until(a.revisit) : 9e9) - (b.revisit ? until(b.revisit) : 9e9));
  return `<div class="vhead"><div><h1>Someday / maybe</h1><p>Ideas and commitments you have deliberately not made yet. Reviewed weekly; a revisit date turns one into a tickler.</p></div><span class="note num">${some.length} parked · ${some.filter(x => x.revisit).length} with a revisit date</span></div>
  <div class="panel"><div class="ph"><h2>Parked</h2><span class="note">Sorted by revisit date</span></div><div class="pb">${some.map(x => `<div class="row"><div class="t"><div>${esc(x.next)}</div><div class="m">${x.project ? `${projChip(x.project)}` : ''}<span class="age">${days(x.since)}d parked</span>${x.revisit ? `<span class="chip" style="color:var(--accent-text);background:var(--accent-soft)">↺ revisit ${dueLabel(x.revisit)}</span>` : '<span class="faint">no revisit date</span>'}</div></div><input type="date" class="in" style="width:auto;padding:4px 8px" value="${x.revisit ? iso(x.revisit) : ''}" data-revisit="${x.id}" title="Revisit on"><button class="btn sm" data-promote="${x.id}">Promote</button><button class="btn sm ghost" data-drop="${x.id}">Drop</button></div>`).join('') || '<div class="empty">Nothing parked.</div>'}</div></div>`;
}
