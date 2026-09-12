import { active, activeProjects, d, items } from '../data/example.js';
import { activity, by, days, esc, fmtDate, srcLabel } from '../model.js';
import { I } from '../ui/nav.js';

      <div class="acts"><button class="btn primary" data-accept>Accept${p.ai && (p.kind === 'action' || p.kind === 'project') ? ' — I do it' : low ? ' as edited' : ''} <span class="kbd" style="margin-left:6px">a</span></button>${p.ai && (p.kind === 'action' || p.kind === 'project') ? `<button class="btn primary" style="background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent)" data-accept-ai>Accept, hand to AI <span class="kbd" style="margin-left:6px">d</span></button>` : ''}<button class="btn" data-draft>Draft reply</button><span class="sp"></span><button class="btn ghost" data-skip>Skip for now</button></div>
    </div>
  </div>
  ${trashPanel()}`;
}
export function trashPanel() {
  const tr = by('trash').filter(x => !x.trashedAt || days(x.trashedAt) <= 30);
  if (!tr.length) return '';
  return `<div class="panel"><div class="ph"><h2>Trash</h2><span class="note num">${tr.length} · kept 30 days, then gone</span></div><div class="pb">${tr.map(x => `<div class="row"><div class="t"><div class="muted">${esc(x.raw || x.next)}</div><div class="m"><span class="chip src">${srcLabel[x.source] || 'Item'}</span><span class="faint">trashed ${x.trashedAt ? fmtDate(x.trashedAt) : 'earlier'}</span></div></div><button class="btn sm ghost" data-restore="${x.id}">Restore to inbox</button></div>`).join('')}</div></div>`;
}

export function viewPrograms() {
  return `<div class="vhead"><div><h1>Programs</h1><p>Every project must have a next action or a waiting-for. Last movement is computed from ledger activity — accepted, done, nudged — never typed in. Stalled means nothing has moved in more than 7 days. Click a project for its history.</p></div><div style="display:flex;gap:10px;align-items:center"><span class="note">Health rolls up: any blocked project blocks the program</span><button class="btn" data-addprog>Add program</button></div></div>
  ${active().map(g => { const js = activeProjects(g.id); const h = js.some(j => j.health === 'crit') ? 'crit' : js.some(j => j.health === 'warn') ? 'warn' : 'good';
