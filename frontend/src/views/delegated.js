import { capLabel } from '../data/constants.js';
import { deliverables, items } from '../store.js';
import { esc } from '../lib/dom.js';
import { delegated } from '../model.js';
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
  const FOR = { meeting:'Prep brief', status:'Status draft', review:'Review prep', wiki:'Wiki change' };
  const forCard = (x) => `<div class="dcard ready"><div>${esc(FOR[x.for.kind] || x.for.kind)}${x.for.id ? ` · ${esc(x.for.id)}` : ''}</div><div class="m" style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px"><span class="chip aichip">${esc(x.actor)}</span></div><div class="preview">${esc(x.deliverable)}</div><div class="effect">On approval: <b>${esc(x.effect)}</b></div><div style="display:flex;gap:6px;margin-top:2px"><button class="btn sm primary" data-approvefor="${esc(x.key)}">Approve</button><button class="btn sm ghost" data-takebackfor="${esc(x.key)}">Take it back</button></div></div>`;
  const readyFor = deliverables.filter(x => x.status === 'ready');
  const lane = (title, list, hint) => `<div class="lane"><div class="lh"><h2>${title}</h2><span class="note num">${list.length}</span></div>${list.map(card).join('') || `<div class="empty" style="padding:22px 12px">${hint}</div>`}</div>`;
  return `<div class="vhead"><div><h1>Delegated to AI</h1><p>Handing work to the assistant is GTD delegation with a faster clock and a review gate. It works from the ledger and the source thread; anything with a side effect waits for your approval.</p></div><div class="shortcuts"><span>From any action: <b>Hand to AI</b></span><span>From the inbox: <b>Accept, hand to AI</b> (<span class="kbd">d</span>)</span></div></div>
  <div class="attn">
    <div class="tile ${r.length + readyFor.length ? 'ai' : ''}"><div class="v">${r.length + readyFor.length}</div><div class="l">ready for your review</div></div>
    <div class="tile"><div class="v">${w.length + q.length}</div><div class="l">in progress or queued</div></div>
    <div class="tile"><div class="v">${approved}</div><div class="l">approved this week</div></div>
    <div class="tile"><div class="v">${hours}<span class="muted" style="font-size:14px"> h</span></div><div class="l">of your time handed off this week</div></div>
  </div>
  <div class="note">Queued → Working → Ready. Approving executes exactly the declared effect.</div>
  <div class="lanes">${lane('Queued', q, 'Nothing queued')}${lane('Working', w, 'Idle')}${lane('Ready for review', r, 'Nothing waiting on you')}</div>
  ${readyFor.length ? `<div class="lanes" style="grid-template-columns:1fr"><div class="lane"><div class="lh"><h2>Ready · briefs and drafts</h2><span class="note num">${readyFor.length}</span></div>${readyFor.map(forCard).join('')}</div></div>` : ''}
  ${/* Autonomy lives in Settings (trust and cost tuned in one place); the log is an audit, so it lives in the review's audit step. */ ''}
  <div class="shortcuts"><a href="#settings">Autonomy settings →</a><a href="#review">Full log in the weekly review's AI audit →</a></div>`;
}
