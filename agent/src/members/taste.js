// How each member likes to play, learned from a few answers. Everyone weighs a game differently: one person cares
// about the time, another about how far the court is, another about the price or about a quiet court. The member's
// agent keeps four weights for that (time, place, price, quiet), which times of the week suit them, how far they will
// go and what they will pay, and learns all of it from what they say:
//   - a quick question: two real-looking games that pull different ways ("your usual time, 6 km away" or "an odd time,
//     1 km away"); the pick moves the weights the way a Bradley-Terry choice model does (a logistic step on the
//     difference between the two games), and the times and distances in it move too;
//   - a yes or a no to a game the agents agreed (huddle.js), with the reason when they give one ("the time", "too far");
//   - joining a game the agent recommended, or saying it isn't for them.
// After about five answers the agent knows enough to answer for them in a negotiation; every change is said back to
// them in a sentence, and they can see and reset all of it. Everything here is code: no model guesses a preference.
//   data/taste.json (TASTE_FILE): { members: { <id>: { home, sports, raw, cells, maxKm, priceCap, answers, learned } } }
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

const FILE = () => path.resolve(process.env.TASTE_FILE || "data/taste.json");
let db = null, from = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), { members: {} }); from = FILE(); } return db; };
const save = () => writeJSON(FILE(), data());
export const FACTORS = ["time", "place", "price", "quiet"];
export const SAY = { time: "the time", place: "how far it is", price: "the price", quiet: "a quiet court" };
export const NO = { time: "not a good time", place: "too far", price: "costs too much", quiet: "too busy then", busy: "busy then" };
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
export const PARTS = ["early", "morning", "afternoon", "evening"];
export const SURE_AT = 5; // answers before the agent answers for its member in a negotiation without asking
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOf = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
export const partOf = (start) => { const h = +String(start).slice(0, 2); return h < 9 ? "early" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };
export const cellOf = (date, start) => `${DAYS[dateOf(date).getDay()]} ${partOf(start)}`;
const groupOf = (cell) => { const [d, p] = cell.split(" "); return `${d === "Sat" || d === "Sun" ? "weekend" : "weekday"} ${p}`; };
export const cellWords = (cell) => { const [d, p] = cell.split(" "); return p === "early" ? `early ${LONG[d]}s` : `${LONG[d]} ${p}s`; };
export const cellWord = (cell) => cellWords(cell).replace(/s$/, "");
const rad = (d) => (d * Math.PI) / 180;
export const km = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

