import { describe, it, expect } from 'vitest';
import { fold, validate, demoEvents, DEMO_TODAY } from '../index.js';

const EV = demoEvents();
const S = fold(EV);
const by = (k) => S.items.filter(i => i.kind === k);
const find = (id) => S.items.find(i => i.id === id);
const days = (x) => Math.round((DEMO_TODAY - new Date(x)) / 864e5);

describe('demo round-trip', () => {
  it('is a valid, sorted, seq-numbered v1 stream', () => {
    expect(EV.length).toBeGreaterThan(1000);
    for (let i = 0; i < EV.length; i++) { expect(EV[i].seq).toBe(i + 1); expect(EV[i].v).toBe(1); if (i) expect(Date.parse(EV[i].at)).toBeGreaterThanOrEqual(Date.parse(EV[i - 1].at)); }
    /* every event validates against the fold of everything before it (a real writer's check) */
    const bad = [], prefix = [];
    for (const e of EV) { const r = validate(e, fold(prefix)); if (!r.ok) bad.push([e.seq, e.type, r.errors]); prefix.push(e); }
    expect(bad).toEqual([]);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(demoEvents())).toBe(JSON.stringify(EV));
  });
  it('folds to the example state: counts', () => {
    expect(S.programs).toHaveLength(3); expect(S.projects).toHaveLength(8); expect(S.people).toHaveLength(7);
    expect(by('inbox').map(i => i.id).sort()).toEqual(['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'R1']);
    expect(by('waiting').filter(i => /^W/.test(i.id))).toHaveLength(7);
    expect(S.items.filter(i => i.owner === 'ai' && i.del && i.kind === 'action').filter(i => /^X/.test(i.id))).toHaveLength(5);
    expect(by('someday').filter(i => /^S/.test(i.id))).toHaveLength(3);
    expect(by('reference').filter(i => /^R/.test(i.id))).toHaveLength(2);      // R1 is in the inbox as today's tickler
    expect(by('trash').filter(i => /^T/.test(i.id))).toHaveLength(1);
    expect(by('done').filter(i => /^D/.test(i.id))).toHaveLength(5);
    expect(by('action').filter(i => /^A/.test(i.id))).toHaveLength(14);
  });
  it('reproduces the named items field for field', () => {
    expect(find('I1')).toMatchObject({ kind: 'inbox', source: 'email', from: 'marcus', p: { kind: 'action', next: 'Send reconciliation variance summary to Marcus', project: 'J3', ctx: '@deep', min: 45, conf: .91 } });
    expect(find('I1').p.due).toBeInstanceOf(Date); expect(find('I1').p.ai.cap).toBe('draft');
    expect(find('I2').p).toMatchObject({ kind: 'waiting', owner: 'priya' }); expect(find('I2').p.followUp).toBeInstanceOf(Date);
    expect(find('A2')).toMatchObject({ kind: 'action', project: 'J3', ctx: '@deep', min: 45, ai: { cap: 'draft' } }); expect(days(find('A2').createdAt)).toBe(5); expect(days(find('A2').due)).toBe(-2);
    expect(find('A9')).toMatchObject({ energy: 'high', ctx: '@meeting/steering' }); expect(days(find('A9').hard)).toBe(-3);
    expect(find('A13').repeat).toBe('weekly'); expect(days(find('A14').start)).toBe(-5);
    const w1 = find('W1'); expect(w1).toMatchObject({ kind: 'waiting', owner: 'sam', project: 'J7', nudges: 2 }); expect(days(w1.since)).toBe(23); expect(days(w1.followUp)).toBe(3); expect(days(w1.lastNudged)).toBe(10);
    const w2 = find('W2'); expect(w2.nudges).toBe(0); expect(days(w2.followUp)).toBe(-2);
    expect(find('X1')).toMatchObject({ owner: 'ai', cap: 'data', del: { status: 'ready', minutes: 25, effect: 'Updates 2 rows in the vendor scorecard' } }); expect(find('X1').del.deliverable).toMatch(/Northstar/);
    expect(find('X4').del).toMatchObject({ status: 'working', progress: .6 }); expect(find('X5').del.status).toBe('queued');
    expect(find('S1')).toMatchObject({ kind: 'someday' }); expect(days(find('S1').since)).toBe(30); expect(days(find('S1').revisit)).toBe(-30);
    expect(find('S2').revisit).toBeUndefined();
    expect(find('R2')).toMatchObject({ kind: 'reference', refPage: 'P1' }); expect(days(find('R2').filedAt)).toBe(11);
    expect(find('R3').refPage).toBe('priya');
    expect(find('T1')).toMatchObject({ kind: 'trash', source: 'email' }); expect(days(find('T1').trashedAt)).toBe(2);
    expect(days(find('D4').doneAt)).toBe(9);
    /* today's tickler */
    expect(find('R1')).toMatchObject({ kind: 'inbox', source: 'tickler', wasKind: 'reference', refPage: 'P3' }); expect(find('R1').p.project).toBe('P3');
  });
  it('reproduces programs, projects, people and the wiki', () => {
    const p3 = S.programs.find(g => g.id === 'P3'); expect(p3).toMatchObject({ name: 'Vendor consolidation', sponsor: 'ingrid' }); expect(days(p3.created)).toBe(49); expect(p3.retired).toBeNull();
    expect(S.projects.find(j => j.id === 'J7')).toMatchObject({ program: 'P3', health: 'crit', dropped: false }); expect(S.projects.find(j => j.id === 'J7').suggest).toMatch(/Sam/);
    expect(S.people.find(u => u.id === 'sam')).toMatchObject({ name: 'Sam Reyes' }); expect(days(S.people.find(u => u.id === 'sam').lastTouched)).toBe(9); expect(S.people.find(u => u.id === 'leo').agenda).toHaveLength(3);
    const w = S.wiki.P1;
    expect(w.page).toBe('program-billing-migration'); expect(w.health).toBe('warn'); expect(w.status).toMatch(/Dry-run plan approved/); expect(days(w.compiled)).toBe(3);
    expect(w.links[0]).toEqual(['Cutover runbook', 'https://docs.example.internal/billing/cutover-runbook']); expect(w.links.some(l => l[0] === 'Auditor materiality memo (0.1% threshold)')).toBe(true);
    expect(w.milestones).toHaveLength(5); expect(w.milestones[0]).toEqual(['11 Sep', 'Dry-run plan approved', 'done', null]);
    expect(w.decisions).toHaveLength(2); expect(w.decisions[0].projects).toEqual(['J1', 'J3']); expect(w.risks).toHaveLength(3); expect(w.pending).toHaveLength(1);
    expect(S.wiki.P3.risks[0].owner).toBe('sam'); expect(days(S.wiki.P3.compiled)).toBe(9);
    expect(w.words).toBeGreaterThan(1000); expect(Object.keys(w.pages)).toContain('program-billing-migration-decisions');
    expect(S.config.autonomy.delete).toBe('never'); expect(S.config.models.prep.effort).toBe('high'); expect(S.config.progColor).toEqual({});
    expect(S.lastReview).toBeInstanceOf(Date); expect(days(S.lastReview)).toBe(10); expect(S.reviews).toBe(7);   // Fri 4 Sep 15:00
  });
  it('project movement comes from the events', () => {
    const j6 = S.projects.find(j => j.id === 'J6'); expect(days(j6.lastMove)).toBeGreaterThan(7);
    expect(S.projects.filter(j => days(j.lastMove) <= 7).length).toBeGreaterThan(4);
  });
  it('folds thousands of events quickly', () => {
    const big = [...EV, ...EV.map(e => ({ ...e, item: e.item ? e.item + 'x' : undefined }))];
    const t0 = performance.now(); for (let i = 0; i < 5; i++) fold(big); const ms = (performance.now() - t0) / 5;
    expect(ms).toBeLessThan(150);
  });
});
