// Derived reads over the ledger: people, projects, health, activity. Nothing here is stored state.

import { d, items, people, programs, projects, wiki } from './data/example.js';
import { TODAY } from './lib/dates.js';
import { applyState, state } from './state.js';

};
export const wikiLint = [
  { page:'program-vendor-consolidation', what:'Current status compiled 9 days ago — older than 7', fix:'Recompile' },
  { page:'program-fall-launch-risks', what:'Go/no-go risk has no owner; ledger project J6 has no next action either', fix:'Assign owner in review step 2' },
  { page:'person-sam-reyes', what:'No inbound links from a hub Stakeholders table other than P3', fix:'Fine — single program' },

  }
}
applyState();
/* Reference items filed under a program appear in that program's wiki key links. */
for (const it of items) if (it.kind === 'reference' && wiki[it.refPage] && !wiki[it.refPage].links.some(l => l[0] === it.next)) wiki[it.refPage].links.push([it.next, '']);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const days = (x) => Math.round((TODAY - new Date(x)) / 86400000);
export const until = (x) => -days(x);
export const person = (id) => people.find(p => p.id === id);
export const pname = (id) => person(id)?.name.split(' ')[0] ?? '—';
export const initials = (id) => person(id)?.name.split(' ').map(s => s[0]).join('') ?? '·';
export const projOf = (id) => projects.find(p => p.id === id) || programs.find(p => p.id === id);
export const projName = (id) => projOf(id)?.name ?? '—';
export const fmtDate = (x) => new Date(x).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
export const dueLabel = (x) => { const u = until(x); return u < 0 ? `${-u}d overdue` : u === 0 ? 'today' : u === 1 ? 'tomorrow' : fmtDate(x); };
export const healthPill = (h) => ({ good:'<span class="pill good"><i></i>On track</span>', warn:'<span class="pill warn"><i></i>At risk</span>', crit:'<span class="pill crit"><i></i>Blocked</span>' })[h];
export const srcLabel = { email:'Email', chat:'Chat', meeting:'Meeting note', voice:'Voice', calendar:'Calendar', capture:'Captured', tickler:'Tickler', sweep:'Mind sweep' };
export const energyOf = (a) => a.energy || (a.ctx === '@deep' ? 'high' : 'low');
export const by = (k) => items.filter(i => i.kind === k);
export const mine = () => items.filter(i => i.kind === 'action' && i.owner !== 'ai');
export const mine_ = mine;
export const delegated = (st) => items.filter(i => i.owner === 'ai' && i.del && (st ? i.del.status === st : i.kind === 'action'));
export function openActions(pid) { return mine().filter(i => i.project === pid); }
export function delegatedFor(pid) { return delegated().find(i => i.project === pid) || null; }
export function nextActionFor(pid) { const open = openActions(pid); return open.find(a => a.id === state.primary[pid]) || open[0] || null; }
export function waitingFor(pid) { return items.find(i => i.kind === 'waiting' && i.project === pid) || null; }
export function isPrimary(a) { return a.project && nextActionFor(a.project)?.id === a.id && openActions(a.project).length > 1; }
/* Activity is derived from the ledger, never typed in: an action being accepted, a waiting-for opening, a nudge going out, an item being done. */
export function activity(pid) {
  const ev = [];
  for (const i of items) {
    if (i.project !== pid) continue;
