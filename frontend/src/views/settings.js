// Settings: autonomy, model per job, prompts, options. Everything here is remembered (state) and read by the
// back-end job registry on the next run — nothing takes effect mid-job.

import { autonomyLabel, capLabel } from '../data/example.js';
import { esc } from '../lib/dom.js';
import { state } from '../state.js';

/* The AI jobs, in the order the back-end registry lists them (docs/backlog.md, "Configurable models per use case"). */
export const JOBS = [
  { id:'clarify', label:'Clarify', what:'Turn an inbox item into kind, next action, owner, context and confidence' },
  { id:'suggest', label:'Suggest next action', what:'Propose the next physical action for a project from its outcome and history' },
  { id:'nudge', label:'Draft nudge', what:'Write a follow-up from the waiting-for history' },
  { id:'prep', label:'Prep brief', what:'Assemble a pre-meeting brief from the ledger and the wiki' },
  { id:'review', label:'Weekly review prep', what:'Gather the evidence for each review step' },
  { id:'compile', label:'Wiki compile', what:'Rewrite compiled status sections from the ledger' },
  { id:'ingest', label:'Wiki ingest', what:'Fold meeting notes into hub, decisions, timeline and log' },
  { id:'enrich', label:'URL enrich', what:'Resolve a pasted link into its thread and context before clarify runs' },
];

