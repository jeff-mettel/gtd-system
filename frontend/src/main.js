// Entry point: styles, state over example data, first render.
import './styles/tokens.css';
import './styles/app.css';
import './replay/replay.css';
import { applyState, linkReferences, applyMilestones } from './state.js';
import { render } from './app.js';

applyState();
linkReferences();
applyMilestones();
window.addEventListener('hashchange', render);
render();
