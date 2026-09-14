// Render loop, routing and event delegation. Every mutation is a ledger event: commit(type, payload, { item }).

import { autonomyLabel, capLabel } from './data/constants.js';
import { handOff, reviewDrawer } from './drawers/ai.js';
import { itemDrawer } from './drawers/item.js';
import { agendaDrawer, nudgeDraft, prepBrief } from './drawers/people.js';
import { addProgramDrawer, addProjectDrawer, createProgram, projectDrawer, retireDrawer, wikiDrawer } from './drawers/project.js';
import { statusDraft } from './drawers/status.js';
import { Replay } from './replay/index.js';
import { TODAY, d, fmtDate, until } from './lib/dates.js';
import { $, esc, toast } from './lib/dom.js';
import { by, mine, person, pname, projName, projOf } from './model.js';
import { prefs, savePrefs, resetPrefs } from './prefs.js';
import { activeRuns, commit, deliverables, isServer, items, ledger, programs, resetLocal, runJob, tick, wiki, withTx } from './store.js';
import { closeDrawer, openDrawer } from './ui/drawer.js';
import { actionRow } from './ui/fragments.js';
import { guideBox, guideDrawer, icons, renderNav, views } from './ui/nav.js';
import { proposalOf, ui } from './ui/session.js';
import { viewDelegated } from './views/delegated.js';
import { viewFlow } from './views/flow.js';
import { viewInbox } from './views/inbox.js';
import { viewNow } from './views/now.js';
import { viewPeople } from './views/people.js';
import { viewPrograms } from './views/programs.js';
import { viewReference } from './views/reference.js';
import { viewReview } from './views/review.js';
import { DEFAULT_PROMPTS, PROVIDERS, dataActions, modelOf, viewSettings } from './views/settings.js';
import { viewSomeday } from './views/someday.js';
import { viewWaiting } from './views/waiting.js';
import { colorPopover } from './views/programs.js';
/* inbox batch */
import { initAutocomplete, parseMentions } from './features/autocomplete.js';
import { initFuzzyInputs } from './features/fuzzyinput.js';
import { inboxTab, kgKeys } from './features/inboxkeys.js';
import { completeItem, doneToast, uncompleteItem } from './features/repeat.js';
/* engage batch */
import { isDeferred } from './features/defer.js';
import { initPaste } from './features/paste.js';

/* ---------- render & events ---------- */
let lastView = null;
export function render() {
  tick();                                                      // ticklers and deferred starts whose day has come become events
  const cur = location.hash.slice(1) || 'now';
  const v = { now:viewNow, inbox:viewInbox, programs:viewPrograms, waiting:viewWaiting, delegated:viewDelegated, someday:viewSomeday, reference:viewReference, people:viewPeople, review:viewReview, flow:viewFlow, settings:viewSettings }[cur] || viewNow;
  /* Scroll to the top only when the view changed; a filter click or a value change re-renders in place. */
  const y = window.scrollY;
  $('#view').innerHTML = v();
  const vh = $('#view .vhead'); if (vh) { const h1 = vh.querySelector('h1'); if (h1 && icons[cur]) h1.insertAdjacentHTML('afterbegin', `<span class="h1ico">${icons[cur]}</span>`); vh.insertAdjacentHTML('afterend', guideBox(cur)); }
  renderNav();
  const host = $('#replayHost'); if (host) Replay.mount(host); else Replay.unmount();
  window.scrollTo({ top: cur === lastView ? y : 0 });
  lastView = cur;
}

const dateOf = (sel) => { const v = $(sel)?.value; return v ? new Date(v + 'T08:00:00') : null; };

/** Add an action straight to a project (quick intake, first actions, review). Returns the new item id. */
export function addAction(fields, { source = 'capture', primary = false } = {}) {
  const id = 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  commit('captured', { source, raw: fields.next }, { item: id });
  commit('accepted', { kind: 'action', fields: Object.assign({ ctx: (fields.min || 30) <= 15 ? '@quick' : '@deep', min: 30 }, fields) }, { item: id });
  if (primary && fields.project) commit('next_action_set', { project: fields.project }, { item: id });
  return id;
}

