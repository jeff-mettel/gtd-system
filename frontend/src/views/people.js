import { aiLog, people } from '../data/example.js';
import { days, until } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { by, delegated, initials, mine_ } from '../model.js';

export function viewPeople() {
  return `<div class="vhead"><div><h1>People</h1><p>Each stakeholder in both directions: what they owe you, what you owe them, and the queue for your next conversation.</p></div></div>
  <div class="note">Both directions per person; open the agenda before a 1:1.</div>
  <div class="people"><div class="pcard aicard"><div class="top"><span class="av">AI</span><div><div><b>Assistant</b></div><div class="role">Delegate · works from the ledger · never sends unasked</div></div></div>
    <div class="two"><div><div class="h">They owe me · ${delegated('queued').length + delegated('working').length}</div><ul>${[...delegated('working'), ...delegated('queued')].map(x => `<li>${esc(x.next)} <span class="age">${x.del.status}</span></li>`).join('') || '<li class="faint">Nothing in progress</li>'}</ul></div>
    <div><div class="h">I owe them · ${delegated('ready').length} reviews</div><ul>${delegated('ready').map(x => `<li>${esc(x.next)}</li>`).join('') || '<li class="faint">Nothing to review</li>'}</ul></div></div>
    <div class="foot"><span>${aiLog.length} runs this week</span><a class="btn sm ghost" href="#delegated">Delegated ledger</a></div></div>
  ${people.map(p => { const theirs = by('waiting').filter(w => w.owner === p.id); const mine = mine_().filter(a => a.ctx === '@1:1/' + p.id || (a.next.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())));
    return `<div class="pcard"><div class="top"><span class="av">${initials(p.id)}</span><div><div><b>${esc(p.name)}</b></div><div class="role">${esc(p.role)}</div></div></div>
    <div class="two"><div><div class="h">They owe me · ${theirs.length}</div><ul>${theirs.map(w => `<li class="${until(w.followUp) < 0 ? 'over' : ''}">${esc(w.next)} <span class="age">${days(w.since)}d</span></li>`).join('') || '<li class="faint">Nothing open</li>'}</ul></div>
    <div><div class="h">I owe them · ${mine.length}</div><ul>${mine.map(a => `<li>${esc(a.next)}</li>`).join('') || '<li class="faint">Nothing open</li>'}</ul></div></div>
    <div class="foot"><span>Last touched ${days(p.lastTouched)}d ago</span><button class="btn sm ghost" data-agenda="${p.id}">1:1 agenda · ${p.agenda.length}</button></div></div>`; }).join('')}</div>`;
}
