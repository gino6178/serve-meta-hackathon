// Where to play, how full it usually is, and what it costs once the venue's agent has been asked. A court that stands
// empty at 14:00 on a Thursday earns its venue nothing, so a venue would rather sell it cheap than not at all; a group
// that can play then should hear about it, and a public court has quiet hours too.
//   Places: courts and sports centres around a point, from OpenStreetMap (club/places.js nearby). A sports centre is a
//   venue you pay for, with an agent that talks price; a pitch or court is public and free.
//   How full: a typical week for the kind of place (weekday evenings and weekend mornings are the busy hours), a little
//   different for each place, plus the games already arranged on Serve at that place and hour. It is an estimate, and
//   the app says so.
//   Price: a venue's list price for a court is a sample (no venue has joined Serve yet, and the app says so); its agent
//   follows a rule a real venue would set: it never goes below a floor that rises with how full the hour usually is
//   (60% of list for an empty hour, the full list once it is 85% full), and it knocks a little more off for a group
//   that books the same hour every week. The group's agent opens low, both sides move toward each other, and the deal
//   is the first offer the venue's rule accepts. Code does all of it; nothing is booked or paid here.
import { nearby, cachedNear } from "../club/places.js";
import { km, dateOf, ymd, DAYS } from "./taste.js";

export const CURRENCY = "NT$";
// a court for an hour, by sport (sample prices, a little different at each venue)
const LIST = { badminton: 300, tennis: 450, pickleball: 280, "table tennis": 200, basketball: 800, volleyball: 700, squash: 350, soccer: 1500 };
const PER_COURT = { badminton: 4, tennis: 4, pickleball: 4, "table tennis": 4, basketball: 10, volleyball: 12, squash: 2, soccer: 14 };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const round10 = (x) => Math.round(x / 10) * 10;
const hourOf = (start) => +String(start).slice(0, 2) + (+String(start).slice(3, 5) || 0) / 60;

// the places for a sport around a point: up to `venues` sports centres and `courts` public courts, nearest first.
// OpenStreetMap can take most of a minute when it is busy, so a lookup runs once per area and sport and is shared; with
// wait false the caller gets [] at once (and { loading } from loading()) while it runs, and the answer next time.
const pending = new Map(), got = new Map();
const areaKey = (at, sport) => `${(+at.lat).toFixed(2)},${(+at.lon).toFixed(2)},${sport}`;
export const loading = (at, sport) => !!at && pending.has(areaKey(at, sport));
export async function placesNear(at, sport = "badminton", { venues = 3, courts = 3, radius = 4000, wait = true } = {}) {
  if (!at) return [];
  let key = areaKey(at, sport);
  // an area already looked up within 2.5 km covers this one too (the search reaches 4 km): no new wait on the map
  if (!got.has(key)) for (const k of got.keys()) { const [la, lo, sp] = k.split(","); if (sp === sport && km({ lat: +la, lon: +lo }, at) < 2.5) { key = k; break; } }
  if (!got.has(key)) { const c = cachedNear(at, sport, 2.5); if (c) got.set(key, c); }
  if (!got.has(key) && !pending.has(key)) {
    // the area rounded to about 1 km, so nearby members share the cached answer
    const job = nearby({ lat: +(+at.lat).toFixed(2), lon: +(+at.lon).toFixed(2), sport, radius, wait: 60000 }).catch(() => null)
      .then((found) => { pending.delete(key); if (found) got.set(key, found); return found || []; });
    pending.set(key, job);
  }
  const found = got.get(key) || (wait ? await pending.get(key) : []);
  // one of each place: the same name, or two entries under 150 m apart (a hall mapped twice, a park as several pitches)
  const one = (list) => list.filter((p, i) => list.findIndex((q) => q.name === p.name || km(q, p) < 0.15) === i);
  const v = one(found.filter((p) => p.kind === "sports_centre")).slice(0, venues), c = one(found.filter((p) => p.kind !== "sports_centre")).slice(0, courts);
  return [...v, ...c].map((p) => {
    const venue = p.kind === "sports_centre";
    return { id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: venue ? "venue" : "public", sport, ...(venue ? { list: round10((LIST[sport] || 300) * (0.85 + 0.3 * hash(p.id))), sample: true } : {}) };
  });
}

