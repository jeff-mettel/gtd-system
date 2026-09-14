// Where each station lives in the scene, in world units. Space is the system; time is playback.
//   ports → inbox tray → clarify ring → program lanes (one track per project) → done chute and heap → the program's wiki
//   behind: waiting shelf (a post per person); in front: the review tray. Delegated items stay in their lane (charged look).
import { people, projects } from '../store.js';

export const LAY = { ports: { email: [-36, 0, -8], calendar: [-36, 0, -4], chat: [-36, 0, 0], meeting: [-36, 0, 4], voice: [-36, 0, 8] }, inbox: [-27, 0, 0], gate: [-18, 0, 0], trash: [-27, 0, 9], floorX: [-11, 13], laneZ: { P1: -11, P2: 0, P3: 11 }, shelf: { z: -23, y: 3.2, x0: -15, x1: 15 }, someday: [-26, 0, -23], chute: [20, 0, 0], heap: [30, 0, 0], wiki: { x: 43, w: 2.4 } };
export const laneOf = (S, prog) => { if (LAY.laneZ[prog] != null) return LAY.laneZ[prog]; const extra = [...S.programs.values()].filter(g => !g.retired && LAY.laneZ[g.id] == null).map(g => g.id); return 22 + extra.indexOf(prog) * 11; };
export const trackZ = (S, pid) => { const j = projects.find(x => x.id === pid); if (!j) return laneOf(S, pid); const sibs = projects.filter(x => x.program === j.program && S.projects.get(x.id) && !S.projects.get(x.id).dropped); const k = sibs.findIndex(x => x.id === pid); return laneOf(S, j.program) + (k - (sibs.length - 1) / 2) * 2.6; };
export const postX = (pid) => { const i = Math.max(0, people.findIndex(p => p.id === pid)); return LAY.shelf.x0 + 2 + i * ((LAY.shelf.x1 - LAY.shelf.x0 - 4) / Math.max(1, people.length - 1)); };
/** Foot of a program's wiki bar: the far end of its lane, past the done heap. */
export const wikiPos = (S, prog) => [LAY.wiki.x, 0, laneOf(S, prog)];
export const CAMS = { over: { t: [2, 0, -2], th: 0, ph: 0.95, r: 80 }, gate: { t: [-22, 1, 0], th: -0.9, ph: 1.15, r: 34 }, wait: { t: [0, 3, -23], th: 0, ph: 1.1, r: 40 }, ai: { t: [1, 1, 0], th: 0.45, ph: 1.0, r: 48 }, wiki: { t: [40, 3, 0], th: 1.1, ph: 1.1, r: 46 }, done: { t: [26, 2, 0], th: 0.8, ph: 1.05, r: 30 } };
