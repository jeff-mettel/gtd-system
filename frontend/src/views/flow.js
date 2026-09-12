import { d, items, projects, wiki } from '../data/example.js';
import { days } from '../model.js';
import { state } from '../state.js';

    wins: 'Get current. Completed items are the evidence for status reporting, and they\'re also how you calibrate: if this list is short, either the week was interrupt-driven or the next actions were too big. The draft status report assembles from here plus health and waiting-fors.',
    ai: 'Trust check. Everything the assistant did this week is listed; automatic actions are the ones to eyeball. If something looks wrong, lower that capability\'s autonomy — the settings exist so trust can be adjusted one capability at a time.',
    lint: 'Get current, for the wiki. Compiled status sections go stale, the wiki and the ledger can disagree, pages can go orphaned. Fix findings through a reviewed ingest so the context you rely on for prep briefs stays true.',
    horizons: 'Look up. Programs are areas of responsibility; each has a purpose you can check projects against. Ask: does every project still serve its program\'s purpose? Is there work with no home? Has a program met its purpose and earned retirement?',
  };
  const doneCount = steps.filter(s => s.auto || state.review[s.id]).length;
  return `<div class="vhead"><div><h1>Weekly review</h1><p>AI prepared the evidence; the decisions are yours. Last completed ${days(state.lastReview)} days ago.</p></div><div style="display:flex;align-items:center;gap:12px;min-width:260px"><div class="progress"><i style="width:${doneCount / steps.length * 100}%"></i></div><span class="note num">${doneCount}/${steps.length}</span></div></div>
  <div class="steps">${steps.map((s, i) => { const ok = s.auto || !!state.review[s.id]; return `<div class="step ${ok ? 'ok' : ''}"><div class="sh"><input class="chk" type="checkbox" data-step="${s.id}" ${ok ? 'checked' : ''} ${s.auto ? 'disabled' : ''}><span class="n">${i + 1}</span><h3>${s.title}</h3><span class="st">${s.status}</span></div>${why[s.id] ? `<div class="swhy">${why[s.id]}</div>` : ''}<div class="sb">${s.body}</div></div>`; }).join('')}</div>
  <div class="acts" style="border:0;padding:0"><span class="note">Completing the review stamps <code class="mono">last_reviewed</code> on every project and resets the health strip.</span><span class="sp"></span><button class="btn primary" data-complete ${doneCount < steps.length ? 'disabled' : ''}>Complete review</button></div>`;
}

export function viewFlow() {
  const W = 720, H = 220, padL = 32, padB = 26, padT = 10, gw = (W - padL - 8) / flowWeeks.length, bw = Math.floor((gw - 14) / 3), maxV = 45;
  const y = v => padT + (H - padT - padB) * (1 - v / maxV);
  const series = [['c', 'Captured', 'var(--s1)'], ['k', 'Clarified', 'var(--s2)'], ['d', 'Done', 'var(--s3)']];
  const bars = flowWeeks.map((wk, i) => series.map((s, j) => { const x = padL + i * gw + 7 + j * (bw + 2), h = H - padB - y(wk[s[0]]);
    return `<rect x="${x}" y="${y(wk[s[0]])}" width="${bw}" height="${h}" rx="3" fill="${s[2]}" data-tip="<b>${s[1]}</b> · week of ${wk.w}: ${wk[s[0]]}"></rect>`; }).join('')).join('');
  const ticks = [0, 15, 30, 45].map(v => `<line x1="${padL}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"></line><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const labels = flowWeeks.map((wk, i) => `<text x="${padL + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${wk.w}</text>`).join('');
  const streak = 4;
  return `<div class="vhead"><div><h1>Flow</h1><p>Is the system itself healthy? Capture must be clarified within a day, and done should track captured — a widening gap means the lists are filling faster than you close them.</p></div><button class="btn ghost" data-reset>Reset demo data</button></div>
  <div class="attn">
