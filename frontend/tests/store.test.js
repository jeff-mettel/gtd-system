import { describe, it, expect, beforeEach } from 'vitest';
import { demoEvents } from '@gtd/ledger';
import * as store from '../src/store.js';
import { commit, withTx, load, tick, ledger } from '../src/store.js';
import { by, mine, nextActionFor, projHealth, projOf } from '../src/model.js';
import { completeItem, uncompleteItem } from '../src/features/repeat.js';
import { TODAY, d } from '../src/lib/dates.js';

const find = (id) => store.items.find(i => i.id === id);
let undo = null;
store.setUndoOffer((fn) => { undo = fn; });
store.setNotifier(() => {});

beforeEach(async () => { undo = null; await load({ seed: demoEvents() }); });

describe('store — load and bindings', () => {
  it('folds the demo seed into live bindings with the expected counts', () => {
    expect(ledger.mode).toBe('local'); expect(ledger.events.length).toBeGreaterThan(1000); expect(ledger.seq).toBe(ledger.events.length);
    expect(store.programs).toHaveLength(3); expect(store.projects).toHaveLength(8); expect(store.people).toHaveLength(7);
    expect(by('inbox')).toHaveLength(8); expect(by('waiting').filter(i => /^W/.test(i.id))).toHaveLength(7);
    expect(mine().length).toBeGreaterThan(8); expect(by('someday').filter(i => /^S/.test(i.id))).toHaveLength(3);
    expect(store.config.autonomy.send).toBe('ask'); expect(store.lastReview()).toBeInstanceOf(Date);
    expect(store.meetings.length).toBe(4); expect(store.calendarLive).toBe(false);        // fixtures until a calendar_synced lands
    expect(store.wiki.P1.milestones).toHaveLength(5);
  });
  it('an empty seed is an empty, renderable state', async () => {
    await load({ seed: [] });
    expect(store.items).toEqual([]); expect(store.programs).toEqual([]); expect(store.lastReview()).toBeNull(); expect(store.config.models.clarify.model).toBe('claude-haiku-4-5');
  });
});

describe('store — commit', () => {
  it('inbox accept → event appended → refold shows it filed', () => {
    const n = ledger.events.length;
    const e = commit('accepted', { kind: 'action', fields: { next: 'Send the variance summary', project: 'J3', ctx: '@deep', min: 45, due: d(2) } }, { item: 'I1' });
    expect(e.seq).toBe(n + 1); expect(e.actor).toBe('jeff'); expect(e.payload.fields.due).toMatch(/^2026-09-16/);
    expect(ledger.events.at(-1)).toBe(e);
    const it = find('I1'); expect(it.kind).toBe('action'); expect(it.next).toBe('Send the variance summary'); expect(it.due).toBeInstanceOf(Date); expect(it.createdAt).toBeInstanceOf(Date);
    expect(by('inbox')).toHaveLength(7); expect(mine().some(a => a.id === 'I1')).toBe(true);
  });
  it('rejects invalid events and leaves the ledger untouched', () => {
    const n = ledger.events.length;
    expect(() => commit('accepted', { kind: 'action', fields: { project: 'J99' } }, { item: 'I1' })).toThrow(/unknown project/);
    expect(() => commit('approved', { effect: 'x' }, { item: 'X1', actor: 'ai:draft' })).toThrow(/ai actors may not/);
    expect(() => commit('teleport', {}, { item: 'I1' })).toThrow(/unknown type/);
    expect(ledger.events.length).toBe(n); expect(find('I1').kind).toBe('inbox');
  });
  it('captured with a known ref is a no-op returning the existing capture', () => {
    const a = commit('captured', { source: 'email', raw: 'x', ref: 'gmail:thread/1' }, { item: 'i_a' });
    const b = commit('captured', { source: 'email', raw: 'again', ref: 'gmail:thread/1' }, { item: 'i_b' });
    expect(b).toBe(a); expect(find('i_b')).toBeUndefined();
  });
  it('settings persist as config_set', () => {
    commit('config_set', { key: 'autonomy.file', value: 'never' }); commit('config_set', { key: 'models.clarify', value: { provider: 'local', model: 'qwen3-8b' } }); commit('config_set', { key: 'prompts.nudge', value: 'Short and kind.' }); commit('config_set', { key: 'progColor.P2', value: 5 });
    expect(store.config.autonomy.file).toBe('never'); expect(store.config.models.clarify.model).toBe('qwen3-8b'); expect(store.config.prompts.nudge).toBe('Short and kind.'); expect(store.config.progColor.P2).toBe(5);
    commit('config_set', { key: 'prompts.nudge', value: null }); expect(store.config.prompts.nudge).toBeUndefined();
  });
  it('milestone add and next_action_set fold through', () => {
    commit('milestone_added', { program: 'P2', milestone: { label: '30 Sep', what: 'Macros live', state: 'planned', iso: '2026-09-30' } });
    expect(store.wiki.P2.milestones.at(-1)).toEqual(['30 Sep', 'Macros live', 'planned', '2026-09-30']);
    commit('next_action_set', { project: 'J8' }, { item: 'A7' });
    expect(projOf('J8').primary).toBe('A7'); expect(nextActionFor('J8').id).toBe('A7');
  });
});

