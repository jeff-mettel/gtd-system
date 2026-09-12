import { cycle } from '../data/example.js';
import { weeks } from '../replay/events.js';
import { by, delegated, mine } from '../model.js';

export function viewFlow() {
  const flowWeeks = weeks();
  const W = 720, H = 220, padL = 32, padB = 26, padT = 10, gw = (W - padL - 8) / flowWeeks.length, bw = Math.floor((gw - 14) / 3), maxV = 45;
  const y = v => padT + (H - padT - padB) * (1 - v / maxV);
  const series = [['c', 'Captured', 'var(--s1)'], ['k', 'Clarified', 'var(--s2)'], ['d', 'Done', 'var(--s3)']];
  const bars = flowWeeks.map((wk, i) => series.map((s, j) => { const x = padL + i * gw + 7 + j * (bw + 2), h = H - padB - y(wk[s[0]]);
    return `<rect x="${x}" y="${y(wk[s[0]])}" width="${bw}" height="${h}" rx="3" fill="${s[2]}" data-tip="<b>${s[1]}</b> · week of ${wk.w}: ${wk[s[0]]}"></rect>`; }).join('')).join('');
  const ticks = [0, 15, 30, 45].map(v => `<line x1="${padL}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"></line><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const labels = flowWeeks.map((wk, i) => `<text x="${padL + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${wk.w}</text>`).join('');
  const streak = 4;
  return `<div class="vhead"><div><h1>Flow</h1><p>Is the system itself healthy? Capture must be clarified within a day, and done should track captured — a widening gap means the lists are filling faster than you close them.</p></div><button class="btn ghost" data-reset>Reset demo data</button></div>
  <div class="panel"><div class="ph"><h2>Replay</h2><span class="note">Every ball is an item; where it sits is a fold of the ledger up to the playhead. Nothing here is a status field.</span></div><div id="replayHost"></div></div>
  <div class="attn">
    <div class="tile"><div class="v">${streak}</div><div class="l">days in a row at inbox zero</div></div>
    <div class="tile"><div class="v">0.6<span class="muted" style="font-size:14px"> d</span></div><div class="l">median inbox → clarified</div></div>
    <div class="tile warn"><div class="v">9.4<span class="muted" style="font-size:14px"> d</span></div><div class="l">median waiting-for age</div></div>
    <div class="tile"><div class="v num">${mine().length + by('waiting').length + delegated().length}</div><div class="l">open commitments in the ledger</div></div>
    <div class="tile"><div class="v">${((delegated().reduce((n, i) => n + (i.del.minutes || 0), 0) + 130) / 60).toFixed(1)}<span class="muted" style="font-size:14px"> h</span></div><div class="l">handed to AI this week</div></div>
  </div>
  <div class="chartbox"><h2 style="font-size:15px">Items per week</h2><div class="legend">${series.map(s => `<span><i style="background:${s[2]}"></i>${s[1]}</span>`).join('')}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:8px" role="img" aria-label="Grouped bars of captured, clarified and done items per week for eight weeks"><g class="grid">${ticks}</g>${bars}<g>${labels}</g></svg></div>
  <div class="panel"><div class="ph"><h2>Cycle time by list</h2><span class="note">Where work waits</span></div><div class="tablewrap"><table><thead><tr><th>Stage</th><th>Median</th><th>P90</th><th>Note</th></tr></thead><tbody>${cycle.map(c => `<tr><td>${c.list}</td><td class="num">${c.median}</td><td class="num">${c.p90}</td><td class="muted">${c.note}</td></tr>`).join('')}</tbody></table></div></div>`;
}