const blank = () => ({ home: null, sports: [], open: false, windows: [], limitKm: null, limitEach: null, delegate: null, raw: { time: 0, place: 0, price: 0, quiet: 0 }, cells: {}, maxKm: 5, priceCap: 250, answers: [], learned: [], asked: 0 });
export const get = (id) => ({ ...blank(), ...(data().members[id] || {}) });
const put = (id, t) => { data().members[id] = t; save(); return t; };
export function forget(id) { if (data().members[id]) { delete data().members[id]; save(); } }
export function reset(id) { const t = get(id); return put(id, { ...blank(), home: t.home, sports: t.sports, open: t.open }); }
// open to people nearby: other members' agents may ask this member's agent for a game (huddle.js), within about 5 km
export function setOpen(id, on) { const t = get(id); if (on && !t.home) return { error: "Share your rough area first, so people nearby can find you.", code: 400 }; return { taste: view(put(id, { ...t, open: !!on })) }; }
// hard limits an agent can set straight from what its person said: when they can play at all, how far, how much
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function setLimits(id, b = {}) {
  const t = get(id), w = b.windows === null ? [] : Array.isArray(b.windows) ? b.windows.slice(0, 14) : t.windows;
  const windows = [];
  for (const x of w || []) {
    const days = (Array.isArray(x.days) ? x.days : []).filter((d) => DAYS.includes(d));
    if (!days.length || !HM.test(x.from) || !HM.test(x.to) || x.from >= x.to) return { error: "Each window needs days (Sun..Sat) and from < to as HH:MM.", code: 400 };
    windows.push({ days: [...new Set(days)], from: x.from, to: x.to });
  }
  const num = (x) => (typeof x === "number" || (typeof x === "string" && x.trim() !== "")) && isFinite(+x) ? +x : NaN;
  if (b.maxKm !== undefined && b.maxKm !== null && !(num(b.maxKm) > 0)) return { error: "maxKm is a number of km above 0, or null to clear it.", code: 400 };
  if (b.maxEach !== undefined && b.maxEach !== null && !(num(b.maxEach) >= 0)) return { error: "maxEach is a price of 0 or more, or null to clear it.", code: 400 };
  const limitKm = b.maxKm === undefined ? t.limitKm : b.maxKm === null ? null : Math.min(30, num(b.maxKm));
  const limitEach = b.maxEach === undefined ? t.limitEach : b.maxEach === null ? null : Math.min(5000, Math.round(num(b.maxEach)));
  const n = { ...t, windows, limitKm, limitEach };
  if (limitKm) n.maxKm = Math.min(n.maxKm, limitKm);
  if (limitEach != null) n.priceCap = Math.min(n.priceCap, Math.max(60, limitEach));
  const parts = [windows.length ? `only ${windows.map((x) => `${x.days.join("/")} ${x.from}–${x.to}`).join(", ")}` : "", limitKm ? `within ${limitKm} km` : "", limitEach != null ? `at most NT$${limitEach} each` : ""].filter(Boolean);
  n.learned = [...n.learned, { at: Date.now(), text: parts.length ? `Set: ${parts.join(", ")}. Nothing outside that is ever agreed.` : "Limits cleared." }].slice(-30);
  return { taste: view(put(id, n)) };
}
// the person's standing permission for their agent to say yes for them: within a price, and with or without new people
export function setDelegate(id, b = {}) {
  const t = get(id);
  const d = b.on === true ? { on: true, maxEach: b.maxEach == null ? null : Math.max(0, Math.round(+b.maxEach)), newPeople: b.newPeople === true, at: Date.now() } : null;
  return { taste: view(put(id, { ...t, delegate: d })) };
}
export const openNear = (at, sport, maxKm = 5) => !at ? [] : Object.entries(data().members).filter(([, t]) => t.open && t.home && km(at, t.home) <= maxKm && (!t.sports?.length || t.sports.includes(sport))).map(([id, t]) => ({ id, km: +km(at, t.home).toFixed(1) }));
// the member's rough area (about 1 km), for courts near them and the middle of a group; never an address
export function setHome(id, at) {
  const lat = +at?.lat, lon = +at?.lon, t0 = get(id), moves = (t0.homeMoves || []).filter((x) => Date.now() - x < 864e5);
  if (t0.home && moves.length >= 3) return { error: "Your area can change three times a day: try again tomorrow.", code: 429 };
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: "That is not a place on the map." };
  return { taste: view(put(id, { ...get(id), home: { lat: +lat.toFixed(2), lon: +lon.toFixed(2) }, homeMoves: [...moves, Date.now()] })) };
}
const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash"];
export function setSports(id, sports) {
  const s = [...new Set((Array.isArray(sports) ? sports : []).map((x) => String(x).toLowerCase()).filter((x) => SPORTS.includes(x)))].slice(0, 4);
  return { taste: view(put(id, { ...get(id), sports: s })) };
}

// ---- what a game is worth to a member ----
export function weights(t) {
  const e = FACTORS.map((f) => Math.exp(t.raw[f] || 0)), n = e.reduce((a, b) => a + b, 0);
  return Object.fromEntries(FACTORS.map((f, i) => [f, e[i] / n]));
}
// how well a time of the week suits them, 0..1: the cell itself, half of its group (a liked Saturday morning makes
// Sunday morning a little likelier too), and, before they have said otherwise, what suits most people who work or
// study: weekday evenings and weekend mornings, not weekday mornings and afternoons
const PRIOR = { "weekday early": 0, "weekday morning": -0.8, "weekday afternoon": -0.7, "weekday evening": 0.4, "weekend early": -0.2, "weekend morning": 0.4, "weekend afternoon": 0.2, "weekend evening": 0 };
export function timeFit(t, cell) {
  const g = groupOf(cell), v = (t.cells[cell] || 0) + 0.5 * (t.cells[g] || 0) + 0.35 * (t.cells[`any ${cell.split(" ")[1]}`] || 0) + PRIOR[g];
  return 0.5 + 0.5 * Math.tanh(v);
}
// a game: { date, start, km, each (price per person, 0 for a public court), busy (0..1, how full the place usually is) }
export function fits(t, o) {
  return { time: timeFit(t, cellOf(o.date, o.start)), place: Math.exp(-(o.km ?? 3) / t.maxKm), price: o.each > 0 ? clamp(1 - o.each / t.priceCap, 0, 1) : 1, quiet: 1 - clamp(o.busy ?? 0.5, 0, 1) };
}
export function worth(t, o) { const w = weights(t), f = fits(t, o); return FACTORS.reduce((s, k) => s + w[k] * f[k], 0); }
// the one thing that most makes a game worse for them than their best one (what their agent says when it says no)
export function mainWhy(t, o, best) {
  const w = weights(t), a = fits(t, o), b = fits(t, best);
  return FACTORS.map((k) => [k, w[k] * (b[k] - a[k])]).sort((x, y) => y[1] - x[1])[0][0];
}

