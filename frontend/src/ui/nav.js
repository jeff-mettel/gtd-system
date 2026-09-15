// Rail navigation, health strip, instruction cards and the guide.

import { TODAY, days, until } from '../lib/dates.js';
import { $ } from '../lib/dom.js';
import { by, delegated, projHealth } from '../model.js';
import { prefs } from '../prefs.js';
import { activeRuns, lastReview, ledger, programs, projects } from '../store.js';
import { openDrawer } from './drawer.js';

/* ---------- nav & health ---------- */
export const I = (d) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  now: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  inbox: I('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
  programs: I('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
  waiting: I('<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'),
  delegated: I('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>'),
  someday: I('<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.7 12.2 3.5 3.5 0 0 0 6 19z"/>'),
  reference: I('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>'),
  people: I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  review: I('<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  flow: I('<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>'),
  guide: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5"/><path d="M12 17h.01"/>'),
  settings: I('<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>'),
  /* Weekly review step icons: one per step, muted, aligned with the step number. */
  stepInbox: I('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
  stepSweep: I('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>'),
  stepPastcal: I('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="m13 14-3 3 3 3"/>'),
  stepUpcoming: I('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="m11 14 3 3-3 3"/>'),
  stepNext: I('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
  stepWaiting: I('<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'),
  stepSomeday: I('<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.7 12.2 3.5 3.5 0 0 0 6 19z"/>'),
  stepWins: I('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  stepAi: I('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>'),
  stepLint: I('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m9 10 2 2 4-4"/>'),
  stepHorizons: I('<path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.174l1.09-.325a1 1 0 0 1 1.264.789l1.113 4.573a1 1 0 0 1-.68 1.183l-1.09.325a2 2 0 0 1-2.5-1.328z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/>'),
};

/* Instruction cards: one per view, dismissable, teach the GTD habit the view serves. */
export const guides = {
  now: { stage:'Engage', text:'Work from here. Red tiles are promises the system can\'t keep for you — clear them first. Next actions are grouped by <b>context</b>: pick the group that matches where you are and the energy you have, not the item that looks most urgent. Tick <span class="kbd">x</span> when done — it logs movement on the project. Anything with a Hand to AI button, consider delegating.' },
  inbox: { stage:'Clarify', text:'The one habit that makes the system trustworthy: get this to zero daily. For each item, GTD\'s question: <b>is it actionable?</b> No → reference, someday, or trash. Yes → what is the very next physical action, and who owns it? The AI has already answered; you confirm with <span class="kbd">a</span> or correct it. Never leave something here "to think about later" — that is what Someday is for.' },
  programs: { stage:'Organize', text:'A project is any outcome that needs more than one step. Every project must show a next action, a waiting-for, or AI work in progress — otherwise it is flagged and cannot move. <b>Stalled</b> means nothing in the ledger has moved in 7 days. The status paragraph is compiled from the ledger into the wiki; <b>Wiki</b> opens links, decisions and risks. Click a project name for its history. <b>Add program</b> is deliberately rare — a program is an area of responsibility with a purpose; <b>Retire</b> it when that purpose is met.' },
  waiting: { stage:'Organize · the PM\'s real list', text:'Everything owed to you, aged like receivables. A follow-up date is a promise to yourself to chase. <b>Draft nudge</b> writes the follow-up from the history — nothing sends until you approve. Read this list oldest-first and ask of each item: still needed, or drop or escalate?' },
  delegated: { stage:'Delegate', text:'Hand work to the assistant the way you would hand it to a person: it does the work, you review. Queued → Working → Ready. Approving executes exactly the declared side effect; <b>Take it back</b> returns the item to your list. Autonomy sets what it may do unasked — raise one capability at a time as the weekly audit earns trust.' },
  someday: { stage:'Incubate', text:'Things you might do, not things you will. Parking here is a real decision — it keeps the idea without letting it clutter the action lists. Give an item a <b>revisit</b> date and it becomes a tickler: it re-enters the inbox that morning for a fresh decision. Everything here is reviewed weekly; promote it, re-date it, or drop it.' },
  reference: { stage:'Reference', text:'Not actionable, worth keeping. Reference is filed <b>into the wiki</b> — under a program\'s key links, a person, or its own page — so this list is simply the wiki index. A reference item with a revisit date is a tickler ("contract renews 1 Oct"), and comes back to the inbox on that day.' },
  people: { stage:'Organize · stakeholders', text:'Both directions for every person: what they owe you and what you owe them. Before a 1:1, open the agenda — it is what you queued with <span class="chip ctx">@1:1/name</span> plus everything open between you. The assistant is listed as a person on purpose: delegation is delegation.' },
  review: { stage:'Reflect', text:'GTD\'s keystone habit: weekly, uninterrupted, top to bottom. The AI has gathered the evidence; you make the calls. Steps tick themselves when the data says so. Do not skip the AI audit — automatic actions are the ones to eyeball — or the wiki lint.' },
  flow: { stage:'Reflect · the system itself', text:'Is the system healthy, independent of the work in it? If <b>done</b> falls away from <b>captured</b>, lists are filling faster than you clear them. Cycle time shows where work waits. Watch this before you feel it.' },
  settings: { stage:'Configure', text:'Configure — what the assistant may do unasked, which model runs each job, and the prompts behind them. Changes here are remembered and take effect on the next run of that job.' },
};

export function guideBox(view) {
  const g = guides[view]; if (!g) return '';
  /* Dismissed guides fold to one line rather than vanishing, so the habit text stays one click away. */
  if (prefs.guides[view]) return `<div class="guide mini"><span class="gi">${icons.guide}</span><div class="gh"><b>${g.stage}</b><span class="faint">· how this view works</span></div><button class="btn sm ghost" data-guide-show="${view}">Show</button></div>`;
  return `<div class="guide"><span class="gi">${icons.guide}</span><div><div class="gh"><b>${g.stage}</b><span class="faint">· how this view works</span></div><p>${g.text}</p></div><button class="btn sm" data-guide-dismiss="${view}">Got it</button></div>`;
}

export function guideDrawer() {
  openDrawer('Guide', `
    <div class="sec"><h3>The loop</h3><ol class="steps-l"><li><b>Capture</b> — anything, from anywhere, into the inbox. The capture box at the top, <span class="kbd">/</span>.</li><li><b>Clarify</b> — daily, to zero. Is it actionable? What is the next physical action? Who owns it? AI proposes, you confirm.</li><li><b>Organize</b> — nothing to file; Programs, Waiting for, People and Delegated are views over the same ledger.</li><li><b>Reflect</b> — the weekly review, Fridays. Steps tick themselves when the data says so.</li><li><b>Engage</b> — Now: what fits this hour, by context and energy.</li></ol></div>
    <div class="sec"><h3>Two stores</h3><p class="muted" style="margin:0">The <b>ledger</b> holds commitments — dates and owners. The <b>wiki</b> holds context — purpose, links, decisions with rationale, history. Status paragraphs are compiled from the ledger into the wiki; decisions and notes go in through a reviewed ingest.</p></div>
    <div class="sec"><h3>Trust rules</h3><ul><li>The AI never sends, books or deletes without your approval.</li><li>Every AI write is tagged and appears in the weekly audit.</li><li>"What approving does" is declared by the job, never written by the model.</li></ul></div>
    <div class="sec"><h3>Keys</h3><ul>
      <li><span class="kbd">⌘K</span> or <span class="kbd">/</span> capture from anywhere · <span class="kbd">⌘P</span> command palette · <span class="kbd">?</span> this guide · <span class="kbd">[</span> sidebar</li>
      <li>Capture grammar: <span class="kbd">@</span>project or person files it at once · <b>fri</b>, <b>+3</b>, <b>next week</b>, <b>20 sep</b> at the end sets the date · <b>!</b> pins to today · <b>~30m</b> estimate · a question always goes to the inbox</li>
      <li>Views: <span class="kbd">1</span>–<span class="kbd">9</span>, <span class="kbd">0</span>, <span class="kbd">,</span> · or <span class="kbd">g</span> then <span class="kbd">i</span> inbox, <span class="kbd">e</span> engage, <span class="kbd">p</span> programs, <span class="kbd">w</span> waiting, <span class="kbd">r</span> review, <span class="kbd">s</span> settings, <span class="kbd">d</span> delegated, <span class="kbd">o</span> someday</li>
      <li>Any list: <span class="kbd">j</span>/<span class="kbd">k</span> or <span class="kbd">↑</span>/<span class="kbd">↓</span> move the ring · <span class="kbd">⏎</span> open · <span class="kbd">x</span> done · <span class="kbd">d</span> defer until… · <span class="kbd">p</span> park in someday · <span class="kbd">n</span> draft nudge · <span class="kbd">m</span> move to project… · click a date chip to change it</li>
      <li>Inbox: <span class="kbd">a</span> accept · <span class="kbd">w</span> waiting · <span class="kbd">s</span> someday · <span class="kbd">t</span> trash · <span class="kbd">e</span> edit · <span class="kbd">d</span> accept and hand to AI · <span class="kbd">x</span> do it now (two-minute rule) · <span class="kbd">⌘⏎</span> accept from any field · <span class="kbd">Tab</span> list → kinds → next action</li>
      <li>Palette: <b>defer fri</b> · <b>move billing</b> · <b>nudge sam</b> · <b>go waiting</b> · <b>capture …</b> · items, projects and people by name</li>
      <li>Drawers: <span class="kbd">⌘⏎</span> primary button · <span class="kbd">Esc</span> close. Dates accept fuzzy text everywhere: tomorrow, fri, next week, +3, eom, 20 sep</li></ul></div>`,
    `<button class="btn" data-guide-reset>Show view tips again</button><button class="btn primary" data-close>Close</button>`);
}

export const views = [
  { id:'now', label:'Engage', key:'1', sub:'Work from here — what fits this hour' },
  { id:'inbox', label:'Inbox', key:'2', count:() => by('inbox').length, hot:true },
  { id:'programs', label:'Programs', key:'3', count:() => projects.filter(p => !p.dropped && !programs.find(g => g.id === p.program)?.retired && projHealth(p).noNext).length, hot:true },
  { id:'waiting', label:'Waiting for', key:'4', count:() => by('waiting').filter(w => until(w.followUp) < 0).length, hot:true },
  { id:'delegated', label:'Delegated to AI', key:'5', count:() => delegated('ready').length, ai:true },
  { id:'someday', label:'Someday / maybe', key:'6' },
  { id:'reference', label:'Reference', key:'7' },
  { id:'people', label:'People', key:'8' },
  { id:'review', label:'Weekly review', key:'9' },
  { id:'flow', label:'Flow', key:'0' },
  { id:'settings', label:'Settings', key:',' },
];

export function renderNav() {
  const cur = location.hash.slice(1) || 'now';
  const rail = $('.rail'); if (rail) { rail.classList.toggle('collapsed', !!prefs.collapsed.rail); const tb = rail.querySelector('.railtoggle'); if (tb) { tb.title = (prefs.collapsed.rail ? 'Expand' : 'Collapse') + ' sidebar ([)'; tb.setAttribute('aria-label', tb.title); tb.querySelector('span').textContent = prefs.collapsed.rail ? 'Expand' : 'Collapse'; }
  const foot = rail?.querySelector('.foot'); if (foot) foot.innerHTML = `${ledger.mode === 'server' ? 'Live ledger' + (ledger.stub ? ' (stub server)' : '') : ledger.demo ? 'Example data' : 'Local ledger'} · ${TODAY.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}.<br>Every AI write is tagged and reversible.<br><span class="kbd">?</span> guide`; const dt = $('.topbar .date'); if (dt) dt.textContent = TODAY.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' }); }
  $('#nav').innerHTML = views.slice(0, 1).map(v => `<a href="#${v.id}" class="primary ${cur === v.id ? 'on' : ''}" title="${v.label} (${v.key})">${icons[v.id]}<span><b>${v.label}</b><small>${v.sub}</small></span><span class="key">${v.key}</span></a>`).join('') +
    `<div class="group">Lists</div>` + views.slice(1, 8).map(v => navLink(v, cur)).join('') +
    `<div class="group">Reflect</div>` + views.slice(8).map(v => navLink(v, cur)).join('');
  const inbox = by('inbox').length, over = by('waiting').filter(w => until(w.followUp) < 0).length, noNext = projects.filter(p => !p.dropped && !programs.find(g => g.id === p.program)?.retired && projHealth(p).noNext).length, lrd = lastReview(), lr = lrd ? days(lrd) : null;
  $('#healthbar').innerHTML = `<a href="#inbox" class="${inbox ? 'bad' : ''}">Inbox <b>${inbox}</b></a><a href="#waiting" class="${over ? 'bad' : ''}">Overdue waiting <b>${over}</b></a><a href="#programs" class="${noNext ? 'bad' : ''}">No next action <b>${noNext}</b></a><a href="#review" class="${lr > 7 ? 'bad' : ''}">Last review <b>${lr == null ? '—' : lr + 'd'}</b></a><a href="#delegated" class="ai">AI for review <b>${delegated('ready').length}</b></a>${activeRuns().length ? `<span class="ai working" title="${activeRuns().map(r => r.job).join(', ')}">AI working <b>${activeRuns().length}</b></span>` : ''}`;
}

export function navLink(v, cur) {
  const n = v.count ? v.count() : 0;
  /* Two fixed-width slots after the label — badge, then key — so badge and key sit at the same x on every row; rows without a count get an empty badge slot. */
  return `<a href="#${v.id}" class="${cur === v.id ? 'on' : ''}" title="${v.label} (${v.key})">${icons[v.id] || ''}<span>${v.label}</span>${n ? `<span class="cnt ${v.hot ? 'hot' : ''}${v.ai ? ' ai' : ''}">${n}</span>` : '<span class="cnt none"></span>'}<span class="key">${v.key}</span></a>`;
}
