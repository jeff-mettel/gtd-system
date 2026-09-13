// The demo fixture: the example ledger (three programs, eight projects, seven people, the named items every view
// shows, eight weeks of background volume) expressed as a v1 event stream. `fold(demoEvents())` is the state the
// published prototype opens with. Deterministic — same events every call; dates are relative to DEMO_TODAY.

export const DEMO_TODAY = new Date('2026-09-14T08:00:00');
const DAY = 864e5, H = 36e5;
const d = (n) => new Date(DEMO_TODAY.getTime() + n * DAY);
const iso = (x) => new Date(x).toISOString();
const isoDay = (x) => { const t = new Date(x); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const at = (dayOff, hour = 9) => DEMO_TODAY.getTime() + dayOff * DAY + (hour - 8) * H;

/* ---------- the example data (was frontend/src/data/example.js) ---------- */
const programs = [
  { id: 'P1', name: 'Billing platform migration', page: 'program-billing-migration', purpose: 'Move all invoicing off the legacy system by end of Q1 with zero customer-visible billing errors.', sponsor: 'ingrid', cadence: 'Steering Thu · status Fri' },
  { id: 'P2', name: 'Fall launch readiness', page: 'program-fall-launch', purpose: 'Ship the fall release on 21 Oct with support, comms and go/no-go criteria in place.', sponsor: 'ingrid', cadence: 'Readiness Mon · status Fri' },
  { id: 'P3', name: 'Vendor consolidation', page: 'program-vendor-consolidation', created: d(-49), purpose: 'Reduce 14 tooling vendors to 6 by year end, saving ~$1.1M annually without a service gap.', sponsor: 'ingrid', cadence: 'Steering biweekly' },
];

const projects = [
  { id: 'J1', program: 'P1', name: 'Data migration dry run', outcome: 'Full production data replayed into the new system with <0.1% variance', health: 'good', suggest: 'Confirm the dry-run date with infra and put it on the steering agenda' },
  { id: 'J2', program: 'P1', name: 'Legacy invoice cutover plan', outcome: 'Signed cutover runbook with rollback and a locked date', health: 'warn', suggest: 'Draft the two cutover options on one page so Ingrid can decide in steering' },
  { id: 'J3', program: 'P1', name: 'Finance sign-off', outcome: 'Controller signs reconciliation results and tolerance', health: 'warn', suggest: 'Walk Marcus through the reconciliation summary in Thursday\'s sync' },
  { id: 'J4', program: 'P2', name: 'Launch comms', outcome: 'Announcement, FAQ and internal brief published by 14 Oct', health: 'good', suggest: 'Agree the FAQ owner with Dana' },
  { id: 'J5', program: 'P2', name: 'Support readiness', outcome: 'Support trained, macros live, on-call staffed for launch week', health: 'good', suggest: 'Send Leo the macro list to review' },
  { id: 'J6', program: 'P2', name: 'Go/no-go criteria', outcome: 'Agreed, measurable criteria signed by Ingrid before 7 Oct', health: 'warn', suggest: 'Draft a strawman of go/no-go criteria and send to Ingrid for reaction' },
  { id: 'J7', program: 'P3', created: d(-49), name: 'Legal review of master agreements', outcome: 'Redlined template approved so six contracts can be renegotiated', health: 'crit', suggest: 'Book a 30-minute working session with Sam on the redlines' },
  { id: 'J8', program: 'P3', created: d(-35), name: 'Vendor scorecard', outcome: 'All 14 vendors scored on cost, risk and overlap; shortlist confirmed', health: 'good', suggest: 'Score the four remaining vendors with Tomas in one sitting' },
];

const people = [
  { id: 'priya', name: 'Priya Natarajan', role: 'Engineering lead, billing', lastTouched: d(-1), agenda: ['Dry-run window: who owns the infra ask?', 'Variance report format for Marcus', 'Her ask: fewer status pings during dry run'] },
  { id: 'marcus', name: 'Marcus Bell', role: 'Finance controller', lastTouched: d(-4), agenda: ['Tolerance approval is 11 days old', 'Thursday close: what he needs from us'] },
  { id: 'dana', name: 'Dana Whitfield', role: 'Product marketing', lastTouched: d(-1), agenda: ['Announcement draft feedback', 'Launch date confirmation path'] },
  { id: 'leo', name: 'Leo Okafor', role: 'Support manager', lastTouched: d(-3), agenda: ['On-call headcount for launch week', 'Rebook training (2 Oct room clash)', 'Macro review owner'] },
  { id: 'sam', name: 'Sam Reyes', role: 'Legal counsel', lastTouched: d(-9), agenda: ['Redlines are the critical path for P3', 'Would a 30-min working session unblock?'] },
  { id: 'ingrid', name: 'Ingrid Halvorsen', role: 'VP Operations, sponsor', lastTouched: d(-2), agenda: ['Cutover date decision (1 Nov vs 15 Nov)', 'Board one-pager on vendor savings', 'Go/no-go owner for launch'] },
  { id: 'tomas', name: 'Tomas Vieira', role: 'Vendor management', lastTouched: d(-2), agenda: ['Scorecard data for the remaining 4', 'Updated pricing from two vendors'] },
];

const items = [
  // inbox
  { id: 'I1', kind: 'inbox', source: 'email', from: 'marcus', captured: d(0), raw: 'Can you get me the reconciliation variance numbers before Thursday\'s close? Board pack goes out Friday.', p: { kind: 'action', next: 'Send reconciliation variance summary to Marcus', project: 'J3', ctx: '@deep', min: 45, due: d(2), conf: .91, why: 'Direct ask with a deadline; matches the open Finance sign-off project.', ai: { level: 'draft', cap: 'draft', what: 'Draft the variance summary from the reconciliation export; you check the numbers.' } } },
  { id: 'I2', kind: 'inbox', source: 'meeting', from: 'priya', captured: d(-1), raw: 'Billing sync: Priya said the dry run needs a 6-hour window; she\'ll check with infra and come back to us.', p: { kind: 'waiting', next: 'Dry-run window confirmation from infra', owner: 'priya', project: 'J1', ctx: '@waiting', followUp: d(4), conf: .84, why: 'Priya committed to an action; nothing for you to do until she reports back.' } },
  { id: 'I3', kind: 'inbox', source: 'chat', from: 'dana', captured: d(0), raw: 'Announcement draft is in the shared folder — need your eyes by Tuesday.', p: { kind: 'action', next: 'Review Dana\'s announcement draft and leave comments', project: 'J4', ctx: '@quick', min: 20, due: d(1), conf: .95, why: 'Explicit review request with a date; Launch comms project.', ai: { level: 'assist', cap: 'draft', what: 'Pre-read the draft and list open questions before you look.' } } },
  { id: 'I4', kind: 'inbox', source: 'voice', from: null, captured: d(-1), raw: 'Idea — run a launch retro template across all three programs, not just P2.', p: { kind: 'someday', next: 'Launch retro template across programs', project: null, ctx: '', conf: .62, why: 'Phrased as an idea with no owner or date. Could be a project seed — please confirm.' } },
  { id: 'I5', kind: 'inbox', source: 'email', from: 'ingrid', captured: d(-1), raw: 'FYI — the board wants a one-pager on vendor savings next month. Nothing needed yet.', p: { kind: 'project', next: 'Draft outline of the vendor savings one-pager', project: 'P3', ctx: '@deep', min: 60, due: d(14), conf: .71, why: '"Nothing needed yet" but a multi-step outcome with a date is a project. Proposed as a new project under Vendor consolidation.', ai: { level: 'draft', cap: 'draft', what: 'Draft the one-pager outline from the vendor scorecard and savings model.' } } },
  { id: 'I6', kind: 'inbox', source: 'calendar', from: 'leo', captured: d(0), raw: 'Comment on "Support training": room is double-booked on 2 Oct.', p: { kind: 'action', next: 'Rebook support training room with Leo', project: 'J5', ctx: '@1:1/leo', min: 10, conf: .88, why: 'Small logistics task; best raised in your 1:1 with Leo today.', ai: { level: 'do', cap: 'calendar', what: 'Find a free room on 2 Oct and propose the rebooking to Leo.' } } },
  { id: 'I7', kind: 'inbox', source: 'chat', from: 'tomas', captured: d(0), raw: 'Two vendors sent updated pricing, attached.', p: { kind: 'reference', next: 'File updated pricing against vendor scorecard', project: 'J8', ctx: '@quick', min: 15, conf: .58, why: 'Could be reference only, or it could mean the scorecard needs updating. Low confidence — your call.', ai: { level: 'do', cap: 'data', what: 'Extract the pricing from the attachments and update the two scorecard rows.' } } },
  // next actions
  { id: 'A1', kind: 'action', next: 'Confirm dry-run window with Priya', project: 'J1', ctx: '@1:1/priya', min: 10, createdAt: d(-2) },
  { id: 'A2', kind: 'action', next: 'Send reconciliation summary to Marcus', project: 'J3', ctx: '@deep', min: 45, due: d(2), createdAt: d(-5), ai: { level: 'draft', cap: 'draft', what: 'Draft the summary from the reconciliation export; you check the numbers.' } },
  { id: 'A3', kind: 'action', next: 'Review draft announcement from Dana', project: 'J4', ctx: '@quick', min: 20, due: d(1), createdAt: d(-1), ai: { level: 'assist', cap: 'draft', what: 'Pre-read the draft and list open questions.' } },
  { id: 'A4', kind: 'action', next: 'Book support training slot with Leo', project: 'J5', ctx: '@1:1/leo', min: 10, createdAt: d(-3) },
  { id: 'A5', kind: 'action', next: 'Fill in scorecard for remaining 4 vendors', project: 'J8', ctx: '@deep', min: 90, createdAt: d(-4), ai: { level: 'draft', cap: 'data', what: 'Fill the scorecard from the vendor submissions; you verify.' } },
  { id: 'A6', kind: 'action', next: 'Prep steering deck for Ingrid', project: 'P2', ctx: '@deep', min: 60, due: d(3), createdAt: d(-2), ai: { level: 'draft', cap: 'draft', what: 'Outline the deck from program health, wins and decisions.' } },
  { id: 'A7', kind: 'action', next: 'Reply to Tomas on scorecard weighting', project: 'J8', ctx: '@quick', min: 10, createdAt: d(-4), ai: { level: 'draft', cap: 'draft', what: 'Draft the reply from the agreed scorecard criteria.' } },
  { id: 'A8', kind: 'action', next: 'Add cutover date options to steering agenda', project: 'P1', ctx: '@agenda/steering', min: 5, createdAt: d(-3) },
  // waiting for
  { id: 'W1', kind: 'waiting', next: 'Redlines on the master agreement template', owner: 'sam', project: 'J7', since: d(-23), followUp: d(-3), nudges: 2, lastNudged: d(-10) },
  { id: 'W2', kind: 'waiting', next: 'Infra window for the 6-hour dry run', owner: 'priya', project: 'J1', since: d(-4), followUp: d(2), nudges: 0 },
  { id: 'W3', kind: 'waiting', next: 'Approval of reconciliation tolerance (0.1%)', owner: 'marcus', project: 'J3', since: d(-11), followUp: d(-1), nudges: 1, lastNudged: d(-6) },
  { id: 'W4', kind: 'waiting', next: 'Headcount for launch-week on-call', owner: 'leo', project: 'J5', since: d(-16), followUp: d(-2), nudges: 1, lastNudged: d(-9) },
  { id: 'W5', kind: 'waiting', next: 'Final launch date confirmation from PMM', owner: 'dana', project: 'J4', since: d(-2), followUp: d(3), nudges: 0 },
  { id: 'W6', kind: 'waiting', next: 'Scorecard data for the remaining 4 vendors', owner: 'tomas', project: 'J8', since: d(-8), followUp: d(0), nudges: 0 },
  { id: 'W7', kind: 'waiting', next: 'Decision on cutover date (1 Nov vs 15 Nov)', owner: 'ingrid', project: 'J2', since: d(-19), followUp: d(-5), nudges: 2, lastNudged: d(-12) },
  // delegated to the assistant
  { id: 'X1', kind: 'action', owner: 'ai', next: 'Fold the two vendors\' updated pricing into the scorecard', project: 'J8', cap: 'data', del: { status: 'ready', at: d(0), readyAt: d(0), minutes: 25, deliverable: 'Vendor pricing changes\n\nNorthstar Tools — annual $84,000 → $79,500 (−5.4%), 3-year lock offered\nHelix Analytics — annual $61,200 → $66,000 (+7.8%), adds SSO tier\n\nScorecard impact: Northstar cost score 6 → 7; Helix 7 → 6. Shortlist unchanged.', effect: 'Updates 2 rows in the vendor scorecard' } },
  { id: 'X2', kind: 'action', owner: 'ai', next: 'Find three 30-minute slots with Sam for a redlines working session', project: 'J7', cap: 'calendar', del: { status: 'ready', at: d(-1), readyAt: d(0), minutes: 15, deliverable: 'Both of you are free:\n• Tue 15 Sep, 14:00–14:30\n• Wed 16 Sep, 10:30–11:00\n• Thu 17 Sep, 15:00–15:30\n\nSuggested invite: "Master agreement redlines — working session", template attached, 30 min.', effect: 'Sends 1 calendar invite to Sam Reyes' } },
  { id: 'X3', kind: 'action', owner: 'ai', next: 'Draft Friday status for Fall launch readiness', project: 'P2', cap: 'draft', del: { status: 'ready', at: d(-1), readyAt: d(0), minutes: 40, deliverable: 'Fall launch readiness — On track\n\nDone this week\n• Launch comms calendar published\n• Draft go/no-go criteria circulated for comment\n\nRisks / asks\n• Go/no-go criteria: no next action since 5 Sep — owner needed\n• Launch-week on-call headcount: waiting on Leo for 16 days', effect: 'Nothing is sent — a draft for you to paste' } },
  { id: 'X4', kind: 'action', owner: 'ai', next: 'Compile the decisions log for Billing migration from meeting notes since 1 Aug', project: 'P1', cap: 'wiki', del: { status: 'working', at: d(0), minutes: 60, progress: .6, effect: 'Updates program-billing-migration-decisions.md (2 entries) and appends to log.md' } },
  { id: 'X5', kind: 'action', owner: 'ai', next: 'Pre-read Dana\'s announcement draft and list open questions', project: 'J4', cap: 'draft', del: { status: 'queued', at: d(0), minutes: 20, effect: 'Nothing is sent — questions appear here for review' } },
  // calendar — hard landscape
  { id: 'A9', kind: 'action', next: 'Present cutover date options at steering', project: 'P1', ctx: '@meeting/steering', min: 15, hard: d(3), createdAt: d(-3), energy: 'high' },
  { id: 'A10', kind: 'action', next: 'Sign off support macros with Leo before training', project: 'J5', ctx: '@1:1/leo', min: 20, hard: d(1), createdAt: d(-2) },
  { id: 'A11', kind: 'action', next: 'Walk Ingrid through the go/no-go strawman after readiness', project: 'P2', ctx: '@meeting/readiness', min: 10, hard: d(0), createdAt: d(-1) },
  { id: 'A12', kind: 'action', next: 'Send Q4 vendor exit notices (contract window opens)', project: 'J8', ctx: '@deep', min: 40, hard: d(8), createdAt: d(-5), energy: 'high' },
  // repeating
  { id: 'A13', kind: 'action', next: 'Send Friday status to Ingrid', project: 'P2', ctx: '@deep', min: 30, hard: d(4), repeat: 'weekly', createdAt: d(-10), energy: 'high' },
  // deferred
  { id: 'A14', kind: 'action', next: 'Draft the Q1 legacy-retirement comms', project: 'J2', ctx: '@deep', min: 45, start: d(5), createdAt: d(-1) },
  // someday / maybe
  { id: 'S1', kind: 'someday', next: 'Launch retro template across programs', since: d(-30), revisit: d(30) },
  { id: 'S2', kind: 'someday', next: 'Generate weekly status straight from the ledger', since: d(-52) },
  { id: 'S3', kind: 'someday', next: 'Vendor risk heatmap for the board', since: d(-18), revisit: d(12) },
  // reference
  { id: 'R1', kind: 'reference', next: 'Northstar contract auto-renews 1 Oct — renewal terms and notice period', refPage: 'P3', filedAt: d(-20), revisit: d(0) },
  { id: 'R2', kind: 'reference', next: 'Auditor materiality memo (0.1% threshold)', refPage: 'P1', filedAt: d(-11) },
  { id: 'R3', kind: 'reference', next: 'Priya out 28 Sep – 2 Oct', refPage: 'priya', filedAt: d(-4) },
  // trash
  { id: 'T1', kind: 'trash', next: 'Webinar invite: vendor management trends 2027', trashedAt: d(-2), raw: 'Webinar invite: vendor management trends 2027', source: 'email' },
  // done this week
  { id: 'D1', kind: 'done', next: 'Migration dry-run plan approved', project: 'J1', doneAt: d(-3) },
  { id: 'D2', kind: 'done', next: 'Launch comms calendar published', project: 'J4', doneAt: d(-2) },
  { id: 'D3', kind: 'done', next: 'Scorecard criteria agreed with Tomas', project: 'J8', doneAt: d(-4) },
  { id: 'D4', kind: 'done', next: 'Draft go/no-go criteria circulated for comment', project: 'J6', doneAt: d(-9) },
  { id: 'D5', kind: 'done', next: 'Cutover risk register rebased', project: 'P1', doneAt: d(-1) },
];

const wiki = {
  P1: { compiled: d(-3), health: 'warn',
    status: 'Dry-run plan approved and a 6-hour window is being confirmed with infra. Finance sign-off is pending Marcus\'s formal approval of the 0.1% reconciliation tolerance, 11 days waiting. The cutover date (1 Nov vs 15 Nov) has been with Ingrid for 19 days and now gates the runbook; without it the dry-run-to-cutover gap compresses.',
    links: [['Cutover runbook', 'https://docs.example.internal/billing/cutover-runbook'], ['Reconciliation dashboard', 'https://metrics.example.internal/billing/reconciliation'], ['Steering deck 4 Sep', 'https://drive.example.internal/billing/steering-2026-09-04'], ['Legacy retirement plan', 'https://docs.example.internal/billing/legacy-retirement'], ['#billing-migration', '']],
    milestones: [['11 Sep', 'Dry-run plan approved', 'done'], ['25 Sep', 'Production data dry run', 'pending window'], ['2 Oct', 'Finance sign-off', 'at risk'], ['1 or 15 Nov', 'Cutover', 'undecided'], ['31 Mar', 'Legacy system retired', 'planned']],
    decisions: [{ on: '3 Sep', what: 'Reconciliation tolerance set at 0.1%', who: 'Marcus, Priya', why: 'Matches the auditor\'s materiality threshold; tighter fails on known legacy rounding, looser won\'t satisfy Finance.', status: 'agreed; formal sign-off pending (W3)', projects: ['J1', 'J3'] },
      { on: '14 Aug', what: 'Dry run before cutover is mandatory', who: 'Ingrid', why: 'The 2024 CRM migration skipped a full-data rehearsal and produced two weeks of customer-facing errors.', status: 'decided', projects: ['J1', 'J2'] }],
    pending: ['Cutover date: 1 Nov vs 15 Nov — with Ingrid since 26 Aug (W7)'],
    risks: [{ what: 'Cutover date undecided compresses the dry-run-to-cutover gap', level: 'high', owner: 'ingrid', projects: ['J2'] }, { what: 'Finance sign-off slips past Thursday close', level: 'medium', owner: 'marcus', projects: ['J3'] }, { what: 'Infra can\'t give a 6-hour window before 25 Sep', level: 'medium', owner: 'priya', projects: ['J1'] }] },
  P2: { compiled: d(-3), health: 'good',
    status: 'Comms calendar is published and the announcement draft is out for review. Support training is booked but the 2 Oct room is double-booked. Two things need attention: go/no-go criteria have had no next action since 5 Sep and need an owner, and launch-week on-call headcount has been with Leo for 16 days.',
    links: [['Launch plan', 'https://docs.example.internal/launch/fall-2026'], ['Comms calendar', 'https://drive.example.internal/pmm/fall-launch-comms'], ['Support readiness checklist', 'https://docs.example.internal/support/fall-launch'], ['Release notes draft', 'https://docs.example.internal/launch/fall-2026-release-notes'], ['#fall-launch', '']],
    milestones: [['12 Sep', 'Comms calendar published', 'done'], ['2 Oct', 'Support training', 'room clash'], ['7 Oct', 'Go/no-go signed by Ingrid', 'at risk'], ['14 Oct', 'Announcement, FAQ, brief published', 'on track'], ['21 Oct', 'Launch', 'locked']],
    decisions: [{ on: '28 Aug', what: 'Launch date locked: 21 Oct', who: 'Ingrid', why: 'Aligns with the customer conference on 22 Oct; later loses the keynote slot, earlier cuts support training short.', status: 'decided', projects: ['J4', 'J5', 'J6'] },
      { on: '20 Aug', what: 'Single announcement, no phased rollout', who: 'Dana, Leo', why: 'The feature set is customer-visible on day one; phasing doubles comms and confuses support macros.', status: 'decided', projects: ['J4', 'J5'] }],
    pending: ['Go/no-go criteria: who owns the definition? Draft circulated 5 Sep, no owner.'],
    risks: [{ what: 'Launch-week on-call headcount unresolved', level: 'high', owner: 'leo', projects: ['J5'] }, { what: 'Go/no-go criteria undefined by 7 Oct', level: 'medium', owner: null, projects: ['J6'] }, { what: 'Support training room clash 2 Oct', level: 'low', owner: 'leo', projects: ['J5'] }] },
  P3: { compiled: d(-9), health: 'crit',
    status: 'Legal review of the master agreement template has been with Sam for 23 days and gates all six renegotiations; two nudges sent. The scorecard is progressing — criteria agreed with Tomas, 10 of 14 vendors scored, and two vendors sent revised pricing this week. The board wants a savings one-pager next month.',
    links: [['Vendor scorecard', 'https://sheets.example.internal/vendors/scorecard-2026'], ['Master agreement template v3', 'https://docs.example.internal/legal/master-agreement-v3'], ['Savings model', 'https://sheets.example.internal/vendors/savings-model'], ['#vendor-consolidation', '']],
    milestones: [['20 Aug', 'Shortlist reduced to 6', 'done'], ['18 Sep', 'Master agreement approved', 'blocked'], ['30 Sep', 'Scorecard complete 14/14', 'on track'], ['Oct', 'Board one-pager', 'requested'], ['31 Dec', '6 signed, 8 exited', 'planned']],
    decisions: [{ on: '20 Aug', what: 'Shortlist reduced to 6', who: 'Ingrid, Tomas', why: 'The 7th and 8th vendors duplicate capabilities already covered; the savings model needs 6 to hit $1.1M.', status: 'decided', projects: ['J8'] },
      { on: '30 Jul', what: 'One master agreement template instead of six bespoke contracts', who: 'Sam, Tomas', why: 'Six parallel legal reviews would take until Q1; one template reviewed once is faster overall — but becomes the critical path.', status: 'decided', projects: ['J7'] }],
    pending: [],
    risks: [{ what: 'Legal redlines block all six renegotiations', level: 'high', owner: 'sam', projects: ['J7'] }, { what: 'Two vendors raised pricing mid-negotiation', level: 'low', owner: 'tomas', projects: ['J8'] }, { what: 'Board one-pager due before savings are contracted', level: 'medium', owner: null, projects: [] }] },
};

const config = {
  autonomy: { file: 'auto', draft: 'draft', data: 'draft', send: 'ask', calendar: 'ask', delete: 'never' },
  models: { clarify: { provider: 'claude', model: 'claude-haiku-4-5' }, suggest: { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium' }, nudge: { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium' }, prep: { provider: 'claude', model: 'claude-opus-5', effort: 'high' }, review: { provider: 'claude', model: 'claude-opus-5', effort: 'high' }, compile: { provider: 'claude', model: 'claude-opus-5', effort: 'high' }, ingest: { provider: 'claude', model: 'claude-opus-5', effort: 'high' }, enrich: { provider: 'claude', model: 'claude-haiku-4-5' } },
};

/* ---------- helpers ---------- */
const EFFECT = { calendar: 'Sends 1 calendar invite', data: 'Updates the ledger; nothing is sent', wiki: 'Updates the program wiki pages', draft: 'Nothing is sent — a draft for your review' };
const firstName = (id) => people.find(p => p.id === id)?.name.split(' ')[0] || id;
const progOf = (pid) => projects.find(x => x.id === pid)?.program || pid;
const pageOf = (pid) => programs.find(g => g.id === progOf(pid))?.page || null;
const createdOf = (pid) => { const j = projects.find(x => x.id === pid); const g = programs.find(x => x.id === (j ? j.program : pid)); return +(j?.created || g?.created || at(-57)); };
const toIso = (o) => { const out = {}; for (const k in o) { const v = o[k]; if (v === undefined) continue; out[k] = v instanceof Date ? iso(v) : v; } return out; };
const fields = (i, keys) => toIso(Object.fromEntries(keys.filter(k => i[k] !== undefined).map(k => [k, i[k]])));

/** Build the demo stream. */
export function demoEvents() {
  const T0 = at(-56, 6), T1 = DEMO_TODAY.getTime();
  const EV = [];
  let n = 0;
  const ev = (t, actor, type, item, payload) => { EV.push({ n: n++, t, actor, type, item, payload }); };
  const src = (s) => 'ingest:' + (s || 'chat');
  let seed = 20260914; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], between = (a, b) => a + rnd() * (b - a);
  let runN = 0; const run = () => 'r_demo' + String(++runN).padStart(4, '0');

  // config, people
  for (const cap in config.autonomy) ev(T0 - 2 * H, 'jeff', 'config_set', null, { key: 'autonomy.' + cap, value: config.autonomy[cap] });
  for (const job in config.models) ev(T0 - 2 * H, 'jeff', 'config_set', null, { key: 'models.' + job, value: config.models[job] });
  for (const u of people) ev(at(-57, 8), 'jeff', 'person_created', null, { person: toIso(u) });

  // programs, projects, wiki seeds (hub with content, sub-pages, person pages), milestones, decisions
  for (const g of programs) {
    const c = g.created ? +g.created : at(-57), w = wiki[g.id], fresh = c > at(-56);
    ev(c, 'jeff', 'program_created', null, { program: toIso({ id: g.id, name: g.name, page: g.page, purpose: g.purpose, sponsor: g.sponsor, cadence: g.cadence }) });
    ev(c + 0.5 * H, fresh ? 'ai:wiki' : 'jeff', 'wiki_changed', null, { page: g.page, program: g.id, words: fresh ? 320 : 900, summary: (fresh ? 'Stubbed ' : 'Seeded ') + g.page, fields: { links: w.links, risks: w.risks, pending: w.pending } });
    for (const s of ['decisions', 'timeline', 'risks']) ev(c + 0.5 * H, fresh ? 'ai:wiki' : 'jeff', 'wiki_changed', null, { page: g.page + '-' + s, program: g.id, words: fresh ? 90 : 300, summary: (fresh ? 'Stubbed ' : 'Seeded ') + g.page + '-' + s });
    for (const m of w.milestones) ev(c + 0.6 * H, 'jeff', 'milestone_added', null, { program: g.id, milestone: { label: m[0], what: m[1], state: m[2] } });
    for (const x of w.decisions) ev(c + 0.7 * H, 'jeff', 'decision_recorded', null, { program: g.id, decision: x });
    if (g.retired) ev(+g.retired, 'jeff', 'program_retired', null, { id: g.id });
  }
  for (const j of projects) { const c = createdOf(j.id); ev(c + 0.1 * H, 'jeff', 'project_created', null, { project: { id: j.id, program: j.program, name: j.name, outcome: j.outcome, health: j.health, suggest: j.suggest } }); if (j.dropped) ev(T1 - H, 'jeff', 'project_updated', null, { id: j.id, fields: { dropped: true } }); }
  for (const u of people) ev(at(-57, 9), 'jeff', 'wiki_changed', null, { page: 'person-' + u.id, words: 180, summary: 'Seeded person-' + u.id });

  // weekly reviews (Fridays 15:00) and Friday compiles; the last compile per program carries the wiki's compiled date and status
  for (let d0 = -52; d0 <= -10; d0 += 7) {
    ev(at(d0, 15), 'jeff', 'review_completed', null, { steps: ['inbox', 'sweep', 'pastcal', 'upcoming', 'next', 'waiting', 'someday', 'wins', 'ai', 'lint', 'horizons'] });
    for (const g of programs) { if (g.created && +g.created > at(d0, 16)) continue; ev(at(d0, 16), 'ai:wiki', 'wiki_changed', null, { page: g.page, program: g.id, words: Math.round(between(60, 220)), summary: 'Compiled status, commitments, history · ' + g.name }); }
  }
  for (const g of programs) { const w = wiki[g.id]; ev(Math.min(+w.compiled + 8 * H, T1 - H), 'ai:wiki', 'wiki_changed', null, { page: g.page, program: g.id, words: Math.round(between(60, 220)), summary: 'Compiled status, commitments, history · ' + g.name, fields: { status: w.status, health: w.health, compiled: iso(w.compiled) } }); }

  // named items, from their fields
  const cap = (i, t, extra = {}) => ev(t, src(i.source), 'captured', i.id, { source: i.source || 'chat', raw: i.raw || i.next, from: i.from ?? undefined, minutes: i.min || undefined, ...extra });
  const clar = (i, t, proposal) => ev(t, 'ai:clarify', 'clarified', i.id, { proposal: toIso(Object.assign({ conf: .9, why: 'Clarified from the source thread.' }, proposal)) });
  const acc = (i, t, kind, f) => ev(t, 'jeff', 'accepted', i.id, { kind, fields: f });
  let k = 0;
  for (const i of items) {
    k++;
    /* inbox items are staggered by a minute so "newest first" lists them in this order */
    if (i.kind === 'inbox') { const c = +i.captured - k * 60e3; cap(i, c); clar(i, Math.max(c, Math.min(c + 0.4 * H, T1 - 6e4)), i.p); continue; }
    if (i.kind === 'waiting') {
      const s = +i.since; cap(i, s - H); clar(i, s - 0.5 * H, { kind: 'waiting', next: i.next, project: i.project, owner: i.owner, ctx: '@waiting', conf: .9, why: 'Someone else owns the next step.' });
      acc(i, s, 'waiting', fields(i, ['next', 'project', 'owner', 'since', 'followUp']));
      if (i.lastNudged) for (let q = 0; q < (i.nudges || 1); q++) { const t = +i.lastNudged - q * 7 * DAY; if (t > s) { ev(t - 0.5 * H, 'ai:nudge', 'job_finished', i.id, { job: 'nudge', run: run(), summary: 'Drafted a nudge to ' + firstName(i.owner) }); ev(t, 'jeff', 'nudged', i.id, { text: `Hi ${firstName(i.owner)}, quick check-in on ${i.next.toLowerCase()}.`, channel: 'email', followUp: q === 0 ? iso(i.followUp) : undefined }); } }
      continue;
    }
    if (i.owner === 'ai' && i.del) {
      const d0 = +i.del.at, dT = d0 >= T1 ? T1 - (10 + k * 3) * 6e4 : d0;
      cap(i, dT - 20 * H); clar(i, dT - 19.5 * H, { kind: 'action', next: i.next, project: i.project, ctx: '@quick', min: i.del.minutes, ai: { level: 'do', cap: i.cap, what: i.next } });
      acc(i, dT - 19 * H, 'action', fields(i, ['next', 'project']));
      ev(dT, 'jeff', 'handed_off', i.id, { cap: i.cap, what: i.next, effect: i.del.effect, minutes: i.del.minutes });
      if (i.del.status !== 'queued') ev(dT + 5 * 6e4, 'ai:' + i.cap, 'job_started', i.id, { job: i.cap, run: run(), args: { progress: i.del.progress ?? .5 } });
      if (i.del.readyAt) { const r = +i.del.readyAt; ev(Math.min(r >= T1 ? T1 - (5 + k) * 6e4 : r, T1), 'ai:' + i.cap, 'delivered', i.id, { deliverable: i.del.deliverable }); }
      continue;
    }
    if (i.kind === 'action') { const c = +(i.createdAt || DEMO_TODAY); cap(i, c - 18 * H); clar(i, c - 17 * H, { kind: 'action', next: i.next, project: i.project, ctx: i.ctx, min: i.min, due: i.due, hard: i.hard, start: i.start, repeat: i.repeat, ai: i.ai }); acc(i, c, 'action', fields(i, ['next', 'project', 'ctx', 'min', 'due', 'hard', 'start', 'repeat', 'energy', 'ai'])); continue; }
    if (i.kind === 'someday') { const s = +i.since; cap(i, s); clar(i, s + 0.3 * H, { kind: 'someday', next: i.next, project: i.project || null, ctx: '', conf: .7, why: 'An idea, not a commitment.' }); acc(i, s + H, 'someday', fields(i, ['next', 'project', 'since', 'revisit'])); continue; }
    if (i.kind === 'reference') { const f = +i.filedAt; cap(i, f); clar(i, f + 0.2 * H, { kind: 'reference', next: i.next, refPage: i.refPage, conf: .85, why: 'Worth keeping; nothing to do.' }); acc(i, f + 0.5 * H, 'reference', fields(i, ['next', 'refPage', 'filedAt', 'revisit'])); ev(f + 0.6 * H, 'ai:file', 'wiki_changed', i.id, { page: pageOf(i.refPage) || 'person-' + i.refPage, program: programs.some(g => g.id === i.refPage) ? i.refPage : undefined, words: 40 + (k % 5) * 12, summary: 'Filed: ' + i.next, item: i.id }); continue; }
    if (i.kind === 'trash') { const tr = +i.trashedAt; cap(i, tr - H); clar(i, tr - 0.8 * H, { kind: 'trash', next: i.next, conf: .8, why: 'Nothing to keep.' }); acc(i, tr, 'trash', fields(i, ['next'])); continue; }
    if (i.kind === 'done') { const dn = +i.doneAt, c = dn - (3 + (k % 5)) * DAY; cap(i, c); clar(i, c + 0.5 * H, { kind: 'action', next: i.next, project: i.project, ctx: '@deep', min: 30 }); acc(i, c + H, 'action', fields(i, ['next', 'project'])); ev(dn, 'jeff', 'done', i.id, {}); continue; }
  }
  // the tickler that fires today: R1's revisit date has arrived
  ev(T1, 'system', 'resurfaced', 'R1', { for: isoDay(d(0)) });

  // background: ordinary weeks at the Flow view's captured-per-week volume
  const weekTargets = [31, 27, 35, 24, 40, 29, 33, 38];
  const verbs = ['Reply to', 'Send', 'Review', 'Confirm', 'Schedule', 'Update', 'Chase', 'Read', 'Summarise', 'Check'];
  const objs = ['the variance format', 'the dry-run checklist', 'the launch FAQ draft', 'the vendor pricing sheet', 'the steering agenda', 'the on-call rota', 'cutover runbook v2', 'the macro list', 'scorecard weighting', 'the contract notice period', 'the training room booking', 'the risk register', 'the sponsor one-pager', 'the release notes', 'the reconciliation export', 'the comms calendar'];
  const waits = ['Feedback on', 'Approval of', 'Numbers for', 'Decision on', 'Confirmation of', 'Review of'];
  const sources = ['email', 'email', 'email', 'chat', 'chat', 'meeting', 'meeting', 'calendar', 'voice'];
  const kinds = ['action', 'action', 'action', 'action', 'action', 'waiting', 'waiting', 'reference', 'trash', 'someday', 'delegate', 'action', 'waiting', 'reference'];
  const named = new Array(8).fill(0); for (const e of EV) if (e.type === 'captured') { const w = Math.floor((e.t - T0) / (7 * DAY)); if (w >= 0 && w < 8) named[w]++; }
  const baseProjects = projects.filter(j => /^J\d+$/.test(j.id)), quiet = { J6: at(-40), J7: at(-32) };
  let seq = 0;
  for (let w = 0; w < 8; w++) for (let i = 0, m = Math.max(0, weekTargets[w] - named[w]); i < m; i++) {
    const id = 'B' + (++seq), dow = pick([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]), capT = T0 + (w * 7 + dow) * DAY + between(2, 12) * H;
    if (capT >= T1) continue;
    const avail = baseProjects.filter(j => createdOf(j.id) <= capT && !(quiet[j.id] && capT > quiet[j.id]));
    if (!avail.length) continue;
    const j = pick(avail), proj = rnd() < .2 ? j.program : j.id, source = pick(sources), person = pick(people).id;
    let kind = pick(kinds); const delegate = kind === 'delegate'; if (delegate) kind = 'action';
    const first = firstName(person);
    const text = kind === 'waiting' ? `${pick(waits)} ${pick(objs)} from ${first}` : `${pick(verbs)} ${pick(objs)}` + (rnd() < .5 ? ` with ${first}` : '');
    const minutes = pick([5, 10, 10, 15, 20, 30, 45, 60, 90]);
    ev(capT, src(source), 'captured', id, { source, raw: text, minutes });
    const clarT = capT + between(0.2, 14) * H, corrected = rnd() < .13, pkind = corrected ? pick(kinds.filter(x => x !== kind && x !== 'delegate')) : kind;
    ev(clarT, 'ai:clarify', 'clarified', id, { proposal: { kind: pkind, next: text, project: proj, owner: kind === 'waiting' ? person : null, ctx: minutes <= 15 ? '@quick' : '@deep', min: minutes, conf: +(corrected ? between(.45, .7) : between(.7, .98)).toFixed(2), why: 'Clarified from the source thread.' } });
    const accT = clarT + between(0.5, 30) * H; if (accT >= T1) continue;
    const f = { next: text, project: proj }; if (kind === 'waiting') f.owner = person; if (kind === 'action') { f.ctx = minutes <= 15 ? '@quick' : '@deep'; f.min = minutes; }
    ev(accT, 'jeff', 'accepted', id, { kind, fields: f });
    if (kind === 'trash') continue;
    if (kind === 'reference') { ev(accT + 0.1 * H, 'ai:file', 'wiki_changed', id, { page: pageOf(proj), program: progOf(proj), words: Math.round(between(20, 70)), summary: 'Filed: ' + text, item: id }); continue; }
    if (kind === 'someday') { if (rnd() < .3) { const pT = accT + between(18, 40) * DAY; if (pT < T1) { ev(pT, 'jeff', 'promoted', id, {}); const dT = pT + between(2, 9) * DAY; if (dT < T1) ev(dT, 'jeff', 'done', id, {}); } } continue; }
    if (kind === 'waiting') { const close = accT + between(3, 26) * DAY; for (let q = 1; q <= 3; q++) { const nT = accT + 7 * q * DAY; if (nT < close && nT < T1) { ev(nT, 'ai:nudge', 'job_finished', id, { job: 'nudge', run: run(), summary: 'Drafted a nudge to ' + first }); ev(nT + 0.5 * H, 'jeff', 'nudged', id, { text: `Hi ${first}, quick check-in on ${text.toLowerCase()}.`, channel: 'email' }); } } if (close < T1) ev(close, 'jeff', 'done', id, {}); continue; }
    if (delegate) {
      const dT = accT + between(0.2, 6) * H, c = pick(['draft', 'data', 'draft', 'calendar']);
      ev(dT, 'jeff', 'handed_off', id, { cap: c, what: text, effect: EFFECT[c], minutes });
      ev(dT + 0.5 * H, 'ai:' + c, 'job_started', id, { job: c, run: run() });
      const rT = dT + between(2, 30) * H; if (rT >= T1) continue;
      ev(rT, 'ai:' + c, 'delivered', id, { deliverable: text + '\n\n(demo deliverable)' });
      const aT = rT + between(1, 30) * H; if (aT >= T1) continue;
      if (rnd() < .1) { ev(aT, 'jeff', 'taken_back', id, {}); const dn = aT + between(1, 8) * DAY; if (dn < T1) ev(dn, 'jeff', 'done', id, {}); }
      else ev(aT, 'jeff', 'approved', id, { effect: EFFECT[c] });
      continue;
    }
    const dT = accT + ((accT < at(-14)) ? between(0.5, 12) : between(0.5, 20)) * DAY;
    if (dT < T1 && (accT < at(-14) || rnd() < .55)) ev(dT, 'jeff', 'done', id, {});
  }

  EV.sort((a, b) => a.t - b.t || a.n - b.n);
  return EV.map((e, i) => {
    const out = { seq: i + 1, id: 'e_demo' + String(i + 1).padStart(5, '0'), v: 1, at: iso(e.t), actor: e.actor, type: e.type };
    if (e.item) out.item = e.item;
    out.payload = JSON.parse(JSON.stringify(e.payload));               // strip undefined, detach from the fixture
    return out;
  });
}
