// How good the booked games were, against every game the same players could have had (docs/booking_quality.md).
// For each game Serve booked in the simulated-user runs (submission/results/sim_users_*.json: who, when, where), every
// candidate in the same week (a half-hour start in everyone's free windows, within their rules, at a venue with a free
// court, as test/sim_users/courts.mjs keeps the timetable) is searched exhaustively for the same players. Per game and
// in all: how many minutes the booked game's longest trip and total trip lie above the best possible, the burden
// fairness (shortest trip / longest trip of the players), and the game messages per booking from the run's metrics.
// Then the three venue rules of a2a/talk.js (minimax, sum, nash) on the same games, and on every pair of simulated
// users at the start of each window they share; and the invitation-exposure inequality match_eval.mjs measured.
// Offline, no model:   node test/booking_quality.mjs [out.json]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-bq-"));
for (const [k, v] of Object.entries({ A2A_STUDENT: "off", BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, LLM_URL: "http://127.0.0.1:9/v1" })) process.env[k] = v;
const { court, venueScore, VENUE_RULES } = await import("../src/a2a/talk.js");
const { helpers } = await import("../src/club/play.js");
const { gini } = await import("../src/match/fit.js");
const { freeCourts, travelMin } = await import("./sim_users/courts.mjs");

const OUT = process.argv[2] || path.join(ROOT, "submission/results/booking_quality.json");
const RUNS = ["v2s2", "v2s3", "v3s4"], MIN = 90, SPORT = "badminton";
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const venues = read(path.join(ROOT, "web/public/data/venues.json")), personas = read(path.join(HERE, "sim_users/personas.json")).personas;
const P = Object.fromEntries(personas.map((p) => [p.id, p]));
const { windows, ymd, hm, toMin, dateOf, DAYS } = helpers;
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10), r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const sum = (xs) => xs.reduce((a, b) => a + b, 0), mean = (xs) => (xs.length ? sum(xs) / xs.length : null);
const fair = (mins) => r3(Math.min(...mins) / Math.max(...mins));
const week = (first) => Array.from({ length: 7 }, (_, i) => { const d = dateOf(first); d.setDate(d.getDate() + i); return ymd(d); });

// a player can play then: in a free window, within their rules (endBy, maxTrip; talk.js breaks keeps the same ones)
const fits = (p, date, start, trip) => {
  const day = dateOf(date).getDay(), r = p.rules || {};
  if (!windows(p.free).some((w) => w.day === day && w.from <= start && start + MIN <= w.to)) return false;
  if (r.endBy && start + MIN > toMin(r.endBy)) return false;
  return !(r.maxTrip != null && trip > r.maxTrip);
};
// every candidate (date x half-hour start x venue) for these players; `taken`: other games of the run, a court each
function candidates(ids, dates, taken = []) {
  const out = [];
  for (const date of dates) for (let start = 6 * 60; start + MIN <= 24 * 60; start += 30) {
    if (!ids.every((id) => fits(P[id], date, start, 0))) continue;
    for (const v of venues.venues) {
      const mins = ids.map((id) => travelMin(P[id].home, v));
      if (!ids.every((id, i) => fits(P[id], date, start, mins[i]))) continue;
      const busy = taken.filter((g) => g.venue === v.id && g.date === date && toMin(g.start) < start + MIN && start < toMin(g.start) + MIN).length;
      if (freeCourts(v, date, start, MIN, { sport: SPORT }).length - busy <= 0) continue;
      out.push({ date, start: hm(start), venue: v.id, mins, longest: Math.max(...mins), total: sum(mins) });
    }
  }
  return out;
}
const best = (cs, rule) => cs.reduce((b, c) => { const s = venueScore(c.mins, rule); return !b || s < b.s || (s === b.s && rule !== "minimax" && c.longest < b.c.longest) ? { s, c } : b; }, null)?.c || null;
const pickOf = (c) => c && { date: c.date, start: c.start, venue: c.venue, mins: c.mins, longest: c.longest, total: c.total, fairness: fair(c.mins) };

