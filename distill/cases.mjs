// Decision cases for the Jev-style member decision model: what a member's agent is asked in a talk (a2a.js), built by
// the same code the talks use, from the simulated club (population.js), with what is known by code beside it.
//   - The times come from a2a.js shared() and court(), the ids and the order as rounds() gives them, and each time is
//     written out the way the member's own agent writes it over A2A (a2a_server.js spell: the member's own trip only).
//   - The truth for which listed times work is computed by code (a2a.js breaks: the member's calendar and hard rules),
//     so `works` is labeled exactly. Which workable time the member likes best is the teacher's call (Muse Glimmer).
//   - kind: "judge" (the proposed time does not work and two or more listed times do: the model's real judgment, all
//     that reaches the model with A2A_ROUTE=1), "accept" (the proposed time works), "single" (one listed time works),
//     "none" (no listed time works: code declines, no model call).
// The same seed gives the same cases. Held-out members: seed 7 is the club the end-to-end evals use (persona_eval,
// private_eval, scale_eval); training cases come from other seeds.
import { population } from "../agent/src/club/population.js";
import { shared, court, breaks, when, first } from "../agent/src/a2a/talk.js";
import { helpers } from "../agent/src/club/play.js";
import { readClub } from "../agent/src/club/club.js";

const { hm, toMin, travelMin, dateOf, ymd, DAYS, readVenues } = helpers;
// mulberry32, as population.js
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
// the member's profile as its agent reads it (a2a.js profile)
export const profile = (m) => `You are ${m.name}'s agent. ${m.name} plays ${m.prefers === "any" ? "singles or doubles" : m.prefers}, level ${m.level}. Free: ${m.free.join(", ")}.${m.limit ? ` Health limit: ${m.limit}.` : ""} ${m.agent || ""}`;
// a time in words as the member's agent writes it over A2A (a2a_server.js spell)
export const spell = (x, minutes, them, venueName) => `${when(x.date, x.start)}–${hm(toMin(x.start) + minutes)}${venueName ? ` at ${venueName}` : ""}${x.court ? `, court ${x.court}` : ""}${x.trip != null ? ` (${them}'s trip ${x.trip} min)` : ""}`;

// the player's week: free all week, a usual week, the demo player's, or a few random windows
const SLOTS = [["Mon", 18, 22], ["Tue", 18, 22], ["Wed", 19, 22], ["Thu", 18, 21], ["Fri", 18, 22], ["Sat", 8, 13], ["Sat", 14, 18], ["Sun", 9, 13], ["Sun", 14, 18], ["Wed", 8, 12]];
function playerWeek(r, club) {
  const u = r();
  if (u < 0.3) return { kind: "all", free: DAYS.map((d) => `${d} 08-22`) };
  if (u < 0.5) return { kind: "usual", free: ["Mon 19-22", "Wed 18-21", "Sat 09-13", "Sun 14-18"] };
  if (u < 0.65) return { kind: "demo", free: club.you.free };
  const n = 3 + Math.floor(r() * 4), seen = new Set(), free = [];
  for (let k = 0; free.length < n && k < 30; k++) { const [d, a, b] = pick(r, SLOTS); if (seen.has(d)) continue; seen.add(d); free.push(`${d} ${String(a).padStart(2, "0")}-${b}`); }
  return { kind: "random", free };
}

// Preferences in a member's own words, beyond the simulated club's few habits (the demo club's members say things like
// these): a day, a part of the day, a venue. Soft only: the hard rules stay the member's own, in code.
const DAYNAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const PREFS = [
  (n, r, m) => { const d = pick(r, m.free).split(" ")[0]; return `${DAYNAMES[d]} is best for ${n}.`; },
  (n, r, m) => { const d = pick(r, m.free).split(" ")[0]; return `${n} plays ${DAYNAMES[d]} ${["Sat", "Sun"].includes(d) ? "mornings" : "evenings"} by preference.`; },
  (n) => `${n} prefers evenings.`, (n) => `${n} likes early weekend mornings.`, (n) => `${n} prefers Sunday late mornings.`, (n) => `${n} likes Saturday mornings.`,
  (n) => `${n} would rather start later in the evening.`, (n) => `${n} likes a late start at weekends.`, (n) => `${n} prefers weeknights to weekends.`,
  (n, r) => `${n} likes ${pick(r, ["Riverside", "Midtown", "North", "Lakeside", "Westgate"])}.`, (n, r) => `${n} prefers playing at ${pick(r, ["Riverside Sports Centre", "North District Gym", "Lakeside School Hall", "Midtown Community Gym", "Westgate Badminton Hall"])}.`,
  (n) => `${n} is flexible; early starts are fine.`, (n) => `${n} likes short trips.`, (n) => `${n} doesn't mind a longer trip for a good court.`,
];
// what a simulated member's agent reads, with its soft habits replaced by one or two of these
function varied(m, r) {
  const n = m.name.split(" ")[0], hard = [/doesn't play on/, /home by ten/, /won't travel more than/];
  const kept = (m.agent || "").replace("A simulated member. ", "").split(/(?<=\.)\s+/).filter((s) => hard.some((h) => h.test(s)));
  const extra = [pick(r, PREFS)(n, r, m), ...(r() < 0.4 ? [pick(r, PREFS)(n, r, m)] : [])];
  return { ...m, agent: `A simulated member. ${[...kept, ...new Set(extra)].join(" ")}`, varied: true };
}

// Build cases. `keep` gives the share of each kind kept. With A2A_ROUTE (the default), code answers the other kinds,
// so only judge cases reach the model. `variety`: the share of members whose soft habits are replaced (varied);
// `demo`: the demo club's own members instead of simulated ones.
// `shared`: shared calendars only (Serve's default: every listed time fits every calendar, so the proposed time fails
// only on a hard rule); otherwise 40% of the talks use private calendars (A2A_PRIVATE), where most judge cases come from.
export function buildCases({ seed = 1, n = 100, popSeed = 11, popSize = 2000, keep = { judge: 1 }, variety = 0, demo = false, shared: sharedOnly = false, base = new Date("2026-11-02T08:00:00+08:00") } = {}) {
  const r = rng(seed * 7919 + popSeed), club = readClub(), venues = readVenues(), pop = demo ? club.members.filter((x) => x.rulesComplete && x.free?.length) : population(popSize, popSeed);
  const vname = (id) => venues.venues.find((v) => v.id === id)?.name || null;
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 60; tries++) {
    let m = pick(r, pop);
    if (!demo && variety > 0 && r() < variety) m = varied(m, r);
    m = { rules: {}, sports: ["badminton"], ...m };
    const others = m.sports.filter((s) => s !== "badminton" && venues.venues.some((v) => v.sports?.[s]));
    const sport = others.length && r() < 0.15 ? pick(r, others) : "badminton";
    const format = m.prefers === "singles" ? (r() < 0.1 ? "doubles" : "singles") : m.prefers === "doubles" ? (r() < 0.1 ? "singles" : "doubles") : r() < 0.6 ? "singles" : "doubles";
    const minutes = r() < 0.8 ? 90 : r() < 0.5 ? 60 : 120;
    const privateCal = r() < 0.4 && !sharedOnly;
    const week = playerWeek(r, club);
    const me = { id: "you", name: "You", area: club.you.area, free: week.free };
    const mates = format === "doubles" ? [pick(r, pop), pick(r, pop)].filter((x) => x.id !== m.id && x.free?.length) : [];
    if (format === "doubles" && mates.length < 2) continue;
    const people = [me, m, ...mates];
    const now = new Date(base.getTime() + Math.floor(r() * 14) * 86400000 + Math.floor(r() * 12) * 3600000);
    // the times your agent lists, as rounds() makes them
    const times = shared(privateCal ? [me] : people, minutes, now);
    const starts = (s) => (privateCal ? Array.from({ length: Math.max(0, Math.floor((s.to - minutes - s.from) / 60) + 1) }, (_, k) => s.from + 60 * k) : [s.from, ...(s.to - s.from >= minutes + 60 ? [s.from + 60] : [])]);
    const offer = (s, start) => { const c = court(s, start, minutes, people, venues, sport); return c && { slot: s, start, c }; };
    const choices = times.flatMap((s) => starts(s).map((st) => offer(s, st))).filter(Boolean);
    if (choices.length < 2) continue;
    const usual = (x) => (!privateCal ? 0 : ["Sat", "Sun"].includes(x.slot.day) ? (x.start >= 9 * 60 && x.start <= 14 * 60 ? 3 : 0) : x.start >= 18 * 60 && x.start <= 20 * 60 ? 3 : 0);
    const ordered = choices.map((x, i) => ({ x, s: usual(x) - i * 0.01 })).sort((a, b) => b.s - a.s).map((y) => y.x);
    ordered.forEach((x, i) => { x.id = `t${i + 1}`; });
    const listed = ordered.slice(0, 12);
    // the member's side, as a2a_server.js reads the proposal: its own trip to each venue, each time in its own words
    const them = first(m.name);
    const side = (x) => { const trip = m.area ? travelMin(m.area, x.c.v) : null; const f = { id: x.id, date: x.slot.date, start: hm(x.start), venue: x.c.v.id, court: x.c.court, trip };
      return { id: x.id, slot: { date: x.slot.date, day: DAYS[dateOf(x.slot.date).getDay()] }, start: x.start, trip, text: spell(f, minutes, them, vname(f.venue)), venue: x.c.v.id, venueName: vname(x.c.v.id), court: x.c.court }; };
    const offers = listed.map(side);
    const bad = offers.map((x) => breaks(m, x, minutes));
    // the proposed time: usually one that does not work for this member (the judgment), else your agent's favourite
    const badIdx = bad.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    const ci = badIdx.length && r() < 0.75 ? pick(r, badIdx) : 0;
    const cur = offers[ci];
    // the order the member's agent sees (a2a.js ask: the proposed time first, then the rest)
    const sent = [cur, ...offers.filter((x) => x !== cur)];
    const works = sent.filter((x) => !breaks(m, x, minutes)).map((x) => x.id);
    const curBad = breaks(m, cur, minutes);
    const kind = !works.length ? "none" : !curBad ? "accept" : works.length === 1 ? "single" : "judge";
    if (r() >= (keep[kind] ?? 0)) continue;
    out.push({
      id: `s${seed}-p${popSeed}-${out.length}`, kind, member: m, sport, format, minutes, private: privateCal, week: week.kind, now: now.toISOString(),
      cur: cur.id, curBad, offers: sent.map((x) => ({ ...x, bad: breaks(m, x, minutes) })), works,
    });
  }
  return out;
}
// Cases where the player asked for a time (Serve's usual way in: "a game Tuesday at 20:30?"), as persona_eval and the
// one-pass decider's eval make them: shared calendars, the asked time first and the times nearest it next (rounds()
// with `prefer`), the asked time breaking one of the member's hard rules (a day off, a latest end, a longest trip), and
// two or more listed times keeping them. The player's week varies (free all week mostly), and so do the members' words.
export function askedCases({ seed = 1, n = 100, popSeed = 11, popSize = 2000, per = 2, variety = 0.5, base = new Date("2026-11-02T07:00:00+08:00") } = {}) {
  const r = rng(seed * 104729 + popSeed), club = readClub(), venues = readVenues(), pop = population(popSize, popSeed);
  const vname = (id) => venues.venues.find((v) => v.id === id)?.name || null;
  const out = [], MIN = 90;
  const order = [...pop.keys()].sort(() => r() - 0.5);
  for (const i of order) {
    if (out.length >= n) break;
    let m = { rules: {}, sports: ["badminton"], ...pop[i] };
    if (!Object.keys(m.rules).length || m.prefers === "doubles" || !m.sports.includes("badminton")) continue;
    if (r() < variety) m = varied(m, r);
    const week = r() < 0.7 ? { kind: "all", free: DAYS.map((d) => `${d} 08-22`) } : playerWeek(r, club);
    const me = { id: "you", name: "You", area: club.you.area, free: week.free }, people = [me, m];
    const now = new Date(base.getTime() + Math.floor(r() * 7) * 86400000);
    const times = shared(people, MIN, now);
    const listing = (prefer) => {
      const offer = (s, start) => { const c = court(s, start, MIN, people, venues, "badminton"); return c && { slot: s, start, c }; };
      const starts = (s) => [s.from, ...(s.to - s.from >= MIN + 60 ? [s.from + 60] : [])];
      const choices = times.flatMap((s) => starts(s).map((st) => offer(s, st))).filter(Boolean);
      const ps = prefer && times.find((s) => s.day === prefer.day && s.from <= toMin(prefer.start) && toMin(prefer.start) + MIN <= s.to);
      if (ps && !choices.some((x) => x.slot.date === ps.date && x.start === toMin(prefer.start))) { const x = offer(ps, toMin(prefer.start)); if (x) choices.push(x); }
      const ordered = choices.map((x, k) => ({ x, s: -k * 0.01 + (prefer && x.slot.day === prefer.day ? 20 - Math.abs(x.start - toMin(prefer.start)) / 30 : 0) })).sort((a, b) => b.s - a.s).map((y) => y.x);
      ordered.forEach((x, k) => { x.id = `t${k + 1}`; });
      return { cur: ordered[0], listed: ordered.slice(0, 12), choices };
    };
    const R = m.rules, asks = [], all = listing(null).choices;
    if (R.noDays) for (const s of times) if (R.noDays.includes(s.day)) asks.push({ rule: "noDays", prefer: { day: s.day, start: hm(s.from) } });
    if (R.endBy) for (const s of times) { const st = Math.max(s.from, Math.ceil((toMin(R.endBy) - MIN + 30) / 30) * 30); if (st + MIN <= s.to) asks.push({ rule: "endBy", prefer: { day: s.day, start: hm(st) } }); }
    if (R.maxTrip != null) for (const x of all) if (/trip/.test(breaks(m, x, MIN) || "")) asks.push({ rule: "maxTrip", prefer: { day: x.slot.day, start: hm(x.start) } });
    asks.sort(() => r() - 0.5);
    const them = first(m.name);
    let k = 0;
    for (const a of asks) {
      if (k >= per || out.length >= n) break;
      const { cur, listed } = listing(a.prefer);
      const why = cur && breaks(m, cur, MIN);
      if (!why || /not free|already/.test(why)) continue;
      const works = listed.filter((x) => !breaks(m, x, MIN));
      if (works.length < 2) continue;
      if (out.some((c) => c.member.id === m.id && c.offers[0].slot.date === cur.slot.date && c.offers[0].start === cur.start)) continue;
      const side = (x) => { const trip = m.area ? travelMin(m.area, x.c.v) : null; const f = { date: x.slot.date, start: hm(x.start), venue: x.c.v.id, court: x.c.court, trip };
        return { id: x.id, slot: { date: x.slot.date, day: DAYS[dateOf(x.slot.date).getDay()] }, start: x.start, trip, text: spell(f, MIN, them, vname(f.venue)), venue: x.c.v.id, venueName: vname(x.c.v.id), court: x.c.court, bad: breaks(m, x, MIN) }; };
      out.push({ id: `a${seed}-p${popSeed}-${out.length}`, kind: "judge", rule: a.rule, member: m, sport: "badminton", format: "singles", minutes: MIN, private: false, week: week.kind, now: now.toISOString(),
        cur: cur.id, curBad: why, offers: [cur, ...listed.filter((x) => x !== cur)].map(side), works: works.map((x) => x.id) });
      k++;
    }
  }
  return out;
}
// a case's times as the objects a2a.js fullAnswer reads (slot, start, trip, text, id)
export const asChoices = (c) => c.offers.map((x) => ({ id: x.id, slot: x.slot, start: x.start, trip: x.trip, text: x.text }));
export { ymd };
