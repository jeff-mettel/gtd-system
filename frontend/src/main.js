// Entry point: styles, state over example data, first render.
import './styles/tokens.css';
import './styles/app.css';
import './replay/replay.css';
import { applyState, linkReferences } from './state.js';
import { render } from './app.js';

applyState();
linkReferences();
window.addEventListener('hashchange', render);
render();
