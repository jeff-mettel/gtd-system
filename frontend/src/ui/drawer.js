// The right-hand detail drawer.

import { d, items } from '../data/example.js';
import { by, delegated, mine } from '../model.js';

    <div class="tile"><div class="v">0.6<span class="muted" style="font-size:14px"> d</span></div><div class="l">median inbox → clarified</div></div>
    <div class="tile warn"><div class="v">9.4<span class="muted" style="font-size:14px"> d</span></div><div class="l">median waiting-for age</div></div>
    <div class="tile"><div class="v num">${mine().length + by('waiting').length + delegated().length}</div><div class="l">open commitments in the ledger</div></div>
    <div class="tile"><div class="v">${((delegated().reduce((n, i) => n + (i.del.minutes || 0), 0) + 130) / 60).toFixed(1)}<span class="muted" style="font-size:14px"> h</span></div><div class="l">handed to AI this week</div></div>
  </div>
  <div class="chartbox"><h2 style="font-size:15px">Items per week</h2><div class="legend">${series.map(s => `<span><i style="background:${s[2]}"></i>${s[1]}</span>`).join('')}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:8px" role="img" aria-label="Grouped bars of captured, clarified and done items per week for eight weeks"><g class="grid">${ticks}</g>${bars}<g>${labels}</g></svg></div>
