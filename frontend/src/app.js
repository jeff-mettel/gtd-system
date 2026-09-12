// Render loop, routing and event delegation.

import { active, activeProjects, autonomyLabel, capLabel, d, iso, items, people, programs, projects, wiki } from './data/example.js';
import { handOff } from './drawers/ai.js';
import { itemDrawer } from './drawers/item.js';
import { closeDrawer, nudgeDraft, openDrawer, prepBrief } from './drawers/people.js';
import { addProgramDrawer, addProjectDrawer, agendaDrawer, createProgram, projectDrawer, retireDrawer, wikiDrawer } from './drawers/project.js';
import { TODAY } from './lib/dates.js';
import { by, days, delegated, esc, fmtDate, person, pname, projName, projOf } from './model.js';
import { STORE, save, state } from './state.js';
import { $ } from './ui/fragments.js';
import { I, guideBox, guideDrawer, guides, icons, projHealth, renderNav, toast, views } from './ui/nav.js';
import { ui } from './ui/session.js';
import { reviewDrawer, viewDelegated } from './views/delegated.js';
import { viewFlow } from './views/flow.js';
import { viewInbox } from './views/inbox.js';
import { viewNow } from './views/now.js';
import { viewPeople, viewReference } from './views/people.js';
import { viewPrograms } from './views/programs.js';
import { viewSomeday } from './views/reference.js';
import { viewReview } from './views/review.js';
import { viewWaiting } from './views/waiting.js';

}
export function statusDraft() {
  const done = by('done');
  const text = active().map(g => { const js = activeProjects(g.id); const h = js.some(j => j.health === 'crit') ? 'Blocked' : js.some(j => j.health === 'warn') ? 'At risk' : 'On track';
    const wins = done.filter(x => js.some(j => j.id === x.project) || x.project === g.id).map(x => `  • ${x.next}`).join('\n');
    const risks = js.filter(j => j.health !== 'good').map(j => { const s = projHealth(j); return `  • ${j.name}: ${s.w ? `waiting on ${pname(s.w.owner)} for ${days(s.w.since)}d` : s.noNext ? 'no next action defined' : 'at risk'}`; }).join('\n');
    return `${g.name} — ${h}\nDone this week:\n${wins || '  • —'}\nRisks / asks:\n${risks || '  • none'}`; }).join('\n\n');
  openDrawer('Status report · week of 7 Sep', `<textarea class="draft" style="min-height:360px">${esc(text)}</textarea><div class="note">Assembled from health, wins and waiting-fors. Edit, then paste wherever status lives.</div>`, `<button class="btn" data-close>Close</button><button class="btn primary" data-copy>Copy</button>`);

/* ---------- render & events ---------- */
export function render() {
  const cur = location.hash.slice(1) || 'now';
  const v = { now:viewNow, inbox:viewInbox, programs:viewPrograms, waiting:viewWaiting, delegated:viewDelegated, someday:viewSomeday, reference:viewReference, people:viewPeople, review:viewReview, flow:viewFlow }[cur] || viewNow;
  $('#view').innerHTML = v();
  const vh = $('#view .vhead'); if (vh) { const h1 = vh.querySelector('h1'); if (h1 && icons[cur]) h1.insertAdjacentHTML('afterbegin', `<span class="h1ico">${icons[cur]}</span>`); vh.insertAdjacentHTML('afterend', guideBox(cur)); }
  renderNav();
  window.scrollTo({ top:0 });
}


export function acceptCurrent(overrideKind) {
  const it = items.find(i => i.id === ui.sel); if (!it) return;
  const kind = overrideKind || it.p.kind;
  const next = $('#pNext')?.value.trim() || it.p.next;
  if (kind === 'trash') { it.kind = 'trash'; it.trashedAt = TODAY; state.kinds[it.id] = 'trash'; state.overrides[it.id] = Object.assign(state.overrides[it.id] || {}, { trashedAt:TODAY }); }
  else if (kind === 'done') { it.next = next; it.project = $('#pProj')?.value || it.p.project || null; it.kind = 'done'; it.doneAt = TODAY; it.createdAt = TODAY; it.min = Math.min(it.p.min || 2, 2); state.kinds[it.id] = 'done'; state.done[it.id] = true; state.overrides[it.id] = { next:it.next, project:it.project, doneAt:TODAY, createdAt:TODAY, min:it.min }; }
  else if (kind === 'program') {
    const name = $('#pProgName')?.value.trim(), purpose = $('#pPurpose')?.value.trim();
    if (!name || !purpose) { toast('A program needs a name and a purpose'); ($('#pProgName').value ? $('#pPurpose') : $('#pProgName')).focus(); return; }
    const g = createProgram({ name, purpose, sponsor: it.from && person(it.from) ? it.from : 'ingrid', cadence:'Status Fri' }, $('#pFirstProj')?.value.trim(), next, $('#pCtx')?.value || '@deep');
    it.kind = 'reference'; it.project = g.id; state.kinds[it.id] = 'reference'; state.overrides[it.id] = { project:g.id };
  }
  else {
    it.next = next; it.project = $('#pProj')?.value || it.p.project || null;
    if (kind === 'action' || kind === 'project') { it.ctx = $('#pCtx')?.value || it.p.ctx || '@quick'; it.min = +($('#pMin')?.value) || it.p.min; const dv = $('#pDue')?.value; it.due = dv ? new Date(dv + 'T08:00:00') : it.p.due; }
    if (kind === 'waiting') { it.owner = $('#pOwner')?.value || it.p.owner || it.from; it.since = TODAY; const fv = $('#pFollow')?.value; it.followUp = fv ? new Date(fv + 'T08:00:00') : d(3); it.nudges = 0; }
    if (kind === 'someday') { it.since = TODAY; const rv = $('#pRevisit')?.value; it.revisit = rv ? new Date(rv + 'T08:00:00') : null; }
    if (kind === 'reference') { it.refPage = $('#pRef')?.value || null; it.filedAt = TODAY; const rv = $('#pRevisit')?.value; it.revisit = rv ? new Date(rv + 'T08:00:00') : null; if (wiki[it.refPage] && !wiki[it.refPage].links.some(l => l[0] === next)) wiki[it.refPage].links.push([next, '']); }
    if (kind === 'action' || kind === 'project') { it.createdAt = TODAY; const hv = $('#pHard')?.value; it.hard = hv ? new Date(hv + 'T08:00:00') : null; }
    if (it.wasKind) { state.resurfaced[it.id + ':' + new Date(it.revisit || TODAY).toDateString()] = true; delete it.wasKind; }
    if (ui.delegateOnAccept && it.p.ai && (kind === 'action' || kind === 'project')) handOff(it, it.p.ai.cap, it.p.ai.what);

    it.kind = kind === 'project' ? 'action' : kind;
    state.kinds[it.id] = it.kind; state.overrides[it.id] = { next:it.next, project:it.project, ctx:it.ctx, min:it.min, due:it.due, hard:it.hard, owner:it.owner, since:it.since, followUp:it.followUp, nudges:it.nudges, createdAt:it.createdAt, revisit:it.revisit, refPage:it.refPage, filedAt:it.filedAt, energy:it.energy };
  }
  save();
  const labels = { action:'Filed as next action', waiting:'Filed as waiting for', project:'New project created with first action', program:'New program created — wiki hub page added', done:'Done — two-minute rule; movement logged', someday:'Parked in someday / maybe', reference:'Filed as reference', trash:'Trashed' };
  toast((it.owner === 'ai' ? 'Filed and handed to AI' : labels[kind]) + ' · tagged ai-filed, confirmed by you');
  ui.delegateOnAccept = false;
  const rest = by('inbox'); ui.sel = rest[0]?.id ?? null; render();
}
export function moveSel(dir) { const inbox = by('inbox'); const i = inbox.findIndex(x => x.id === ui.sel); ui.sel = inbox[Math.max(0, Math.min(inbox.length - 1, i + dir))]?.id ?? ui.sel; render(); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-sel],[data-kind],[data-accept],[data-accept-ai],[data-skip],[data-draft],[data-prep],[data-nudge],[data-agenda],[data-close],[data-send],[data-proj],[data-item],[data-received],[data-markdone],[data-park],[data-restore],[data-capfrom],[data-capprep],[data-ftime],[data-fenergy],[data-fclear],[data-collapse],[data-group],[data-addprog],[data-saveprog],[data-retire],[data-doretire],[data-dropproj],[data-guide],[data-guide-dismiss],[data-guide-reset],[data-wiki],[data-ingest],[data-hand],[data-review],[data-approve],[data-takeback],[data-addproj],[data-saveproj],[data-primary],[data-addnext],[data-promote],[data-drop],[data-status],[data-complete],[data-copy],[data-reset]');
  if (!t) return;
  const ds = t.dataset;
  if (ds.sel) { ui.sel = ds.sel; render(); }
  else if (ds.kind) { const it = items.find(i => i.id === ui.sel); it.p.kind = ds.kind; if (ds.kind === 'waiting' && !it.p.owner) it.p.owner = it.from || 'priya'; render(); }
  else if ('accept' in ds) acceptCurrent();
  else if ('acceptAi' in ds) { ui.delegateOnAccept = true; acceptCurrent(); }
  else if ('skip' in ds) moveSel(1);
  else if ('draft' in ds) { const it = items.find(i => i.id === ui.sel); openDrawer('Reply draft', `<textarea class="draft">Hi ${esc(pname(it.from) || 'there')},\n\nThanks — got it. ${it.p.kind === 'action' ? `I'll have this to you ${it.p.due ? 'by ' + fmtDate(it.p.due) : 'shortly'}.` : 'I\'ll follow up once I have what I need.'}\n\nJeff</textarea><div class="note">Two-minute rule: if the AI can do it, it drafts it. You still press send.</div>`, `<button class="btn" data-close>Discard</button><button class="btn primary" data-close>Approve and send</button>`); }
  else if (ds.prep) prepBrief(+ds.prep);
  else if (ds.nudge) nudgeDraft(ds.nudge);
  else if (ds.agenda) agendaDrawer(ds.agenda);
  else if ('close' in ds) closeDrawer();
  else if (ds.send) { state.nudged[ds.send] = (state.nudged[ds.send] || 0) + 1; const w = items.find(i => i.id === ds.send); w.nudges = (w.nudges || 0) + 1; w.followUp = d(5); w.lastNudged = TODAY; save(); closeDrawer(); toast(`Nudge sent to ${pname(w.owner)} · follow-up moved to ${fmtDate(w.followUp)}`); render(); }
  else if (ds.proj) projectDrawer(ds.proj);
  else if (ds.wiki) wikiDrawer(ds.wiki);
  else if ('guide' in ds) guideDrawer();
  else if ('ftime' in ds) { ui.nowTime = +ds.ftime; render(); }
  else if (ds.item) itemDrawer(ds.item);
  else if (ds.received) { const x = items.find(i => i.id === ds.received); x.kind = 'done'; x.doneAt = TODAY; state.done[x.id] = true; state.overrides[x.id] = Object.assign(state.overrides[x.id] || {}, { doneAt:TODAY }); save(); closeDrawer(); toast(`Received from ${pname(x.owner)} · done`); render(); }
  else if (ds.markdone) { const x = items.find(i => i.id === ds.markdone); x.kind = 'done'; x.doneAt = TODAY; state.done[x.id] = true; state.overrides[x.id] = Object.assign(state.overrides[x.id] || {}, { doneAt:TODAY }); save(); closeDrawer(); toast('Done · movement logged'); render(); }
  else if (ds.park) { const x = items.find(i => i.id === ds.park); x.kind = 'someday'; x.since = TODAY; state.kinds[x.id] = 'someday'; state.overrides[x.id] = Object.assign(state.overrides[x.id] || {}, { since:TODAY }); save(); closeDrawer(); toast('Parked in someday / maybe'); render(); }
  else if (ds.restore) { const x = items.find(i => i.id === ds.restore); x.kind = 'inbox'; x.captured = TODAY; if (!x.p) x.p = { kind:'action', next:x.next, project:null, ctx:'@quick', min:15, conf:.5, why:'Restored from trash — clarify again.' }; delete state.kinds[x.id]; save(); ui.sel = x.id; toast('Restored to inbox'); render(); }
  else if (ds.capprep) { const [title, on] = ds.capprep.split('|'); const id = 'C' + Date.now(); const n = { id, kind:'inbox', source:'calendar', from:null, captured:TODAY, raw:`Prep for ${title} on ${fmtDate(new Date(on + 'T08:00:00'))}`, p:{ kind:'action', next:`Prepare for ${title}`, project:null, ctx:'@deep', min:30, due:new Date(on + 'T08:00:00'), conf:.65, why:'From the two-week preview. Due the day of the meeting; set the project and what "prepared" means.' } }; items.unshift(n); state.captured.push(Object.assign({}, n, { captured:iso(TODAY) })); save(); toast('Captured — clarify it in the inbox'); render(); }
  else if (ds.capfrom) { const id = 'C' + Date.now(); const n = { id, kind:'inbox', source:'meeting', from:null, captured:TODAY, raw:`Follow-ups from ${ds.capfrom} (last week)`, p:{ kind:'action', next:`Write up follow-ups from ${ds.capfrom}`, project:null, ctx:'@quick', min:10, conf:.6, why:'Captured from the past-calendar sweep; no notes to read yet.' } }; items.unshift(n); state.captured.push(Object.assign({}, n, { captured:iso(TODAY) })); save(); toast('Captured — clarify it in the inbox'); render(); }
  else if ('fenergy' in ds) { ui.nowEnergy = ds.fenergy; render(); }
  else if (ds.group) { state.nowGroup = ds.group; save(); render(); }
  else if (ds.collapse) { state.collapsed[ds.collapse] = !state.collapsed[ds.collapse]; save(); render(); }
  else if ('fclear' in ds) { ui.nowScope = ''; ui.nowTime = 0; ui.nowEnergy = ''; render(); }
  else if ('addprog' in ds) addProgramDrawer();
  else if ('saveprog' in ds) {
    const name = $('#ngName').value.trim(), purpose = $('#ngPurpose').value.trim(), err = $('#npErr');
    if (!name) { err.textContent = 'Give the program a name.'; $('#ngName').focus(); return; }
    if (!purpose) { err.textContent = 'Write the purpose — the sentence every project must answer to.'; $('#ngPurpose').focus(); return; }
    const g = createProgram({ name, purpose, sponsor:$('#ngSponsor').value, cadence:$('#ngCadence').value.trim() || 'Status Fri' }, $('#ngProj').value.trim(), $('#ngNext').value.trim(), '@deep');
    closeDrawer(); toast(`Program created · wiki/${wiki[g.id].page}.md added`); location.hash = '#programs'; render();
  }
  else if (ds.retire) retireDrawer(ds.retire);
  else if (ds.dropproj) { const j = projOf(ds.dropproj); j.dropped = true; state.projOverrides[j.id] = Object.assign(state.projOverrides[j.id] || {}, { dropped:true }); save(); toast(`Dropped "${j.name}" — history kept`); retireDrawer(j.program); render(); }
  else if (ds.doretire) { const g = programs.find(x => x.id === ds.doretire); g.retired = TODAY; state.retired[g.id] = iso(TODAY); save(); closeDrawer(); toast(`${g.name} retired · wiki pages kept as history`); render(); }
  else if (ds.guideDismiss) { state.guides[ds.guideDismiss] = true; save(); t.closest('.guide').remove(); }
  else if ('guideReset' in ds) { state.guides = {}; save(); closeDrawer(); render(); toast('View tips are back'); }
  else if (ds.ingest) { const g = programs.find(x => x.id === ds.ingest); const id = 'N' + Date.now(); const a = { id, kind:'action', next:`Ingest this week's notes into ${g.name} wiki pages`, project:g.id, ctx:'@ai', min:30, createdAt:TODAY, ai:{ level:'do', cap:'wiki', what:'Read the notes, update hub sections and decisions, append to timeline and log' } }; items.push(a); state.captured.push(Object.assign({}, a, { createdAt:iso(TODAY) })); handOff(a, 'wiki', a.ai.what); a.del.effect = `Updates ${wiki[g.id].page}.md and -decisions.md; appends to log.md`; state.delegated[id].effect = a.del.effect; save(); closeDrawer(); toast('Handed to AI · wiki ingest queued for your review'); location.hash = '#delegated'; render(); }
  else if (ds.hand) { const a = items.find(i => i.id === ds.hand); handOff(a, a.ai?.cap, a.ai?.what); toast(`Handed to AI · "${a.next}" — you'll be asked before anything is sent`); render(); }
  else if (ds.review) reviewDrawer(ds.review);
  else if (ds.approve) { const x = items.find(i => i.id === ds.approve); const txt = $('#rvText')?.value; if (txt) x.del.deliverable = txt; x.del.status = 'approved'; x.kind = 'done'; x.doneAt = TODAY; state.delegated[x.id] = Object.assign(state.delegated[x.id] || {}, { status:'approved', deliverable:x.del.deliverable, at:iso(x.del.at), readyAt:iso(x.del.readyAt || TODAY) }); state.done[x.id] = true; save(); closeDrawer(); toast(`Approved · ${x.del.effect}`); render(); }
  else if (ds.takeback) { const x = items.find(i => i.id === ds.takeback); delete x.owner; delete x.del; if (!x.ctx) x.ctx = '@quick'; state.delegated[x.id] = { status:'taken' }; save(); closeDrawer(); toast(`Taken back · "${x.next}" is on your list again`); render(); }
  else if (ds.addproj) addProjectDrawer(ds.addproj);
  else if (ds.saveproj) {
    const name = $('#npName').value.trim(), outcome = $('#npOutcome').value.trim(), next = $('#npNext').value.trim(), err = $('#npErr');
    if (!name) { err.textContent = 'Give the project a name.'; $('#npName').focus(); return; }
    if (!outcome) { err.textContent = 'Write the outcome — one sentence you could check against.'; $('#npOutcome').focus(); return; }
    const id = 'JN' + Date.now();
    const j = { id, program:ds.saveproj, name, outcome, health:$('#npHealth').value, suggest:'Book 20 minutes with the owner to agree the next step' };
    projects.push(j); state.projects.push(j);
    if (next) { const aid = 'N' + Date.now(); const a = { id:aid, kind:'action', next, project:id, ctx:$('#npCtx').value, min:30, createdAt:TODAY }; items.push(a); state.captured.push(Object.assign({}, a, { createdAt:iso(TODAY) })); state.primary[id] = aid; }
    save(); closeDrawer(); toast(next ? `Project created with its first action` : `Project created — decide its next action`); render();
  }
  else if (ds.primary) { const a = items.find(i => i.id === ds.primary); state.primary[a.project] = a.id; save(); toast('Marked as the next action for ' + projName(a.project)); projectDrawer(a.project); render(); }
  else if (ds.addnext) { const j = projOf(ds.addnext); const next = $('#suggestText')?.value.trim(); if (!next) { $('#suggestErr').textContent = 'Write the next physical action first.'; return; } const id = 'N' + Date.now(); const n = { id, kind:'action', next, project:j.id, ctx:$('#suggestCtx')?.value || '@deep', min:30, createdAt:TODAY }; items.push(n); state.captured.push(Object.assign({}, n, { createdAt:iso(TODAY) })); state.primary[j.id] = id; save(); toast('Next action added · tagged ai-suggested, confirmed by you'); projectDrawer(j.id); render(); }
  else if (ds.promote) { const s = items.find(i => i.id === ds.promote); s.kind = 'action'; s.ctx = '@deep'; s.min = 30; s.createdAt = TODAY; state.kinds[s.id] = 'action'; state.overrides[s.id] = { ctx:'@deep', min:30, createdAt:TODAY }; save(); toast('Promoted to next action'); render(); }
  else if (ds.drop) { const s = items.find(i => i.id === ds.drop); s.kind = 'trash'; state.kinds[s.id] = 'trash'; save(); toast('Dropped'); render(); }
  else if ('status' in ds) statusDraft();
  else if ('complete' in ds) { state.lastReview = iso(TODAY); state.review = {}; save(); toast('Weekly review completed · every project stamped'); render(); }
  else if ('copy' in ds) { const ta = $('#drawer textarea'); ta?.select(); try { navigator.clipboard?.writeText(ta.value); } catch (x) {} toast('Copied'); }
  else if ('reset' in ds) { try { localStorage.removeItem(STORE); } catch (x) {} location.reload(); }
});
document.addEventListener('input', (e) => { if (e.target.closest('.form')) { const er = $('#npErr'); if (er) er.textContent = ''; } });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.done) { const it = items.find(i => i.id === t.dataset.done); if (t.checked) { it._prev = it.kind; it.kind = 'done'; it.doneAt = TODAY; state.done[it.id] = true; state.overrides[it.id] = Object.assign(state.overrides[it.id] || {}, { doneAt:TODAY }); toast('Done · logged for the weekly review'); } else { it.kind = it._prev || 'action'; delete state.done[it.id]; } save(); renderNav(); }
  if (t.dataset.step) { state.review[t.dataset.step] = t.checked; save(); render(); }
  if (t.dataset.moveproj && t.value) { const j = projOf(t.dataset.moveproj); const from = j.program; j.program = t.value; state.projOverrides[j.id] = Object.assign(state.projOverrides[j.id] || {}, { program:t.value }); save(); toast(`Moved "${j.name}" to ${projName(t.value)}`); retireDrawer(from); render(); }
  if (t.dataset.revisit) { const x = items.find(i => i.id === t.dataset.revisit); x.revisit = t.value ? new Date(t.value + 'T08:00:00') : null; state.overrides[x.id] = Object.assign(state.overrides[x.id] || {}, { revisit:x.revisit }); save(); toast(x.revisit ? `Will resurface ${fmtDate(x.revisit)}` : 'Revisit date cleared'); renderNav(); }
  if ('fscope' in t.dataset) { ui.nowScope = t.value; render(); }
  if (t.dataset.setdate) { const x = items.find(i => i.id === t.dataset.id); const v = t.value ? new Date(t.value + 'T08:00:00') : null; x[t.dataset.setdate] = v; state.overrides[x.id] = Object.assign(state.overrides[x.id] || {}, { [t.dataset.setdate]: v }); save(); toast(v ? `${t.dataset.setdate === 'followUp' ? 'Follow-up' : t.dataset.setdate === 'hard' ? 'Pinned to' : 'Due'} ${fmtDate(v)}` : 'Date cleared'); render(); }
  if (t.dataset.autonomy) { state.autonomy[t.dataset.autonomy] = t.value; save(); toast(`${capLabel[t.dataset.autonomy]}: ${autonomyLabel[t.value]}`); }
});
$('#drawerBg').addEventListener('click', closeDrawer);
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-sweepform]'); if (!f) return; e.preventDefault();
  const v = f.querySelector('input').value.trim(); if (!v) return;
  const src = f.dataset.sweepform || 'sweep';
  const id = 'C' + Date.now(); const n = { id, kind:'inbox', source:src, from:null, captured:TODAY, raw:v, p:{ kind:'action', next:v, project:null, ctx:'@quick', min:15, conf:.6, why: src === 'calendar' ? 'Captured from the two-week preview — prep for something on the calendar.' : 'From the mind sweep — clarify in the inbox.' } };
  items.unshift(n); state.captured.push(Object.assign({}, n, { captured:iso(TODAY) })); save(); f.querySelector('input').value = ''; toast(src === 'calendar' ? 'Captured — clarify it in the inbox' : 'Captured — keep sweeping'); render(); $(`[data-sweepform="${src === 'sweep' ? '' : src}"] input`)?.focus();
});
$('#captureForm').addEventListener('submit', (e) => {
  e.preventDefault(); const v = $('#captureInput').value.trim(); if (!v) return;
  const id = 'C' + Date.now();
  const guessWait = /waiting|will send|said (he|she|they)|promised|get back/i.test(v), guessSome = /idea|someday|maybe|could/i.test(v);
  const n = { id, kind:'inbox', source:'capture', from:null, captured:TODAY, raw:v, p:{ kind: guessWait ? 'waiting' : guessSome ? 'someday' : 'action', next:v.replace(/^(todo|remember to|remind me to)\s*/i, ''), owner: guessWait ? 'priya' : undefined, project:null, ctx:'@quick', min:15, conf:.66, why:'Captured just now with no source thread to read, so this is a first guess from the wording alone.' } };
  items.unshift(n); state.captured.push(Object.assign({}, n, { captured:iso(TODAY) })); save();
  $('#captureInput').value = ''; ui.sel = id; location.hash = '#inbox'; toast('Captured · waiting for you in the inbox'); render();
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select') ) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') { closeDrawer(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const v = views.find(x => x.key === e.key); if (v) { location.hash = '#' + v.id; return; }
  if (e.key === '/') { e.preventDefault(); $('#captureInput').focus(); return; }
  if (e.key === '?') { guideDrawer(); return; }
  const cur = location.hash.slice(1) || 'now';
  if (cur === 'inbox') {
    if (e.key === 'j') moveSel(1); else if (e.key === 'k') moveSel(-1);
    else if (e.key === 'a') acceptCurrent(); else if (e.key === 'x') acceptCurrent('done'); else if (e.key === 'w') acceptCurrent('waiting'); else if (e.key === 's') acceptCurrent('someday'); else if (e.key === 't') acceptCurrent('trash');
    else if (e.key === 'e') { e.preventDefault(); $('#pNext')?.focus(); $('#pNext')?.select(); }