// how full a place usually is at a time, 0..1: the kind of place's typical week, this place's own lean, and the games
// on Serve already there then (games: [{ at: {lat, lon}, day, start }])
export function busy(place, date, start, games = []) {
  const d = dateOf(date), wk = d.getDay() === 0 || d.getDay() === 6, h = hourOf(start);
  let b;
  if (wk) b = h < 8 ? 0.3 : h < 12 ? 0.8 : h < 17 ? 0.6 : h < 21 ? 0.5 : 0.25;
  else b = h < 7 ? 0.25 : h < 9 ? 0.45 : h < 12 ? 0.2 : h < 14 ? 0.4 : h < 17 ? 0.2 : h < 21 ? 0.85 : 0.5;
  if (place.kind === "public") b = wk ? b : h >= 16 && h < 20 ? b : b * 0.8; // public courts fill after school and work
  b += (hash(`${place.id}|${DAYS[d.getDay()]}|${Math.floor(h)}`) - 0.5) * 0.2;
  const here = games.filter((g) => g.at && km(g.at, place) < 0.2 && (g.day === date || g.day === DAYS[d.getDay()]) && Math.abs(hourOf(g.start) - h) < 1.5).length;
  return Math.max(0.05, Math.min(0.98, b + 0.15 * here));
}
// the quietest hours at a place over the next days, for the member to see
export function quietest(place, { days = 7, now = new Date(), games = [], starts = ["07:00", "09:00", "12:00", "14:00", "17:00", "19:00", "21:00"], n = 3 } = {}) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i); const date = ymd(d);
    for (const s of starts) { if (i === 0 && hourOf(s) <= now.getHours() + 1) continue; out.push({ date, start: s, busy: +busy(place, date, s, games).toFixed(2) }); }
  }
  const grid = out;
  return { quiet: [...out].sort((a, b) => a.busy - b.busy).slice(0, n), grid };
}

// the venue's floor and opening price for a court at a time, before talking
export function terms(place, date, start, { minutes = 90, weekly = false, games = [] } = {}) {
  const list = round10(place.list * (minutes / 60)), b = busy(place, date, start, games);
  const floor = b >= 0.85 ? list : round10(list * (0.6 + 0.4 * Math.min(1, b / 0.85)) * (weekly ? 0.92 : 1));
  return { list, busy: b, floor: Math.min(list, floor) };
}
// a quick estimate of the price per person a group would end up paying (for ranking options before anyone talks)
export function guessEach(place, date, start, players, opts = {}) {
  if (place.kind !== "venue") return 0;
  const t = terms(place, date, start, opts), courts = Math.max(1, Math.ceil(players / (PER_COURT[place.sport] || 4)));
  return ((t.floor + t.list) / 2 * courts) / players;
}

// the talk: the group's agent and the venue's agent, in turns, until the venue's rule accepts or three rounds pass.
// push 0..1 is how hard the group's agent pushes (how much the group cares about price).
export function talk(place, { date, start, players = 4, minutes = 90, weekly = false, push = 0.5, games = [], group = "Your group" } = {}) {
  if (place.kind !== "venue") return { free: true, price: 0, each: 0, lines: [] };
  const courts = Math.max(1, Math.ceil(players / (PER_COURT[place.sport] || 4)));
  const t = terms(place, date, start, { minutes, weekly, games }), list = t.list * courts, floor = t.floor * courts;
  const d = dateOf(date), when = `${DAYS[d.getDay()]} ${start}`, end = (() => { const m = hourOf(start) * 60 + minutes; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`; })();
  const pct = Math.round(t.busy * 100), lines = [], C = CURRENCY;
  const us = group === "Your" ? "Your agent" : `${group}'s agent`, them = `${place.name}'s agent`;
  const ask = `${players} players, ${courts > 1 ? `${courts} courts` : "a court"}, ${when}–${end}${weekly ? ", the same time every week" : ""}.`;
  if (t.busy >= 0.85) {
    lines.push({ from: us, text: `${ask} What's your best price?` });
    lines.push({ from: them, text: `That hour is usually ${pct}% full, so it's the list price: ${C}${list}.` });
    return { price: list, each: Math.ceil(list / players), list, off: 0, busy: t.busy, courts, lines, sample: true };
  }
  let ours = round10(list * (0.62 - 0.12 * push + 0.15 * t.busy)), theirs = round10(list * (0.9 + 0.08 * t.busy));
  lines.push({ from: us, text: `${ask} It's usually ${t.busy < 0.5 ? "only " : ""}${pct}% full then. Would you take ${C}${ours}?` });
  for (let r = 0; r < 3; r++) {
    if (ours >= floor) { lines.push({ from: them, text: `Deal at ${C}${ours}.` }); return done(ours); }
    theirs = Math.max(floor, round10(theirs - (theirs - ours) * 0.4));
    const low = theirs === floor ? `, and that's as low as I go for that hour` : "";
    lines.push({ from: them, text: r === 0 ? `List is ${C}${list} for ${minutes} minutes. ${t.busy < 0.5 ? "For a quiet hour" : "For that hour"} I can do ${C}${theirs}${low}.` : `${C}${theirs}${low}.` });
    if (theirs === floor || r === 2) { lines.push({ from: us, text: `${C}${theirs} it is.` }); return done(theirs); }
    ours = round10(ours + (theirs - ours) * (0.35 + 0.3 * (1 - push)));
    lines.push({ from: us, text: `Meet us at ${C}${ours}?` });
  }
  return done(theirs);
  function done(price) { return { price, each: Math.ceil(price / players), list, off: Math.round((1 - price / list) * 100), busy: t.busy, courts, lines, sample: true }; }
}
