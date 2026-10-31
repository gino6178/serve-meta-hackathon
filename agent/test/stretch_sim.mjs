// The second round (src/a2a/stretch.js) on the simulated club, code only, no model: requests whose listed times all
// break someone's limit, how many a stretch round turns into a game, and how the stretched minutes fall on people
// with and without the burden ledger. The listing and the sets are what talk.js computes: shared() windows, a court
// for each start, the first twelve, breaks() and stretchOf(). Members are population(), and a share of them
// (STRETCH_SHARE, 0.5: an assumption, as no real member has set one yet) allow their agent to stretch: endBy and
// notBefore by 15 or 30 minutes, maxTrip by 5 or 10.
//   node test/stretch_sim.mjs [out.json]    STRETCH_SEED=11 (held out: settings were not tuned on any seed)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-stretchsim-"));
Object.assign(process.env, { BOOKINGS_FILE: `${tmp}/b.json`, A2A_FILE: `${tmp}/a.json`, NEGOTIATIONS_FILE: `${tmp}/n.json`, LEDGER_FILE: `${tmp}/l.jsonl`, TRACE_FILE: `${tmp}/t.jsonl`, STRETCH_FILE: `${tmp}/s.json`, A2A_LEASE: "off", MEMORY: "off" });
const { shared, court, breaks, when } = await import("../src/a2a/talk.js");
const st = await import("../src/a2a/stretch.js");
const { population } = await import("../src/club/population.js");
const { helpers } = await import("../src/club/play.js");
const { hm } = helpers;

const OUT = process.argv[2] || "../submission/results/stretch.json", SEED = +(process.env.STRETCH_SEED || 11), SHARE = +(process.env.STRETCH_SHARE || 0.5);
const REQ = +(process.env.STRETCH_REQ || 4000), CLUB = +(process.env.STRETCH_CLUB || 40), GAMES = +(process.env.STRETCH_GAMES || 1500);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(SEED);
const venues = helpers.readVenues(), now = new Date("2026-11-02T07:00:00"), MIN = 90;
const pop = population(800, SEED).map((m) => ({ ...m, rules: { ...m.rules, ...(r() < SHARE ? { stretch: { endBy: r() < 0.5 ? 15 : 30, notBefore: r() < 0.5 ? 15 : 30, maxTrip: r() < 0.5 ? 5 : 10 } } : {}) } }));
const pickN = (xs, n) => { const s = new Set(); while (s.size < n) s.add(xs[Math.floor(r() * xs.length)]); return [...s]; };

// one request: the listed times and each member's set; null when there is nothing to list
function talk(host, members) {
  const people = [host, ...members], times = shared(people, MIN, now);
  const starts = (s) => [s.from, ...(s.to - s.from >= MIN + 60 ? [s.from + 60] : [])];
  const listed = times.flatMap((s) => starts(s).map((start) => { const c = court(s, start, MIN, people, venues); return c && { slot: s, start, c }; })).filter(Boolean).slice(0, 12);
  listed.forEach((x, i) => { x.id = `t${i + 1}`; });
  if (!listed.length) return null;
  const works = members.map((m) => new Set(listed.filter((x) => !breaks(m, x, MIN)).map((x) => x.id)));
  const marks = members.map((m, k) => st.marksFor(m, listed, [...works[k]], MIN, breaks));
  return { listed, works, marks, common: listed.filter((x) => works.every((w) => w.has(x.id))) };
}

// 1. how many requests end with no common time, and how many a stretch round lands
const kinds = { singles: 1, doubles: 3 }, landing = {};
for (const [kind, n] of Object.entries(kinds)) {
  let listedAny = 0, empty = 0, saved = 0, minutes = [], who = [];
  for (let i = 0; i < REQ; i++) {
    const [host, ...members] = pickN(pop, n + 1), t = talk(host, members);
    if (!t) continue;
    listedAny++;
    if (t.common.length) continue;
    empty++;
    st.forgetBurden();
    const p = st.pickStretched(t.listed, members, t.works, t.marks, now.getTime(), false);
    if (p) { saved++; minutes.push(Math.max(...Object.values(p.by))); who.push(Object.keys(p.by).length); }
  }
  const mean = (a) => +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  landing[kind] = { requests: REQ, listedSomething: listedAny, noCommonTime: empty, noCommonShare: +(empty / listedAny).toFixed(4), landedByStretch: saved, landedShareOfNoCommon: +(saved / Math.max(1, empty)).toFixed(4),
    gamesBefore: +((listedAny - empty) / listedAny).toFixed(4), gamesAfter: +((listedAny - empty + saved) / listedAny).toFixed(4), meanLargestStretchMin: mean(minutes), meanMembersStretching: mean(who) };
}

// 2. one club of CLUB members playing GAMES doubles requests: the minutes each member stretched in all, with and
// without the ledger (the same requests, in the same order)
const club = pickN(pop, CLUB), reqs = Array.from({ length: GAMES }, () => pickN(club, 4));
function season(useLedger) {
  st.forgetBurden();
  const total = Object.fromEntries(club.map((m) => [m.id, 0]));
  let games = 0, stretched = 0;
  reqs.forEach(([host, ...members], i) => {
    const t = talk(host, members);
    if (!t) return;
    if (t.common.length) { games++; return; }
    const at = now.getTime() + Math.floor((i / GAMES) * 50) * 86400000; // the season over 50 days, inside the ledger's 60
    const p = st.pickStretched(t.listed, members, t.works, t.marks, at, useLedger);
    if (!p) return;
    games++; stretched++;
    for (const [id, min] of Object.entries(p.by)) total[id] += min;
    st.noteStretch(p.by, `g${i}`, at);
  });
  const v = Object.values(total).sort((a, b) => a - b), n = v.length, sum = v.reduce((a, b) => a + b, 0);
  const gini = sum ? +(v.reduce((a, x, i) => a + (2 * (i + 1) - n - 1) * x, 0) / (n * sum)).toFixed(3) : 0;
  const givers = v.filter((x) => x > 0);
  return { games, stretchedGames: stretched, totalMinutes: sum, giniAll: gini, maxMinutes: v.at(-1), membersWhoStretched: givers.length,
    giniAmongThoseWhoCan: (() => { const w = club.filter((m) => m.rules.stretch).map((m) => total[m.id]).sort((a, b) => a - b), k = w.length, s = w.reduce((a, b) => a + b, 0); return s ? +(w.reduce((a, x, i) => a + (2 * (i + 1) - k - 1) * x, 0) / (k * s)).toFixed(3) : 0; })() };
}
const burden = { club: CLUB, requests: GAMES, format: "doubles", withLedger: season(true), withoutLedger: season(false) };
const out = { simulated: true, label: "The second round (a2a/stretch.js): requests with no common time, games a stretch round lands, and how stretched minutes fall with and without the burden ledger; code only, no model",
  seed: SEED, stretchShare: SHARE, minutes: MIN, week: now.toISOString().slice(0, 10), landing, burden };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
