// Handing work to the AI and reviewing what comes back. Every step is an event: handed_off (you), job_started and
// delivered (the assistant — simulated here with a 7-second delay until a real job runs), approved / taken_back (you).

import { autonomyLabel, capLabel } from '../data/constants.js';
import { fmtDate } from '../lib/dates.js';
import { esc, toast } from '../lib/dom.js';
import { projName } from '../model.js';
import { commit, config, items } from '../store.js';
import { openDrawer } from '../ui/drawer.js';

const EFFECT = { calendar:'Sends 1 calendar invite', data:'Updates the ledger; nothing is sent', wiki:'Updates the program wiki pages', draft:'Nothing is sent — a draft for your review' };

export function handOff(id, cap, what, effect) {
  const a = items.find(i => i.id === id); if (!a) return;
  cap = cap || 'draft';
  commit('handed_off', { cap, what: what || a.next, effect: effect || EFFECT[cap] || EFFECT.draft, minutes: a.min || 20 }, { item: id });
  /* Simulated delivery. In the live system the server's job runner writes these two events. */
  setTimeout(() => {
    const x = items.find(i => i.id === id); if (!x?.del || x.del.status !== 'queued') return;
    const run = 'r_' + Date.now().toString(36);
    try {
      commit('job_started', { job: cap, run, args:{ progress:.5 } }, { item: id, actor:'ai:' + cap });
      commit('delivered', { deliverable: `${what || x.next}\n\n(In the live system the assistant's output appears here — produced from the ledger, the source thread and the project outcome. You edit it, then approve or take it back.)` }, { item: id, actor:'ai:' + cap });
      toast(`AI finished: "${x.next}" is ready for review`);
    } catch (e) { console.error(e); }
  }, 7000);
}

export function reviewDrawer(id) {
  const x = items.find(i => i.id === id), sendy = x.cap === 'send' || x.cap === 'calendar';
  openDrawer(`Review · ${esc(x.next)}`, `
    <div class="sec"><div class="eyebrow">${esc(capLabel[x.cap] || x.cap)} · AI worked ${x.del.minutes} min · handed off ${fmtDate(x.del.at)} · ${esc(projName(x.project))}</div></div>
    <textarea class="draft" id="rvText" style="min-height:240px">${esc(x.del.deliverable || '')}</textarea>
    <div class="sec"><h3>What approving does</h3><ul><li><b>${esc(x.del.effect)}</b></li><li>Marks the action done and logs "Approved AI work" on ${esc(projName(x.project))}</li><li>Your edits are kept as feedback for next time</li></ul></div>
    <div class="note">Autonomy for "${esc(capLabel[x.cap] || x.cap)}" is set to <b>${autonomyLabel[config.autonomy[x.cap] || 'ask']}</b>${sendy ? ' — anything that leaves the system always waits for you.' : '.'}</div>`,
    `<button class="btn" data-takeback="${id}">Take it back</button><button class="btn primary" data-approve="${id}">${sendy ? 'Approve and send' : 'Approve'}</button>`);
}