export function acceptCurrent(overrideKind) {
  const it = items.find(i => i.id === ui.sel); if (!it) return;
  const p = proposalOf(it), kind = overrideKind || p.kind;
  const next = $('#pNext')?.value.trim() || p.next;
  const labels = { action:'Filed as next action', waiting:'Filed as waiting for', project:'New project created with first action', program:'New program created — wiki hub page added', done:'Done — two-minute rule; movement logged', someday:'Parked in someday / maybe', reference:'Filed as reference', trash:'Trashed' };
  let handed = false, deferredUntil = null;
  if (kind === 'trash') commit('accepted', { kind:'trash', fields:{ next } }, { item: it.id });
  else if (kind === 'done') commit('accepted', { kind:'done', fields:{ next, project: $('#pProj')?.value || p.project || null, min: Math.min(p.min || 2, 2) } }, { item: it.id });
  else if (kind === 'program') {
    const name = $('#pProgName')?.value.trim(), purpose = $('#pPurpose')?.value.trim();
    if (!name || !purpose) { toast('A program needs a name and a purpose'); ($('#pProgName').value ? $('#pPurpose') : $('#pProgName')).focus(); return; }
    const g = createProgram({ name, purpose, sponsor: it.from && person(it.from) ? it.from : (person('ingrid') ? 'ingrid' : null), cadence:'Status Fri' }, $('#pFirstProj')?.value.trim(), next, $('#pCtx')?.value || '@deep');
    commit('accepted', { kind:'reference', fields:{ next, project: g.id, refPage: g.id } }, { item: it.id });
  }
  else {
    let project = $('#pProj')?.value || p.project || null;
    const fields = { next, project };
    if (kind === 'project') {
      /* The inbox creates the project itself; this item becomes its first (primary) action. */
      const name = $('#pNewProj')?.value.trim(), program = $('#pProg')?.value;
      if (!name || !program) { toast('A project needs a name and a program'); $('#pNewProj')?.focus(); return; }
      const jid = 'j_' + Date.now().toString(36);
      commit('project_created', { project:{ id: jid, program, name, outcome: $('#pOutcome')?.value.trim() || '', health:'good', suggest:'Decide the next action once this first one is done' } });
      project = fields.project = jid;
    }
    if (kind === 'action' || kind === 'project') {
      fields.min = +($('#pMin')?.value) || p.min || null; const cv = $('#pCtx'); fields.ctx = (cv ? cv.value : p.ctx) || ((fields.min || 0) <= 15 ? '@quick' : '@deep');
      fields.due = $('#pDue') ? dateOf('#pDue') : (p.due || null); fields.repeat = $('#pRepeat')?.value || p.repeat || null;
      fields.hard = dateOf('#pHard'); fields.start = $('#pStart') ? dateOf('#pStart') : (p.start || null); if (p.ai) fields.ai = p.ai; if (it.energy) fields.energy = it.energy;
      if (fields.start && isDeferred({ start: fields.start })) deferredUntil = fields.start;
    }
    if (kind === 'waiting') { fields.owner = $('#pOwner')?.value || p.owner || it.from; fields.since = TODAY; fields.followUp = dateOf('#pFollow') || d(3); fields.nudges = 0; }
    if (kind === 'someday') { fields.since = TODAY; fields.revisit = dateOf('#pRevisit'); }
    if (kind === 'reference') { fields.refPage = $('#pRef')?.value || null; fields.filedAt = TODAY; fields.revisit = dateOf('#pRevisit'); }
    commit('accepted', { kind: kind === 'project' ? 'action' : kind, fields }, { item: it.id });
    if (kind === 'project') commit('next_action_set', { project }, { item: it.id });
    if (ui.delegateOnAccept && p.ai && (kind === 'action' || kind === 'project')) { handOff(it.id, p.ai.cap, p.ai.what); handed = true; }
  }
  delete ui.pkind[it.id];
  toast((handed ? 'Filed and handed to AI' : kind === 'action' && deferredUntil ? `Filed as next action · deferred until ${fmtDate(deferredUntil)}` : labels[kind]) + ' · tagged ai-filed, confirmed by you');
  ui.delegateOnAccept = false;
  const rest = by('inbox'); ui.sel = rest[0]?.id ?? null; render();
}

