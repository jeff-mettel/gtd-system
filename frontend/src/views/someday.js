import { d } from '../data/example.js';
import { days, esc, pname, until } from '../model.js';

    <div class="panel"><div class="ph"><h2>Aging</h2><span class="note num">${ws.length} open · ${ws.filter(w => until(w.followUp) < 0).length} past follow-up</span></div>
      <div class="aging">${buckets.map(b => { const n = ws.filter(b[1]).length; return `<div class="bar"><span class="lbl">${b[0]}</span><div class="trk"><i style="width:${n / max * 100}%;background:${b[2]}"></i></div><span class="n">${n}</span></div>`; }).join('')}</div>
      <div class="ph" style="border-top:1px solid var(--line);border-bottom:0"><h2>Oldest</h2></div>
      <div class="pb">${[...ws].sort((a, b) => days(b.since) - days(a.since)).slice(0, 3).map(w => `<div class="row"><div class="t"><div>${esc(w.next)}</div><div class="m"><span class="chip">${esc(pname(w.owner))}</span><span class="age over">${days(w.since)}d</span></div></div></div>`).join('')}</div>
    </div>
