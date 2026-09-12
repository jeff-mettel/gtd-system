import { days } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, activeProjects, by, pname, projHealth } from '../model.js';
import { openDrawer } from '../ui/drawer.js';

export function statusDraft() {
  const done = by('done');
  const text = active().map(g => { const js = activeProjects(g.id); const h = js.some(j => j.health === 'crit') ? 'Blocked' : js.some(j => j.health === 'warn') ? 'At risk' : 'On track';
    const wins = done.filter(x => js.some(j => j.id === x.project) || x.project === g.id).map(x => `  • ${x.next}`).join('\n');
    const risks = js.filter(j => j.health !== 'good').map(j => { const s = projHealth(j); return `  • ${j.name}: ${s.w ? `waiting on ${pname(s.w.owner)} for ${days(s.w.since)}d` : s.noNext ? 'no next action defined' : 'at risk'}`; }).join('\n');
    return `${g.name} — ${h}\nDone this week:\n${wins || '  • —'}\nRisks / asks:\n${risks || '  • none'}`; }).join('\n\n');
  openDrawer('Status report · week of 7 Sep', `<textarea class="draft" style="min-height:360px">${esc(text)}</textarea><div class="note">Assembled from health, wins and waiting-fors. Edit, then paste wherever status lives.</div>`, `<button class="btn" data-close>Close</button><button class="btn primary" data-copy>Copy</button>`);
}
