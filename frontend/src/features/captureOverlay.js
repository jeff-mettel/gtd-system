// Global capture overlay: ⌘K / Ctrl+K, `/` outside fields, or focusing the top-bar capture box. One large input,
// one hint line, "@" autocomplete (features/autocomplete.js), Esc closes, ⏎ captures and closes — no navigation.
// What the text means (project, date, pin, estimate) is decided by features/captureParse.js in app.js's captureText().

import { $, esc } from '../lib/dom.js';
import { attachAutocomplete } from './autocomplete.js';
import { parseCapture } from './captureParse.js';
import { parseMentions } from './autocomplete.js';
import { fmtDate } from '../lib/dates.js';
import { projName, pname } from '../model.js';

let ovl = null, input = null, onCapture = null, preview = null;

const HINT = '<span class="kbd">⏎</span> capture · <span class="kbd">@</span> project or person · <b>fri</b> / <b>+3</b> sets a date · <b>!</b> pins to today · <b>~30m</b> estimate · <span class="kbd">Esc</span>';

function build() {
  ovl = document.createElement('div'); ovl.className = 'ovl'; ovl.id = 'captureOvl'; ovl.hidden = true;
  ovl.innerHTML = `<form class="ovl-box" id="ovlForm" role="dialog" aria-label="Capture"><div class="ovl-row"><span class="ovl-plus">+</span><input id="ovlInput" placeholder="Capture anything…" aria-label="Capture" autocomplete="off" spellcheck="false"></div><div class="ovl-hint">${HINT}</div><div class="ovl-preview" id="ovlPreview" hidden></div></form>`;
  document.body.appendChild(ovl);
  input = $('#ovlInput'); preview = $('#ovlPreview');
  const form = $('#ovlForm');
  attachAutocomplete(input, { host: form });
  ovl.addEventListener('mousedown', (e) => { if (e.target === ovl) closeCapture(); });
  /* Enter submits explicitly (the autocomplete list, when open, takes Enter first and stops it here). */
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCapture(); }
    else if (e.key === 'Enter' && !e.isComposing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); e.stopPropagation(); form.requestSubmit(); }
  });
  input.addEventListener('input', paintPreview);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim(); if (!v) return;
    input.value = ''; paintPreview();
    closeCapture();
    onCapture?.(v);
  });
}

/* A one-line read-back of what the parser will do, so the grammar teaches itself. */
function paintPreview() {
  const v = input.value.trim();
  if (!v) { preview.hidden = true; return; }
  const p = parseCapture(v, { mentions: parseMentions });
  const bits = [];
  if (p.mentions.project) bits.push(`<span class="chip proj">${esc(projName(p.mentions.project))}</span>`);
  if (p.mentions.owner) bits.push(`<span class="chip">${esc(pname(p.mentions.owner))}</span>`);
  if (p.hard) bits.push(`<span class="chip when warn">📌 today</span>`);
  else if (p.due) bits.push(`<span class="chip when">due ${esc(fmtDate(p.due))}</span>`);
  if (p.min) bits.push(`<span class="num">${p.min} min</span>`);
  const where = p.question ? 'to the inbox — a question needs a decision' : p.filed ? `straight to <b>${esc(projName(p.mentions.project))}</b> as a next action` : 'to the inbox — add <b>@project</b> to file it at once';
  preview.innerHTML = `<span class="faint">"${esc(p.next)}"</span> ${bits.join(' ')} <span class="faint">→ ${where}</span>`;
  preview.hidden = false;
}

export function initCaptureOverlay({ capture }) {
  onCapture = capture;
  if (!ovl) build();
  /* One capture path: the top-bar box hands off to the overlay on focus (mouse or keyboard). */
  const top = $('#captureInput');
  top?.addEventListener('focus', () => { const v = top.value; top.value = ''; top.blur(); openCapture(v); });
}

export function openCapture(text = '') {
  if (!ovl) build();
  ovl.hidden = false;
  if (text) input.value = text;
  paintPreview();
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
}

export function closeCapture() { if (ovl) ovl.hidden = true; }
export const captureOpen = () => !!ovl && !ovl.hidden;