// ---- learning ----
const say = (t, text) => { t.learned = [...t.learned, { at: Date.now(), text }].slice(-30); return text; };
const nudgeCell = (t, cell, d) => {
  t.cells[cell] = clamp((t.cells[cell] || 0) + d, -2, 2);
  const g = groupOf(cell), a = `any ${cell.split(" ")[1]}`;
  t.cells[g] = clamp((t.cells[g] || 0) + d / 2, -2, 2);
  t.cells[a] = clamp((t.cells[a] || 0) + d / 2.5, -2, 2);
};
// the games a member said no to, and the times they said they were busy: their agent never says yes to those again
const remember = (t, list, o) => { t[list] = [...(t[list] || []).filter((x) => x.date >= ymd(new Date())), { date: o.date, start: o.start }].slice(-30); };
const near = (a, b) => a.date === b.date && Math.abs(+a.start.slice(0, 2) + +a.start.slice(3) / 60 - (+b.start.slice(0, 2) + +b.start.slice(3) / 60)) < 2;
// a hard no, whatever the weights say: busy then, already turned down, far over the price or the distance they gave
export function hardNos(t, o) {
  const out = [], one = (x) => { const r = hardNo(x, o); return r; };
  for (const k of ["windows", "km", "each", "busy", "declined"]) {
    const tt = { ...t, windows: k === "windows" ? t.windows : [], limitKm: k === "km" ? t.limitKm : null, limitEach: k === "each" ? t.limitEach : null, busyAt: k === "busy" ? t.busyAt : [], declined: k === "declined" ? t.declined : [], maxKm: 1e9, priceCap: 1e9 };
    const r = one(tt); if (r && !out.includes(r)) out.push(r);
  }
  const soft = hardNo({ ...t, windows: [], limitKm: null, limitEach: null, busyAt: [], declined: [] }, o); if (soft && !out.includes(soft)) out.push(soft);
  return out;
}
export function hardNo(t, o) {
  if (t.windows?.length) { const d = DAYS[dateOf(o.date).getDay()], end = (() => { const m = +o.start.slice(0, 2) * 60 + +o.start.slice(3) + (o.minutes || 90); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; })(); if (!t.windows.some((w) => w.days.includes(d) && w.from <= o.start && end <= w.to)) return "time"; }
  if (t.limitKm && o.km != null && o.km > t.limitKm) return "place";
  if (t.limitEach != null && o.each > t.limitEach) return "price";
  if ((t.busyAt || []).some((x) => near(x, o))) return "busy";
  if ((t.declined || []).some((x) => x.date === o.date && x.start === o.start)) return "time";
  if (o.each > 0 && o.each > t.priceCap * 1.15 && (t.raw.price || 0) > 0.2) return "price";
  if (o.km != null && o.km > t.maxKm * 1.6) return "place";
  return null;
}
// a pick between two games: a logistic step on the weights (the chosen game should be worth more), then the time and
// the distance and price of what they picked
export function choose(id, q, pick) {
  const t = get(id);
  // an agent may send back just the question's id: the last question asked is kept for that
  if ((typeof q === "string" || (q && !q.a)) && t.lastQ && t.lastQ.id === (typeof q === "string" ? q : q.id)) q = t.lastQ;
  if (!q || !q.a || !q.b) return { error: "No such question: send back the question object, or the id of the last one GET /api/huddle/question gave.", code: 400 };
  t.asked = (t.asked || 0) + 1;
  if (pick === "either") {
    t.answers = [...t.answers, { at: Date.now(), kind: "pair", q: q.id, pick, axes: q.axes }].slice(-40);
    const line = say(t, "Either works for you there, so I won't fuss over that difference.");
    return { taste: view(put(id, t)), line };
  }
  const [win, lose] = pick === "a" ? [q.a, q.b] : [q.b, q.a];
  const fw = fits(t, win), fl = fits(t, lose), w = weights(t);
  const margin = FACTORS.reduce((s, k) => s + w[k] * (fw[k] - fl[k]), 0), p = 1 / (1 + Math.exp(-6 * margin)), lr = 1.6;
  for (const k of FACTORS) t.raw[k] = clamp(t.raw[k] + lr * (1 - p) * (fw[k] - fl[k]), -3, 3);
  const cw = cellOf(win.date, win.start), cl = cellOf(lose.date, lose.start);
  if (cw !== cl) { nudgeCell(t, cw, 0.5); nudgeCell(t, cl, -0.25); }
  if (Math.abs(win.km - lose.km) >= 2) t.maxKm = clamp(t.maxKm * (win.km > lose.km ? 1.25 : 0.85), 1, 25);
  if (Math.abs(win.each - lose.each) >= 40) t.priceCap = clamp(t.priceCap * (win.each > lose.each ? 1.2 : 0.85), 60, 1200);
  if (t.limitKm) t.maxKm = Math.min(t.maxKm, t.limitKm);
  if (t.limitEach != null) t.priceCap = Math.min(t.priceCap, Math.max(60, t.limitEach));
  t.answers = [...t.answers, { at: Date.now(), kind: "pair", q: q.id, pick, axes: q.axes }].slice(-40);
  // say what moved, in their words: the factor the winner was better on
  const gain = FACTORS.map((k) => [k, fw[k] - fl[k]]).sort((x, y) => y[1] - x[1])[0][0];
  const lostOn = FACTORS.map((k) => [k, fl[k] - fw[k]]).sort((x, y) => y[1] - x[1])[0][0];
  const line = say(t, gain === lostOn ? `Noted: ${SAY[gain]} matters to you.` : `Noted: ${SAY[gain]} matters more to you than ${SAY[lostOn]}.`);
  return { taste: view(put(id, t)), line };
}
// a yes or a no to a game the agents agreed, or to one the agent recommended; why: time | place | price | quiet | busy
export function reply(id, o, yes, why = null) {
  const t = get(id), cell = cellOf(o.date, o.start);
  let line;
  if (yes) {
    nudgeCell(t, cell, 0.35);
    if (o.km > t.maxKm * 0.8) t.maxKm = clamp(t.maxKm * 1.1, 1, 25);
    line = `You said yes to ${cellWord(cell)}: I'll count ${cellWords(cell)} a bit more.`;
  } else if (why === "busy") {
    nudgeCell(t, cell, -0.15); remember(t, "busyAt", o);
    line = `You were busy that ${cellWord(cell)}. One busy day doesn't mean you dislike it, so I only moved it a little.`;
  } else if (FACTORS.includes(why)) {
    t.raw[why] = clamp(t.raw[why] + 0.45, -3, 3);
    remember(t, "declined", o);
    if (why === "time") { nudgeCell(t, cell, -0.6); line = `Not ${cellWords(cell)}, then. I'll weigh the time more and that slot less.`; }
    if (why === "place" && o.km != null && o.km < t.maxKm * 0.5) line = "Not that place, then: I'll look at other courts.";
    else if (why === "place") { t.maxKm = clamp(Math.min(t.maxKm, Math.max((o.km || t.maxKm) * 0.9, t.maxKm * 0.7)), 1, 25); line = `Too far: I'll keep games within about ${t.maxKm.toFixed(0)} km of you.`; }
    if (why === "price") { if (o.each > 0) t.priceCap = clamp(Math.min(t.priceCap, o.each * 0.9), 60, 1200); line = `Too dear: I'll aim under ${Math.round(t.priceCap)} each and push venues harder on price.`; }
    if (why === "quiet") line = "Too crowded: I'll look for quieter hours.";
  } else { nudgeCell(t, cell, -0.25); line = `Not that one. I'll count ${cellWords(cell)} a bit less.`; }
  t.answers = [...t.answers, { at: Date.now(), kind: yes ? "yes" : "no", cell, why }].slice(-40);
  say(t, line);
  return { taste: view(put(id, t)), line };
}

