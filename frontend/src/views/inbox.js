import { active, activeProjects, calendarAhead, d, iso, items, levelLabel, meetings, people, programs, projChip, projects } from '../data/example.js';
import { by, days, delegated, esc, fmtDate, person, pname, projName, srcLabel, until } from '../model.js';
import { state } from '../state.js';
import { actionRow } from '../ui/fragments.js';
import { I } from '../ui/nav.js';
import { ui } from '../ui/session.js';
import { waitingRow } from './now.js';
import { trashPanel } from './programs.js';

    ${state.collapsed.strip ? '' : `<div class="cal week">${days7.map((day, i) => { const ms = i === 0 ? meetings.map(m => ({ time:m.time, title:m.title })) : calendarAhead.filter(c => until(c.on) === i); const hs = all.filter(a => a.hard && until(a.hard) === i); const ts = items.filter(x => (x.kind === 'someday' || x.kind === 'reference') && x.revisit && until(x.revisit) === i); const dow = day.getDay(), wk = dow === 0 || dow === 6;
      return `<div class="cal-col ${i === 0 ? 'today' : ''} ${wk ? 'wk' : ''}"><div class="cal-h"><b>${i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday:'short' })}</b><span>${day.getDate()}</span></div>${ms.map((m, k) => i === 0 ? `<button class="cal-item mtg" data-prep="${k}" title="Prep brief">${m.time}<span>${esc(m.title)}</span></button>` : `<div class="cal-item mtg">${m.time}<span>${esc(m.title)}</span></div>`).join('')}${hs.map(a => `<button class="cal-item hard" data-proj="${a.project}" title="${esc(a.next)}">${esc(a.next)}<span>${esc(projName(a.project))}</span></button>`).join('')}${ts.map(t => `<div class="cal-item tick" title="Tickler: ${esc(t.next)}">↺ ${esc(t.next)}<span>resurfaces</span></div>`).join('')}</div>`; }).join('')}</div>`}</div>`; })()}

    <div class="panel"><div class="ph"><h2>Next actions by ${byProg ? 'program' : 'context'}</h2><span class="seg" style="margin-left:6px"><button data-group="context" class="${byProg ? '' : 'on'}">by context</button><button data-group="program" class="${byProg ? 'on' : ''}">by program</button></span><span class="sp" style="flex:1"></span><span class="note num">${actions.length} shown · ${delegated().length} with AI</span></div>
      <div class="filters"><span class="faint">I have</span><span class="seg">${[[0, 'any time'], [15, '≤ 15 min'], [30, '≤ 30 min'], [60, '60+ min']].map(f => `<button data-ftime="${f[0]}" class="${ui.nowTime === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">energy</span><span class="seg">${[['', 'any'], ['low', 'low'], ['high', 'high']].map(f => `<button data-fenergy="${f[0]}" class="${ui.nowEnergy === f[0] ? 'on' : ''}">${f[1]}</button>`).join('')}</span><span class="faint">scope</span><select class="in" style="width:auto;padding:3px 8px;font-size:12px" data-fscope aria-label="Program or project"><option value="">all programs</option>${active().map(g => `<optgroup label="${esc(g.name)}"><option value="${g.id}" ${ui.nowScope === g.id ? 'selected' : ''}>${esc(g.name)} — whole program</option>${activeProjects(g.id).map(j => `<option value="${j.id}" ${ui.nowScope === j.id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</optgroup>`).join('')}</select>${ui.nowScope || ui.nowTime || ui.nowEnergy ? `<button class="btn sm ghost" data-fclear>Clear</button>` : ''}</div>
      <div class="pb">${hardToday.length ? `<div class="ctxgroup"><span class="chip" style="color:var(--warn);background:var(--warn-soft)">pinned to today</span><span class="n">${hardToday.length}</span><span class="faint" style="font-size:11px">· must happen today — shown here, not in a context list</span></div>${hardToday.map(actionRow).join('')}` : ''}${keys.map(k => `<div class="ctxgroup">${byProg ? `${k === '—' ? '<span class="chip">No project</span>' : projChip(k)}` : `<span class="chip ctx">${esc(k)}</span>`}<span class="n">${groups[k].length}</span></div>${groups[k].map(actionRow).join('')}`).join('')}</div>
    </div>
  ${over.length ? `<div class="panel"><div class="ph"><h2>Past follow-up</h2><a href="#waiting" class="note">Full ledger →</a></div><div class="pb">${over.map(w => waitingRow(w, { showOwner:true })).join('')}</div></div>` : ''}`;
}

export let ui.sel = null, ui.delegateOnAccept = false, ui.nowTime = 0, ui.nowEnergy = '', ui.nowScope = '';
export function viewInbox() {
  const inbox = by('inbox');
  if (!inbox.length) return `<div class="vhead"><div><h1>Inbox</h1><p>Every ask from every surface lands here. AI proposes what each one is; you confirm in one keystroke.</p></div></div><div class="panel"><div class="empty"><b>Inbox zero</b>Nothing waiting to be clarified. Capture something above or reset the demo from Flow.</div></div>${trashPanel()}`;
  if (!inbox.find(i => i.id === ui.sel)) ui.sel = inbox[0].id;
  const it = inbox.find(i => i.id === ui.sel), p = it.p;
  const kinds = [['action', 'Next action'], ['waiting', 'Waiting for'], ['project', 'New project'], ['program', 'New program'], ['someday', 'Someday'], ['reference', 'Reference'], ['trash', 'Trash']];
  const low = p.conf < .75;
  return `<div class="vhead"><div><h1>Inbox</h1><p>Every ask from every surface lands here. AI proposes what each one is; you confirm in one keystroke. Low-confidence guesses are flagged.</p></div>
    <div class="shortcuts"><span><span class="kbd">j</span>/<span class="kbd">k</span> move</span><span><span class="kbd">a</span> accept</span><span><span class="kbd">w</span> waiting</span><span><span class="kbd">s</span> someday</span><span><span class="kbd">t</span> trash</span><span><span class="kbd">e</span> edit</span></div></div>
  <div class="inbox">
    <div class="panel ilist"><div class="ph"><h2>To clarify</h2><span class="note num">${inbox.length} items · ${inbox.filter(i => i.p.conf < .75).length} flagged</span></div>
      <div class="pb">${inbox.map(i => `<div class="row ${i.id === ui.sel ? 'sel' : ''}" data-sel="${i.id}"><div class="conf ${i.p.conf < .75 ? 'low' : ''}" title="AI confidence ${Math.round(i.p.conf * 100)}%"><i style="width:${Math.round(i.p.conf * 100)}%"></i></div><div class="t"><div class="raw">${esc(i.raw)}</div><div class="m"><span class="chip src">${srcLabel[i.source]}${i.from ? ' · ' + esc(pname(i.from)) : ''}</span><span class="faint">${days(i.captured) === 0 ? 'today' : days(i.captured) + 'd ago'}</span><span class="chip">${kinds.find(k => k[0] === i.p.kind)?.[1] ?? i.p.kind}</span></div></div></div>`).join('')}</div>
    </div>
    <div class="panel detail">
      <div class="src"><div class="eyebrow">${srcLabel[it.source]}${it.from ? ' from ' + esc(person(it.from)?.name) : ''} · ${fmtDate(it.captured)}</div><div class="raw">${esc(it.raw)}</div></div>
      <div class="prop">
        <label>Is it actionable?</label><div class="kindgrid">
          <div class="kg"><div class="kgh">Yes — who does what?</div>${[['done', 'Do it now', 'Under 2 minutes — do it, mark done'], ['action', 'Next action', 'I do it'], ['waiting', 'Waiting for', 'Someone else does it'], ['project', 'New project', 'More than one step'], ['program', 'New program', 'A new area of responsibility']].map(k => `<button data-kind="${k[0]}" class="${p.kind === k[0] ? 'on' : ''}"><b>${k[1]}</b><span>${k[2]}</span></button>`).join('')}</div>
          <div class="kg"><div class="kgh">No — then what?</div>${[['reference', 'Reference', 'Keep it, nothing to do'], ['someday', 'Someday / maybe', 'Not now; review later'], ['trash', 'Trash', 'Nothing to keep']].map(k => `<button data-kind="${k[0]}" class="${p.kind === k[0] ? 'on' : ''}"><b>${k[1]}</b><span>${k[2]}</span></button>`).join('')}</div>
        </div>
        ${p.kind === 'program' ? `<label for="pProgName">Program</label><input id="pProgName" value="${esc(p.programName || '')}" placeholder="Short name">
        <label for="pPurpose">Purpose</label><input id="pPurpose" value="${esc(p.purpose || '')}" placeholder="Why it exists — one checkable sentence">
        <label for="pFirstProj">First project</label><input id="pFirstProj" value="${esc(p.firstProject || '')}" placeholder="Optional">` : ''}
        <label for="pNext">${p.kind === 'waiting' ? 'Waiting on' : p.kind === 'project' || p.kind === 'program' ? 'First action' : 'Next action'}</label><input id="pNext" value="${esc(p.next)}">
        ${p.ai && (p.kind === 'action' || p.kind === 'project') ? `<label>Who does it?</label><div class="aican"><div><span class="chip aichip">${levelLabel[p.ai.level]}</span> ${esc(p.ai.what)}</div><div class="faint">You choose below: <b>Accept</b> keeps it on your list; <b>Accept, hand to AI</b> files it and starts the assistant — you review before anything leaves.</div></div>` : ''}
        ${p.kind === 'waiting' ? `<label>From</label><select id="pOwner">${people.map(x => `<option value="${x.id}" ${x.id === p.owner ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
        ${p.kind === 'program' ? '' : `<label>Project</label><select id="pProj"><option value="">— none —</option>${active().map(g => `<optgroup label="${esc(g.name)}">${projects.filter(j => j.program === g.id).map(j => `<option value="${j.id}" ${j.id === p.project ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}<option value="${g.id}" ${g.id === p.project ? 'selected' : ''}>(program level)</option></optgroup>`).join('')}</select>`}
        ${p.kind === 'action' || p.kind === 'project' || p.kind === 'program' ? `<label>Context</label><select id="pCtx">${['@quick', '@deep', '@1:1/priya', '@1:1/leo', '@1:1/marcus', '@agenda/steering', '@errand'].map(c => `<option ${c === p.ctx ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label>Estimate</label><input id="pMin" type="number" value="${p.min ?? ''}" placeholder="minutes">
        <label>Due</label><input id="pDue" type="date" value="${p.due ? iso(p.due) : ''}">
        <label title="Hard landscape: only if it must happen on that day">On a specific day?</label><input id="pHard" type="date" value="${p.hard ? iso(p.hard) : ''}">` : ''}
        ${p.kind === 'reference' ? `<label>File under</label><select id="pRef">${active().map(g => `<option value="${g.id}" ${(p.refPage || it.refPage || p.project) === g.id ? 'selected' : ''}>${esc(g.name)} — key links</option>`).join('')}${people.map(x => `<option value="${x.id}" ${(p.refPage || it.refPage) === x.id ? 'selected' : ''}>${esc(x.name)} — person page</option>`).join('')}<option value="new">New reference page</option></select>` : ''}
        ${p.kind === 'reference' || p.kind === 'someday' ? `<label title="Tickler: it comes back to the inbox on this day">Revisit on</label><input id="pRevisit" type="date" value="${it.revisit && it.wasKind ? '' : (p.revisit ? iso(p.revisit) : '')}" placeholder="optional">` : ''}
        ${p.kind === 'waiting' ? `<label>Follow up on</label><input id="pFollow" type="date" value="${p.followUp ? iso(p.followUp) : iso(d(3))}">` : ''}
      </div>
      <div class="rationale"><div class="why ${low ? 'low' : ''}"><b>${low ? 'Flagged · ' : ''}${Math.round(p.conf * 100)}% confident.</b> ${esc(p.why)}</div></div>
