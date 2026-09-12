import { autonomyLabel, capLabel, d, items, projChip } from '../data/example.js';
import { openDrawer } from '../drawers/people.js';
import { delegated, esc, fmtDate, projName } from '../model.js';
import { state } from '../state.js';

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
export function viewDelegated() {
  const q = delegated('queued'), w = delegated('working'), r = delegated('ready');
  const approved = items.filter(i => i.del?.status === 'approved').length + 3;
  const hours = ((delegated().reduce((n, i) => n + (i.del.minutes || 0), 0) + 130) / 60).toFixed(1);
  const card = (x) => `<div class="dcard ${x.del.status}"><div>${esc(x.next)}</div><div class="m" style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px">${projChip(x.project)}<span class="chip">${esc(capLabel[x.cap] || x.cap)}</span><span class="faint num">~${x.del.minutes} min</span></div>
    ${x.del.status === 'working' ? `<div class="pbar"><i style="width:${Math.round((x.del.progress || .1) * 100)}%"></i></div>` : ''}
    ${x.del.status === 'ready' && x.del.deliverable ? `<div class="preview">${esc(x.del.deliverable)}</div>` : ''}
    <div class="effect">On approval: <b>${esc(x.del.effect)}</b></div>
    <div style="display:flex;gap:6px;margin-top:2px">${x.del.status === 'ready' ? `<button class="btn sm primary" data-review="${x.id}">Review</button>` : ''}<button class="btn sm ghost" data-takeback="${x.id}">Take it back</button></div></div>`;
  const lane = (title, list, hint) => `<div class="lane"><div class="lh"><h2>${title}</h2><span class="note num">${list.length}</span></div>${list.map(card).join('') || `<div class="empty" style="padding:22px 12px">${hint}</div>`}</div>`;
  const opts = (cap) => (cap === 'send' || cap === 'calendar' || cap === 'delete') ? ['never', 'ask'] : ['never', 'ask', 'draft', 'auto'];
  return `<div class="vhead"><div><h1>Delegated to AI</h1><p>Handing work to the assistant is GTD delegation with a faster clock and a review gate. It works from the ledger and the source thread; anything with a side effect waits for your approval.</p></div><div class="shortcuts"><span>From any action: <b>Hand to AI</b></span><span>From the inbox: <b>Accept, hand to AI</b> (<span class="kbd">d</span>)</span></div></div>
  <div class="attn">
    <div class="tile ${r.length ? 'ai' : ''}"><div class="v">${r.length}</div><div class="l">ready for your review</div></div>
    <div class="tile"><div class="v">${w.length + q.length}</div><div class="l">in progress or queued</div></div>
    <div class="tile"><div class="v">${approved}</div><div class="l">approved this week</div></div>
    <div class="tile"><div class="v">${hours}<span class="muted" style="font-size:14px"> h</span></div><div class="l">of your time handed off this week</div></div>
  </div>
