// The send gate (match/gate.js) in simulation: when should the Match helper's daily ask go out, and when not at all.
// Simulated players, each with a hidden reply window (the hours they answer within 2 h, weekday and weekend), a hidden
// interest (the chance of a yes when they answer) and a hidden annoyance (asks left unanswered raise it, answered ones a little; it decays by a
// tenth a day; the chance of "not this week" and of opting out ("stop") rise with it). Every policy keeps what
// agents/ask.js keeps: one daily ask at most, only when the week is short of the player's goal, the weekly cap (3),
// quiet until Monday after "not this week", nothing after "stop". Policies:
//   current  the ask at 12:00 (ASK_HOUR) every day it can     fixed  the same at the one hour best on training seeds
//   gate     match/gate.js (Thompson sampling, burden cost)   timing the gate's hour, always sending (no burden, no bar)
//   oracle   each player's true best hour, every day it can (a reference no policy can know)
// The burden cost and the bar are chosen on training seeds 1-4 by J = games from asks - 3 x opt-outs - 0.5 x "not
// this week" per player, declared before the held-out run; reported on held-out seeds 101-120 with 95% intervals
// (t over seeds; differences paired by seed: the same players and the same hidden draws for every policy).
// Rule, also declared before: the gate is on by default only if on held-out seeds its J is above the current ask's
// (paired interval above 0) and its games from asks are not below them (paired interval not wholly below 0).
// Simplified: "Another time" counts as a no (no second ask that day); the Messenger 24-hour window is always open.
//   node test/ask_gate_sim.mjs [--quick] [--out ../submission/results/ask_gate.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { plan, club, rng, PARAMS } from "../src/match/gate.js";

const H = 36e5, DAY = 24 * H, T0 = new Date(2026, 0, 5).getTime(); // a Monday
const WEEKS = 12, CAP = 3, RANGE = [8, 21];

// a player: hidden traits drawn from the seed
function player(u, i) {
  const nrm = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  const clip = (h) => Math.min(22, Math.max(7, Math.round(h)));
  const k = u(), cw = clip(k < 0.45 ? 19.5 + 1.5 * nrm() : k < 0.7 ? 12.5 + nrm() : 7 + 15 * u());
  return { id: `s${i}`, cw, ce: clip(cw + Math.floor(u() * 6) - 3), width: 1 + Math.floor(u() * 3), hi: 0.55 + 0.35 * u(), lo: 0.03 + 0.17 * u(),
    interest: 0.1 + 0.6 * u(), goal: 1 + Math.floor(u() * 3), own: 0.05 + 0.15 * u() };
}
const pFast = (pl, t) => { const d = new Date(t), we = d.getDay() === 0 || d.getDay() === 6; return Math.abs(d.getHours() - (we ? pl.ce : pl.cw)) <= pl.width ? pl.hi : pl.lo; };