// ---- the booked games ----
const games = [], perRun = {};
for (const run of RUNS) {
  const res = read(path.join(ROOT, `submission/results/sim_users_${run}.json`)), dates = week(res.days[0].date);
  const sg = res.serveGames.map((g) => ({ ...g, venueId: venues.venues.find((v) => v.name === g.venue)?.id, ids: [g.by, ...g.with] }));
  for (const g of sg) {
    const v = venues.venues.find((x) => x.id === g.venueId), mins = g.ids.map((id) => travelMin(P[id].home, v));
    const others = sg.filter((x) => x !== g).map((x) => ({ venue: x.venueId, date: x.date, start: x.start }));
    const all = candidates(g.ids, dates, others), same = all.filter((c) => c.date === g.date && c.start === g.start);
    const optL = Math.min(...all.map((c) => c.longest)), optT = Math.min(...all.map((c) => c.total));
    const sameL = same.length ? Math.min(...same.map((c) => c.longest)) : null, sameT = same.length ? Math.min(...same.map((c) => c.total)) : null;
    // what talk.js court() picks at the booked time, with the members' home areas (the code that booked it)
    const people = g.ids.map((id) => ({ id, name: P[id].name, area: P[id].home })), slot = { date: g.date, day: DAYS[dateOf(g.date).getDay()] };
    const rules = Object.fromEntries(VENUE_RULES.map((rule) => [rule, { atBookedTime: pickOf(best(same, rule)), anyTime: pickOf(best(all, rule)), court: court(slot, toMin(g.start), MIN, people, venues, SPORT, rule)?.v.id ?? null }]));
    games.push({ run, key: g.key, format: g.format, date: g.date, start: g.start, venue: g.venueId, players: g.ids, played: g.played, mins, longest: Math.max(...mins), total: sum(mins), fairness: fair(mins),
      candidates: all.length, candidatesAtBookedTime: same.length, optimum: { longest: optL, total: optT }, optimumAtBookedTime: { longest: sameL, total: sameT },
      excess: { longest: Math.max(...mins) - optL, total: sum(mins) - optT }, excessAtBookedTime: { longest: sameL == null ? null : Math.max(...mins) - sameL, total: sameT == null ? null : sum(mins) - sameT },
      minimaxCourtAgrees: rules.minimax.court === g.venueId, rules });
  }
  // game messages per booking: what the run's metrics counted (sim_users/metrics.mjs, the request/answer/tap actions)
  const a = res.headline.actionsPerGame, b = res.headline.booked;
  perRun[run] = { games: sg.length, booked: b.serve, gameMessages: a.serveGameTotal, gameMessagesPerBooking: b.serve ? r1(a.serveGameTotal / b.serve) : null, allMessagesPerBooking: b.serve ? r1(a.serveTotal / b.serve) : null,
    baselineMessagesPerBooking: b.baseline ? r1(a.baselineTotal / b.baseline) : null,
    // invitation exposure: how often each simulated user was invited to a booked game (fit.js gini, as match_eval.mjs)
    giniInvited: gini(personas.map((p) => sg.filter((g) => g.with.includes(p.id)).length)) };
}

// ---- the rules on every pair of simulated users, at the start of each window they share (what court() decides) ----
const pairs = [], dates0 = week(read(path.join(ROOT, "submission/results/sim_users_v2s2.json")).days[0].date);
const plays = personas.filter((p) => p.sports.includes(SPORT));
for (let i = 0; i < plays.length; i++) for (let j = i + 1; j < plays.length; j++) {
  const ids = [plays[i].id, plays[j].id], cs = candidates(ids, dates0);
  const starts = [...new Set(cs.map((c) => `${c.date} ${c.start}`))].filter((k, n, a) => { const [d, s] = k.split(" "); return !a.includes(`${d} ${hm(toMin(s) - 30)}`); });
  for (const k of starts) { const at = cs.filter((c) => `${c.date} ${c.start}` === k); pairs.push(Object.fromEntries(VENUE_RULES.map((rule) => [rule, pickOf(best(at, rule))]))); }
}

