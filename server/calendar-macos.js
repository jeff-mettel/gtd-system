#!/usr/bin/env node
// Read events from macOS Calendar (the Google account synced there) via JXA — zero OAuth.
// Window: [-7 days, +14 days] by default. Normalised shape:
//   { id, title, start, end, attendees:[{ name, email }], calendar }
// Usage as a module: readCalendar({ calendars:[...names], from, to }) → Promise<events>
// Usage as a script: node server/calendar-macos.js [--calendars "Work,Jeff"] [--days-back 7] [--days-ahead 14]
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DAY = 864e5;

// Runs inside osascript. Calendar's `whose` filters are the only way to avoid pulling every event
// of every calendar (which takes minutes on a big Google account). Arguments arrive JSON-encoded.
const JXA = `
function run(argv) {
  const arg = JSON.parse(argv[0]);
  const from = new Date(arg.from), to = new Date(arg.to);
  const Cal = Application('Calendar');
  const out = [];
  const wanted = arg.calendars && arg.calendars.length ? arg.calendars : null;
  for (const cal of Cal.calendars()) {
    let name; try { name = cal.name(); } catch (e) { continue; }
    if (wanted && wanted.indexOf(name) < 0) continue;
    let evs;
    try { evs = cal.events.whose({ _and: [{ startDate: { _greaterThanEquals: from } }, { startDate: { _lessThan: to } }] })(); }
    catch (e) { continue; }
    for (const ev of evs) {
      let att = [];
      try { att = ev.attendees().map(a => { let n = null, m = null; try { n = a.displayName(); } catch (e) {} try { m = a.email(); } catch (e) {} return { name: n, email: m }; }); } catch (e) {}
      let id = null; try { id = ev.uid(); } catch (e) {}
      let loc = null; try { loc = ev.location(); } catch (e) {}
      out.push({ id: id, title: ev.summary(), start: ev.startDate().toISOString(), end: ev.endDate().toISOString(), attendees: att, calendar: name, location: loc, allDay: (function(){ try { return ev.alldayEvent(); } catch (e) { return false; } })() });
    }
  }
  return JSON.stringify(out);
}`;

/** Read the window from macOS Calendar. Rejects with a readable message if Calendar access is denied or the app is absent. */
export function readCalendar({ calendars = [], from, to, daysBack = 7, daysAhead = 14 } = {}) {
  const now = Date.now();
  const f = from ? new Date(from) : new Date(now - daysBack * DAY);
  const t = to ? new Date(to) : new Date(now + daysAhead * DAY);
  const arg = JSON.stringify({ calendars, from: f.toISOString(), to: t.toISOString() });
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', JXA, arg], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').trim();
        if (/not allowed|not permitted|-1743|assistive|Automation/i.test(msg)) return reject(new Error(`macOS refused Calendar access: ${msg}. Grant it in System Settings → Privacy & Security → Automation (the process running the server → Calendar) and retry.`));
        return reject(new Error(`osascript failed: ${msg}`));
      }
      let events;
      try { events = JSON.parse(stdout.trim() || '[]'); } catch (e) { return reject(new Error(`could not parse Calendar output: ${e.message}`)); }
      events.sort((a, b) => a.start.localeCompare(b.start));
      resolve({ window: { from: f.toISOString(), to: t.toISOString() }, events });
    });
  });
}

/** Match attendees to People by email (exact, case-insensitive) or full name; returns person ids for `who`. */
export function matchAttendees(attendees, people) {
  const list = people instanceof Map ? [...people.values()] : Object.values(people || {});
  const byEmail = new Map(), byName = new Map();
  for (const p of list) {
    const emails = [].concat(p.channels?.email || [], p.email || []);
    for (const e of emails) if (e) byEmail.set(String(e).toLowerCase(), p.id);
    if (p.name) byName.set(String(p.name).toLowerCase(), p.id);
  }
  const who = [];
  for (const a of attendees || []) {
    const id = (a.email && byEmail.get(a.email.toLowerCase())) || (a.name && byName.get(a.name.toLowerCase()));
    if (id && !who.includes(id)) who.push(id);
  }
  return who;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  readCalendar({ calendars: (opt('--calendars', '') || '').split(',').map(s => s.trim()).filter(Boolean), daysBack: +opt('--days-back', 7), daysAhead: +opt('--days-ahead', 14) })
    .then(r => { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); })
    .catch(err => { console.error(err.message); process.exit(1); });
}
