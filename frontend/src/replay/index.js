// Replay: mount point for the Flow view. Owns one persistent root element (the WebGL context
// survives view re-renders because the element is re-parented, never rebuilt) and lazy-loads
// three.js the first time the scene is needed.
import { programs } from '../data/example.js';
import { buildEvents } from './events.js';
import { createScene } from './scene.js';

let root = null, scene = null, threePromise = null, pending = null;

const markup = () => `
  <div class="rp-bar">
    <div class="seg" data-rpwin><button data-win="week">Since last review</button><button data-win="all" class="on">Eight weeks</button></div>
    <select class="in" data-rpprog aria-label="Program filter"><option value="">All programs</option>${programs.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select>
    <label class="rp-chk"><input type="checkbox" data-rpai> AI touched · 7 d</label>
    <span class="sp"></span>
    <div class="seg" data-rpcam><button data-cam="over" class="on">Overview</button><button data-cam="gate">Gate</button><button data-cam="wait">Waiting</button><button data-cam="ai">AI</button><button data-cam="wiki">Wiki</button><button data-cam="done">Done</button></div>
  </div>
  <div class="rp-stage"><div class="rp-loading">Loading the scene…</div></div>
  <div class="rp-transport">
    <button class="btn primary" data-rpplay aria-label="Play">▶</button>
    <div class="seg" data-rpspeed><button data-sp="0.5">½ d/s</button><button data-sp="1" class="on">1 d/s</button><button data-sp="3">3 d/s</button><button data-sp="7">1 wk/s</button></div>
    <div class="rp-scrub"><div class="rp-ticks"></div><input type="range" min="0" max="1" step="1" value="0" aria-label="Time"></div>
    <div class="rp-date"></div>
  </div>
  <div class="rp-stats" aria-label="Counts at the playhead">${[['inbox', 'Inbox'], ['action', 'Next actions'], ['waiting', 'Waiting for'], ['ai', 'With the AI'], ['someday', 'Someday'], ['done', 'Done (cum.)'], ['stalled', 'Stalled'], ['words', 'Wiki words'], ['reviews', 'Reviews']].map(([k, l]) => `<div><span>${l}</span><b data-stat="${k}">0</b></div>`).join('')}</div>
  <div class="rp-legend" aria-label="Legend">
    <div class="grp"><span class="h">Items</span><div class="row"><span><i style="background:var(--s1)"></i>Next action</span><span><i style="background:var(--s3)"></i>Waiting for</span><span><i style="background:var(--accent)"></i>With the AI</span><span><i style="background:var(--o1)"></i>Reference → wiki</span><span><i style="background:var(--ink-3)"></i>Someday</span><span><i class="wire"></i>AI-proposed, unconfirmed</span><span><i class="ghost" style="background:var(--s1)"></i>Done</span></div></div>
    <div class="grp"><span class="h">Waiting age</span><div class="row"><span><i style="background:var(--s3)"></i>0–7 d</span><span><i style="background:var(--warn)"></i>8–14 d</span><span><i style="background:var(--s2)"></i>15–30 d</span><span><i style="background:var(--crit)"></i>30+ d</span></div></div>
    <div class="grp"><span class="h">Tracks</span><div class="row"><span><i class="bar" style="background:var(--good)"></i>Good</span><span><i class="bar" style="background:var(--warn)"></i>Warn</span><span><i class="bar" style="background:var(--crit)"></i>Crit</span><span><i class="bar" style="background:var(--line-2)"></i>Stalled &gt; 7 d</span></div></div>
    <div class="grp"><span class="h">Wiki</span><div class="row"><span><i class="col" style="background:var(--o2)"></i>Program page</span><span><i class="col" style="background:var(--o1)"></i>Project page</span></div></div>
  </div>
  <div class="rp-caption"></div>
  <div class="rp-hint">Drag to orbit · wheel to zoom · shift-drag to pan · hover a ball · <span class="kbd">space</span> play · <span class="kbd">←</span><span class="kbd">→</span> day · <span class="kbd">⇧</span> week · <span class="kbd">r</span> next review</div>`;

const loadThree = () => threePromise || (threePromise = import('three'));

function applyPending() {
  if (!scene || !pending) return;
  scene.setWindow(pending.win); scene.setAI(!!pending.ai); scene.setCam(pending.cam || 'over'); if (pending.play) scene.play(true);
  pending = null;
}

export const Replay = {
  /** Put the replay into `host`. Safe to call on every render of the Flow view. */
  async mount(host) {
    if (!root) { root = document.createElement('div'); root.className = 'rp'; root.tabIndex = 0; root.innerHTML = markup(); }
    host.appendChild(root);
    if (scene) { scene.resize(); applyPending(); return; }
    const THREE = await loadThree();
    if (!root.isConnected) return;                       // user navigated away while three.js loaded
    root.querySelector('.rp-loading')?.remove();
    scene = createScene(THREE, root, buildEvents());
    applyPending();
  },
  /** Park the replay (keeps the WebGL context; the frame loop idles while unmounted). */
  unmount() { if (root?.parentNode) root.parentNode.removeChild(root); scene?.play(false); },
  /** Preset applied on next mount: 'week' (since last review) or 'ai' (the week, AI filter, AI camera). */
  preset(name) { pending = name === 'ai' ? { win: 'week', ai: true, cam: 'ai', play: true } : { win: 'week', ai: false, cam: 'over', play: true }; },
};
