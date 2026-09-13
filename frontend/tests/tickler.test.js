import { describe, it, expect, beforeEach } from 'vitest';
import { items } from '../src/data/example.js';
import { d } from '../src/lib/dates.js';
import { resurfaceDue, state } from '../src/state.js';

const find = (id) => items.find(i => i.id === id);

describe('resurfaceDue', () => {
  beforeEach(() => { state.resurfaced = {}; state.kinds = {}; });

  it('brings a due reference tickler back into the inbox and remembers which date did it', () => {
    const r1 = find('R1'); r1.kind = 'reference'; delete r1.wasKind;
    resurfaceDue();
    expect(r1.kind).toBe('inbox'); expect(r1.wasKind).toBe('reference'); expect(r1.source).toBe('tickler');
    expect(r1.tickledFor).toBe(new Date(r1.revisit).toDateString());
    expect(r1.p.project).toBe('P3');
  });

  it('is idempotent and leaves future ticklers alone', () => {
    resurfaceDue(); const before = items.filter(i => i.kind === 'inbox').length;
    resurfaceDue(); expect(items.filter(i => i.kind === 'inbox').length).toBe(before);
    expect(find('S1').kind).toBe('someday'); expect(find('S3').kind).toBe('someday');
  });

  it('does not fire twice for the same revisit date, but does for a new one', () => {
    const s2 = find('S2'); s2.kind = 'someday'; s2.revisit = d(-1);
    state.resurfaced['S2:' + d(-1).toDateString()] = true;
    resurfaceDue(); expect(s2.kind).toBe('someday');
    s2.revisit = d(0); resurfaceDue(); expect(s2.kind).toBe('inbox'); expect(s2.tickledFor).toBe(d(0).toDateString());
    delete s2.revisit; s2.kind = 'someday'; delete s2.wasKind;
  });

  it('resurfaces items that were once accepted through the inbox (state.kinds set)', () => {
    const s3 = find('S3'); s3.kind = 'someday'; s3.revisit = d(-2); state.kinds.S3 = 'someday';
    resurfaceDue(); expect(s3.kind).toBe('inbox');
    s3.kind = 'someday'; s3.revisit = d(12); delete s3.wasKind;
  });
});