// one run: N players over WEEKS weeks under one policy. Each player's hidden draws come from its own stream, so the
// same seed gives every policy the same players and the same luck where their asks coincide.
function run(seed, policy, { n = 300, params = PARAMS, hour = 12 } = {}) {
  const top = rng(seed * 7919 + 1), pls = Array.from({ length: n }, (_, i) => player(top, i));
  const st = pls.map((pl, i) => ({ u: rng(seed * 1e6 + i * 97 + 3), annoy: 0, out: false, snooze: -1, week: -1, games: 0 }));
  const rows = pls.map(() => []); // the trial log, per player (the gate's input), with the truth kept on it
  const m = { asks: 0, fast: 0, answered: 0, yes: 0, games: 0, notThisWeek: 0, optOuts: 0, ownGames: 0 };
  // what the gate may see at time t: an answer only once it was given
  const seen = (rs, t) => rs.filter((r) => r.at < t).map((r) => (r.respondedAt != null && r.respondedAt > t ? { ...r, response: null, respondedAt: null } : r));
  for (let d = 0; d < WEEKS * 7; d++) {
    const day0 = T0 + d * DAY, wk = Math.floor(d / 7), look = day0 + RANGE[0] * H;
    const clubRates = policy === "gate" || policy === "timing" ? club(rows.flatMap((rs) => seen(rs, look)), look) : null;
    for (let i = 0; i < n; i++) {
      const pl = pls[i], s = st[i], u = s.u;
      if (s.week !== wk) { s.week = wk; s.games = 0; }
      s.annoy *= 0.9;
      const ownToday = u() < pl.own, rs = rows[i];
      if (s.out || s.snooze > d || s.games >= pl.goal || rs.filter((r) => r.at >= T0 + wk * 7 * DAY).length >= CAP) { if (ownToday) { s.games++; m.ownGames++; } continue; }
      let at;
      if (policy === "current" || policy === "fixed") at = day0 + hour * H;
      else if (policy === "oracle") { const we = new Date(day0).getDay() % 6 === 0; at = day0 + Math.min(RANGE[1], Math.max(RANGE[0], we ? pl.ce : pl.cw)) * H; }
      else {
        const p = plan({ rows: seen(rs, look), clubRates, who: pl.id, day: `${seed}-${d}`, now: look, range: RANGE, p: policy === "timing" ? { ...params, lambda: 0, mu: 0, tau: -Infinity } : params });
        if (!p.send) { if (ownToday) { s.games++; m.ownGames++; } continue; }
        at = day0 + p.hour * H;
      }
      // the ask goes out: fast, late (2-24 h) or never; then the answer, the game, the annoyance, maybe "stop"
      m.asks++;
      const f = u() < pFast(pl, at), late = !f && u() < 0.35, row = { who: pl.id, day: d, at, sentAt: at, asked: true, arm: "ask", p: 0, response: null, respondedAt: null };
      if (f || late) {
        row.respondedAt = at + (f ? u() * 2 * H : 2 * H + u() * 22 * H);
        const yes = u() < pl.interest, week = !yes && u() < Math.min(0.6, 0.15 + 0.1 * s.annoy);
        row.response = yes ? "yes" : week ? "week" : "other";
        m.answered++; if (f) m.fast++;
        if (yes) { m.yes++; if (u() < 0.75) { m.games++; s.games++; } }
        if (week) { m.notThisWeek++; s.snooze = (wk + 1) * 7; }
        s.annoy += 0.3;
      } else s.annoy += 1;
      rs.push(row);
      if (u() < 0.002 + 0.006 * s.annoy) { s.out = true; m.optOuts++; }
      if (ownToday && s.games < pl.goal) { s.games++; m.ownGames++; }
    }
  }
  const per = (x) => x / n;
  return { asks: per(m.asks), fast: per(m.fast), answered: per(m.answered), yes: per(m.yes), games: per(m.games), notThisWeek: per(m.notThisWeek), optOuts: per(m.optOuts),
    fastRate: m.asks ? m.fast / m.asks : 0, yesRate: m.asks ? m.yes / m.asks : 0, J: per(m.games) - 3 * per(m.optOuts) - 0.5 * per(m.notThisWeek) };
}