describe('store — transactions and undo', () => {
  it('a transaction offers one undo that commits the compensating events', () => {
    const n = ledger.events.length;
    withTx(() => { commit('done', {}, { item: 'A1' }); commit('trashed', {}, { item: 'I4' }); });
    expect(find('A1').kind).toBe('done'); expect(find('I4').kind).toBe('trash'); expect(typeof undo).toBe('function');
    undo();
    expect(find('A1').kind).toBe('action'); expect(find('I4').kind).toBe('inbox');
    expect(ledger.events.length).toBe(n + 4);
    expect(ledger.events.slice(-2).map(e => e.type)).toEqual(['restored', 'undone']);
  });
  it('undo of an accept restores the item to the inbox with its prior fields', () => {
    withTx(() => commit('accepted', { kind: 'waiting', fields: { next: 'Window from infra', owner: 'priya', project: 'J1', since: TODAY, followUp: d(4) } }, { item: 'I2' }));
    expect(find('I2').kind).toBe('waiting');
    undo();
    const it = find('I2'); expect(it.kind).toBe('inbox'); expect(it.owner).toBeNull(); expect(ledger.events.at(-1).type).toBe('edited');
  });
  it('undo of a hand-off is a take-back; of a config_set the prior value; of a new project a drop', () => {
    withTx(() => commit('handed_off', { cap: 'draft', what: 'Draft it', effect: 'Nothing is sent' }, { item: 'A1' }));
    expect(find('A1').owner).toBe('ai'); undo(); expect(find('A1').owner).toBeUndefined(); expect(ledger.events.at(-1).type).toBe('taken_back');
    withTx(() => commit('config_set', { key: 'autonomy.draft', value: 'auto' }));
    expect(store.config.autonomy.draft).toBe('auto'); undo(); expect(store.config.autonomy.draft).toBe('draft');
    withTx(() => commit('project_created', { project: { id: 'j_new', program: 'P1', name: 'New', outcome: 'x', health: 'good' } }));
    expect(projOf('j_new').dropped).toBe(false); undo(); expect(projOf('j_new').dropped).toBe(true);
  });
  it('a rejected commit inside a transaction is reported, not thrown, and offers no undo', () => {
    expect(() => withTx(() => commit('done', {}, { item: 'nope' }))).not.toThrow();
    expect(undo).toBeNull();
  });
});

