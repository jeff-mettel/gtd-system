import { levelLabel, people, projects } from '../data/example.js';
import { REPEATS } from '../features/repeat.js';
import { d, days, fmtDate, iso } from '../lib/dates.js';
import { esc } from '../lib/dom.js';
import { active, by, person, pname, projOf, srcLabel } from '../model.js';
import { ui } from '../ui/session.js';

/* A date input with its fuzzy-text companion (see features/fuzzyinput.js). */
const dateField = (id, val) => `<div class="datewrap"><input id="${id}" type="date" value="${val}"><input class="fuzzy" data-for="${id}" placeholder="or: tomorrow, fri, +3, next week" aria-label="Type a date"></div>`;

/* A short project name from a first action: drop the leading verb, keep the first six words. */
export const projectNameFrom = (next) => { const w = String(next || '').replace(/^(draft|write|create|build|plan|set up|prepare|make|review|send|organi[sz]e|run|define|agree|book|start|kick off)\s+(the\s+|a\s+|an\s+)?/i, '').replace(/[.!?]+$/, '').split(/\s+/).slice(0, 6).join(' '); return w.charAt(0).toUpperCase() + w.slice(1); };

export function viewInbox() {
  const inbox = by('inbox');
  if (!inbox.length) return `<div class="vhead"><div><h1>Inbox</h1><p>Every ask from every surface lands here. AI proposes what each one is; you confirm in one keystroke.</p></div></div><div class="panel"><div class="empty"><b>Inbox zero</b>Nothing waiting to be clarified. Capture something above or reset the demo from Flow.</div></div>${trashPanel()}`;
  if (!inbox.find(i => i.id === ui.sel)) ui.sel = inbox[0].id;
  const it = inbox.find(i => i.id === ui.sel), p = it.p;
  const kinds = [['action', 'Next action'], ['waiting', 'Waiting for'], ['project', 'New project'], ['program', 'New program'], ['someday', 'Someday'], ['reference', 'Reference'], ['trash', 'Trash']];
  const low = p.conf < .75;
  return `<div class="vhead"><div><h1>Inbox</h1><p>Every ask from every surface lands here. AI proposes what each one is; you confirm in one keystroke. Low-confidence guesses are flagged.</p></div>
    <div class="shortcuts"><span><span class="kbd">j</span>/<span class="kbd">k</span> or <span class="kbd">↑</span>/<span class="kbd">↓</span> move</span><span><span class="kbd">a</span> accept</span><span><span class="kbd">⌘⏎</span> accept from anywhere</span><span><span class="kbd">Tab</span> list → kinds → fields</span><span><span class="kbd">w</span> waiting</span><span><span class="kbd">s</span> someday</span><span><span class="kbd">t</span> trash</span><span><span class="kbd">e</span> edit</span></div></div>
  <div class="inbox">
    <div class="panel ilist"><div class="ph"><h2>To clarify</h2><span class="note num">${inbox.length} items · ${inbox.filter(i => i.p.conf < .75).length} flagged</span></div>
      <div class="pb">${inbox.map(i => `<div class="row ${i.id === ui.sel ? 'sel' : ''}" data-sel="${i.id}" tabindex="${i.id === ui.sel ? 0 : -1}"><div class="conf ${i.p.conf < .75 ? 'low' : ''}" title="AI confidence ${Math.round(i.p.conf * 100)}%"><i style="width:${Math.round(i.p.conf * 100)}%"></i></div><div class="t"><div class="raw">${esc(i.raw)}</div><div class="m"><span class="chip src">${srcLabel[i.source]}${i.from ? ' · ' + esc(pname(i.from)) : ''}</span><span class="faint">${days(i.captured) === 0 ? 'today' : days(i.captured) + 'd ago'}</span><span class="chip">${kinds.find(k => k[0] === i.p.kind)?.[1] ?? i.p.kind}</span></div></div></div>`).join('')}</div>
    </div>
    <div class="panel detail">
      <div class="src"><div class="eyebrow">${srcLabel[it.source]}${it.from ? ' from ' + esc(person(it.from)?.name) : ''} · ${fmtDate(it.captured)}</div><div class="raw">${esc(it.raw)}</div></div>
      <div class="prop">
        <label>Is it actionable?</label><div class="kindgrid">
          ${[['Yes — who does what?', [['done', 'Do it now', 'Under 2 minutes — do it, mark done'], ['action', 'Next action', 'I do it'], ['waiting', 'Waiting for', 'Someone else does it'], ['project', 'New project', 'More than one step'], ['program', 'New program', 'A new area of responsibility']]], ['No — then what?', [['reference', 'Reference', 'Keep it, nothing to do'], ['someday', 'Someday / maybe', 'Not now; review later'], ['trash', 'Trash', 'Nothing to keep']]]].map(([h, ks]) => { const on = ks.some(k => k[0] === p.kind); return `<div class="kg" role="group" aria-label="${h}"><div class="kgh">${h}</div>${ks.map((k, i) => `<button data-kind="${k[0]}" class="${p.kind === k[0] ? 'on' : ''}" tabindex="${p.kind === k[0] || (!on && i === 0) ? 0 : -1}"><b>${k[1]}</b><span>${k[2]}</span></button>`).join('')}</div>`; }).join('')}
        </div>
        ${p.kind === 'program' ? `<label for="pProgName">Program</label><input id="pProgName" value="${esc(p.programName || '')}" placeholder="Short name">
        <label for="pPurpose">Purpose</label><input id="pPurpose" value="${esc(p.purpose || '')}" placeholder="Why it exists — one checkable sentence">
        <label for="pFirstProj">First project</label><input id="pFirstProj" value="${esc(p.firstProject || '')}" placeholder="Optional">` : ''}
        <label for="pNext">${p.kind === 'waiting' ? 'Waiting on' : p.kind === 'project' || p.kind === 'program' ? 'First action' : 'Next action'}</label><input id="pNext" value="${esc(p.next)}">
        ${p.ai && (p.kind === 'action' || p.kind === 'project') ? `<label>Who does it?</label><div class="aican"><div><span class="chip aichip">${levelLabel[p.ai.level]}</span> ${esc(p.ai.what)}</div><div class="faint">You choose below: <b>Accept</b> keeps it on your list; <b>Accept, hand to AI</b> files it and starts the assistant — you review before anything leaves.</div></div>` : ''}
        ${p.kind === 'waiting' ? `<label>From</label><select id="pOwner">${people.map(x => `<option value="${x.id}" ${x.id === p.owner ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
        ${p.kind === 'project' ? `<label for="pNewProj">New project</label><input id="pNewProj" value="${esc(p.newProject || projectNameFrom(p.next))}" placeholder="Short name">
        <label for="pProg">Under program</label><select id="pProg">${active().map(g => `<option value="${g.id}" ${g.id === (projOf(p.project)?.program || p.project) ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
        <label for="pOutcome">Outcome</label><input id="pOutcome" value="${esc(p.outcome || '')}" placeholder="What done looks like — one checkable sentence">` : p.kind === 'program' ? '' : `<label>Project</label><select id="pProj"><option value="">— none —</option>${active().map(g => `<optgroup label="${esc(g.name)}">${projects.filter(j => j.program === g.id).map(j => `<option value="${j.id}" ${j.id === p.project ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}<option value="${g.id}" ${g.id === p.project ? 'selected' : ''}>(program level)</option></optgroup>`).join('')}</select>`}
        ${p.kind === 'action' || p.kind === 'project' || p.kind === 'program' ? `<label for="pCtx">Context (optional)</label><select id="pCtx"><option value="">auto</option>${['@quick', '@deep', '@1:1/priya', '@1:1/leo', '@1:1/marcus', '@agenda/steering', '@errand'].map(c => `<option ${c === p.ctx ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label for="pMin">Estimate (min)</label><input id="pMin" type="number" value="${p.min ?? ''}" placeholder="e.g. 20">
        <label for="pDue">Due</label>${dateField('pDue', p.due ? iso(p.due) : '')}
        <label for="pHard" title="Hard landscape: only if it must happen on that day">On a specific day?</label>${dateField('pHard', p.hard ? iso(p.hard) : '')}
        ${p.kind === 'program' ? '' : `<label for="pRepeat">Repeats</label><select id="pRepeat">${REPEATS.map(([v, l]) => `<option value="${v}" ${v === (p.repeat || '') ? 'selected' : ''}>${l}</option>`).join('')}</select>`}` : ''}
        ${p.kind === 'reference' ? `<label>File under</label><select id="pRef">${active().map(g => `<option value="${g.id}" ${(p.refPage || it.refPage || p.project) === g.id ? 'selected' : ''}>${esc(g.name)} — key links</option>`).join('')}${people.map(x => `<option value="${x.id}" ${(p.refPage || it.refPage) === x.id ? 'selected' : ''}>${esc(x.name)} — person page</option>`).join('')}<option value="new">New reference page</option></select>` : ''}
        ${p.kind === 'reference' || p.kind === 'someday' ? `<label for="pRevisit" title="Tickler: it comes back to the inbox on this day">Revisit on</label>${dateField('pRevisit', it.revisit && it.wasKind ? '' : (p.revisit ? iso(p.revisit) : ''))}` : ''}
        ${p.kind === 'waiting' ? `<label for="pFollow">Follow up on</label>${dateField('pFollow', p.followUp ? iso(p.followUp) : iso(d(3)))}` : ''}
      </div>
      <div class="rationale"><div class="why ${low ? 'low' : ''}"><b>${low ? 'Flagged · ' : ''}${Math.round(p.conf * 100)}% confident.</b> ${esc(p.why)}</div></div>
      <div class="acts"><button class="btn primary" data-accept>Accept${p.ai && (p.kind === 'action' || p.kind === 'project') ? ' — I do it' : low ? ' as edited' : ''} <span class="kbd" style="margin-left:6px">a</span></button>${p.ai && (p.kind === 'action' || p.kind === 'project') ? `<button class="btn primary" style="background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent)" data-accept-ai>Accept, hand to AI <span class="kbd" style="margin-left:6px">d</span></button>` : ''}<button class="btn" data-draft>Draft reply</button><span class="sp"></span><button class="btn ghost" data-skip>Skip for now</button></div>
    </div>
  </div>
  ${trashPanel()}`;
}

export function trashPanel() {
  const tr = by('trash');
  if (!tr.length) return '';
  return `<div class="panel"><div class="ph"><h2>Trash</h2><span class="note">${tr.length} · Nothing is ever deleted — trash stays in the ledger. Restore any time.</span></div><div class="pb">${tr.map(x => `<div class="row"><div class="t"><div class="muted">${esc(x.raw || x.next)}</div><div class="m"><span class="chip src">${srcLabel[x.source] || 'Item'}</span><span class="faint">trashed ${x.trashedAt ? fmtDate(x.trashedAt) : 'earlier'}</span></div></div><button class="btn sm ghost" data-restore="${x.id}">Restore to inbox</button></div>`).join('')}</div></div>`;
}
