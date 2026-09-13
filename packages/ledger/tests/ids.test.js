import { describe, it, expect } from 'vitest';
import { newId, now } from '../index.js';

describe('ids', () => {
  it('are prefixed, unique and time-sortable', () => {
    const a = newId('i'), b = newId('i');
    expect(a).toMatch(/^i_[0-9A-HJKMNP-TV-Z]{18}$/); expect(a).not.toBe(b);
    const many = new Set(Array.from({ length: 5000 }, () => newId('e'))); expect(many.size).toBe(5000);
    const t0 = Date.now(); const first = newId('e'); while (Date.now() - t0 < 3) { /* wait a few ms */ } const later = newId('e');
    expect(later > first).toBe(true);
  });
  it('now() is an ISO timestamp', () => {
    expect(Number.isNaN(Date.parse(now()))).toBe(false);
  });
});
