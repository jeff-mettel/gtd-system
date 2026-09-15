// Paste a screenshot into capture. An image on the clipboard — pasted into #captureInput, or anywhere while the
// capture box is focused — is downsized on a canvas (≤ MAX px on the long edge, JPEG q.7) and becomes an inbox
// item like any other capture: source 'screenshot', the typed text (if any) as the raw ask, the data URL on
// `image`. It is a `captured` event like any other; at this size a data URL is fine in the ledger.
// In the live system the assistant reads the image (vision) and proposes the ask; here the human describes it.

import { TODAY } from '../lib/dates.js';
import { $, toast } from '../lib/dom.js';
import { withTx } from '../store.js';
import { ui } from '../ui/session.js';

export const MAX = 480;

/* Pull the first image file off a clipboard event, or null. */
export function imageFrom(cb) {
  for (const it of cb?.items || []) if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile();
  return null;
}

/* Downsize a File/Blob to a JPEG data URL, long edge ≤ max. */
export function shrink(file, max = MAX) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', .7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
    img.src = url;
  });
}

/* Build the inbox item. Pure apart from the id; exported so tests can check the shape. */
export function screenshotItem(text, image, id = 'C' + Date.now()) {
  const t = String(text || '').trim();
  return { id, kind:'inbox', source:'screenshot', from:null, captured:TODAY, raw: t || 'Screenshot', image, p:{ kind:'action', next: t || 'Screenshot — clarify what it asks for', project:null, ctx:'@quick', min:15, conf:.5, why:'A screenshot: in the live system the assistant reads it (vision) and proposes the ask; here you describe it.' } };
}

export function initPaste({ render, capture }) {
  const inp = $('#captureInput'); if (!inp) return;
  if (!/paste a screenshot/.test(inp.placeholder)) inp.placeholder = inp.placeholder.replace(/\s*$/, ' — or paste a screenshot');
  /* The capture overlay's input (features/captureOverlay.js) is a capture box too. */
  const boxes = () => [inp, $('#ovlInput')].filter(Boolean);
  document.addEventListener('paste', async (e) => {
    const src = boxes().find(b => e.target === b || document.activeElement === b); if (!src) return;
    const file = imageFrom(e.clipboardData); if (!file) return;
    e.preventDefault();
    let image; try { image = await shrink(file); } catch (x) { toast('Could not read that image'); return; }
    const n = screenshotItem(src.value, image);
    withTx(() => { const id = capture({ source:'screenshot', raw:n.raw, image:n.image, proposal:n.p }); src.value = ''; src.closest('.ovl')?.setAttribute('hidden', ''); ui.sel = id; location.hash = '#inbox'; render(); toast('Screenshot captured · describe the ask in the inbox'); });
  });
}