export function moveSel(dir) { const inbox = by('inbox'); const i = inbox.findIndex(x => x.id === ui.sel); ui.sel = inbox[Math.max(0, Math.min(inbox.length - 1, i + dir))]?.id ?? ui.sel; render(); }

/* chart tooltips */
export const tip = $('#tip');

/* Move an item into a project (or to program level): an `edited` with the new project; the fold stamps movedAt. */
function moveItem(id, pid) {
  const it = items.find(i => i.id === id), j = projOf(pid); if (!it || !j || it.project === pid) return false;
  commit('edited', { fields:{ project: pid } }, { item: id });
  toast(`Moved to ${j.name}`); return true;
}

/* A capture from anywhere in the UI: `captured` then the local first-guess `clarified` (the clarify job's stand-in). */
export function capture({ source = 'capture', raw, from = null, image, mentions, proposal }) {
  const id = 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  commit('captured', { source, raw, from, image, mentions }, { item: id });
  if (isServer()) requestClarify();                                            // the real clarify job, via the server
  else if (proposal) commit('clarified', { proposal }, { item: id, actor:'ai:clarify' });   // local stand-in
  return id;
}
/* Ask the server to run clarify shortly after a burst of captures (one job for the whole inbox). */
let clarifyTimer = null;
export function requestClarify({ now = false } = {}) {
  clearTimeout(clarifyTimer);
  const go = () => runJob('clarify').then(r => { if (r) toast('Clarifying with AI…'); renderNav(); }).catch(e => toast('Clarify did not start: ' + e.message));
  if (now) go(); else clarifyTimer = setTimeout(go, 2500);
}

/* Every click that changes the ledger gets an Undo on its toast: the transaction collects the events, Undo commits their compensations. */
document.addEventListener('click', (e) => withTx(() => onClick(e)));