// the member asked, in their own words, for these days and parts of the day: they count a little more from now on
export function askedFor(id, w, each = null) {
  const t = get(id);
  // a price they named ("under NT$200") is what the agent aims under from now on (their hard limit stays as they set it)
  if (each != null && +each >= 0) { t.priceCap = clamp(Math.min(t.priceCap, Math.max(60, +each)), 60, 1200); put(id, t); }
  const days = (w?.days || []).map((d) => (/^\d{4}-/.test(d) ? DAYS[dateOf(d).getDay()] : d)).filter((d) => DAYS.includes(d)), parts = (w?.parts || []).filter((p) => PARTS.includes(p));
  if (!parts.length) return;
  for (const d of days.length ? [...new Set(days)] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) for (const p of parts) nudgeCell(t, `${d} ${p}`, days.length ? 0.3 : 0.15);
  put(id, t);
}

// ---- questions ----
// the next question, when the agent still needs one: two games that pull two factors apart, built around the member's
// own area and sport (named places when the caller passes courts near them). Before SURE_AT answers it asks every
// time; after that, now and then, on the pair of factors it is least sure about.
const PAIRS = [["time", "place"], ["price", "time"], ["quiet", "place"], ["time", "time"], ["price", "place"], ["quiet", "time"], ["time", "time"]];
// the times asked about against each other, a different pair each time: weekday evenings, weekend mornings and evenings, early starts
const TIME_PAIRS = [["Thu evening", "Sat morning"], ["Sat evening", "Wed early"], ["Sun morning", "Tue evening"], ["Fri evening", "Sun afternoon"], ["Mon early", "Sat afternoon"]];
const STARTS = { early: "07:00", morning: "09:00", afternoon: "14:00", evening: "19:30" };
const nextDate = (now, day) => { const d = new Date(now); d.setHours(0, 0, 0, 0); do d.setDate(d.getDate() + 1); while (d.getDay() !== day); return ymd(d); };
const kmText = (k) => (k < 1 ? `${Math.round(k * 10) * 100} m` : `${k.toFixed(k < 10 ? 1 : 0)} km`);
const busyText = (b) => (b >= 0.7 ? "usually busy" : b <= 0.35 ? "usually quiet" : "a few people usually");
export const dayText = (date) => { const d = dateOf(date); return `${LONG[DAYS[d.getDay()]]} ${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`; };
export const gameText = (o, cur = "NT$") => [`${dayText(o.date)}, ${o.start}`, o.where, kmText(o.km), o.each > 0 ? `${cur}${Math.round(o.each)} each` : "free court", busyText(o.busy)].filter(Boolean).join(" · ");
export function question(id, { places = [], now = new Date(), force = false } = {}) {
  const t = get(id), n = t.answers.filter((a) => a.kind === "pair").length;
  if (!force && n >= SURE_AT) return null;
  const done = new Set(t.answers.filter((a) => a.kind === "pair").map((a) => (a.axes || []).join("+")));
  const asked = t.answers.filter((x) => x.kind === "pair").map((x) => (x.axes || []).join("+"));
  let axes = PAIRS.find((p, i) => asked.filter((x) => x === p.join("+")).length < PAIRS.slice(0, i + 1).filter((q) => q.join("+") === p.join("+")).length);
  if (!axes) { const w = weights(t), fs = [...FACTORS].sort((a, b) => w[b] - w[a]); axes = [fs[0], fs[1]]; }
  // the member's best-liked time so far, and a contrasting one
  const liked = Object.entries(t.cells).filter(([k]) => /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) /.test(k)).sort((a, b) => b[1] - a[1])[0]?.[0] || "Thu evening";
  const [ld, lp] = liked.split(" "), other = lp === "evening" ? "Sat morning" : "Wed evening";
  const [od, op] = other.split(" ");
  const pub = places.filter((p) => p.kind === "public"), ven = places.filter((p) => p.kind === "venue");
  const near = (list, k) => list.find((p) => p.km != null && Math.abs(p.km - k) < 1.5)?.name || null;
  const g = (cell, k, each, busy, list = []) => { const [d, p] = cell.split(" "); return { date: nextDate(now, DAYS.indexOf(d)), start: STARTS[p], km: k, each, busy, where: near(list, k) || (each > 0 ? "an indoor court" : "a public court") }; };
  let a, b;
  const [x, y] = axes;
  if (x === "time" && y === "place") { a = g(liked, Math.max(t.maxKm * 1.1, 4), 90, 0.5, ven); b = g(other, 0.8, 90, 0.5, ven); }
  else if (x === "price" && y === "time") { a = g(other, 2, 40, 0.5, ven); b = g(liked, 2, 160, 0.5, ven); }
  else if (x === "quiet" && y === "place") { a = g(liked, Math.max(t.maxKm, 4), 0, 0.2, pub); b = g(liked, 0.8, 0, 0.85, pub); }
  else if (x === "time" && y === "time") { const v = TIME_PAIRS[(t.asked || 0) % TIME_PAIRS.length]; a = g(v[0], 2, 90, 0.5, ven); b = g(v[1], 2, 90, 0.5, ven); }
  else if (x === "price" && y === "place") { a = g(liked, 5, 40, 0.5, ven); b = g(liked, 1, 150, 0.5, ven); }
  else if (x === "quiet" && y === "time") { a = g("Tue early", 2, 0, 0.2, pub); b = g(liked, 2, 0, 0.85, pub); }
  else { a = g(liked, 1, 90, 0.5, ven); b = g(other, 1, 90, 0.5, ven); }
  if (a.date === b.date && a.start === b.start && x !== "time") b.start = a.start === "19:30" ? "18:00" : a.start;
  for (const o of [a, b]) { if (t.limitKm) o.km = +Math.min(o.km, t.limitKm * 0.95).toFixed(1); if (t.limitEach != null && o.each > 0) o.each = Math.min(o.each, t.limitEach); }
  // with time windows set, both games are at times the member can play (two different ones when the question is about time)
  if (t.windows?.length) {
    const slots = [];
    for (let i = 1; i <= 7; i++) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); const date = ymd(d), day = DAYS[d.getDay()];
      for (const w of t.windows) if (w.days.includes(day)) for (const s of [w.from, "07:00", "09:00", "10:30", "14:00", "16:00", "18:00", "19:30"]) { const end = +s.slice(0, 2) * 60 + +s.slice(3) + 90; if (s >= w.from && `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}` <= w.to && !slots.some((x) => x.date === date && x.start === s)) slots.push({ date, start: s }); } }
    if (slots.length) {
      const inWin = (o) => !hardNo({ ...t, limitKm: null, limitEach: null, busyAt: [], declined: [], maxKm: 1e9, priceCap: 1e9 }, o);
      if (!inWin(a)) Object.assign(a, slots[0]);
      if (!inWin(b) || (x === "time" && cellOf(a.date, a.start) === cellOf(b.date, b.start))) Object.assign(b, slots.find((sl) => cellOf(sl.date, sl.start) !== cellOf(a.date, a.start)) || slots[Math.min(1, slots.length - 1)]);
    }
  }
  const qid = `q${t.asked || 0}-${axes.join("")}`;
  const out = { id: qid, axes, a: { ...a, text: gameText(a) }, b: { ...b, text: gameText(b) }, n, of: SURE_AT, ask: n === 0 ? "Which of these would you rather play?" : "One more: which would you pick?" };
  data().members[id] = { ...get(id), lastQ: out }; save();
  return out;
}

