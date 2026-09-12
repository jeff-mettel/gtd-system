// Where each station lives in the scene, in world units. Space is the system; time is playback.
//   ports → inbox tray → clarify ring → program lanes (one track per project) → done chute and heap
//   behind: waiting shelf (a post per person), wiki wall (a column per page); in front: the AI ring and review tray
import { projects, people } from '../data/example.js';

export const LAY = { ports: { email: [-36, 0, -8], calendar: [-36, 0, -4], chat: [-36, 0, 0], meeting: [-36, 0, 4], voice: [-36, 0, 8] }, inbox: [-27, 0, 0], gate: [-18, 0, 0], trash: [-27, 0, 9], floorX: [-11, 13], laneZ: { P1: -11, P2: 0, P3: 11 }, shelf: { z: -23, y: 3.2, x0: -15, x1: 15 }, someday: [-26, 0, -23], ai: { ring: [-3, 1.2, 23], tray: [9, 0.6, 23] }, chute: [20, 0, 0], heap: [30, 0, 0], wiki: { z: -36, x0: -22, x1: 22 } };
export const laneOf = (S, prog) => { if (LAY.laneZ[prog] != null) return LAY.laneZ[prog]; const extra = [...S.programs.values()].filter(g => !g.retired && LAY.laneZ[g.id] == null).map(g => g.id); return 22 + extra.indexOf(prog) * 11; };
export const trackZ = (S, pid) => { const j = projects.find(x => x.id === pid); if (!j) return laneOf(S, pid); const sibs = projects.filter(x => x.program === j.program && S.projects.get(x.id) && !S.projects.get(x.id).dropped); const k = sibs.findIndex(x => x.id === pid); return laneOf(S, j.program) + (k - (sibs.length - 1) / 2) * 2.6; };
export const postX = (pid) => { const i = Math.max(0, people.findIndex(p => p.id === pid)); return LAY.shelf.x0 + 2 + i * ((LAY.shelf.x1 - LAY.shelf.x0 - 4) / Math.max(1, people.length - 1)); };
export const pageX = (PAGES, page) => { const i = Math.max(0, PAGES.findIndex(p => p[0] === page)); return LAY.wiki.x0 + 1 + i * ((LAY.wiki.x1 - LAY.wiki.x0 - 2) / Math.max(1, PAGES.length - 1)); };
export const CAMS = { over: { t: [0, 0, -2], th: 0, ph: 0.95, r: 74 }, gate: { t: [-22, 1, 0], th: -0.9, ph: 1.15, r: 34 }, wait: { t: [0, 3, -23], th: 0, ph: 1.1, r: 40 }, ai: { t: [3, 1, 23], th: 0.3, ph: 1.1, r: 32 }, wiki: { t: [0, 4, -36], th: 0, ph: 1.2, r: 50 }, done: { t: [26, 2, 0], th: 0.8, ph: 1.05, r: 30 } };