export const PROVIDERS = {
  claude: { label:'Claude', models:['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] },
  local: { label:'Local (Ollama)', models:['qwen3-14b', 'qwen3-8b', 'llama-3.3-8b'] },
};
export const EFFORTS = ['low', 'medium', 'high'];

/* Default prompt stubs. The full prompts live with the back-end jobs; these are the editable openings the user owns. */
export const DEFAULT_PROMPTS = {
  clarify: 'You clarify one captured item for a program manager. Answer GTD\'s questions: is it actionable; what is the very next physical action; who owns it. Return the schema with a confidence and a one-line rationale. Never invent a project — match an existing one or propose a new one with an outcome.',
  suggest: 'Given a project\'s outcome, its open items and its recent history, propose one next physical action, verb-first, that a person could do in one sitting. Say which context it belongs in and why it moves the project.',
  nudge: 'Draft a short follow-up to the person who owes this item. Use the history: what was asked, when, how many nudges so far. Polite, specific, with a date. Nothing sends until the user approves.',
  prep: 'Prepare a one-page brief for this meeting from the ledger and the wiki: related project and its status, open items with the attendees, waiting-fors, the latest decisions and risks. Lead with what the user needs to decide or ask.',
  review: 'Gather the evidence for each weekly-review step: inbox count, meetings with nothing captured, projects without a next action, aged waiting-fors, someday items, wins. Present facts; the user makes the calls.',
  compile: 'Rewrite the compiled status sections of the program hub from ledger activity only. Do not touch purpose, links, decisions or risks. Note the compile date.',
  ingest: 'Fold these notes into the program wiki: update hub sections, append decisions with rationale, extend the timeline, and add a log entry. Preserve everything written by a person; flag contradictions with the ledger instead of resolving them.',
  enrich: 'Resolve this URL into the message or document behind it, with author, channel or location, and the surrounding thread. Return raw text plus a two-line context summary for clarify.',
};

export const modelOf = (job) => Object.assign({ provider:'claude', model:'claude-opus-5', effort:'medium' }, state.models?.[job]);

export function viewSettings() {
  const opts = (cap) => (cap === 'send' || cap === 'calendar' || cap === 'delete') ? ['never', 'ask'] : ['never', 'ask', 'draft', 'auto'];
  const sel = (job, field, choices, value, extra = '') => `<select class="in" data-model="${job}|${field}" aria-label="${field} for ${job}" ${extra}>${choices.map(c => `<option value="${c}" ${c === value ? 'selected' : ''}>${esc(field === 'provider' ? PROVIDERS[c].label : c)}</option>`).join('')}</select>`;
  return `<div class="vhead"><div><h1>Settings</h1><p>What the assistant may do unasked, which model runs each job, and the prompts behind them. Trust and cost are tuned in one place.</p></div></div>
  <div class="panel"><div class="ph"><h2>Autonomy</h2><span class="note">What the assistant may do without asking</span></div>
    <div class="tablewrap"><table><tbody>${Object.keys(capLabel).filter(c => c !== 'clarify').map(c => `<tr><td>${esc(capLabel[c])}</td><td style="width:210px"><select class="in" data-autonomy="${c}">${opts(c).map(o => `<option value="${o}" ${(state.autonomy[c] || 'ask') === o ? 'selected' : ''}>${autonomyLabel[o]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="note" style="padding:10px 18px">Sending, booking and deleting can never go above "Always ask first". Everything the assistant does — including at "Do it" — is logged and shows up in the weekly review's AI audit.</div>
  </div>
  <div class="panel"><div class="ph"><h2>Models per job</h2><span class="note">Claude with an effort level, or a local model served by Ollama</span></div>
    <div class="tablewrap"><table class="models"><thead><tr><th>Job</th><th>Provider</th><th>Model</th><th>Effort</th></tr></thead><tbody>${JOBS.map(j => { const m = modelOf(j.id); const p = PROVIDERS[m.provider] || PROVIDERS.claude;
      return `<tr><td><b>${esc(j.label)}</b><div class="sub">${esc(j.what)}</div></td><td>${sel(j.id, 'provider', Object.keys(PROVIDERS), m.provider)}</td><td>${sel(j.id, 'model', p.models, m.model)}${m.provider === 'local' ? '<div class="sub">local (Ollama)</div>' : ''}</td><td>${m.provider === 'claude' && !/haiku/.test(m.model) ? sel(j.id, 'effort', EFFORTS, m.effort) : '<span class="faint" title="Effort levels apply to Opus and Sonnet; Haiku and local models run at one speed">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="note" style="padding:10px 18px">This drives the back-end job registry (<code class="mono">jobs.yaml</code>; see <code class="mono">docs/backlog.md</code>). Cheap, high-volume jobs are the natural local candidates; synthesis jobs stay on Claude.</div>
  </div>
  <div class="panel"><div class="ph"><h2>Prompts</h2><span class="note">The editable opening of each job's prompt; the rest is fixed by the job's schema</span></div>
    <div class="pb prompts">${JOBS.map(j => { const custom = state.prompts?.[j.id] != null; return `<details class="fold"><summary>${esc(j.label)}${custom ? ' <span class="chip">edited</span>' : ''}</summary>
      <textarea class="draft" rows="4" data-prompt="${j.id}" aria-label="Prompt for ${esc(j.label)}">${esc(custom ? state.prompts[j.id] : DEFAULT_PROMPTS[j.id])}</textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button class="btn sm ghost" data-promptreset="${j.id}" ${custom ? '' : 'disabled'}>Reset to default</button><span class="note">Saved when you leave the field. Takes effect on the next run of ${esc(j.label.toLowerCase())}.</span></div></details>`; }).join('')}</div>
  </div>
  <div class="panel"><div class="ph"><h2>Options</h2><span class="note">How the views behave</span></div>
    <div class="tablewrap"><table><tbody>
      <tr><td>Default grouping on Engage</td><td style="width:210px"><select class="in" data-opt="nowGroup"><option value="context" ${state.nowGroup !== 'program' ? 'selected' : ''}>By context</option><option value="program" ${state.nowGroup === 'program' ? 'selected' : ''}>By program</option></select></td></tr>
      <tr><td>Sidebar collapsed on open</td><td><label class="lab" style="align-items:center;gap:8px"><input class="chk" type="checkbox" data-opt="rail" ${state.collapsed.rail ? 'checked' : ''}><span class="note">Icons only; <span class="kbd">[</span> toggles it any time</span></label></td></tr>
      <tr><td>View tips</td><td><button class="btn sm" data-guide-reset>Show view tips again</button></td></tr>
      <tr><td>Demo data</td><td><button class="btn sm ghost" data-reset>Reset demo data</button><div class="sub">Clears everything remembered in this browser — including these settings — and reloads the example ledger.</div></td></tr>
    </tbody></table></div>
  </div>`;
}
