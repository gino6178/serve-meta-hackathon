// A member's existing calendar (an .ics file, iCalendar) read into their weekly free times, in the club's format
// ("Thu 19-22") and as time limits (taste.js windows). Code only, no model.
//   Read: each VEVENT's DTSTART, DTEND or DURATION (UTC, a TZID, floating, or an all-day date), RRULE (WEEKLY and
//   DAILY: INTERVAL, BYDAY, COUNT, UNTIL; other rules count once), EXDATE, TRANSP and STATUS. Nothing else in the file is read: titles,
//   descriptions, places and attendees are never parsed, kept or sent back; only busy times leave this module.
//   Then: over the next `weeks` weeks (4 by default) in the member's time zone, an hour of a weekday is busy when an event
//   covers any of it in more than a quarter of those weeks (a one-off in a month leaves the weekly time free); the free
//   hours inside the playing day (07:00 to 22:00) in runs of two hours or more are the free times.
//   An all-day event is a busy day; a transparent ("free") or cancelled one is no event.
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
export const MAX_BYTES = 1e6, MAX_EVENTS = 3000, MAX_OCC = 20000;
const pad = (n) => String(n).padStart(2, "0");
const KEEP = new Set(["BEGIN", "END", "DTSTART", "DTEND", "DURATION", "RRULE", "EXDATE", "TRANSP", "STATUS"]);

// the zone's offset from UTC at an instant, in ms (Intl; an unknown zone is UTC)
const fmts = new Map();
const fmt = (tz) => { if (!fmts.has(tz)) { let f; try { f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { f = null; } fmts.set(tz, f); } return fmts.get(tz); };
export const validZone = (tz) => !!tz && !!fmt(tz);
export function wallOf(ms, tz) {
  const f = fmt(tz); if (!f) { const d = new Date(ms); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, +x.value || 0]));
  return { y: p.year, mo: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}
