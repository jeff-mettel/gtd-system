import { describe, it, expect } from 'vitest';
import { parseFuzzy } from '../src/lib/fuzzydate.js';

const BASE = new Date('2026-09-14T08:00:00');          // Monday
const ymd = (x) => x && `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const p = (s) => ymd(parseFuzzy(s, BASE));

describe('parseFuzzy', () => {
  it('relative words', () => {
    expect(p('today')).toBe('2026-09-14');
    expect(p('Tomorrow')).toBe('2026-09-15');
    expect(p('yesterday')).toBe('2026-09-13');
  });
  it('weekdays are the coming occurrence; next = one week later', () => {
    expect(p('fri')).toBe('2026-09-18');
    expect(p('Friday')).toBe('2026-09-18');
    expect(p('mon')).toBe('2026-09-21');                 // same weekday → next one, never today
    expect(p('next fri')).toBe('2026-09-25');
    expect(p('next week')).toBe('2026-09-21');
    expect(p('next month')).toBe('2026-10-01');
  });
  it('offsets', () => {
    expect(p('in 3 days')).toBe('2026-09-17');
    expect(p('in 2 weeks')).toBe('2026-09-28');
    expect(p('in 1 month')).toBe('2026-10-14');
    expect(p('3d')).toBe('2026-09-17');
    expect(p('2w')).toBe('2026-09-28');
    expect(p('1m')).toBe('2026-10-14');
    expect(p('t+3')).toBe('2026-09-17');
    expect(p('+10')).toBe('2026-09-24');
  });
  it('period ends', () => {
    expect(p('eom')).toBe('2026-09-30');
    expect(p('eoq')).toBe('2026-09-30');
    expect(ymd(parseFuzzy('eoq', new Date('2026-10-02T08:00:00')))).toBe('2026-12-31');
  });
  it('explicit dates', () => {
    expect(p('2026-09-20')).toBe('2026-09-20');
    expect(p('9/20')).toBe('2026-09-20');
    expect(p('20 sep')).toBe('2026-09-20');
    expect(p('Sep 20')).toBe('2026-09-20');
    expect(p('sept 20th')).toBe('2026-09-20');
    expect(p('1 jan')).toBe('2027-01-01');               // already passed this year → next year
    expect(p('3/1/2027')).toBe('2027-03-01');
  });
  it('returns 08:00 local and null for junk', () => {
    const x = parseFuzzy('fri', BASE);
    expect(x.getHours()).toBe(8); expect(x.getMinutes()).toBe(0);
    expect(parseFuzzy('', BASE)).toBeNull();
    expect(parseFuzzy('whenever', BASE)).toBeNull();
    expect(parseFuzzy('31 feb', BASE)).toBeNull();
  });
});
