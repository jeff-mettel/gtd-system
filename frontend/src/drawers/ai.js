// Handing work to the AI and reviewing what comes back.

import { render } from '../app.js';
import { iso } from '../data/example.js';
import { TODAY } from '../lib/dates.js';
import { by, delegated, until } from '../model.js';
import { save, state } from '../state.js';
import { $ } from '../ui/fragments.js';
import { toast } from '../ui/nav.js';

      ${field('npName', 'Project', `<input id="npName" class="in" placeholder="Short name, e.g. Launch retro" autocomplete="off">`)}
      ${field('npOutcome', 'Outcome — what does done look like?', `<textarea id="npOutcome" class="in" rows="2" placeholder="A checkable sentence: 'Retro held with all three teams and five actions assigned by 30 Oct'"></textarea>`)}
      ${field('npHealth', 'Health', `<select id="npHealth" class="in"><option value="good">On track</option><option value="warn">At risk</option><option value="crit">Blocked</option></select>`)}
      ${field('npNext', 'First next action', `<input id="npNext" class="in" placeholder="Verb first: 'Email Dana to pick a retro date'" autocomplete="off">`)}
      <div class="fld"><label for="npCtx">Context</label><select id="npCtx" class="in">${ctxs.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div id="npErr" class="note" style="color:var(--crit)"></div>
    </div>
    <div class="note">A project needs a written outcome — that's the GTD rule this form enforces. It should also leave here with a first action; skip it and the project is flagged "No next action" until you decide one.</div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" data-saveproj="${gid}">Create project</button>`);
  $('#npName').focus();
}
export function handOff(a, cap, what) {
  a.owner = 'ai'; a.cap = cap || 'draft';
  a.del = { status:'working', at:TODAY, minutes:a.min || 20, progress:.1, effect: cap === 'calendar' ? 'Sends 1 calendar invite' : cap === 'data' ? 'Updates the ledger; nothing is sent' : 'Nothing is sent — a draft for your review', what };
  state.delegated[a.id] = { status:'working', at:iso(TODAY), minutes:a.del.minutes, effect:a.del.effect, cap:a.cap };
  save();
  setTimeout(() => {
    a.del.status = 'ready'; a.del.readyAt = TODAY; a.del.progress = 1;
    a.del.deliverable = `${what || a.next}\n\n(In the live system the assistant's output appears here — produced from the ledger, the source thread and the project outcome. You edit it, then approve or take it back.)`;
    state.delegated[a.id] = Object.assign(state.delegated[a.id], { status:'ready', readyAt:iso(TODAY), deliverable:a.del.deliverable });
    save(); toast(`AI finished: "${a.next}" is ready for review`); render();
