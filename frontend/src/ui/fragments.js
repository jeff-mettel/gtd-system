// Shared HTML fragments.

import { d, programs, projects } from '../data/example.js';
import { by, days, delegated, until } from '../model.js';
import { state } from '../state.js';
import { icons, projHealth, views } from './nav.js';

export const $ = (s, el = document) => el.querySelector(s);

    `<div class="group">Lists</div>` + views.slice(1, 8).map(v => navLink(v, cur)).join('') +
    `<div class="group">Reflect</div>` + views.slice(8).map(v => navLink(v, cur)).join('');
  const inbox = by('inbox').length, over = by('waiting').filter(w => until(w.followUp) < 0).length, noNext = projects.filter(p => !p.dropped && !programs.find(g => g.id === p.program)?.retired && projHealth(p).noNext).length, lr = days(state.lastReview);
  $('#healthbar').innerHTML = `<span class="${inbox ? 'bad' : ''}">Inbox <b>${inbox}</b></span><span class="${over ? 'bad' : ''}">Overdue waiting <b>${over}</b></span><span class="${noNext ? 'bad' : ''}">No next action <b>${noNext}</b></span><span class="${lr > 7 ? 'bad' : ''}">Last review <b>${lr}d</b></span><span class="ai">AI for review <b>${delegated('ready').length}</b></span>`;
}
export function navLink(v, cur) {
  const n = v.count ? v.count() : 0;
  return `<a href="#${v.id}" class="${cur === v.id ? 'on' : ''}">${icons[v.id] || ''}<span>${v.label}</span>${n ? `<span class="cnt ${v.hot ? 'hot' : ''}${v.ai ? ' ai' : ''}">${n}</span>` : `<span class="key">${v.key}</span>`}</a>`;
}

/* ---------- shared fragments ---------- */
export function actionRow(a) {
  return `<div class="row ${a.kind === 'done' ? 'done' : ''}"><label class="lab" style="flex:none"><input class="chk" type="checkbox" data-done="${a.id}" ${a.kind === 'done' ? 'checked' : ''}></label>