// 95% interval over seeds (t with n-1 degrees of freedom)
const T = { 3: 3.182, 4: 2.776, 9: 2.262, 19: 2.093, 29: 2.045 };
function ci(xs) {
  const k = xs.length, mean = xs.reduce((a, b) => a + b, 0) / k, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, k - 1)), h = (T[k - 1] || 1.96) * sd / Math.sqrt(k);
  const r = (x) => +x.toFixed(4);
  return { mean: r(mean), ci95: [r(mean - h), r(mean + h)] };
}
const KEYS = ["asks", "fast", "answered", "yes", "games", "notThisWeek", "optOuts", "fastRate", "yesRate", "J"];
const summary = (runs) => Object.fromEntries(KEYS.map((k) => [k, ci(runs.map((r) => r[k]))]));
const diff = (a, b) => Object.fromEntries(KEYS.map((k) => [k, ci(a.map((r, i) => r[k] - b[i][k]))]));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const quick = process.argv.includes("--quick"), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const TRAIN = quick ? [1, 2] : [1, 2, 3, 4], HELD = quick ? [101, 102, 103, 104, 105] : Array.from({ length: 20 }, (_, i) => 101 + i), N = quick ? 150 : 300;
  const t0 = Date.now(), mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // 1. training seeds: the fixed best hour, then the gate's burden cost and bar
  const hourScores = [];
  for (let h = RANGE[0]; h <= RANGE[1]; h++) hourScores.push({ hour: h, J: +mean(TRAIN.map((s) => run(s, "fixed", { n: N, hour: h }).J)).toFixed(4) });
  const bestHour = hourScores.reduce((a, b) => (b.J > a.J ? b : a)).hour;
  const grid = [];
  for (const n0 of [1, 3]) for (const lambda of [0, 0.1, 0.3]) for (const mu of [0.3, 1]) for (const tau of [0, 0.05, 0.1, 0.15, 0.2]) for (const yes of [0, 1]) {
    const params = { ...PARAMS, n0, lambda, mu, tau, yes }, rs = TRAIN.map((s) => run(s, "gate", { n: N, params }));
    grid.push({ n0, lambda, mu, tau, yes, J: +mean(rs.map((r) => r.J)).toFixed(4), games: +mean(rs.map((r) => r.games)).toFixed(4), asks: +mean(rs.map((r) => r.asks)).toFixed(3) });
  }
  grid.sort((a, b) => b.J - a.J);
  const chosen = { ...PARAMS, n0: grid[0].n0, lambda: grid[0].lambda, mu: grid[0].mu, tau: grid[0].tau, yes: grid[0].yes };
  console.log(`training: best fixed hour ${bestHour}:00; gate ${JSON.stringify(chosen)} (J ${grid[0].J}); in gate.js: ${JSON.stringify(PARAMS)}`);
  // 2. held-out seeds, every policy on the same players
  const pol = { current: { hour: 12 }, fixed: { hour: bestHour }, gate: { params: chosen }, timing: { params: chosen }, oracle: {} };
  const out = Object.fromEntries(Object.entries(pol).map(([k, o]) => [k, HELD.map((s) => run(s, k === "current" ? "fixed" : k, { n: N, ...o }))]));
  const result = {
    simulated: true,
    what: "Daily 'Match asks first' ask: when to send and when not to. Simulated players with hidden reply windows, interest and annoyance (test/ask_gate_sim.mjs); per player over 12 weeks.",
    setup: { players: N, weeks: WEEKS, weekCap: CAP, hours: RANGE, trainSeeds: TRAIN, heldOutSeeds: HELD, objective: "J = games from asks - 3 x opt-outs - 0.5 x 'not this week', per player (declared before the held-out run)", interval: "95% t interval over held-out seeds; differences paired by seed" },
    tuning: { fixedHour: { best: bestHour, byHour: hourScores }, gate: { chosen, top5: grid.slice(0, 5), configs: grid.length }, gateParamsInCode: PARAMS },
    heldOut: Object.fromEntries(Object.entries(out).map(([k, rs]) => [k, summary(rs)])),
    vsCurrent: Object.fromEntries(["fixed", "gate", "timing", "oracle"].map((k) => [k, diff(out[k], out.current)])),
    gateVsFixed: diff(out.gate, out.fixed),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  const f = (x) => `${x.mean} [${x.ci95[0]}, ${x.ci95[1]}]`;
  for (const [k, s] of Object.entries(result.heldOut)) console.log(`${k.padEnd(8)} asks ${f(s.asks)}  fast ${f(s.fast)}  yes ${f(s.yes)}  games ${f(s.games)}  not-this-week ${f(s.notThisWeek)}  opt-outs ${f(s.optOuts)}`);
  for (const [k, d] of Object.entries(result.vsCurrent)) console.log(`${k} - current: games ${f(d.games)}  opt-outs ${f(d.optOuts)}  asks ${f(d.asks)}  J ${f(d.J)}`);
  console.log(`gate - fixed: games ${f(result.gateVsFixed.games)}  opt-outs ${f(result.gateVsFixed.optOuts)}  J ${f(result.gateVsFixed.J)}`);
  const file = arg("--out", null);
  if (file) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(path.resolve(file), JSON.stringify(result, null, 2) + "\n"); console.log(`wrote ${file}`); }
}

export { run, player };
