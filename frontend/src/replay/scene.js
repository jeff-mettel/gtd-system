// The three.js scene: balls are items, stations are the GTD lists. Every position is a fold of
// events ≤ t (fold.js); only motion is tweened. createScene() mounts into `root` (see index.js for
// the markup it expects) and returns the controls the Flow view uses.
import { programs, projects, people, wiki } from '../data/example.js';
import { state } from '../state.js';
import { esc } from '../lib/dom.js';
import { pname, srcLabel, progIdx } from '../model.js';
import { fold } from './fold.js';
import { hubPage } from './events.js';
import { LAY, CAMS, laneOf, trackZ, postX, pageX } from './layout.js';

const DAY = 864e5, H = 36e5;
const fmtD = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), fmtT = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function createScene(THREE, root, data) {
  const { EV, ITEMS, REVIEWS, PAGES, T0, T1 } = data;
  const stage = root.querySelector('.rp-stage'), statEls = [...root.querySelectorAll('.rp-stats [data-stat]')], scrub = root.querySelector('.rp-scrub input'), ticks = root.querySelector('.rp-ticks'), dateEl = root.querySelector('.rp-date'), capEl = root.querySelector('.rp-caption'), playBtn = root.querySelector('[data-rpplay]');
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), col = (v) => new THREE.Color(css(v) || '#888');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); stage.appendChild(renderer.domElement);
  const tipEl = document.createElement('div'); tipEl.className = 'tip'; stage.appendChild(tipEl);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(20, 40, 10); scene.add(sun);
  let P = {}; const themed = [];   // [material, palette key] — recoloured on theme change
  const palette = () => { P = { s1: col('--s1'), s2: col('--s2'), s3: col('--s3'), o1: col('--o1'), o2: col('--o2'), accent: col('--accent'), ink3: col('--ink-3'), line2: col('--line-2'), good: col('--good'), warn: col('--warn'), crit: col('--crit'), floor: col('--scene-floor'), grid: col('--scene-grid'), bg: col('--scene-bg'), surface2: col('--surface-2'), ink: col('--ink') }; scene.background = P.bg; scene.fog = new THREE.Fog(P.bg, 120, 230); for (const [m, key] of themed) { m.color.copy(P[key]); if (key === 'crit' && m.emissive) m.emissive.copy(P.crit); } if (grid) grid.material.color.copy(P.grid); };
  let grid = null; palette();
  const mat = (key, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: P[key], roughness: .85, metalness: 0 }, o)); themed.push([m, key]); return m; };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 90), mat('floor')); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, -6); scene.add(floor);
  grid = new THREE.GridHelper(100, 50, P.grid, P.grid); grid.position.set(0, 0, -6); grid.material.opacity = .5; grid.material.transparent = true; scene.add(grid);
  const box = (w, h, d, key, pos, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(key, o)); m.position.set(...pos); scene.add(m); return m; };
  for (const k in LAY.ports) box(1.6, 0.6, 2.2, 'surface2', [LAY.ports[k][0], 0.3, LAY.ports[k][2]]);
  box(6, 0.25, 8, 'surface2', [LAY.inbox[0], 0.12, LAY.inbox[2]]);
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 12, 48), mat('accent', { roughness: .5 })); gateRing.position.set(LAY.gate[0], 3.2, 0); gateRing.rotation.y = Math.PI / 2; scene.add(gateRing);
  box(2.2, 1.6, 2.2, 'line2', [LAY.trash[0], 0.8, LAY.trash[2]], { transparent: true, opacity: .55 });
  box(LAY.shelf.x1 - LAY.shelf.x0 + 2, 0.4, 5, 'surface2', [0, LAY.shelf.y - 0.2, LAY.shelf.z]);
  for (const p of people) box(0.35, 2.4, 0.35, 'line2', [postX(p.id), LAY.shelf.y + 1.2, LAY.shelf.z - 1.6]);
  box(5, 1.2, 4, 'surface2', [LAY.someday[0], 0.6, LAY.someday[2]], { transparent: true, opacity: .7 });
  const aiRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 10, 48), mat('accent', { roughness: .4 })); aiRing.position.set(...LAY.ai.ring); aiRing.rotation.x = Math.PI / 2; scene.add(aiRing);
  box(7, 0.3, 3, 'surface2', [LAY.ai.tray[0], 0.15, LAY.ai.tray[2]]);
  // the drop into the done heap is the balls' own arc (see the `default` case in frame); a thin floor ring marks where they land
  const heapRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 2 * Math.PI) * 4.2, Math.sin(i / 64 * 2 * Math.PI) * 4.2, 0))), new THREE.LineBasicMaterial({ color: P.line2, transparent: true, opacity: .8 })); heapRing.rotation.x = -Math.PI / 2; heapRing.position.set(LAY.heap[0], 0.02, 0); scene.add(heapRing); themed.push([heapRing.material, 'line2']);
  box(LAY.wiki.x1 - LAY.wiki.x0 + 3, 0.5, 3, 'surface2', [0, 0.25, LAY.wiki.z]);
  const trackGeo = new THREE.BoxGeometry(LAY.floorX[1] - LAY.floorX[0], 0.16, 1.4), colGeo = new THREE.BoxGeometry(1.5, 1, 1.5); colGeo.translate(0, 0.5, 0);
  const colMeshes = new Map(PAGES.map(([page, owner]) => { const m = new THREE.Mesh(colGeo, mat(String(owner).startsWith('P') ? 'o2' : 'o1')); m.position.set(pageX(PAGES, page), 0.5, LAY.wiki.z); m.scale.y = 0.001; scene.add(m); return [page, m]; }));
  const trackMeshes = new Map(), stallRings = new Map(), trackLabels = new Map();
  // one plate per program, enclosing its tracks — the grouping that says which projects belong together
  const plates = new Map(), plateGeo = new THREE.BoxGeometry(LAY.floorX[1] - LAY.floorX[0] + 4, 0.06, 1), edgeGeo = new THREE.EdgesGeometry(plateGeo);
  const progColor = (gid) => col('--c' + progIdx(gid));
  const ensurePlate = (g) => { if (plates.has(g.id)) return plates.get(g.id); const fill = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: progColor(g.id), transparent: true, opacity: .10, roughness: 1 })); const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: progColor(g.id), transparent: true, opacity: .8 })); fill.add(edge); scene.add(fill); const P_ = { fill, edge }; plates.set(g.id, P_); return P_; };
  const ensureTrack = (j) => { if (trackMeshes.has(j.id)) return; const m = new THREE.Mesh(trackGeo, mat('good', { transparent: true, opacity: .55 })); m.visible = false; scene.add(m); trackMeshes.set(j.id, m); const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 32), mat('crit', { emissive: P.crit, emissiveIntensity: .4 })); r.rotation.x = Math.PI / 2; r.visible = false; scene.add(r); stallRings.set(j.id, r); trackLabels.set(j.id, label(j.name, [0, 0.5, 0], 'small')); };
  const N = ITEMS.length, sphere = new THREE.SphereGeometry(0.5, 18, 14);
  const solid = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ roughness: .45, metalness: .05 }), N), wire = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ wireframe: true }), N), ghost = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ roughness: .6, transparent: true, opacity: .42 }), N);
  for (const m of [solid, wire, ghost]) { m.frustumCulled = false; scene.add(m); for (let i = 0; i < N; i++) m.setColorAt(i, P.ink3); }
  const cur = ITEMS.map(() => ({ x: -40, y: 0, z: 0, s: 0, init: false })), dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  // labels
  const labels = [];
  function label(text, pos, cls = '') { const el = document.createElement('div'); el.className = 'rp-lbl ' + cls; el.innerHTML = text; stage.appendChild(el); const L = { el, pos: new THREE.Vector3(...pos) }; labels.push(L); return L; }
  label('Email', [-36, 1.2, -8], 'small'); label('Calendar', [-36, 1.2, -4], 'small'); label('Chat', [-36, 1.2, 0], 'small'); label('Meetings', [-36, 1.2, 4], 'small'); label('Voice', [-36, 1.2, 8], 'small');
  label('Inbox', [LAY.inbox[0], 1.6, LAY.inbox[2] - 4], 'big'); label('Clarify gate', [LAY.gate[0], 0.4, 5.5], 'big'); label('Trash', [LAY.trash[0], 2.4, LAY.trash[2]], 'small');
  label('Waiting for', [LAY.shelf.x0 - 2.5, LAY.shelf.y + 1.2, LAY.shelf.z], 'big'); for (const p of people) label(p.name.split(' ')[0], [postX(p.id), LAY.shelf.y + 2.9, LAY.shelf.z - 1.6], 'small');
  label('Someday / maybe', [LAY.someday[0], 2.2, LAY.someday[2]], 'small'); label('Delegated to AI', [LAY.ai.ring[0], 3.4, LAY.ai.ring[2]], 'big'); label('Ready for review', [LAY.ai.tray[0], 1.6, LAY.ai.tray[2]], 'small');
  label('Done', [LAY.heap[0], 7, 0], 'big'); label('Wiki', [LAY.wiki.x0 - 3, 1.5, LAY.wiki.z], 'big');
  const laneLabels = new Map(), hubLabels = new Map(programs.filter(g => wiki[g.id]).map(g => [wiki[g.id].page, label(g.name, [pageX(PAGES, wiki[g.id].page), 1, LAY.wiki.z], 'small')]));
  // camera
  const cam = { target: new THREE.Vector3(0, 0, -4), theta: 0, phi: 0.98, r: 86 }; let camGoal = null;
  const applyCam = () => { const y = Math.cos(cam.phi) * cam.r, h = Math.sin(cam.phi) * cam.r; camera.position.set(cam.target.x + Math.sin(cam.theta) * h, cam.target.y + y, cam.target.z + Math.cos(cam.theta) * h); camera.lookAt(cam.target); };
  const setCamBtn = (name) => root.querySelectorAll('[data-rpcam] button').forEach(b => b.classList.toggle('on', b.dataset.cam === name));
  let drag = null, hoverId = null;
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }; camGoal = null; cv.setPointerCapture(e.pointerId); root.focus({ preventScroll: true }); });
  cv.addEventListener('pointerup', () => drag = null); cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointermove', e => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (drag.pan) { const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize(); const fwd = new THREE.Vector3(-right.z, 0, right.x); cam.target.addScaledVector(right, -dx * cam.r / 900).addScaledVector(fwd, -dy * cam.r / 900); } else { cam.theta -= dx * 0.006; cam.phi = Math.min(1.5, Math.max(0.15, cam.phi - dy * 0.005)); } setCamBtn(null); } hover(e); });
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.min(160, Math.max(12, cam.r * (1 + e.deltaY * 0.0012))); camGoal = null; }, { passive: false });
  cv.addEventListener('pointerleave', () => { hoverId = null; tipEl.style.display = 'none'; });
  root.querySelector('[data-rpcam]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCam(b.dataset.cam); });
  function setCam(name) { camGoal = CAMS[name]; setCamBtn(name); }
  // time / window / filters
  let W0 = T0, W1 = T1, t = T0, playing = false, speed = 1, progFilter = '', aiFilter = false;
  const setT = (v) => { t = Math.max(W0, Math.min(W1, v)); scrub.value = Math.round((t - W0) / H); };
  function setWindow(name) {
    root.querySelectorAll('[data-rpwin] button').forEach(b => b.classList.toggle('on', b.dataset.win === name));
    if (name === 'week') { const lr = new Date(state.lastReview + 'T15:00:00').getTime(); W0 = Math.max(T0, Math.min(lr, T1 - DAY)); } else W0 = T0;
    W1 = T1; scrub.max = Math.round((W1 - W0) / H); setT(W0);
    ticks.innerHTML = ''; const pct = (x) => ((x - W0) / (W1 - W0) * 100) + '%';
    for (let d0 = W0; d0 <= W1; d0 += DAY) { const dt = new Date(d0); const daily = (W1 - W0) < 21 * DAY; if (dt.getDay() === 1 || daily) { const el = document.createElement('div'); el.className = 'rp-tick week'; el.style.left = pct(d0); el.innerHTML = `<span class="l">${dt.getDate()}${!daily || d0 === W0 || dt.getDate() === 1 ? ' ' + dt.toLocaleDateString('en-GB', { month: 'short' }) : ''}</span>`; ticks.appendChild(el); } }
    for (const r of REVIEWS) if (r >= W0 && r <= W1) { const el = document.createElement('div'); el.className = 'rp-tick review'; el.title = 'Weekly review'; el.style.left = pct(r); ticks.appendChild(el); }
  }
  const play = (on) => { if (on && t >= W1) setT(W0); playing = on; playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
  playBtn.addEventListener('click', () => play(!playing));
  scrub.addEventListener('input', () => { t = W0 + scrub.value * H; });
  root.querySelector('[data-rpspeed]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; speed = +b.dataset.sp; root.querySelectorAll('[data-rpspeed] button').forEach(x => x.classList.toggle('on', x === b)); });
  root.querySelector('[data-rpwin]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setWindow(b.dataset.win); });
  root.querySelector('[data-rpprog]').addEventListener('change', e => progFilter = e.target.value);
  const aiBox = root.querySelector('[data-rpai]'); aiBox.addEventListener('change', e => aiFilter = e.target.checked);
  root.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
    if (e.code === 'Space') { e.preventDefault(); play(!playing); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setT(t + (e.shiftKey ? 7 : 1) * DAY); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setT(t - (e.shiftKey ? 7 : 1) * DAY); }
    else if (e.key === 'r') { const n = REVIEWS.find(x => x > t + H); if (n) setT(n + H); }
    else if (e.key === 'Home') setT(W0); else if (e.key === 'End') setT(W1);
    e.stopPropagation();
  });
  setWindow('all');
  // frame
  const ageBucket = (days) => days > 30 ? P.crit : days > 14 ? P.s2 : days > 7 ? P.warn : P.s3;
  const kindColor = (it) => it.stage === 'waiting' ? ageBucket((t - it.since) / DAY) : ({ action: P.s1, waiting: P.s3, someday: P.ink3, reference: P.o1, trash: P.line2, project: P.s1 })[it.kind || it.pkind] || P.ink3;
  const progOf = (proj) => { const j = projects.find(x => x.id === proj); return j ? j.program : proj; };
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!root.isConnected) return;                                   // parked: skip work
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) { setT(t + dt * speed * DAY); if (t >= W1) play(false); }
    const S = fold(EV, t);
    const slots = new Map(), slot = (key) => { const n = slots.get(key) || 0; slots.set(key, n + 1); return n; };
    const targets = new Map();
    for (const it of [...S.items.values()].sort((a, b) => a.since - b.since)) {
      let p; const sinceD = (t - it.since) / DAY;
      switch (it.stage) {
        case 'inbox': { if (sinceD * 24 < 1.5) { const port = LAY.ports[it.source] || LAY.ports.chat, k = sinceD * 24 / 1.5; p = [port[0] + (LAY.inbox[0] - 3 - port[0]) * k, 0.6, port[2] + (LAY.inbox[2] - port[2]) * k]; } else { const n = slot('inbox'); p = [LAY.inbox[0] - 2 + (n % 5) * 1.1, 0.6 + Math.floor(n / 25) * 1.1, LAY.inbox[2] - 3 + Math.floor(n / 5) % 5 * 1.3]; } break; }
        case 'gate': { const n = slot('gate'); p = [LAY.gate[0] - 3 + (n % 3) * 1.1, 0.6 + Math.floor(n / 3) * 1.1, -1 + Math.floor(n / 9) * 1.2]; break; }
        case 'action': { const z = trackZ(S, it.project), n = slot('track:' + it.project); p = n > 15 ? [LAY.floorX[0] + 0.8 + (n - 16) * 1.5, 1.7, z] : [LAY.floorX[0] + 0.8 + n * 1.5, 0.6, z]; break; }
        case 'waiting': { const x = postX(it.owner), n = slot('post:' + it.owner); p = [x + 0.8 + (n % 3) * 1.05 - 1.05, LAY.shelf.y + 0.55 + Math.floor(n / 3) * 1.05, LAY.shelf.z + 0.6]; break; }
        case 'delegated': { const n = slot('ai'), a = now / 1400 + n * 1.3; p = [LAY.ai.ring[0] + Math.cos(a) * 3.4, LAY.ai.ring[1] + (it.working ? 0.3 * Math.sin(now / 300 + n) : 0), LAY.ai.ring[2] + Math.sin(a) * 3.4]; break; }
        case 'ready': { const n = slot('tray'); p = [LAY.ai.tray[0] - 2.6 + (n % 5) * 1.3, 0.85 + Math.floor(n / 5) * 1.05, LAY.ai.tray[2]]; break; }
        case 'someday': { const n = slot('someday'); p = [LAY.someday[0] - 1.6 + (n % 4) * 1.1, 1.6 + Math.floor(n / 12) * 1.05, LAY.someday[2] - 1.2 + Math.floor(n / 4) % 3 * 1.1]; break; }
        case 'reference': case 'wiki': { const x = pageX(PAGES, it.page || hubPage(it.project) || PAGES[0][0]), k = Math.min(1, sinceD * 24 / 2); p = [x, 0.9, LAY.wiki.z + 4 - 3 * k]; break; }
        case 'trash': { const n = slot('trash'); p = [LAY.trash[0] - 0.5 + (n % 2), 0.5 + Math.floor(n / 4) * 0.8, LAY.trash[2] - 0.5 + Math.floor(n / 2) % 2]; break; }
        default: { const n = slot('done'); if (sinceD * 24 < 2) { const k = sinceD * 24 / 2; p = [LAY.chute[0] - 3 + 8 * k, 2.2 - 1.6 * k, (trackZ(S, it.project) || 0) * (1 - k)]; } else { const r = 0.62 * Math.sqrt(n), a = n * 2.39996; p = [LAY.heap[0] + Math.cos(a) * r, 0.5 + Math.max(0, 4.6 - r * 0.75), Math.sin(a) * r]; } }
      }
      targets.set(it.id, p);
    }
    const k = reduced ? 1 : 1 - Math.pow(0.001, dt);
    for (let i = 0; i < N; i++) {
      const id = ITEMS[i], it = S.items.get(id), c = cur[i], p = targets.get(id);
      const vis = !!it && (it.stage !== 'wiki' || (t - it.since) < 2 * H);
      if (!vis) { c.s += (0 - c.s) * k; if (!it) c.init = false; }
      else {
        if (!c.init) { const port = LAY.ports[it.source] || LAY.ports.chat; c.x = port[0]; c.y = 0.6; c.z = port[2]; c.s = 0; c.init = true; }
        c.x += (p[0] - c.x) * k; c.y += (p[1] - c.y) * k; c.z += (p[2] - c.z) * k;
        let s = 0.55 + Math.min(1, (it.minutes || 15) / 90) * 0.55;
        const evAge = (t - it.lastEv) / H; if (evAge >= 0 && evAge < 6) s *= 1 + 0.5 * (1 - evAge / 6);
        const corr = it.corrected ? (t - it.corrected) / H : 99; if (corr >= 0 && corr < 8) c.y += Math.sin(corr / 8 * Math.PI) * 1.6;
        let dim = false; if (progFilter && progOf(it.project) !== progFilter) dim = true; if (aiFilter) { const a = S.aiTouched.get(id); if (!(a && t - a < 7 * DAY)) dim = true; }
        c.s += ((dim ? s * 0.35 : s) - c.s) * k;
        tmpC.copy(kindColor(it)); if (dim) tmpC.lerp(P.bg, 0.75); if (hoverId === id) tmpC.lerp(P.ink, 0.35);
        solid.setColorAt(i, tmpC); wire.setColorAt(i, tmpC); ghost.setColorAt(i, tmpC);
      }
      const which = !it ? null : it.stage === 'done' ? ghost : (it.stage === 'gate' || (it.stage === 'inbox' && it.proposed)) ? wire : solid;
      for (const m of [solid, wire, ghost]) { dummy.position.set(c.x, c.y, c.z); dummy.scale.setScalar(m === which ? c.s : 0.0001); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
    }
    for (const m of [solid, wire, ghost]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const j of projects) {
      ensureTrack(j); const m = trackMeshes.get(j.id), L = trackLabels.get(j.id), pj = S.projects.get(j.id), g = S.programs.get(j.program);
      const on = !!pj && !pj.dropped && g && !g.retired; m.visible = on; L.el.style.display = on ? '' : 'none'; stallRings.get(j.id).visible = false;
      if (!on) continue;
      const z = trackZ(S, j.id); m.position.set((LAY.floorX[0] + LAY.floorX[1]) / 2, 0.08, z); L.pos.set(LAY.floorX[1] + 1.2, 0.5, z);
      const stalledD = (t - pj.lastMove) / DAY, stalled = stalledD > 7;
      m.material.color.copy(stalled ? P.line2 : P[pj.health] || P.good); m.material.opacity = progFilter && j.program !== progFilter ? .15 : .6;
      L.el.className = 'rp-lbl small left' + (stalled ? ' stalled' : ''); L.el.innerHTML = `<span class="st" style="background:var(--${pj.health || 'good'})"></span>${esc(j.name)}${stalled ? ` · stalled ${Math.floor(stalledD)} d` : ''}`;
      if (stalled) { const r = stallRings.get(j.id), sc = 1 + 0.12 * Math.sin(now / 350); r.visible = true; r.scale.set(sc, sc, sc); r.position.set(LAY.floorX[0] + 0.8, 0.3, z); r.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(now / 350); }
    }
    for (const g of programs) {
        if (!laneLabels.has(g.id)) { const L0 = label(esc(g.name), [0, 0.5, 0], 'big left'); L0.el.style.color = css('--c' + progIdx(g.id)); laneLabels.set(g.id, L0); }
        const L = laneLabels.get(g.id), pg = S.programs.get(g.id), on = pg && !pg.retired, pl = ensurePlate(g);
        L.el.style.display = on ? '' : 'none'; pl.fill.visible = !!on;
        if (!on) continue;
        const live = projects.filter(x => x.program === g.id && S.projects.get(x.id) && !S.projects.get(x.id).dropped).length;
        const depth = Math.max(1, live) * 2.6 + 1.6, z = laneOf(S, g.id);
        pl.fill.position.set((LAY.floorX[0] + LAY.floorX[1]) / 2 - 1, 0.03, z); pl.fill.scale.z += (depth - pl.fill.scale.z) * k;
        const dimP = progFilter && g.id !== progFilter; pl.fill.material.opacity = dimP ? .03 : .10; pl.edge.material.opacity = dimP ? .2 : .8;
        L.pos.set(LAY.floorX[0] - 2.6, 0.3, z + depth / 2 + 0.9); L.el.style.opacity = dimP ? .35 : 1;   // just in front of the plate's near edge
      }
    for (const [page, m] of colMeshes) { const w = S.wiki.get(page) || 0, target = Math.max(0.001, w / 160); m.scale.y += (target - m.scale.y) * k; const L = hubLabels.get(page); if (L) { L.pos.set(pageX(PAGES, page), m.scale.y + 0.6, LAY.wiki.z); L.el.style.display = w ? '' : 'none'; } }
    gateRing.rotation.z += dt * 0.15;
    if (camGoal) { const g = camGoal; cam.target.lerp(new THREE.Vector3(...g.t), 0.08); cam.theta += (g.th - cam.theta) * 0.08; cam.phi += (g.ph - cam.phi) * 0.08; cam.r += (g.r - cam.r) * 0.08; if (Math.abs(cam.r - g.r) < 0.05) camGoal = null; }
    applyCam(); renderer.render(scene, camera);
    const Wd = stage.clientWidth, Hd = stage.clientHeight;
    for (const L of labels) { const v = L.pos.clone().project(camera); L.el.style.visibility = v.z > 1 || L.el.style.display === 'none' ? 'hidden' : 'visible'; L.el.style.left = ((v.x + 1) / 2 * Wd) + 'px'; L.el.style.top = ((1 - v.y) / 2 * Hd) + 'px'; }
    dateEl.textContent = fmtD(t) + ' · ' + fmtT(t);
    const c = { inbox: 0, action: 0, waiting: 0, ai: 0, someday: 0, done: 0 };
    for (const it of S.items.values()) { if (it.stage === 'inbox' || it.stage === 'gate') c.inbox++; else if (it.stage === 'action') c.action++; else if (it.stage === 'waiting') c.waiting++; else if (it.stage === 'delegated' || it.stage === 'ready') c.ai++; else if (it.stage === 'someday') c.someday++; else if (it.stage === 'done') c.done++; }
    let words = 0; for (const w of S.wiki.values()) words += w;
    const stalledN = [...S.projects.values()].filter(p => !p.dropped && (t - p.lastMove) / DAY > 7).length;
    const stats = { inbox: c.inbox, action: c.action, waiting: c.waiting, ai: c.ai, someday: c.someday, done: c.done, stalled: stalledN, words: words.toLocaleString(), reviews: S.reviews };
    for (const el of statEls) { const v = String(stats[el.dataset.stat]); if (el.textContent !== v) el.textContent = v; }
    const e = S.last; if (e) { const ai = e.actor.startsWith('ai:'); const what = ({ captured: 'Captured', clarified: 'Proposed ' + (e.kind || ''), accepted: (e.corrected ? 'Corrected to ' : 'Accepted as ') + e.kind, done: 'Done', closed: 'Received', nudged: 'Nudged ' + pname(e.owner), nudge_drafted: 'Drafted nudge to ' + pname(e.owner), delegated: 'Handed to the AI (' + e.cap + ')', working: 'AI working', delivered: 'Ready for review', approved: 'Approved', taken_back: 'Taken back', promoted: 'Promoted from someday', dropped: 'Trashed', wiki_changed: 'Wiki · ' + (e.text || e.page), review_completed: 'Weekly review completed', program_created: 'Program created · ' + e.text, program_retired: 'Program retired · ' + e.text, project_created: 'Project created · ' + e.text, project_dropped: 'Project dropped', health_set: 'Health set' })[e.type] || e.type; const it = e.item ? S.items.get(e.item) : null; capEl.innerHTML = `<span class="when">${fmtD(e.at)} ${fmtT(e.at)}</span><span class="who ${ai ? 'ai' : ''}">${e.actor}</span><span>${esc(what)}${it ? ' · ' + esc(it.text) : ''}</span>`; }
  }
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  function hover(e) {
    const r = cv.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects([solid, wire, ghost])[0];
    hoverId = hit ? ITEMS[hit.instanceId] : null;
    if (!hoverId) { tipEl.style.display = 'none'; return; }
    const it = fold(EV, t).items.get(hoverId); if (!it) { tipEl.style.display = 'none'; return; }
    const j = projects.find(x => x.id === it.project), pj = programs.find(x => x.id === (j ? j.program : it.project));
    tipEl.innerHTML = `<b>${esc(it.text)}</b><div class="muted mono" style="font-size:11px;margin-top:3px">${it.id} · ${srcLabel[it.source] || it.source} · ${it.minutes || '—'} min${pj ? ' · ' + esc(pj.name) : ''}${j ? ' › ' + esc(j.name) : ''}</div><div class="rp-hist">${it.hist.filter(h => h.at <= t).slice(-6).map(h => `<div><span>${fmtD(h.at)}</span>${h.actor.startsWith('ai:') ? '<em>' + h.actor + '</em> ' : ''}${h.type}${h.owner ? ' · ' + pname(h.owner) : ''}${h.corrected ? ' (corrected)' : ''}</div>`).join('')}</div>`;
    tipEl.style.display = 'block'; const sr = stage.getBoundingClientRect(); tipEl.style.left = Math.min(sr.width - 330, e.clientX - sr.left + 14) + 'px'; tipEl.style.top = Math.min(sr.height - 160, e.clientY - sr.top + 14) + 'px';
  }
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', palette);
  new MutationObserver(palette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  requestAnimationFrame(frame);
  return { resize, setWindow, setAI: (v) => { aiFilter = v; aiBox.checked = v; }, setCam, play };
}
