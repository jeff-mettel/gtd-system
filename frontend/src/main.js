// Entry point: styles, the store (ledger → fold), first render.
import './styles/tokens.css';
import './styles/app.css';
import './replay/replay.css';
import { load, setNotifier, setRenderer, setUndoOffer } from './store.js';
import { $, offerUndo, toast } from './lib/dom.js';

setNotifier(toast); setUndoOffer(offerUndo);
$('#view').innerHTML = '<div class="empty">Opening the ledger…</div>';
load().then(async () => {
  const { render } = await import('./app.js');
  setRenderer(render);
  window.addEventListener('hashchange', render);
  render();
});
