// Example data. Every date is relative to TODAY (see lib/dates.js).

import { TODAY } from '../lib/dates.js';
import { by, days, esc, projName, projOf, until } from '../model.js';
import { $ } from '../ui/fragments.js';
import { I } from '../ui/nav.js';

<script>
/* ---------- example data ---------- */
export const TODAY = new Date('2026-09-14T08:00:00');
export const d = (n) => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return x; };
export const iso = (x) => new Date(x).toISOString().slice(0, 10);

export const programs = [
  { id:'P1', name:'Billing platform migration', purpose:'Move all invoicing off the legacy system by end of Q1 with zero customer-visible billing errors.', sponsor:'ingrid', cadence:'Steering Thu · status Fri' },
  { id:'P2', name:'Fall launch readiness', purpose:'Ship the fall release on 21 Oct with support, comms and go/no-go criteria in place.', sponsor:'ingrid', cadence:'Readiness Mon · status Fri' },
  { id:'P3', name:'Vendor consolidation', purpose:'Reduce 14 tooling vendors to 6 by year end, saving ~$1.1M annually without a service gap.', sponsor:'ingrid', cadence:'Steering biweekly' },
];
export const projects = [
  { id:'J1', program:'P1', name:'Data migration dry run', outcome:'Full production data replayed into the new system with <0.1% variance', health:'good', suggest:'Confirm the dry-run date with infra and put it on the steering agenda' },
  { id:'J2', program:'P1', name:'Legacy invoice cutover plan', outcome:'Signed cutover runbook with rollback and a locked date', health:'warn', suggest:'Draft the two cutover options on one page so Ingrid can decide in steering' },
  { id:'J3', program:'P1', name:'Finance sign-off', outcome:'Controller signs reconciliation results and tolerance', health:'warn', suggest:'Walk Marcus through the reconciliation summary in Thursday\'s sync' },
  { id:'J4', program:'P2', name:'Launch comms', outcome:'Announcement, FAQ and internal brief published by 14 Oct', health:'good', suggest:'Agree the FAQ owner with Dana' },
  { id:'J5', program:'P2', name:'Support readiness', outcome:'Support trained, macros live, on-call staffed for launch week', health:'good', suggest:'Send Leo the macro list to review' },
  { id:'J6', program:'P2', name:'Go/no-go criteria', outcome:'Agreed, measurable criteria signed by Ingrid before 7 Oct', health:'warn', suggest:'Draft a strawman of go/no-go criteria and send to Ingrid for reaction' },
  { id:'J7', program:'P3', name:'Legal review of master agreements', outcome:'Redlined template approved so six contracts can be renegotiated', health:'crit', suggest:'Book a 30-minute working session with Sam on the redlines' },
  { id:'J8', program:'P3', name:'Vendor scorecard', outcome:'All 14 vendors scored on cost, risk and overlap; shortlist confirmed', health:'good', suggest:'Score the four remaining vendors with Tomas in one sitting' },
];
export const people = [
  { id:'priya', name:'Priya Natarajan', role:'Engineering lead, billing', lastTouched:d(-1), agenda:['Dry-run window: who owns the infra ask?', 'Variance report format for Marcus', 'Her ask: fewer status pings during dry run'] },
  { id:'marcus', name:'Marcus Bell', role:'Finance controller', lastTouched:d(-4), agenda:['Tolerance approval is 11 days old', 'Thursday close: what he needs from us'] },
  { id:'dana', name:'Dana Whitfield', role:'Product marketing', lastTouched:d(-1), agenda:['Announcement draft feedback', 'Launch date confirmation path'] },
  { id:'leo', name:'Leo Okafor', role:'Support manager', lastTouched:d(-3), agenda:['On-call headcount for launch week', 'Rebook training (2 Oct room clash)', 'Macro review owner'] },
  { id:'sam', name:'Sam Reyes', role:'Legal counsel', lastTouched:d(-9), agenda:['Redlines are the critical path for P3', 'Would a 30-min working session unblock?'] },
  { id:'ingrid', name:'Ingrid Halvorsen', role:'VP Operations, sponsor', lastTouched:d(-2), agenda:['Cutover date decision (1 Nov vs 15 Nov)', 'Board one-pager on vendor savings', 'Go/no-go owner for launch'] },
  { id:'tomas', name:'Tomas Vieira', role:'Vendor management', lastTouched:d(-2), agenda:['Scorecard data for the remaining 4', 'Updated pricing from two vendors'] },
];
export const items = [
  // inbox
  { id:'I1', kind:'inbox', source:'email', from:'marcus', captured:d(0), raw:'Can you get me the reconciliation variance numbers before Thursday\'s close? Board pack goes out Friday.', p:{ kind:'action', next:'Send reconciliation variance summary to Marcus', project:'J3', ctx:'@deep', min:45, due:d(2), conf:.91, why:'Direct ask with a deadline; matches the open Finance sign-off project.', ai:{ level:'draft', cap:'draft', what:'Draft the variance summary from the reconciliation export; you check the numbers.' } } },
  { id:'I2', kind:'inbox', source:'meeting', from:'priya', captured:d(-1), raw:'Billing sync: Priya said the dry run needs a 6-hour window; she\'ll check with infra and come back to us.', p:{ kind:'waiting', next:'Dry-run window confirmation from infra', owner:'priya', project:'J1', ctx:'@waiting', followUp:d(4), conf:.84, why:'Priya committed to an action; nothing for you to do until she reports back.' } },
  { id:'I3', kind:'inbox', source:'chat', from:'dana', captured:d(0), raw:'Announcement draft is in the shared folder — need your eyes by Tuesday.', p:{ kind:'action', next:'Review Dana\'s announcement draft and leave comments', project:'J4', ctx:'@quick', min:20, due:d(1), conf:.95, why:'Explicit review request with a date; Launch comms project.', ai:{ level:'assist', cap:'draft', what:'Pre-read the draft and list open questions before you look.' } } },
  { id:'I4', kind:'inbox', source:'voice', from:null, captured:d(-1), raw:'Idea — run a launch retro template across all three programs, not just P2.', p:{ kind:'someday', next:'Launch retro template across programs', project:null, ctx:'', conf:.62, why:'Phrased as an idea with no owner or date. Could be a project seed — please confirm.' } },
  { id:'I5', kind:'inbox', source:'email', from:'ingrid', captured:d(-1), raw:'FYI — the board wants a one-pager on vendor savings next month. Nothing needed yet.', p:{ kind:'project', next:'Draft outline of the vendor savings one-pager', project:'P3', ctx:'@deep', min:60, due:d(14), conf:.71, why:'"Nothing needed yet" but a multi-step outcome with a date is a project. Proposed as a new project under Vendor consolidation.', ai:{ level:'draft', cap:'draft', what:'Draft the one-pager outline from the vendor scorecard and savings model.' } } },
  { id:'I6', kind:'inbox', source:'calendar', from:'leo', captured:d(0), raw:'Comment on "Support training": room is double-booked on 2 Oct.', p:{ kind:'action', next:'Rebook support training room with Leo', project:'J5', ctx:'@1:1/leo', min:10, conf:.88, why:'Small logistics task; best raised in your 1:1 with Leo today.', ai:{ level:'do', cap:'calendar', what:'Find a free room on 2 Oct and propose the rebooking to Leo.' } } },
  { id:'I7', kind:'inbox', source:'chat', from:'tomas', captured:d(0), raw:'Two vendors sent updated pricing, attached.', p:{ kind:'reference', next:'File updated pricing against vendor scorecard', project:'J8', ctx:'@quick', min:15, conf:.58, why:'Could be reference only, or it could mean the scorecard needs updating. Low confidence — your call.', ai:{ level:'do', cap:'data', what:'Extract the pricing from the attachments and update the two scorecard rows.' } } },
  // next actions
  { id:'A1', kind:'action', next:'Confirm dry-run window with Priya', project:'J1', ctx:'@1:1/priya', min:10, createdAt:d(-2) },
  { id:'A2', kind:'action', next:'Send reconciliation summary to Marcus', project:'J3', ctx:'@deep', min:45, due:d(2), createdAt:d(-5), ai:{ level:'draft', cap:'draft', what:'Draft the summary from the reconciliation export; you check the numbers.' } },
  { id:'A3', kind:'action', next:'Review draft announcement from Dana', project:'J4', ctx:'@quick', min:20, due:d(1), createdAt:d(-1), ai:{ level:'assist', cap:'draft', what:'Pre-read the draft and list open questions.' } },
  { id:'A4', kind:'action', next:'Book support training slot with Leo', project:'J5', ctx:'@1:1/leo', min:10, createdAt:d(-3) },
  { id:'A5', kind:'action', next:'Fill in scorecard for remaining 4 vendors', project:'J8', ctx:'@deep', min:90, createdAt:d(-4), ai:{ level:'draft', cap:'data', what:'Fill the scorecard from the vendor submissions; you verify.' } },
  { id:'A6', kind:'action', next:'Prep steering deck for Ingrid', project:'P2', ctx:'@deep', min:60, due:d(3), createdAt:d(-2), ai:{ level:'draft', cap:'draft', what:'Outline the deck from program health, wins and decisions.' } },
  { id:'A7', kind:'action', next:'Reply to Tomas on scorecard weighting', project:'J8', ctx:'@quick', min:10, createdAt:d(-4), ai:{ level:'draft', cap:'draft', what:'Draft the reply from the agreed scorecard criteria.' } },
  { id:'A8', kind:'action', next:'Add cutover date options to steering agenda', project:'P1', ctx:'@agenda/steering', min:5, createdAt:d(-3) },
  // waiting for
  { id:'W1', kind:'waiting', next:'Redlines on the master agreement template', owner:'sam', project:'J7', since:d(-23), followUp:d(-3), nudges:2, lastNudged:d(-10) },
  { id:'W2', kind:'waiting', next:'Infra window for the 6-hour dry run', owner:'priya', project:'J1', since:d(-4), followUp:d(2), nudges:0 },
  { id:'W3', kind:'waiting', next:'Approval of reconciliation tolerance (0.1%)', owner:'marcus', project:'J3', since:d(-11), followUp:d(-1), nudges:1, lastNudged:d(-6) },
  { id:'W4', kind:'waiting', next:'Headcount for launch-week on-call', owner:'leo', project:'J5', since:d(-16), followUp:d(-2), nudges:1, lastNudged:d(-9) },
  { id:'W5', kind:'waiting', next:'Final launch date confirmation from PMM', owner:'dana', project:'J4', since:d(-2), followUp:d(3), nudges:0 },
  { id:'W6', kind:'waiting', next:'Scorecard data for the remaining 4 vendors', owner:'tomas', project:'J8', since:d(-8), followUp:d(0), nudges:0 },
  { id:'W7', kind:'waiting', next:'Decision on cutover date (1 Nov vs 15 Nov)', owner:'ingrid', project:'J2', since:d(-19), followUp:d(-5), nudges:2, lastNudged:d(-12) },
  // delegated to the assistant
  { id:'X1', kind:'action', owner:'ai', next:'Fold the two vendors\' updated pricing into the scorecard', project:'J8', cap:'data', del:{ status:'ready', at:d(0), readyAt:d(0), minutes:25, deliverable:'Vendor pricing changes\n\nNorthstar Tools — annual $84,000 → $79,500 (−5.4%), 3-year lock offered\nHelix Analytics — annual $61,200 → $66,000 (+7.8%), adds SSO tier\n\nScorecard impact: Northstar cost score 6 → 7; Helix 7 → 6. Shortlist unchanged.', effect:'Updates 2 rows in the vendor scorecard' } },
  { id:'X2', kind:'action', owner:'ai', next:'Find three 30-minute slots with Sam for a redlines working session', project:'J7', cap:'calendar', del:{ status:'ready', at:d(-1), readyAt:d(0), minutes:15, deliverable:'Both of you are free:\n• Tue 15 Sep, 14:00–14:30\n• Wed 16 Sep, 10:30–11:00\n• Thu 17 Sep, 15:00–15:30\n\nSuggested invite: "Master agreement redlines — working session", template attached, 30 min.', effect:'Sends 1 calendar invite to Sam Reyes' } },
  { id:'X3', kind:'action', owner:'ai', next:'Draft Friday status for Fall launch readiness', project:'P2', cap:'draft', del:{ status:'ready', at:d(-1), readyAt:d(0), minutes:40, deliverable:'Fall launch readiness — On track\n\nDone this week\n• Launch comms calendar published\n• Draft go/no-go criteria circulated for comment\n\nRisks / asks\n• Go/no-go criteria: no next action since 5 Sep — owner needed\n• Launch-week on-call headcount: waiting on Leo for 16 days', effect:'Nothing is sent — a draft for you to paste' } },
  { id:'X4', kind:'action', owner:'ai', next:'Compile the decisions log for Billing migration from meeting notes since 1 Aug', project:'P1', cap:'wiki', del:{ status:'working', at:d(0), minutes:60, progress:.6, effect:'Updates program-billing-migration-decisions.md (2 entries) and appends to log.md' } },
  { id:'X5', kind:'action', owner:'ai', next:'Pre-read Dana\'s announcement draft and list open questions', project:'J4', cap:'draft', del:{ status:'queued', at:d(0), minutes:20, effect:'Nothing is sent — questions appear here for review' } },
  // calendar — hard landscape: these must happen on the day, so they leave the context lists
  { id:'A9', kind:'action', next:'Present cutover date options at steering', project:'P1', ctx:'@meeting/steering', min:15, hard:d(3), createdAt:d(-3), energy:'high' },
  { id:'A10', kind:'action', next:'Sign off support macros with Leo before training', project:'J5', ctx:'@1:1/leo', min:20, hard:d(1), createdAt:d(-2) },
  { id:'A11', kind:'action', next:'Walk Ingrid through the go/no-go strawman after readiness', project:'P2', ctx:'@meeting/readiness', min:10, hard:d(0), createdAt:d(-1) },
  { id:'A12', kind:'action', next:'Send Q4 vendor exit notices (contract window opens)', project:'J8', ctx:'@deep', min:40, hard:d(8), createdAt:d(-5), energy:'high' },
  // someday / maybe — incubating; revisit dates are ticklers that resurface into the inbox
  { id:'S1', kind:'someday', next:'Launch retro template across programs', since:d(-30), revisit:d(30) },
  { id:'S2', kind:'someday', next:'Generate weekly status straight from the ledger', since:d(-52) },
  { id:'S3', kind:'someday', next:'Vendor risk heatmap for the board', since:d(-18), revisit:d(12) },
  // reference — filed into the wiki; a revisit date makes it a tickler
  { id:'R1', kind:'reference', next:'Northstar contract auto-renews 1 Oct — renewal terms and notice period', refPage:'P3', filedAt:d(-20), revisit:d(0) },
  { id:'R2', kind:'reference', next:'Auditor materiality memo (0.1% threshold)', refPage:'P1', filedAt:d(-11) },
  { id:'R3', kind:'reference', next:'Priya out 28 Sep – 2 Oct', refPage:'priya', filedAt:d(-4) },
  // trash — kept 30 days
  { id:'T1', kind:'trash', next:'Webinar invite: vendor management trends 2027', trashedAt:d(-2), raw:'Webinar invite: vendor management trends 2027', source:'email' },
  // done this week
  { id:'D1', kind:'done', next:'Migration dry-run plan approved', project:'J1', doneAt:d(-3) },
  { id:'D2', kind:'done', next:'Launch comms calendar published', project:'J4', doneAt:d(-2) },
  { id:'D3', kind:'done', next:'Scorecard criteria agreed with Tomas', project:'J8', doneAt:d(-4) },
  { id:'D4', kind:'done', next:'Draft go/no-go criteria circulated for comment', project:'J6', doneAt:d(-9) },
  { id:'D5', kind:'done', next:'Cutover risk register rebased', project:'P1', doneAt:d(-1) },
];
/* Program wiki — compiled knowledge (wiki/program-*.md). Ledger owns commitments; the wiki owns context. */
export const wiki = {
  P1: { page:'program-billing-migration', compiled:d(-3), health:'warn',
    status:'Dry-run plan approved and a 6-hour window is being confirmed with infra. Finance sign-off is pending Marcus\'s formal approval of the 0.1% reconciliation tolerance, 11 days waiting. The cutover date (1 Nov vs 15 Nov) has been with Ingrid for 19 days and now gates the runbook; without it the dry-run-to-cutover gap compresses.',
    links:[['Cutover runbook','https://docs.example.internal/billing/cutover-runbook'],['Reconciliation dashboard','https://metrics.example.internal/billing/reconciliation'],['Steering deck 4 Sep','https://drive.example.internal/billing/steering-2026-09-04'],['Legacy retirement plan','https://docs.example.internal/billing/legacy-retirement'],['#billing-migration','']],
    milestones:[['11 Sep','Dry-run plan approved','done'],['25 Sep','Production data dry run','pending window'],['2 Oct','Finance sign-off','at risk'],['1 or 15 Nov','Cutover','undecided'],['31 Mar','Legacy system retired','planned']],
    decisions:[{ on:'3 Sep', what:'Reconciliation tolerance set at 0.1%', who:'Marcus, Priya', why:'Matches the auditor\'s materiality threshold; tighter fails on known legacy rounding, looser won\'t satisfy Finance.', status:'agreed; formal sign-off pending (W3)', projects:['J1','J3'] },
                { on:'14 Aug', what:'Dry run before cutover is mandatory', who:'Ingrid', why:'The 2024 CRM migration skipped a full-data rehearsal and produced two weeks of customer-facing errors.', status:'decided', projects:['J1','J2'] }],
    pending:['Cutover date: 1 Nov vs 15 Nov — with Ingrid since 26 Aug (W7)'],
    risks:[{ what:'Cutover date undecided compresses the dry-run-to-cutover gap', level:'high', owner:'ingrid', projects:['J2'] },{ what:'Finance sign-off slips past Thursday close', level:'medium', owner:'marcus', projects:['J3'] },{ what:'Infra can\'t give a 6-hour window before 25 Sep', level:'medium', owner:'priya', projects:['J1'] }] },
  P2: { page:'program-fall-launch', compiled:d(-3), health:'good',
    status:'Comms calendar is published and the announcement draft is out for review. Support training is booked but the 2 Oct room is double-booked. Two things need attention: go/no-go criteria have had no next action since 5 Sep and need an owner, and launch-week on-call headcount has been with Leo for 16 days.',
    links:[['Launch plan','https://docs.example.internal/launch/fall-2026'],['Comms calendar','https://drive.example.internal/pmm/fall-launch-comms'],['Support readiness checklist','https://docs.example.internal/support/fall-launch'],['Release notes draft','https://docs.example.internal/launch/fall-2026-release-notes'],['#fall-launch','']],
    milestones:[['12 Sep','Comms calendar published','done'],['2 Oct','Support training','room clash'],['7 Oct','Go/no-go signed by Ingrid','at risk'],['14 Oct','Announcement, FAQ, brief published','on track'],['21 Oct','Launch','locked']],
    decisions:[{ on:'28 Aug', what:'Launch date locked: 21 Oct', who:'Ingrid', why:'Aligns with the customer conference on 22 Oct; later loses the keynote slot, earlier cuts support training short.', status:'decided', projects:['J4','J5','J6'] },
                { on:'20 Aug', what:'Single announcement, no phased rollout', who:'Dana, Leo', why:'The feature set is customer-visible on day one; phasing doubles comms and confuses support macros.', status:'decided', projects:['J4','J5'] }],
    pending:['Go/no-go criteria: who owns the definition? Draft circulated 5 Sep, no owner.'],
    risks:[{ what:'Launch-week on-call headcount unresolved', level:'high', owner:'leo', projects:['J5'] },{ what:'Go/no-go criteria undefined by 7 Oct', level:'medium', owner:null, projects:['J6'] },{ what:'Support training room clash 2 Oct', level:'low', owner:'leo', projects:['J5'] }] },
  P3: { page:'program-vendor-consolidation', compiled:d(-9), health:'crit',
    status:'Legal review of the master agreement template has been with Sam for 23 days and gates all six renegotiations; two nudges sent. The scorecard is progressing — criteria agreed with Tomas, 10 of 14 vendors scored, and two vendors sent revised pricing this week. The board wants a savings one-pager next month.',
    links:[['Vendor scorecard','https://sheets.example.internal/vendors/scorecard-2026'],['Master agreement template v3','https://docs.example.internal/legal/master-agreement-v3'],['Savings model','https://sheets.example.internal/vendors/savings-model'],['#vendor-consolidation','']],
    milestones:[['20 Aug','Shortlist reduced to 6','done'],['18 Sep','Master agreement approved','blocked'],['30 Sep','Scorecard complete 14/14','on track'],['Oct','Board one-pager','requested'],['31 Dec','6 signed, 8 exited','planned']],
    decisions:[{ on:'20 Aug', what:'Shortlist reduced to 6', who:'Ingrid, Tomas', why:'The 7th and 8th vendors duplicate capabilities already covered; the savings model needs 6 to hit $1.1M.', status:'decided', projects:['J8'] },
                { on:'30 Jul', what:'One master agreement template instead of six bespoke contracts', who:'Sam, Tomas', why:'Six parallel legal reviews would take until Q1; one template reviewed once is faster overall — but becomes the critical path.', status:'decided', projects:['J7'] }],
    pending:[],
    risks:[{ what:'Legal redlines block all six renegotiations', level:'high', owner:'sam', projects:['J7'] },{ what:'Two vendors raised pricing mid-negotiation', level:'low', owner:'tomas', projects:['J8'] },{ what:'Board one-pager due before savings are contracted', level:'medium', owner:null, projects:[] }] },

];
export const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const wikiStub = (g) => ({ page:'program-' + slug(g.name), compiled:null, health:'good', status:'Not compiled yet — the compile job runs Friday, or on the first health change.', links:[], milestones:[], decisions:[], pending:[], risks:[] });
export const active = () => programs.filter(g => !g.retired);
export const activeProjects = (gid) => projects.filter(j => j.program === gid && !j.dropped);
/* Program identity color: slot by program order, fixed for life; beyond 8 programs folds to gray. */
export const progIdx = (gid) => { const i = programs.findIndex(g => g.id === gid); return i < 0 || i > 7 ? 0 : i + 1; };
export const progOfAny = (pid) => programs.find(g => g.id === pid) ? pid : projOf(pid)?.program;
export const pcStyle = (pid) => `style="--pc:var(--c${progIdx(progOfAny(pid))})"`;
export const projChip = (pid, label) => pid ? `<span class="chip proj" ${pcStyle(pid)}>${esc(label ?? projName(pid))}</span>` : `<span class="chip">${esc(label ?? '—')}</span>`;
export const wikiOf = (pid) => wiki[pid] || wiki[projOf(pid)?.program] || null;
export const aiLog = [
  { at:d(-3), what:'Compiled status, commitments and history sections on 3 program wiki pages', cap:'wiki', mode:'auto' },
  { at:d(-1), what:'Filed 4 reference items', cap:'file', mode:'auto' },
  { at:d(-2), what:'Drafted 2 nudges — both approved and sent', cap:'draft', mode:'ask' },
  { at:d(-3), what:'Clarified 31 inbox items — 27 accepted unchanged', cap:'clarify', mode:'ask' },
  { at:d(-4), what:'Prepared 4 meeting briefs', cap:'draft', mode:'auto' },
];
export const capLabel = { file:'File reference items', draft:'Draft replies, nudges, summaries', data:'Update ledger data', wiki:'Update the wiki', send:'Send email, chat, messages', calendar:'Book time on calendars', delete:'Delete or archive', clarify:'Clarify inbox items' };
export const levelLabel = { do:'Can do it', draft:'Can draft it', assist:'Can prep it' };
export const autonomyLabel = { never:'Never', ask:'Always ask first', draft:'Draft, then ask', auto:'Do it, tell me weekly' };
export const pastMeetings = [
  { on:d(-7), title:'Billing sync', who:['priya','marcus'], captured:2 },
  { on:d(-6), title:'Vendor consolidation steering', who:['ingrid','tomas','sam'], captured:1 },
  { on:d(-5), title:'1:1 · Dana Whitfield', who:['dana'], captured:0 },
  { on:d(-4), title:'Steering committee', who:['ingrid'], captured:1 },
  { on:d(-3), title:'Launch readiness', who:['dana','leo','ingrid'], captured:0 },
  { on:d(-3), title:'Skip-level with Ingrid', who:['ingrid'], captured:0 },
];
export const calendarAhead = [
  { on:d(1), time:'09:00', title:'Billing sync', who:['priya','marcus'] },
  { on:d(3), time:'14:00', title:'Billing migration steering', who:['ingrid','priya','marcus'] },
  { on:d(4), time:'11:00', title:'Status review', who:['ingrid'] },
  { on:d(7), time:'13:00', title:'Launch readiness', who:['dana','leo','ingrid'] },
  { on:d(8), time:'10:00', title:'Vendor consolidation steering', who:['ingrid','tomas','sam'] },
  { on:d(10), time:'15:00', title:'Board prep with Ingrid', who:['ingrid'] },
];
export const sweepTriggers = ['Projects started, not finished', 'Promises to Ingrid, peers, reports', 'Emails or messages to send', 'Meetings to schedule', 'Things I\'m waiting on', 'Decisions pending', 'Risks I\'m carrying in my head', 'Personal admin'];
export const meetings = [
  { time:'09:00', dur:30, title:'Billing sync', who:['priya','marcus'], projects:['J1','J3'], decisions:['Reconciliation tolerance set at 0.1% (3 Sep)'] },
  { time:'10:30', dur:30, title:'1:1 · Leo Okafor', who:['leo'], projects:['J5'], decisions:[] },
  { time:'13:00', dur:45, title:'Launch readiness', who:['dana','leo','ingrid'], projects:['J4','J5','J6'], decisions:['Launch date 21 Oct locked (28 Aug)'] },
  { time:'15:30', dur:45, title:'Vendor consolidation steering', who:['ingrid','tomas','sam'], projects:['J7','J8'], decisions:['Vendor shortlist reduced to 6 (20 Aug)'] },
];