// ---- what the member sees ----
export function summary(t) {
  const w = weights(t), order = [...FACTORS].sort((a, b) => w[b] - w[a]), n = t.answers.length;
  const likes = Object.entries(t.cells).filter(([k, v]) => /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) /.test(k) && v > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => cellWords(k));
  const avoid = Object.entries(t.cells).filter(([k, v]) => /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) /.test(k) && v < -0.3).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => cellWords(k));
  if (!n) return "I don't know how you like to play yet. Answer a few quick questions and I'll negotiate for you the way you would.";
  const even = w[order[0]] - w[order[3]] < 0.08;
  return [even ? "So far you weigh time, distance, price and a quiet court about the same." : `${SAY[order[0]][0].toUpperCase() + SAY[order[0]].slice(1)} matters most to you, then ${SAY[order[1]]}.`,
    likes.length ? `You like ${likes.join(", ").replace(/, ([^,]+)$/, " and $1")}.` : "", avoid.length ? `You'd rather not play ${avoid.join(" or ")}.` : "",
    `You'll go about ${t.maxKm.toFixed(0)} km${w.price > 0.2 ? ` and aim to pay under ${Math.round(t.priceCap)} each` : ""}.`].filter(Boolean).join(" ");
}
export function view(t) {
  const w = weights(t), pairs = t.answers.filter((a) => a.kind === "pair").length;
  const grid = Object.fromEntries(DAYS.flatMap((d) => PARTS.map((p) => [`${d} ${p}`, +timeFit(t, `${d} ${p}`).toFixed(2)])));
  return { home: t.home, sports: t.sports, open: !!t.open, windows: t.windows || [], limitKm: t.limitKm ?? null, limitEach: t.limitEach ?? null, delegate: t.delegate || null, weights: Object.fromEntries(FACTORS.map((k) => [k, +w[k].toFixed(2)])), grid, maxKm: +t.maxKm.toFixed(1), priceCap: Math.round(t.priceCap),
    answers: t.answers.length, pairs, sure: Math.min(1, t.answers.length / SURE_AT), summary: summary(t), learned: t.learned.slice(-8).reverse() };
}
export const isSure = (t) => t.answers.length >= SURE_AT;
