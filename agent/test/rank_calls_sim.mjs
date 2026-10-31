// What the order of the listed times saves in model calls (match/timerank.js), on simulated members, no model.
// Shared calendars: the times listed fit everyone's calendar, so whether a member's agent says yes to the time on the
// table comes down to its member's rules (a day they don't play, the latest they finish). When the time proposed first
// keeps everyone's rules, every member's agent says yes by code and the game is agreed with no model at all; when it
// breaks someone's rule, that member's agent has a choice between times to make (the student, the decider, or
// Glimmer's full answer, about 40 s). So the order decides how many choices are asked of a model.
// The members are a simulated club (club/population.js) with their own free lists and rules; what your agent has seen
// of each is 0 to 6 past answers at times of the week it was proposed (yes when the time kept their rules, else no,
// 10% of them the other way). Your agent is free all week. For singles (1 member) and doubles (3), over requests where
// at least one listed time breaks someone's rule (where the order can matter): the share whose first time keeps
// everyone's rules, and the choices asked of a model per request, by:
//   counts  the old order: 2 per past yes and -3 per past no at that weekday and hour, summed over members
//   prob    the product of each member's posterior (voi.js, the club's prior and shared preferences), with the floor
//   node test/rank_calls_sim.mjs [trials] [out.json]
import fs from "node:fs";
const { timeScore } = await import("../src/match/timerank.js");
const { populationPrior } = await import("../src/match/voi.js");
const { population } = await import("../src/club/population.js");

const N = +(process.argv[2] || 3000), OUT = process.argv[3] || null;
let seed = +(process.env.SIM_SEED || 23); const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const club = population(800, +(process.env.SIM_CLUB || 13));
// (the club's one day rule is "no Fridays", and Friday is also the day its free lists name least, so the club's prior
// alone would steer the first time off Fridays; each member's day off is drawn from the days they list instead, so
// only what your agent has seen of the member can tell it)
const pool = club.slice(300).map((m) => { if (!m.rules.noDays) return m; const days = [...new Set(m.free.map((w) => w.slice(0, 3)))]; return { ...m, rules: { ...m.rules, noDays: [days[Math.floor(rnd() * days.length)]] } }; });
const known = club.slice(0, 300);
const win = (w) => { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m && { day: m[1], from: +m[2] * 60, to: +m[3] * 60 }; };
const dateOf = (day) => `2026-11-0${1 + DAYS.indexOf(day)}`;
const keyOf = (day, start) => `${day} ${String(Math.floor(start / 60)).padStart(2, "0")}:00`;
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const keeps = (m, x) => !(m.rules.noDays?.includes(x.slot.day) || (m.rules.endBy && x.start + 90 > toMin(m.rules.endBy)));
// the times that fit every member's calendar: each shared window's start and, when it is long, an hour later (talk.js)
function listed(members) {
  const out = [];
  for (const day of DAYS) {
    let spans = [[0, 1440]];
    for (const m of members) { const w = m.free.map(win).filter((x) => x && x.day === day).map((x) => [x.from, x.to]); spans = spans.flatMap(([a, b]) => w.map(([c, e]) => [Math.max(a, c), Math.min(b, e)])).filter(([a, b]) => b - a >= 90); }
    for (const [a, b] of spans) for (const s of [a, ...(b - a >= 150 ? [a + 60] : [])]) out.push({ slot: { date: dateOf(day), day }, start: s });
  }
  return out;
}

const res = {};
for (const size of [1, 3]) {
  const tally = { counts: { first: 0, calls: 0 }, prob: { first: 0, calls: 0 } };
  let trials = 0, tries = 0;
  while (trials < N && tries < N * 200) {
    tries++;
    const members = Array.from({ length: size }, () => pool[Math.floor(rnd() * pool.length)]);
    const choices = listed(members);
    if (choices.length < 2 || choices.every((x) => members.every((m) => keeps(m, x))) || !choices.some((x) => members.every((m) => keeps(m, x)))) continue;
    trials++;
    // what your agent has seen: past proposals at the member's own free times, the answer by their rules (10% flipped)
    const mems = members.map((m) => {
      const mem = { yes: {}, no: {}, asked: {} }, mine = listed([m]), n = Math.floor(rnd() * 7);
      for (let i = 0; i < n && mine.length; i++) { const x = mine[Math.floor(rnd() * mine.length)], k = keyOf(x.slot.day, x.start), y = keeps(m, x) !== (rnd() < 0.1); (y ? mem.yes : mem.no)[k] = ((y ? mem.yes : mem.no)[k] || 0) + 1; }
      return mem;
    });
    const prior = populationPrior({ members: known });
    for (const rank of ["counts", "prob"]) {
      const first = choices.map((x, i) => ({ x, s: timeScore(x, mems, prior, rank === "prob") - i * 0.01 })).sort((a, b) => b.s - a.s)[0].x;
      const broken = members.filter((m) => !keeps(m, first)).length;
      tally[rank].first += broken ? 0 : 1; tally[rank].calls += broken;
    }
  }
  const r4 = (x) => +x.toFixed(4), ci = (k) => { const p = k / trials, h = 1.96 * Math.sqrt((p * (1 - p)) / trials); return [r4(p - h), r4(p + h)]; };
  res[size === 1 ? "singles" : "doubles"] = { requests: trials, ...Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, { firstKeepsEveryone: r4(v.first / trials), ci: ci(v.first), modelChoicesPerRequest: r4(v.calls / trials) }])) };
}
const out = { simulated: true, label: "The order of the listed times (match/timerank.js) with shared calendars: requests whose first time keeps everyone's rules (agreed by code, no model), and the choices asked of a model", trials: N, club: "population(800): rules and free lists; the first 300 make the prior", seen: "0 to 6 past answers per member at their own free times, 10% flipped", ...res };
console.log(JSON.stringify(out, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