function onClick(e) {
  const t = e.target.closest('[data-goflow],[data-guide-show],[data-pcolor],[data-colorpick],[data-promptreset],[data-quickadd],[data-sel],[data-kind],[data-accept],[data-accept-ai],[data-skip],[data-draft],[data-prep],[data-nudge],[data-agenda],[data-close],[data-send],[data-proj],[data-addmilestone],[data-item],[data-duelist],[data-received],[data-markdone],[data-park],[data-restore],[data-capfrom],[data-capprep],[data-ftime],[data-fenergy],[data-fclear],[data-collapse],[data-group],[data-addprog],[data-saveprog],[data-retire],[data-doretire],[data-dropproj],[data-guide],[data-runjob],[data-guide-dismiss],[data-guide-reset],[data-wiki],[data-ingest],[data-hand],[data-review],[data-approve],[data-takeback],[data-addproj],[data-saveproj],[data-primary],[data-addnext],[data-promote],[data-drop],[data-status],[data-complete],[data-copy],[data-reset],[data-data],[data-approvefor],[data-takebackfor]');
  if (!t) return;
  /* Project rows carry data-drop as a drag target, not as the "Drop" action: a click that bubbles up to one is not a command. */
  if (t.tagName === 'TR' && 'drop' in t.dataset) return;
  const ds = t.dataset;
  if (ds.goflow) { Replay.preset(ds.goflow); location.hash = '#flow'; }
  else if (ds.sel) { ui.sel = ds.sel; render(); }
  else if (ds.kind) { const it = items.find(i => i.id === ui.sel); const o = Object.assign({}, ui.pkind[it.id], { kind: ds.kind }); if (ds.kind === 'waiting' && !(o.owner || it.p.owner)) o.owner = it.from || it.p.owner || undefined; ui.pkind[it.id] = o; render(); }
  else if ('accept' in ds) acceptCurrent();
  else if ('acceptAi' in ds) { ui.delegateOnAccept = true; acceptCurrent(); }
  else if ('skip' in ds) moveSel(1);
  else if ('draft' in ds) { const it = items.find(i => i.id === ui.sel); const p = proposalOf(it); openDrawer('Reply draft', `<textarea class="draft">Hi ${esc(pname(it.from) || 'there')},\n\nThanks — got it. ${p.kind === 'action' ? `I'll have this to you ${p.due ? 'by ' + fmtDate(p.due) : 'shortly'}.` : 'I\'ll follow up once I have what I need.'}\n\nJeff</textarea><div class="note">Two-minute rule: if the AI can do it, it drafts it. You still press send.</div>`, `<button class="btn" data-close>Discard</button><button class="btn primary" data-close>Approve and send</button>`); }
  else if (ds.prep) prepBrief(+ds.prep);
  else if (ds.nudge) nudgeDraft(ds.nudge);
  else if (ds.agenda) agendaDrawer(ds.agenda);
  else if ('close' in ds) closeDrawer();
  else if (ds.send) { const w = items.find(i => i.id === ds.send); commit('nudged', { text: $('#nudgeText')?.value || '', channel:'email', followUp: d(5) }, { item: w.id }); closeDrawer(); toast(`Nudge sent to ${pname(w.owner)} · follow-up moved to ${fmtDate(d(5))}`); render(); }
  else if (ds.proj) projectDrawer(ds.proj);
  else if (ds.wiki) wikiDrawer(ds.wiki);
  else if (ds.addmilestone) { const gid = ds.addmilestone, what = $('#msWhat').value.trim(), dv = $('#msDate').value, st = $('#msState').value, err = $('#npErr'); if (!what) { err.textContent = 'Say what the milestone is.'; $('#msWhat').focus(); return; } if (!dv) { err.textContent = 'Give it a date — a milestone without one is a hope.'; $('#msDate').focus(); return; } const label = new Date(dv + 'T08:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' }); commit('milestone_added', { program: gid, milestone:{ label, what, state: st, iso: dv } }); toast(`Milestone added to wiki/${wiki[gid].page}.md`); wikiDrawer(gid); }
  else if ('guide' in ds) guideDrawer();
  else if (ds.runjob) { if (ds.runjob === 'clarify') requestClarify({ now: true }); else runJob(ds.runjob, ds.jobargs ? JSON.parse(ds.jobargs) : {}).then(() => { toast(`${ds.runjob} started`); renderNav(); }).catch(e => toast(`${ds.runjob} did not start: ${e.message}`)); }
  else if ('ftime' in ds) { ui.nowTime = +ds.ftime; render(); }
  else if (ds.item) itemDrawer(ds.item);
  else if ('duelist' in ds) { const list = mine().filter(a => a.due && until(a.due) <= 1).sort((a, b) => a.due - b.due); openDrawer('Due by tomorrow', list.length ? `<div class="panel"><div class="pb">${list.map(actionRow).join('')}</div></div><div class="note">Soft due dates — deadlines, not calendar pins. Click an item to open it, tick to mark done.</div>` : '<div class="empty">Nothing due by tomorrow.</div>', '<button class="btn" data-close>Close</button>'); }
  else if (ds.received) { const x = items.find(i => i.id === ds.received); commit('done', {}, { item: x.id }); closeDrawer(); toast(`Received from ${pname(x.owner)} · done`); render(); }
  else if (ds.markdone) { const x = items.find(i => i.id === ds.markdone); const spawned = completeItem(x); closeDrawer(); toast(doneToast(spawned)); render(); }
  else if (ds.park) { commit('parked', {}, { item: ds.park }); closeDrawer(); toast('Parked in someday / maybe'); render(); }
  else if (ds.restore) { commit('restored', {}, { item: ds.restore }); ui.sel = ds.restore; toast('Restored to inbox'); render(); }
  else if (ds.capprep) { const [title, on] = ds.capprep.split('|'); capture({ source:'calendar', raw:`Prep for ${title} on ${fmtDate(new Date(on + 'T08:00:00'))}`, proposal:{ kind:'action', next:`Prepare for ${title}`, project:null, ctx:'@deep', min:30, due:new Date(on + 'T08:00:00'), conf:.65, why:'From the two-week preview. Due the day of the meeting; set the project and what "prepared" means.' } }); toast('Captured — clarify it in the inbox'); render(); }
  else if (ds.capfrom) { capture({ source:'meeting', raw:`Follow-ups from ${ds.capfrom} (last week)`, proposal:{ kind:'action', next:`Write up follow-ups from ${ds.capfrom}`, project:null, ctx:'@quick', min:10, conf:.6, why:'Captured from the past-calendar sweep; no notes to read yet.' } }); toast('Captured — clarify it in the inbox'); render(); }
  else if ('fenergy' in ds) { ui.nowEnergy = ds.fenergy; render(); }
  else if (ds.group) { prefs.nowGroup = ds.group; savePrefs(); render(); }
  else if (ds.collapse) { prefs.collapsed[ds.collapse] = !prefs.collapsed[ds.collapse]; savePrefs(); render(); }
  else if ('fclear' in ds) { ui.nowScope = ''; ui.nowTime = 0; ui.nowEnergy = ''; render(); }
  else if ('addprog' in ds) addProgramDrawer();
  else if ('saveprog' in ds) {
    const name = $('#ngName').value.trim(), purpose = $('#ngPurpose').value.trim(), err = $('#npErr');
    if (!name) { err.textContent = 'Give the program a name.'; $('#ngName').focus(); return; }
    if (!purpose) { err.textContent = 'Write the purpose — the sentence every project must answer to.'; $('#ngPurpose').focus(); return; }
    const g = createProgram({ name, purpose, sponsor:$('#ngSponsor')?.value || null, cadence:$('#ngCadence').value.trim() || 'Status Fri' }, $('#ngProj').value.trim(), $('#ngNext').value.trim(), '@deep');
    closeDrawer(); toast(`Program created · wiki/${wiki[g.id].page}.md added`); location.hash = '#programs'; render();
  }
  else if (ds.retire) retireDrawer(ds.retire);
  else if (ds.dropproj) { const j = projOf(ds.dropproj); commit('project_updated', { id: j.id, fields:{ dropped:true } }); toast(`Dropped "${j.name}" — history kept`); retireDrawer(j.program); render(); }
  else if (ds.doretire) { const g = programs.find(x => x.id === ds.doretire); commit('program_retired', { id: g.id }); closeDrawer(); toast(`${g.name} retired · wiki pages kept as history`); render(); }
  else if (ds.guideDismiss) { prefs.guides[ds.guideDismiss] = true; savePrefs(); render(); }
  else if (ds.guideShow) { prefs.guides[ds.guideShow] = false; savePrefs(); render(); }
  else if (ds.pcolor) { const [gid, slot] = ds.pcolor.split('|'); commit('config_set', { key:'progColor.' + gid, value:+slot }); toast(`${projName(gid)} · color ${slot}`); render(); }
  else if (ds.colorpick) colorPopover(ds.colorpick, t);
  else if (ds.promptreset) { commit('config_set', { key:'prompts.' + ds.promptreset, value:null }); toast('Prompt reset to default'); render(); }
  else if ('quickadd' in ds) {
    const wrap = t.parentElement, sel = wrap.querySelector('select'), inp = wrap.querySelector('input:not([type=number])'), minEl = wrap.querySelector('input[type=number]');
    const next = inp.value.trim(); if (!next) { inp.focus(); return; }
    const pid = sel.value, min = +minEl?.value || 20;
    const ctx = min <= 15 ? '@quick' : '@deep';
    addAction({ next, project: pid, ctx, min }, { primary: !mine().some(x => x.project === pid) });
    toast(`Added to ${projName(pid)} · ${ctx}`); render();
  }
  else if ('guideReset' in ds) { prefs.guides = {}; savePrefs(); closeDrawer(); render(); toast('View tips are back'); }
  else if (ds.ingest) { const g = programs.find(x => x.id === ds.ingest); const id = addAction({ next:`Ingest this week's notes into ${g.name} wiki pages`, project: g.id, ctx:'@ai', min:30, ai:{ level:'do', cap:'wiki', what:'Read the notes, update hub sections and decisions, append to timeline and log' } }); handOff(id, 'wiki', 'Read the notes, update hub sections and decisions, append to timeline and log', `Updates ${wiki[g.id].page}.md and -decisions.md; appends to log.md`); closeDrawer(); toast('Handed to AI · wiki ingest queued for your review'); location.hash = '#delegated'; render(); }
  else if (ds.hand) { const a = items.find(i => i.id === ds.hand); handOff(a.id, a.ai?.cap, a.ai?.what); toast(`Handed to AI · "${a.next}" — you'll be asked before anything is sent`); render(); }
  else if (ds.review) reviewDrawer(ds.review);
  else if (ds.approve) { const x = items.find(i => i.id === ds.approve); const txt = $('#rvText')?.value; commit('approved', { effect: x.del.effect, deliverable: txt && txt !== x.del.deliverable ? txt : undefined }, { item: x.id }); closeDrawer(); toast(`Approved · ${x.del.effect}`); render(); }
  else if (ds.takeback) { const x = items.find(i => i.id === ds.takeback); commit('taken_back', {}, { item: x.id }); closeDrawer(); toast(`Taken back · "${x.next}" is on your list again`); render(); }
  else if (ds.addproj) addProjectDrawer(ds.addproj);
  else if (ds.saveproj) {
    const name = $('#npName').value.trim(), outcome = $('#npOutcome').value.trim(), next = $('#npNext').value.trim(), err = $('#npErr');
    if (!name) { err.textContent = 'Give the project a name.'; $('#npName').focus(); return; }
    if (!outcome) { err.textContent = 'Write the outcome — one sentence you could check against.'; $('#npOutcome').focus(); return; }
    const id = 'j_' + Date.now().toString(36);
    commit('project_created', { project:{ id, program: ds.saveproj, name, outcome, health:$('#npHealth').value, suggest:'Book 20 minutes with the owner to agree the next step' } });
    if (next) addAction({ next, project: id, ctx:$('#npCtx').value, min:30 }, { primary:true });
    closeDrawer(); toast(next ? `Project created with its first action` : `Project created — decide its next action`); render();
  }
  else if (ds.primary) { const a = items.find(i => i.id === ds.primary); commit('next_action_set', { project: a.project }, { item: a.id }); toast('Marked as the next action for ' + projName(a.project)); projectDrawer(a.project); render(); }
  else if (ds.addnext) { const j = projOf(ds.addnext); const next = $('#suggestText')?.value.trim(); if (!next) { $('#suggestErr').textContent = 'Write the next physical action first.'; return; } addAction({ next, project: j.id, ctx:$('#suggestCtx')?.value || '@deep', min:30 }, { primary:true }); toast('Next action added · tagged ai-suggested, confirmed by you'); projectDrawer(j.id); render(); }
  else if (ds.promote) { commit('promoted', {}, { item: ds.promote }); toast('Promoted to next action'); render(); }
  else if (ds.drop) { commit('dropped', {}, { item: ds.drop }); toast('Dropped'); render(); }
  else if ('status' in ds) statusDraft();
  else if ('complete' in ds) { commit('review_completed', { steps: Object.keys(prefs.review).filter(k => prefs.review[k]) }); prefs.review = {}; savePrefs(); toast('Weekly review completed · every project stamped'); render(); }
  else if ('copy' in ds) { const ta = $('#drawer textarea'); ta?.select(); try { navigator.clipboard?.writeText(ta.value); } catch (x) {} toast('Copied'); }
  else if ('reset' in ds) { if (ledger.mode === 'local') { resetPrefs(); resetLocal({ demo:true }); toast('Demo ledger reloaded'); } else { resetPrefs(); toast('Browser preferences reset · the ledger lives on the server'); render(); } }
  else if (ds.data) dataActions(ds.data, t);
  else if (ds.approvefor) { const x = deliverables.find(d => d.key === ds.approvefor); if (x) { commit('approved', { effect: x.effect, for: x.for }); toast(`Approved · ${x.effect}`); render(); } }
  else if (ds.takebackfor) { const x = deliverables.find(d => d.key === ds.takebackfor); if (x) { commit('taken_back', { for: x.for }); toast('Taken back'); render(); } }
}

document.addEventListener('input', (e) => { if (e.target.closest('.form')) { const er = $('#npErr'); if (er) er.textContent = ''; } });

/* Drag a program-level item onto a project row. Native HTML5 drag, delegated once. */
document.addEventListener('dragstart', (e) => { const s = e.target.closest?.('[data-drag]'); if (!s) return; e.dataTransfer.setData('text/plain', s.dataset.drag); e.dataTransfer.effectAllowed = 'move'; s.classList.add('dragging'); });
document.addEventListener('dragend', (e) => { e.target.closest?.('[data-drag]')?.classList.remove('dragging'); });
document.addEventListener('dragover', (e) => { const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; z.classList.add('dropping'); });
document.addEventListener('dragleave', (e) => { const z = e.target.closest?.('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('dropping'); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('dropping');
  withTx(() => { if (moveItem(e.dataTransfer.getData('text/plain'), z.dataset.drop)) render(); });
});

document.addEventListener('change', (e) => withTx(() => onChange(e)));

function onChange(e) {
  const t = e.target;
  if (t.dataset.moveitem && t.value) { const it = items.find(i => i.id === t.dataset.moveitem); if (moveItem(it.id, t.value)) { itemDrawer(it.id); render(); } }
  if (t.dataset.done) { const it = items.find(i => i.id === t.dataset.done); if (t.checked) { const spawned = completeItem(it); toast(doneToast(spawned)); if (spawned) render(); } else uncompleteItem(it); renderNav(); }
  if (t.dataset.step) { prefs.review[t.dataset.step] = t.checked; savePrefs(); render(); }
  if (t.dataset.moveproj && t.value) { const j = projOf(t.dataset.moveproj); const from = j.program; commit('project_updated', { id: j.id, fields:{ program: t.value } }); toast(`Moved "${j.name}" to ${projName(t.value)}`); retireDrawer(from); render(); }
  if (t.dataset.revisit) { const x = items.find(i => i.id === t.dataset.revisit); const v = t.value ? new Date(t.value + 'T08:00:00') : null; commit('edited', { fields:{ revisit: v } }, { item: x.id }); toast(v ? `Will resurface ${fmtDate(v)}` : 'Revisit date cleared'); renderNav(); }
  if ('fscope' in t.dataset) { ui.nowScope = t.value; render(); }
  if (t.dataset.setfield) { const x = items.find(i => i.id === t.dataset.id); const f = t.dataset.setfield; let v = t.value; if (f === 'min') v = t.value ? Math.max(1, +t.value) : null; else if (v === '') v = null; if (f === 'next' && !v) return; commit('edited', { fields:{ [f]: v } }, { item: x.id }); toast(f === 'next' ? 'Renamed' : `${f === 'min' ? 'Estimate' : f[0].toUpperCase() + f.slice(1)} saved`); render(); }
  if (t.dataset.setdate) { const x = items.find(i => i.id === t.dataset.id); const v = t.value ? new Date(t.value + 'T08:00:00') : null; commit('edited', { fields:{ [t.dataset.setdate]: v } }, { item: x.id }); toast(v ? `${t.dataset.setdate === 'followUp' ? 'Follow-up' : t.dataset.setdate === 'hard' ? 'Pinned to' : t.dataset.setdate === 'start' ? 'Deferred until' : 'Due'} ${fmtDate(v)}` : 'Date cleared'); render(); }
  if (t.dataset.autonomy) { commit('config_set', { key:'autonomy.' + t.dataset.autonomy, value: t.value }); toast(`${capLabel[t.dataset.autonomy]}: ${autonomyLabel[t.value]}`); }
  /* Settings. Model rows re-render because the model list depends on the provider; effort only applies to Claude. */
  if (t.dataset.model) { const [job, field] = t.dataset.model.split('|'); const m = Object.assign({}, modelOf(job), { [field]: t.value }); if (field === 'provider') { m.model = PROVIDERS[t.value].models[0]; if (t.value === 'local') delete m.effort; else m.effort = m.effort || 'medium'; } commit('config_set', { key:'models.' + job, value: m }); toast(`${job}: ${PROVIDERS[m.provider].label} · ${m.model}${m.effort ? ' · ' + m.effort : ''}`); render(); }
  if (t.dataset.prompt) { const job = t.dataset.prompt, v = t.value.trim(); commit('config_set', { key:'prompts.' + job, value: (v === DEFAULT_PROMPTS[job] || !v) ? null : v }); toast('Prompt saved · used on the next run'); render(); }
  if (t.dataset.opt === 'nowGroup') { prefs.nowGroup = t.value; savePrefs(); toast(`Engage groups by ${t.value}`); }
  if (t.dataset.opt === 'rail') { prefs.collapsed.rail = t.checked; savePrefs(); render(); }
  if (t.dataset.data === 'import') dataActions('import', t);
}
$('#drawerBg').addEventListener('click', closeDrawer);

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-sweepform]'); if (!f) return; e.preventDefault();
  const v = f.querySelector('input').value.trim(); if (!v) return;
  const src = f.dataset.sweepform || 'sweep';
  withTx(() => { capture({ source: src, raw: v, proposal:{ kind:'action', next: v, project:null, ctx:'@quick', min:15, conf:.6, why: src === 'calendar' ? 'Captured from the two-week preview — prep for something on the calendar.' : 'From the mind sweep — clarify in the inbox.' } }); f.querySelector('input').value = ''; toast(src === 'calendar' ? 'Captured — clarify it in the inbox' : 'Captured — keep sweeping'); render(); });
  $(`[data-sweepform="${src === 'sweep' ? '' : src}"] input`)?.focus();
});
$('#captureForm').addEventListener('submit', (e) => {
  e.preventDefault(); const v = $('#captureInput').value.trim(); if (!v) return;
  const guessWait = /waiting|will send|said (he|she|they)|promised|get back/i.test(v), guessSome = /idea|someday|maybe|could/i.test(v);
  const m = parseMentions(v);           // @Program / @Project / @Person — text is kept as typed
  withTx(() => {
    const id = capture({ source:'capture', raw: v, mentions: m.ids, proposal:{ kind: guessWait ? 'waiting' : guessSome ? 'someday' : 'action', next: v.replace(/^(todo|remember to|remind me to)\s*/i, ''), owner: guessWait ? (m.owner || null) : m.owner || undefined, project: m.project, ctx:'@quick', min:15, conf: m.ids.length ? .72 : .66, why: m.ids.length ? 'Captured just now; the @-mentions set the project and person, the rest is a first guess from the wording.' : 'Captured just now with no source thread to read, so this is a first guess from the wording alone.' } });
    $('#captureInput').value = ''; ui.sel = id; location.hash = '#inbox'; toast('Captured · waiting for you in the inbox'); render();
  });
});