describe('store — repeat, defer, ticklers', () => {
  it('ticking a repeating action spawns the next instance as captured+accepted; unticking withdraws it', () => {
    const a13 = find('A13'); const n = ledger.events.length;
    const spawned = completeItem(a13);
    expect(find('A13').kind).toBe('done');
    expect(spawned).toMatchObject({ kind: 'action', next: a13.next, repeat: 'weekly', project: 'P2', spawnedFrom: 'A13', source: 'repeat' });
    expect(new Date(spawned.hard).getTime()).toBe(new Date(a13.hard).getTime() + 7 * 864e5);
    expect(ledger.events.slice(n).map(e => e.type)).toEqual(['done', 'captured', 'accepted']);
    expect(completeItem(find('A1'))).toBeNull();
    uncompleteItem(find('A13'));
    expect(find('A13').kind).toBe('action'); expect(find(spawned.id).kind).toBe('trash');
  });
  it('the demo tickler (R1) is in the inbox and does not fire twice; a new due tickler fires as a resurfaced event', () => {
    expect(find('R1')).toMatchObject({ kind: 'inbox', source: 'tickler', wasKind: 'reference' });
    expect(tick()).toBe(false);
    commit('edited', { fields: { revisit: d(-1) } }, { item: 'S2' });
    expect(tick()).toBe(true);
    const s2 = find('S2'); expect(s2.kind).toBe('inbox'); expect(s2.wasKind).toBe('someday'); expect(s2.p.why).toMatch(/Tickler/); expect(ledger.events.at(-1)).toMatchObject({ type: 'resurfaced', actor: 'system', item: 'S2' });
    expect(tick()).toBe(false);
    /* accepting it again as someday with a new date arms it again; the same date never fires twice */
    commit('accepted', { kind: 'someday', fields: { next: s2.next, revisit: d(-1) } }, { item: 'S2' }); expect(tick()).toBe(false);
    commit('accepted', { kind: 'someday', fields: { next: s2.next, revisit: d(0) } }, { item: 'S2' }); expect(tick()).toBe(true); expect(find('S2').kind).toBe('inbox');
  });
  it('a deferred action whose start day arrives is stamped resurfacedAt through an event and counts as covered meanwhile', () => {
    const a14 = find('A14'); expect(mine().some(a => a.id === 'A14')).toBe(false);
    commit('done', {}, { item: 'W7' });
    const h = projHealth(projOf('J2')); expect(h.na).toBeNull(); expect(h.deferred?.id).toBe('A14'); expect(h.noNext).toBe(false);
    commit('edited', { fields: { start: d(0) } }, { item: 'A14' });
    expect(tick()).toBe(true); expect(find('A14').resurfacedAt).toBeInstanceOf(Date); expect(mine().some(a => a.id === 'A14')).toBe(true); expect(tick()).toBe(false);
    void a14;
  });
});

describe('store — import / export', () => {
  it('export is the raw event array; checkImport validates in order', () => {
    const out = JSON.parse(store.exportJSON()); expect(out.v).toBe(1); expect(out.events.length).toBe(ledger.events.length);
    expect(store.checkImport(out.events).ok).toBe(true);
    const bad = [...out.events, { v: 1, at: 'x', actor: 'jeff', type: 'done', item: 'A1', payload: {} }];
    const r = store.checkImport(bad); expect(r.ok).toBe(false); expect(r.errors[0][0]).toBe(bad.length - 1);
    expect(store.checkImport('nope').ok).toBe(false);
  });
  it('replace swaps the ledger; append re-commits', async () => {
    const two = [{ seq: 1, id: 'e1', v: 1, at: '2026-09-14T08:00:00Z', actor: 'jeff', type: 'program_created', payload: { program: { id: 'p_x', name: 'X', purpose: 'y' } } }];
    await store.importEvents(two, { replace: true });
    expect(store.programs.map(g => g.id)).toEqual(['p_x']); expect(ledger.events.length).toBe(1);
    await store.importEvents([{ v: 1, at: '2026-09-14T09:00:00Z', actor: 'jeff', type: 'review_completed', payload: {} }]);
    expect(ledger.events.length).toBe(2); expect(store.lastReview()).toBeInstanceOf(Date);
  });
});
