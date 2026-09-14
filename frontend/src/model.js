// Derived reads over the ledger: people, projects, health, activity. Nothing here is stored state.

import { config, items, people, programs, projects, wiki } from './store.js';
import { days } from './lib/dates.js';
import { isDeferred } from './features/defer.js';

export { wikiStub, slug } from '@gtd/ledger';

/* A milestone's date: the ISO 4th element when added in the UI, else parsed from the seeded "11 Sep" label (demo year); ranges like "1 or 15 Nov" have no date. */
export const msDate = (m) => { if (m[3]) return new Date(m[3] + 'T08:00:00'); const r = /^(\d{1,2}) ([A-Za-z]{3})$/.exec(m[0] || ''); if (!r) return null; const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(r[2].toLowerCase()); return mi < 0 ? null : new Date(2026, mi, +r[1], 8); };
export const active = () => programs.filter(g => !g.retired);

export const activeProjects = (gid) => projects.filter(j => j.program === gid && !j.dropped);

export const wikiOf = (pid) => wiki[pid] || wiki[projOf(pid)?.program] || null;

export const person = (id) => people.find(p => p.id === id);

export const pname = (id) => person(id)?.name.split(' ')[0] ?? '—';

export const initials = (id) => person(id)?.name.split(' ').map(s => s[0]).join('') ?? '·';

export const projOf = (id) => projects.find(p => p.id === id) || programs.find(p => p.id === id);

export const projName = (id) => projOf(id)?.name ?? '—';

/* Program identity color: a chosen slot (config.progColor via config_set, 1–8) wins, then the program's own `color`; otherwise slot by program order, fixed for life; beyond 8 programs folds to gray. */
export const progIdx = (gid) => { const c = +(config.progColor?.[gid] ?? programs.find(g => g.id === gid)?.color); if (c >= 1 && c <= 8) return c; const i = programs.findIndex(g => g.id === gid); return i < 0 || i > 7 ? 0 : i + 1; };

export const progOfAny = (pid) => programs.find(g => g.id === pid) ? pid : projOf(pid)?.program;

export const srcLabel = { email:'Email', chat:'Chat', meeting:'Meeting note', voice:'Voice', calendar:'Calendar', capture:'Captured', tickler:'Tickler', sweep:'Mind sweep', screenshot:'Screenshot', repeat:'Repeat', cli:'CLI' };

export const energyOf = (a) => a.energy || (a.ctx === '@deep' ? 'high' : 'low');

export const by = (k) => items.filter(i => i.kind === k);

/* My open actions. A deferred action (features/defer.js) is not open yet: it is off the lists and out of the counts until its start date. */
export const mine = () => items.filter(i => i.kind === 'action' && i.owner !== 'ai' && !isDeferred(i));

/* Parked actions, soonest start first. */
export const deferredActions = (pid) => items.filter(i => i.kind === 'action' && i.owner !== 'ai' && isDeferred(i) && (!pid || i.project === pid)).sort((a, b) => new Date(a.start) - new Date(b.start));

export const mine_ = mine;

export const delegated = (st) => items.filter(i => i.owner === 'ai' && i.del && (st ? i.del.status === st : i.kind === 'action'));

export function openActions(pid) { return mine().filter(i => i.project === pid); }

export function delegatedFor(pid) { return delegated().find(i => i.project === pid) || null; }

/* The primary next action is `project.primary` (set by next_action_set); else the first open one. */
export function nextActionFor(pid) { const open = openActions(pid); const prim = projOf(pid)?.primary; return open.find(a => a.id === prim) || open[0] || null; }

export function waitingFor(pid) { return items.find(i => i.kind === 'waiting' && i.project === pid) || null; }

export function isPrimary(a) { return a.project && nextActionFor(a.project)?.id === a.id && openActions(a.project).length > 1; }

/* Activity is derived from the ledger, never typed in: an action being accepted, a waiting-for opening, a nudge going out, an item being done. */
export function activity(pid) {
  const ev = [];
  for (const i of items) {
    if (i.project !== pid) continue;
    if (i.createdAt) ev.push({ when:new Date(i.createdAt), what:'Next action added', item:i });
    if (i.movedAt) ev.push({ when:new Date(i.movedAt), what:'Moved into project', item:i });
    if (i.kind === 'waiting' && i.since) ev.push({ when:new Date(i.since), what:`Waiting on ${pname(i.owner)}`, item:i });
    if (i.lastNudged) ev.push({ when:new Date(i.lastNudged), what:`Nudged ${pname(i.owner)}`, item:i });
    if (i.kind === 'done' && i.doneAt) ev.push({ when:new Date(i.doneAt), what: i.del ? 'Approved AI work' : 'Done', item:i });
    if (i.del?.at) ev.push({ when:new Date(i.del.at), what:'Handed to AI', item:i });
    if (i.del?.readyAt) ev.push({ when:new Date(i.del.readyAt), what:'AI delivered', item:i });
  }
  return ev.sort((a, b) => b.when - a.when);
}

export function lastMovement(pid) { return activity(pid)[0] || null; }

/* `deferred` is the soonest parked action: it counts as coverage (the project has a decided next step, just not yet), so `noNext` stays false. */
export function projHealth(p) { const na = nextActionFor(p.id), w = waitingFor(p.id), dl = delegatedFor(p.id), df = deferredActions(p.id)[0] || null, lm = lastMovement(p.id); return { na, w, dl, deferred:df, lm, age: lm ? days(lm.when) : null, stalled: !lm || days(lm.when) > 7, noNext: !na && !w && !dl && !df }; }
