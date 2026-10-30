// The "Match asks first" trial (agents/ask.js, ASK_TRIAL_P): what the log says. Reads the daily ask points from the asks
// store (db.trial) and the players' games from the player store, and reports
//   1. the proximal effect: games in the 48 hours after an ask point, ask arm against withhold arm. The contrast is
//      weighted by the chance of each arm at that point (1/(1-p) and 1/p), so points logged under different ASK_TRIAL_P
//      still compare; points with p = 0 (the trial off) carry no contrast and are left out of it. The interval is a
//      bootstrap over players (points of one player are not independent), 95%, seeded.
//   2. the response rate (an answer within 24 hours) to the asks made, by week since sign-up (the player's linkedAt).
// A game counts from the player's record (games) and the matches in their calendar (events, kind "match"), by its start.
//   node test/ask_trial_analysis.mjs [--asks data/asks.json] [--store data/players.json] [--json]
// (ASK_FILE and STORE_FILE are the defaults, as the gateway reads them)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const H = 36e5, WEEK = 7 * 24 * H;
const startOf = (g) => { if (!g?.date) return null; const [y, mo, d] = g.date.split("-").map(Number), [h, mi] = String(g.start || "00:00").split(":").map(Number); const t = new Date(y, mo - 1, d, h || 0, mi || 0).getTime(); return Number.isFinite(t) ? t : null; };
// the start times of a player's games, each game once (a booked game can be on the record and in the calendar)
const gameTimes = (p) => [...new Set([...(p?.games || []), ...(p?.events || []).filter((e) => e.kind === "match")].map(startOf).filter((t) => t != null))];

// a small seeded generator (mulberry32), so the interval is the same for the same log
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// the weighted difference: mean games after an ask, minus after a withheld point (inverse-probability weights)
function contrast(rows) {
  let a = 0, wa = 0, w = 0, ww = 0;
  for (const r of rows) { if (r.arm === "ask") { a += r.games / (1 - r.p); wa += 1 / (1 - r.p); } else { w += r.games / r.p; ww += 1 / r.p; } }
  return wa && ww ? a / wa - w / ww : null;
}

// rows: the trial log; players: { id: player } from the store; now: points less than 48 h old are left out of the effect
export function analyze(rows, players, { now = Date.now(), boot = 1000, seed = 7 } = {}) {
  const pts = rows.filter((r) => r && r.who && Number.isFinite(r.at)).map((r) => {
    const ts = gameTimes(players[r.who]);
    return { ...r, p: +r.p || 0, games: ts.filter((t) => t >= r.at && t < r.at + 48 * H).length, done: now - r.at >= 48 * H };
  });
  // 1. by arm, and the contrast where the arm was drawn (0 < p < 1)
  const byArm = {};
  for (const arm of ["ask", "withhold"]) {
    const xs = pts.filter((r) => r.arm === arm && r.done);
    byArm[arm] = { points: xs.length, players: new Set(xs.map((r) => r.who)).size, games48h: xs.reduce((s, r) => s + r.games, 0), meanGames48h: xs.length ? +(xs.reduce((s, r) => s + r.games, 0) / xs.length).toFixed(3) : null, anyGame48h: xs.length ? +(xs.filter((r) => r.games > 0).length / xs.length).toFixed(3) : null };
  }
  const drawn = pts.filter((r) => r.done && r.p > 0 && r.p < 1), est = contrast(drawn);
  let ci = null;
  if (est != null && boot > 0) {
    const by = new Map(); for (const r of drawn) by.set(r.who, [...(by.get(r.who) || []), r]);
    const ids = [...by.keys()], rand = rng(seed), out = [];
    for (let b = 0; b < boot; b++) { const s = []; for (let k = 0; k < ids.length; k++) s.push(...by.get(ids[Math.floor(rand() * ids.length)])); const c = contrast(s); if (c != null) out.push(c); }
    out.sort((x, y) => x - y);
    if (out.length >= 20) ci = [+out[Math.floor(0.025 * out.length)].toFixed(3), +out[Math.min(out.length - 1, Math.floor(0.975 * out.length))].toFixed(3)];
  }
  // 2. the response rate to asks made, by week since sign-up (players no longer in the store have no week)
  const weeks = {};
  for (const r of pts.filter((x) => x.asked)) {
    const joined = players[r.who]?.linkedAt, wk = Number.isFinite(joined) ? Math.max(0, Math.floor((r.at - joined) / WEEK)) : "unknown";
    const x = (weeks[wk] ||= { asked: 0, answered: 0, yes: 0 });
    x.asked++; if (r.response) x.answered++; if (r.response === "yes") x.yes++;
  }
  for (const x of Object.values(weeks)) { x.responseRate = +(x.answered / x.asked).toFixed(3); x.yesRate = +(x.yes / x.asked).toFixed(3); }
  return { points: pts.length, pending48h: pts.filter((r) => !r.done).length, byArm, effect: { games48h: est == null ? null : +est.toFixed(3), ci95: ci, points: drawn.length, players: new Set(drawn.map((r) => r.who)).size, weighted: "inverse probability of the arm" }, responseByWeek: weeks };
}

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const askFile = path.resolve(arg("--asks", process.env.ASK_FILE || "data/asks.json")), storeFile = path.resolve(arg("--store", process.env.STORE_FILE || "data/players.json"));
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const r = analyze(read(askFile, {}).trial || [], read(storeFile, {}).players || {});
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`${r.points} daily ask points (${r.pending48h} under 48 h old, left out of the effect)`);
    for (const [arm, x] of Object.entries(r.byArm)) console.log(`  ${arm.padEnd(8)} ${String(x.points).padStart(5)} points, ${x.players} players: ${x.meanGames48h ?? "-"} games in 48 h on average, ${x.anyGame48h ?? "-"} with any`);
    const e = r.effect;
    console.log(e.games48h == null ? "proximal effect: no points with both arms possible (is ASK_TRIAL_P set?)" : `proximal effect of asking: ${e.games48h >= 0 ? "+" : ""}${e.games48h} games in 48 h${e.ci95 ? ` (95% ${e.ci95[0]} to ${e.ci95[1]}, bootstrap over ${e.players} players)` : ""}, from ${e.points} points`);
    console.log("response within 24 h, by week since sign-up:");
    for (const [wk, x] of Object.entries(r.responseByWeek).sort((a, b) => (+a[0] || 0) - (+b[0] || 0))) console.log(`  week ${String(wk).padEnd(7)} ${x.answered}/${x.asked} answered (${x.responseRate}), ${x.yes} yes (${x.yesRate})`);
  }
}