document.addEventListener('keydown', (e) => {
  const cur = location.hash.slice(1) || 'now', inInbox = cur === 'inbox' && !$('#drawer').classList.contains('open');
  /* Inbox: Cmd/Ctrl+Enter accepts from anywhere (fields included); Tab walks list → kinds → next action; arrows inside a kind group. */
  if (inInbox && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); withTx(() => acceptCurrent()); return; }
  if (inInbox && e.key === 'Tab' && inboxTab(e)) return;
  /* Sidebar toggle: plain [ outside fields; Cmd/Ctrl+[ anywhere, even while typing. */
  if (e.key === '[' && (e.metaKey || e.ctrlKey || !e.target.matches('input,textarea,select'))) { e.preventDefault(); prefs.collapsed.rail = !prefs.collapsed.rail; savePrefs(); render(); return; }
  if (e.target.matches('input,textarea,select') ) { if (e.key === 'Escape') e.target.blur(); return; }
  if (inInbox && kgKeys(e)) return;
  if (e.key === 'Escape') { closeDrawer(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const v = views.find(x => x.key === e.key); if (v) { location.hash = '#' + v.id; return; }
  if (e.key === '/') { e.preventDefault(); $('#captureInput').focus(); return; }
  if (e.key === '?') { guideDrawer(); return; }
  if (cur === 'inbox') {
    if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const inList = !!document.activeElement?.closest?.('.ilist'); moveSel(e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1); if (inList || e.key.startsWith('Arrow')) $('.ilist .row.sel')?.focus({ preventScroll:false }); }
    else if ('axwst'.includes(e.key) && e.key.length === 1) withTx(() => acceptCurrent({ a:undefined, x:'done', w:'waiting', s:'someday', t:'trash' }[e.key]));
    else if (e.key === 'e') { e.preventDefault(); $('#pNext')?.focus(); $('#pNext')?.select(); }
    else if (e.key === 'd') { const it = items.find(i => i.id === ui.sel); if (it?.p.ai) { ui.delegateOnAccept = true; withTx(() => acceptCurrent()); } }
  }
});

document.addEventListener('mousemove', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.style.display = 'none'; return; }
  tip.innerHTML = t.dataset.tip; tip.style.display = 'block';
  tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 30) + 'px';
});

/* inbox batch: capture-box @autocomplete and fuzzy-date companions (delegated; safe across re-renders) */
initAutocomplete(); initFuzzyInputs();

/* engage batch: paste a screenshot into capture (the toast carries its own Undo) */
initPaste({ render, capture });