const offset = (ms, tz) => { const w = wallOf(ms, tz); return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000; };
// a wall-clock time in a zone, as an instant (DST gaps move forward, as calendars do)
export function instant(w, tz) {
  const guess = Date.UTC(w.y, w.mo - 1, w.d, w.h || 0, w.mi || 0, w.s || 0);
  const t1 = guess - offset(guess, tz);
  return guess - offset(t1, tz);
}
const addDays = (w, n) => { const d = new Date(Date.UTC(w.y, w.mo - 1, w.d + n)); return { ...w, y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const dowOf = (w) => new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
const dayNum = (w) => Math.floor(Date.UTC(w.y, w.mo - 1, w.d) / 864e5);

// unfolded content lines, only the properties above: { name, params, value }
function lines(text) {
  const out = [];
  for (const raw of String(text).replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n")) {
    const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(raw);
    if (!m) continue;
    const name = m[1].toUpperCase();
    if (!KEEP.has(name)) continue; // SUMMARY, DESCRIPTION, LOCATION, ATTENDEE...: never read
    const params = {};
    for (const p of m[2].split(";").slice(1)) { const [k, v = ""] = p.split("="); params[k.toUpperCase()] = v.replace(/^"|"$/g, ""); }
    out.push({ name, params, value: m[3].trim() });
  }
  return out;
}
// a DTSTART-like value: { allDay, wall, zone } (zone null: UTC instant in wall; "floating": the member's zone)
function when(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!m) return null;
  const wall = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  if (!m[4] || params.VALUE === "DATE") return { allDay: true, wall };
  return { allDay: false, wall, zone: m[7] ? "UTC" : params.TZID && validZone(params.TZID) ? params.TZID : "floating" };
}
const DUR = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
const durMs = (v) => { const m = DUR.exec(v); return m ? (m[1] === "-" ? -1 : 1) * ((+m[2] || 0) * 6048e5 + (+m[3] || 0) * 864e5 + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3) : null; };

// the events, with only their times: [{ start, end?, dur?, rrule, exdates }]
export function parse(text) {
  if (typeof text !== "string" || !/BEGIN:VCALENDAR/i.test(text)) return { error: "That isn't an iCalendar (.ics) file." };
  if (text.length > MAX_BYTES) return { error: "The calendar is too big (1 MB at most)." };
  const events = []; let ev = null, depth = 0;
  for (const l of lines(text)) {
    if (l.name === "BEGIN") { if (l.value.toUpperCase() === "VEVENT") { ev = { exdates: [] }; depth = 0; } else if (ev) depth++; continue; }
    if (l.name === "END") { if (ev && depth) { depth--; continue; } if (ev && l.value.toUpperCase() === "VEVENT") { if (ev.start && ev.status !== "CANCELLED" && ev.transp !== "TRANSPARENT") events.push(ev); ev = null; if (events.length > MAX_EVENTS) return { error: `More than ${MAX_EVENTS} events: export a shorter range.` }; } continue; }
    if (!ev || depth) continue; // (an alarm inside an event is not the event)
    if (l.name === "DTSTART") ev.start = when(l.value, l.params);
    else if (l.name === "DTEND") ev.end = when(l.value, l.params);
    else if (l.name === "DURATION") ev.dur = durMs(l.value);
    else if (l.name === "RRULE") ev.rrule = Object.fromEntries(l.value.split(";").map((x) => x.split("=")).map(([k, v]) => [k.toUpperCase(), v]));
    else if (l.name === "EXDATE") for (const v of l.value.split(",")) { const w = when(v.trim(), l.params); if (w) ev.exdates.push(w); }
    else if (l.name === "TRANSP") ev.transp = l.value.toUpperCase();
    else if (l.name === "STATUS") ev.status = l.value.toUpperCase();
  }
  return { events };
}

// one event's busy intervals [startMs, endMs) up to `until`, in instants; all-day ones from the member's midnight
function occurrences(ev, tz, until) {
  const zone = ev.start.allDay || ev.start.zone === "floating" ? tz : ev.start.zone;
  const at = (w) => instant(w, zone);
  const t0 = at(ev.start.wall);
  let len;
  if (ev.end) len = (ev.end.allDay ? instant(ev.end.wall, tz) : instant(ev.end.wall, ev.end.zone === "floating" ? tz : ev.end.zone)) - t0;
  else if (ev.dur != null) len = ev.dur;
  else len = ev.start.allDay ? 864e5 : 0;
  if (!(len > 0)) return [];
  // (an all-day EXDATE is a day number, a timed one an instant: they never collide)
  const ex = new Set(ev.exdates.map((w) => (w.allDay ? dayNum(w.wall) : instant(w.wall, w.zone === "floating" ? zone : w.zone))));
  const isEx = (w, t) => ex.has(t) || ex.has(dayNum(w));
  const out = [], r = ev.rrule;
  if (!r || !["WEEKLY", "DAILY"].includes(r.FREQ)) return [[t0, t0 + len]]; // other rules: the first time only
  const interval = Math.max(1, +r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
  const untilR = r.UNTIL ? (() => { const u = when(r.UNTIL, {}); return u ? (u.allDay ? instant(addDays(u.wall, 1), zone) - 1 : instant(u.wall, u.zone === "floating" ? zone : u.zone)) : Infinity; })() : Infinity;
  let n = 0;
  const take = (w) => { const t = at(w); if (t > untilR || t > until || n >= count) return false; n++; if (!isEx(w, t)) out.push([t, t + len]); return out.length < MAX_OCC; };
  const by = r.BYDAY ? r.BYDAY.split(",").map((x) => BYDAY[x.replace(/^[+-]?\d+/, "").toUpperCase()]).filter((x) => x != null) : null;
  if (r.FREQ === "DAILY") { for (let i = 0; ; i += interval) { const d = addDays(ev.start.wall, i); if (by && !by.includes(dowOf(d))) { if (at(d) > until) break; continue; } if (!take(d)) break; } return out; }
  const days = by || [dowOf(ev.start.wall)];
  const wk = BYDAY[(r.WKST || "MO").toUpperCase()] ?? 1, s0 = dowOf(ev.start.wall), weekStart = addDays(ev.start.wall, -((s0 - wk + 7) % 7));
  const order = [...new Set(days)].sort((a, b) => ((a - wk + 7) % 7) - ((b - wk + 7) % 7));
  for (let w = 0; ; w += interval) {
    let go = true;
    for (const d of order) {
      const day = addDays(weekStart, w * 7 + ((d - wk + 7) % 7));
      if (dayNum(day) < dayNum(ev.start.wall)) continue;
      if (!take(day)) { go = false; break; }
    }
    if (!go || at(addDays(weekStart, w * 7)) > until) break;
  }
  return out;
}

// the busy intervals over the next weeks, and the free times they leave
// opts: { tz, weeks, from (ms, default now), day: [fromHour, toHour], min (hours), share }
export function freeFrom(text, { tz = "UTC", weeks = 4, from = Date.now(), day = [7, 22], min = 2, share = 0.25 } = {}) {
  if (!validZone(tz)) return { error: `Unknown time zone: ${String(tz).slice(0, 40)}.` };
  weeks = Math.max(1, Math.min(12, Math.round(+weeks) || 4));
  const p = parse(text);
  if (p.error) return p;
  const start = addDays({ ...wallOf(from, tz), h: 0, mi: 0, s: 0 }, 1), end = addDays(start, weeks * 7), t0 = instant(start, tz), t1 = instant(end, tz);
  const busy = [];
  for (const ev of p.events) for (const iv of occurrences(ev, tz, t1)) if (iv[1] > t0 && iv[0] < t1) busy.push(iv);
  busy.sort((a, b) => a[0] - b[0]);
  // busy[weekday][hour]: in how many of the weeks some event covered that hour
  const hits = DAYS.map(() => Array(24).fill(0));
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), dow = dowOf(d);
    for (let h = day[0]; h < day[1]; h++) {
      const a = instant({ ...d, h, mi: 0, s: 0 }, tz), b = instant({ ...d, h: h + 1, mi: 0, s: 0 }, tz);
      if (busy.some(([x, y]) => x < b && y > a)) hits[dow][h]++;
    }
  }
  const free = [], runs = [];
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    let run = null;
    for (let h = day[0]; h <= day[1]; h++) {
      const ok = h < day[1] && hits[dow][h] <= weeks * share;
      if (ok && run == null) run = h;
      if (!ok && run != null) { if (h - run >= min) { free.push(`${DAYS[dow]} ${pad(run)}-${pad(h)}`); runs.push({ day: DAYS[dow], from: `${pad(run)}:00`, to: `${pad(h)}:00` }); } run = null; }
    }
  }
  // the same hours on several days are one window (taste.js keeps 14 at most)
  const by = new Map();
  for (const r of runs) { const k = `${r.from}-${r.to}`; if (!by.has(k)) by.set(k, { days: [], from: r.from, to: r.to }); by.get(k).days.push(r.day); }
  const windows = [...by.values()].sort((a, b) => b.days.length - a.days.length).slice(0, 14);
  return { free, windows, events: p.events.length, busyBlocks: busy.length, weeks, tz, from: `${start.y}-${pad(start.mo)}-${pad(start.d)}`, hours: { from: day[0], to: day[1] } };
}