// ---- in all ----
const agg = (rows) => {
  const n = rows.length, at = rows.filter((g) => g.excessAtBookedTime.longest != null);
  return { games: n, played: rows.filter((g) => g.played).length,
    excessLongest: { mean: r1(mean(rows.map((g) => g.excess.longest))), max: Math.max(...rows.map((g) => g.excess.longest)), zero: rows.filter((g) => !g.excess.longest).length },
    excessTotal: { mean: r1(mean(rows.map((g) => g.excess.total))), max: Math.max(...rows.map((g) => g.excess.total)), zero: rows.filter((g) => !g.excess.total).length },
    excessAtBookedTime: { longestMean: r1(mean(at.map((g) => g.excessAtBookedTime.longest))), totalMean: r1(mean(at.map((g) => g.excessAtBookedTime.total))), games: at.length },
    fairness: { mean: r3(mean(rows.map((g) => g.fairness))), min: Math.min(...rows.map((g) => g.fairness)) },
    minimaxCourtAgrees: rows.filter((g) => g.minimaxCourtAgrees).length };
};
const ruleTable = (rows) => {
  const t = Object.fromEntries(VENUE_RULES.map((rule) => { const xs = rows.map((r) => r[rule]).filter(Boolean); return [rule, { n: xs.length, totalMean: r1(mean(xs.map((x) => x.total))), longestMean: r1(mean(xs.map((x) => x.longest))), worstTrip: Math.max(...xs.map((x) => x.longest)), fairnessMean: r3(mean(xs.map((x) => x.fairness))) }]; }));
  const both = rows.filter((r) => r.minimax && r.sum);
  t.minimaxVsSum = { cases: both.length, differ: both.filter((r) => r.minimax.venue !== r.sum.venue || r.minimax.date !== r.sum.date || r.minimax.start !== r.sum.start).length,
    extraTotalMinutes: sum(both.map((r) => r.minimax.total - r.sum.total)),
    // (of those, the minutes where both have the same longest trip: minimax's tie went to the venue listed first)
    extraTotalOnTies: sum(both.filter((r) => r.minimax.longest === r.sum.longest).map((r) => r.minimax.total - r.sum.total)), extraTotalPerCase: r1(mean(both.map((r) => r.minimax.total - r.sum.total))),
    worstTripSavedPerCase: r1(mean(both.map((r) => r.sum.longest - r.minimax.longest))), worstTripSavedMax: Math.max(...both.map((r) => r.sum.longest - r.minimax.longest)) };
  return t;
};
// invitation-exposure inequality as match_eval.mjs measured it (its saved results; giniAsks over members eligible twice)
const MP = path.join(HERE, "matchplan/results"), giniAsks = {};
for (const f of fs.readdirSync(MP).filter((f) => /^match_eval_.*\.json$/.test(f))) { const j = read(path.join(MP, f)); giniAsks[f.replace(/\.json$/, "")] = { requests: j.requests, arms: Object.fromEntries(Object.entries(j.arms).map(([k, a]) => [k, a.summary?.fairness?.giniAsks ?? null])) }; }

const out = { simulated: true, note: "Simulated users and venues (agent/test/sim_users, web/public/data/venues.json); no real person. Trips in minutes, as play.js travelMin.", at: new Date().toISOString(),
  horizon: "the week from each run's first day; half-hour starts; 90-minute games; a court free in the sample timetable, less the run's other bookings", runs: RUNS,
  aggregate: agg(games), messages: perRun,
  rules: { bookedAtBookedTime: ruleTable(games.map((g) => Object.fromEntries(VENUE_RULES.map((r) => [r, g.rules[r].atBookedTime])))), bookedAnyTime: ruleTable(games.map((g) => Object.fromEntries(VENUE_RULES.map((r) => [r, g.rules[r].anyTime])))), allPairs: ruleTable(pairs) },
  exposure: { giniInvitedSimRuns: Object.fromEntries(RUNS.map((r) => [r, perRun[r].giniInvited])), giniAsksMatchEval: giniAsks },
  games };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ aggregate: out.aggregate, rules: Object.fromEntries(Object.entries(out.rules).map(([k, t]) => [k, t.minimaxVsSum])) }, null, 1));
console.log(`wrote ${OUT}`);
