import { describe, it, expect } from 'vitest';
import { estimateToken, isQuestion, parseCapture, trailingDate } from '../src/features/captureParse.js';

const today = new Date('2026-09-14T08:00:00');       // Monday
const iso = (d) => d && d.toISOString().slice(0, 10);

/* A stand-in for autocomplete.parseMentions over a tiny directory. */
const dir = [['@Billing', { id: 'J3', type: 'project' }], ['@Alpha', { id: 'P1', type: 'program' }], ['@Sam Reyes', { id: 'sam', type: 'person' }], ['@Sam', { id: 'sam', type: 'person' }]];
const mentions = (text) => {
  const spans = [], ids = []; let project = null, owner = null;
  for (const [name, e] of dir) { const i = text.indexOf(name); if (i >= 0 && !spans.some(s => s.id === e.id)) { spans.push({ text: name, id: e.id, type: e.type }); ids.push(e.id); if (e.type !== 'person' && (!project || e.type === 'project')) project = e.id; if (e.type === 'person') owner = e.id; } }
  return { ids, project, owner, spans };
};

describe('capture grammar — tokens', () => {
  it('estimates: ~20m, ~1h, ~1.5h, ~90min', () => {
    expect(estimateToken('~20m')).toBe(20); expect(estimateToken('~1h')).toBe(60); expect(estimateToken('~1.5h')).toBe(90); expect(estimateToken('~90min')).toBe(90); expect(estimateToken('~x')).toBeNull(); expect(estimateToken('20m')).toBeNull();
  });
  it('trailing date: one token at the end, an optional lead word, never the whole text', () => {
    expect(iso(trailingDate('send the report fri', today).date)).toBe('2026-09-18');
    expect(trailingDate('send the report by fri', today).from).toBe(3);
    expect(iso(trailingDate('call the vendor next week', today).date)).toBe('2026-09-21');
    expect(iso(trailingDate('renew the cert 20 sep', today).date)).toBe('2026-09-20');
    expect(iso(trailingDate('ping legal +3', today).date)).toBe('2026-09-17');
    expect(trailingDate('fri', today)).toBeNull();
  });
  it('does not read a name or a plain word as a date', () => {
    expect(trailingDate('Call Tom', today)).toBeNull();
    expect(trailingDate('do it now', today)).toBeNull();
    expect(trailingDate('book the room in may', today)).toBeNull();
  });
  it('questions', () => {
    expect(isQuestion('Should we move the launch?')).toBe(true); expect(isQuestion('what is the budget')).toBe(true); expect(isQuestion('Send the report')).toBe(false);
  });
});

describe('capture grammar — parseCapture', () => {
  it('@Billing fri ~20m files as an action with due Friday and 20 min', () => {
    const p = parseCapture('Fix the export @Billing fri ~20m', { today, mentions });
    expect(p.next).toBe('Fix the export'); expect(p.mentions.project).toBe('J3'); expect(iso(p.due)).toBe('2026-09-18'); expect(p.min).toBe(20); expect(p.hard).toBeNull(); expect(p.filed).toBe(true);
  });
  it('! pins to today, standalone or trailing', () => {
    expect(iso(parseCapture('Chase the vendor quote !', { today }).hard)).toBe('2026-09-14');
    const p = parseCapture('Chase the vendor quote! @Alpha', { today, mentions }); expect(iso(p.hard)).toBe('2026-09-14'); expect(p.next).toBe('Chase the vendor quote'); expect(p.filed).toBe(true);
  });
  it('people keep their name in the sentence; a person alone does not file', () => {
    const p = parseCapture('Draft the agenda with @Sam next week', { today, mentions });
    expect(p.next).toBe('Draft the agenda with Sam'); expect(p.mentions.owner).toBe('sam'); expect(iso(p.due)).toBe('2026-09-21'); expect(p.filed).toBe(false);
  });
  it('a question never files straight to a list, even with a project', () => {
    const p = parseCapture('Should we move the launch? @Alpha', { today, mentions });
    expect(p.question).toBe(true); expect(p.filed).toBe(false); expect(p.mentions.project).toBe('P1');
  });
  it('no @ → inbox, wording kept; leading "remember to" dropped', () => {
    const p = parseCapture('remember to renew the domain 20 sep', { today, mentions });
    expect(p.next).toBe('renew the domain'); expect(iso(p.due)).toBe('2026-09-20'); expect(p.filed).toBe(false); expect(p.mentions.ids).toEqual([]);
  });
  it('a bare date or an empty string never swallows the whole text', () => {
    expect(parseCapture('fri', { today }).next).toBe('fri'); expect(parseCapture('', { today }).next).toBe('');
  });
});
