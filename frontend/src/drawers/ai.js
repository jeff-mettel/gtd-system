// Handing work to the AI and reviewing what comes back.

import { render } from '../app.js';
import { autonomyLabel, capLabel, items } from '../data/example.js';
import { TODAY, fmtDate, iso } from '../lib/dates.js';
import { esc, toast } from '../lib/dom.js';
import { projName } from '../model.js';
import { save, state } from '../state.js';
import { openDrawer } from '../ui/drawer.js';

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
  }, 7000);
}

export function reviewDrawer(id) {
  const x = items.find(i => i.id === id), sendy = x.cap === 'send' || x.cap === 'calendar';
  openDrawer(`Review · ${esc(x.next)}`, `
    <div class="sec"><div class="eyebrow">${esc(capLabel[x.cap] || x.cap)} · AI worked ${x.del.minutes} min · handed off ${fmtDate(x.del.at)} · ${esc(projName(x.project))}</div></div>
    <textarea class="draft" id="rvText" style="min-height:240px">${esc(x.del.deliverable || '')}</textarea>
    <div class="sec"><h3>What approving does</h3><ul><li><b>${esc(x.del.effect)}</b></li><li>Marks the action done and logs "Approved AI work" on ${esc(projName(x.project))}</li><li>Your edits are kept as feedback for next time</li></ul></div>
    <div class="note">Autonomy for "${esc(capLabel[x.cap] || x.cap)}" is set to <b>${autonomyLabel[state.autonomy[x.cap] || 'ask']}</b>${sendy ? ' — anything that leaves the system always waits for you.' : '.'}</div>`,
    `<button class="btn" data-takeback="${id}">Take it back</button><button class="btn primary" data-approve="${id}">${sendy ? 'Approve and send' : 'Approve'}</button>`);
}
