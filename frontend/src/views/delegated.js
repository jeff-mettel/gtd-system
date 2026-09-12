import { aiLog, autonomyLabel, capLabel, items } from '../data/example.js';
import { fmtDate } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { delegated } from '../model.js';
import { state } from '../state.js';
import { projChip } from '../ui/fragments.js';

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
  <div class="lanes">${lane('Queued', q, 'Nothing queued')}${lane('Working', w, 'Idle')}${lane('Ready for review', r, 'Nothing waiting on you')}</div>
  <div class="cols">
    <div class="panel"><div class="ph"><h2>Autonomy</h2><span class="note">What the assistant may do without asking</span></div>
      <div class="tablewrap"><table><tbody>${Object.keys(capLabel).filter(c => c !== 'clarify').map(c => `<tr><td>${esc(capLabel[c])}</td><td style="width:210px"><select class="in" data-autonomy="${c}">${opts(c).map(o => `<option value="${o}" ${(state.autonomy[c] || 'ask') === o ? 'selected' : ''}>${autonomyLabel[o]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <div class="note" style="padding:10px 18px">Sending, booking and deleting can never go above "Always ask first". Everything the assistant does — including at "Do it" — is logged and shows up in the weekly review.</div>
    </div>
    <div class="panel"><div class="ph"><h2>This week's log</h2><span class="note">Every AI action, asked or automatic</span></div>
      <div class="pb">${aiLog.map(l => `<div class="row"><div class="t"><div>${esc(l.what)}</div><div class="m"><span class="chip">${esc(capLabel[l.cap] || l.cap)}</span><span class="chip ${l.mode === 'auto' ? 'aichip' : ''}">${l.mode === 'auto' ? 'automatic' : 'you approved'}</span><span class="faint">${fmtDate(l.at)}</span></div></div></div>`).join('')}</div>
    </div>
  </div>`;
}
