// The right-hand detail drawer.

import { $ } from '../lib/dom.js';

/* ---------- drawer ---------- */
export function openDrawer(title, body, foot = '') {
  const dr = $('#drawer');
  dr.innerHTML = `<div class="dh"><h2>${title}</h2><button class="btn sm" data-close>Close</button></div><div class="db">${body}</div>${foot ? `<div class="df">${foot}</div>` : ''}`;
  dr.classList.add('open'); $('#drawerBg').classList.add('open');
  dr.querySelector('button, textarea, input')?.focus();
}

export function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerBg').classList.remove('open'); }
