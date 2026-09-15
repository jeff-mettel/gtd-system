import { describe, it, expect } from 'vitest';
import { rank, score } from '../src/features/match.js';
import { matchCommands } from '../src/features/palette.js';

describe('match — score tiers', () => {
  it('exact > prefix > word prefix > initials > substring > subsequence', () => {
    const t = 'Go to Waiting for';
    const s = ['go to waiting for', 'go to', 'wait', 'gtw', 'ing f', 'gwf'].map(q => score(q, t));
    for (let i = 1; i < s.length; i++) expect(s[i - 1]).toBeGreaterThan(s[i]);
    expect(s.every(x => x >= 0)).toBe(true);
  });
  it('no match → -1; empty query matches everything', () => {
    expect(score('zzz', 'Go to Inbox')).toBe(-1); expect(score('', 'anything')).toBe(0); expect(score('x', '')).toBe(-1);
  });
  it('multi-word prefixes in order ("mo bil" → "Move to Billing")', () => {
    expect(score('mo bil', 'Move to Billing platform')).toBeGreaterThan(score('mo bil', 'Billing move-out review'));
    expect(score('mark d', 'Mark done')).toBeGreaterThan(600);
  });
  it('shorter targets win ties inside a tier', () => {
    expect(score('def', 'Defer until…')).toBeGreaterThan(score('def', 'Defer until the review after next'));
  });
});

describe('match — rank', () => {
  const list = [{ label: 'Go to Inbox' }, { label: 'Go to Waiting for' }, { label: 'Draft nudge' }, { label: 'Mark done' }];
  it('orders by score, drops non-matches, honours the limit', () => {
    expect(rank('go', list).map(x => x.label)).toEqual(['Go to Inbox', 'Go to Waiting for']);
    expect(rank('wait', list).map(x => x.label)).toEqual(['Go to Waiting for']);
    expect(rank('', list, undefined, 2)).toHaveLength(2);
  });
});

describe('palette — matchCommands', () => {
  const cmds = [
    { id: 'go:inbox', label: 'Go to Inbox', group: 'Navigate' },
    { id: 'go:waiting', label: 'Go to Waiting for', group: 'Navigate' },
    { id: 'item:defer', label: 'Defer until…', group: 'This item', param: 'date', verbs: ['defer', 'd'] },
    { id: 'item:move', label: 'Move to project…', group: 'This item', param: 'project', verbs: ['move', 'm'] },
    { id: 'open:1', label: 'Send the variance summary', group: 'Items' },
  ];
  it('a verb and an argument select the parameterized command with the rest of the line', () => {
    expect(matchCommands('defer fri', cmds)).toEqual([{ cmd: cmds[2], arg: 'fri' }]);
    expect(matchCommands('m billing platform', cmds)).toEqual([{ cmd: cmds[3], arg: 'billing platform' }]);
  });
  it('an empty query lists recents first and leaves items out', () => {
    const r = matchCommands('', cmds, ['item:move', 'go:waiting']);
    expect(r.slice(0, 2).map(x => x.cmd.id)).toEqual(['item:move', 'go:waiting']);
    expect(r.some(x => x.cmd.group === 'Items')).toBe(false);
  });
  it('a plain query ranks everything, recents on top when they match', () => {
    expect(matchCommands('go', cmds, ['go:waiting'])[0].cmd.id).toBe('go:waiting');
    expect(matchCommands('variance', cmds)[0].cmd.id).toBe('open:1');
    expect(matchCommands('zzzz', cmds)).toEqual([]);
  });
});
