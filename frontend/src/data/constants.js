// Fixtures that are not (yet) ledger data: labels, the calendar the Now view and the review read until the
// calendar ingest lands (beta phase 3), sweep triggers, the cycle-time table, the AI log and wiki lint the
// review shows. Every date is relative to TODAY. Entity data (programs, projects, people, items, wiki) lives in
// the ledger: see store.js and packages/ledger/demo.js.

import { d } from '../lib/dates.js';

export const wikiLint = [
  { page:'program-vendor-consolidation', what:'Current status compiled 9 days ago — older than 7', fix:'Recompile' },
  { page:'program-fall-launch-risks', what:'Go/no-go risk has no owner; ledger project J6 has no next action either', fix:'Assign owner in review step 2' },
  { page:'person-sam-reyes', what:'No inbound links from a hub Stakeholders table other than P3', fix:'Fine — single program' },
];

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

export const flowWeeksStatic = [
  { w:'20 Jul', c:31, k:29, d:18 }, { w:'27 Jul', c:27, k:27, d:22 }, { w:'3 Aug', c:35, k:30, d:19 }, { w:'10 Aug', c:24, k:24, d:21 },
  { w:'17 Aug', c:40, k:33, d:25 }, { w:'24 Aug', c:29, k:29, d:23 }, { w:'31 Aug', c:33, k:31, d:20 }, { w:'7 Sep', c:38, k:30, d:17 },
];

export const cycle = [
  { list:'Inbox → clarified', median:'0.6 d', p90:'2.1 d', note:'Target < 1 day' },
  { list:'Next action → done', median:'3.2 d', p90:'11 d', note:'Deep-work items dominate the tail' },
  { list:'Waiting for → closed', median:'9.4 d', p90:'26 d', note:'Legal and sponsor decisions' },
  { list:'Someday → promoted or dropped', median:'41 d', p90:'—', note:'Review monthly' },
];
