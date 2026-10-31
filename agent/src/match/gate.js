// When the Match helper should not send its daily ask (agents/ask.js). The weekly cap and the trial stay as they were;
// this gate, for a daily ask point the trial left in the "ask" arm, picks the hour and whether to send at all.
// For each decision point (hour of day, weekday or weekend) it keeps a Beta posterior on "answered within 2 hours",
// from the player's own asks in the trial log, counting the neighbouring hours at half weight and starting from the
// club's rate at that hour. Once a day it draws one value per hour still open (Thompson sampling, seeded by player and
// day, so the plan is the same after a restart), takes the best hour, multiplies by a draw of the player's chance of a
// yes, and sends only if that, less a burden cost, is above a threshold. The burden grows with recent asks left
// unanswered and is large after "not this week" (Oralytics penalises its reward the same way). Otherwise: no ask today.
// After EOPA and ProPerSim (when to speak, fewer suggestions scored better) and arXiv 2410.04596 (a more frequent
// proactive assistant: same productivity, preference ~90% to 47%). Measured in test/ask_gate_sim.mjs.
//   ASK_GATE=off restores the fixed hour (ASK_HOUR); ASK_GATE_HOURS (8-21) the hours it may ask in.
import crypto from "node:crypto";

const H = 36e5, DAY = 24 * H, FAST = 2 * H;
// on unless ASK_GATE=off: on held-out simulated seeds it met the rule declared before the run (more games from asks
// than the ask at 12:00, fewer opt-outs; submission/results/ask_gate.json)
export const on = () => process.env.ASK_GATE !== "off";
export const hours = () => { const m = /^(\d{1,2})-(\d{1,2})$/.exec(process.env.ASK_GATE_HOURS || ""); return m && +m[1] <= +m[2] && +m[2] < 24 ? [+m[1], +m[2]] : [8, 21]; };
// chosen on training seeds 1-4 of test/ask_gate_sim.mjs (lambda: per unanswered ask; mu: after "not this week";
// tau: the bar; yes: how much the drawn chance of a yes counts; n0: how many asks the club's rate counts for)
export const PARAMS = { lambda: 0.1, mu: 0.3, tau: 0.1, yes: 1, n0: 3 };
// ASK_GATE_TAU moves the bar (below 0: the gate only picks the hour and always sends)
const params = () => { const t = process.env.ASK_GATE_TAU; return t != null && t !== "" && Number.isFinite(+t) ? { ...PARAMS, tau: +t } : PARAMS; };

const isWeekend = (t) => { const d = new Date(t).getDay(); return d === 0 || d === 6; };
export const bucketOf = (t) => ({ hour: new Date(t).getHours(), weekend: isWeekend(t) });
const sentAt = (r) => r.sentAt ?? r.at;
// an ask that went out and whose 2 hours are over (or that was answered inside them)
const fast = (r) => r.respondedAt != null && r.respondedAt - sentAt(r) <= FAST;
const resolved = (r, now) => r.asked && Number.isFinite(sentAt(r)) && sentAt(r) < now && (fast(r) || now - sentAt(r) > FAST);

// raw counts per bucket [weekend 0|1][hour]: asks resolved, answered within 2 h, answered at all, yes
function counts(rows, now) {
  const c = { n: [new Array(24).fill(0), new Array(24).fill(0)], s: [new Array(24).fill(0), new Array(24).fill(0)], answered: 0, yes: 0 };
  for (const r of rows) {
    if (!resolved(r, now)) continue;
    const b = bucketOf(sentAt(r)), w = +b.weekend;
    c.n[w][b.hour]++; if (fast(r)) c.s[w][b.hour]++;
    if (r.response) { c.answered++; if (r.response === "yes") c.yes++; }
  }
  return c;
}
// the same hour counts fully, an hour either side at 0.5, two hours at 0.25, the same hour on the other kind of day at 0.3
const K = [1, 0.5, 0.25];
const smooth = (c, w, h, key) => { let x = 0; for (let d = -2; d <= 2; d++) { const hh = h + d; if (hh >= 0 && hh < 24) x += K[Math.abs(d)] * c[key][w][hh]; } return x + 0.3 * c[key][1 - w][h]; };

// the club's rates (every player's asks), the prior each player starts from: Beta(1, 2) at a bucket nobody was asked in
export function club(rows, now = Date.now()) {
  const c = counts(rows, now), rate = [[], []];
  for (const w of [0, 1]) for (let h = 0; h < 24; h++) rate[w][h] = (1 + smooth(c, w, h, "s")) / (3 + smooth(c, w, h, "n"));
  return { rate, yes: (1 + c.yes) / (2 + c.answered) };
}

// one player's posteriors: for each bucket Beta(a, b) on answered within 2 h, and Beta on a yes when answered
export function posterior(rows, clubRates = club([]), now = Date.now(), p = PARAMS) {
  const c = counts(rows, now), a = [[], []], b = [[], []];
  for (const w of [0, 1]) for (let h = 0; h < 24; h++) {
    const r = clubRates.rate[w][h], s = smooth(c, w, h, "s"), n = smooth(c, w, h, "n");
    a[w][h] = p.n0 * r + s; b[w][h] = p.n0 * (1 - r) + n - s;
  }
  const y = clubRates.yes;
  return { a, b, yes: [p.n0 * y + c.yes, p.n0 * (1 - y) + c.answered - c.yes], asked: c.n[0].reduce((x, v) => x + v, 0) + c.n[1].reduce((x, v) => x + v, 0) };
}
// the player's reply window: the hours (in range) whose posterior mean is within 0.1 of the best
export function window(post, weekend, [from, to] = hours()) {
  const m = []; for (let h = from; h <= to; h++) m.push([h, post.a[+weekend][h] / (post.a[+weekend][h] + post.b[+weekend][h])]);
  const best = Math.max(...m.map((x) => x[1])), hs = m.filter((x) => x[1] >= best - 0.1).map((x) => x[0]);
  return { from: Math.min(...hs), to: Math.max(...hs), mean: +best.toFixed(2) };
}

// the burden: each ask left unanswered (no answer and its 2 hours over) in the last 14 days, halved per week of age,
// times lambda; plus mu after "not this week" in the last 14 days, halved per week
export function burden(rows, now = Date.now(), p = PARAMS) {
  let open = 0, week = 0, n = 0;
  for (const r of rows) {
    if (!r.asked || !Number.isFinite(sentAt(r))) continue;
    const age = now - sentAt(r); if (age < 0 || age > 14 * DAY) continue;
    const decay = 0.5 ** (age / (7 * DAY));
    if (r.response == null && age > FAST) { open += decay; n++; }
    if (r.response === "week") week = Math.max(week, decay);
  }
  return { cost: p.lambda * open + p.mu * week, unanswered: n, notThisWeek: week > 0 };
}

// seeded draws: mulberry32 from a hash of (player, day), Beta from two Gammas (Marsaglia-Tsang)
const seedOf = (s) => parseInt(crypto.createHash("sha256").update(s).digest("hex").slice(0, 8), 16);
export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gamma(k, u) {
  if (k < 1) return gamma(k + 1, u) * Math.pow(u() || 1e-12, 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v; do { x = Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u()); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const q = u();
    if (q < 1 - 0.0331 * x ** 4 || Math.log(q || 1e-12) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export const beta = (a, b, u) => { const x = gamma(a, u); return x / (x + gamma(b, u)); };
const hh = (h) => `${String(h).padStart(2, "0")}:00`;

// today's plan for one player: { send, hour, value, cost, why }. rows: this player's trial log rows before now;
// clubRates: club(allRows); now: the first look today (hours already gone are not drawn)
export function plan({ rows = [], clubRates = club([]), who = "", day = "", now = Date.now(), range = hours(), p = params() } = {}) {
  const from = Math.max(range[0], new Date(now).getHours()), to = range[1];
  if (from > to) return { send: false, why: "not asking today: no hour left in the asking hours" };
  const post = posterior(rows, clubRates, now, p), w = +isWeekend(now), u = rng(seedOf(`ask-gate|${who}|${day}`));
  let best = null;
  for (let h = from; h <= to; h++) { const v = beta(post.a[w][h], post.b[w][h], u); if (!best || v > best.v) best = { h, v }; }
  const y = beta(post.yes[0], post.yes[1], u), value = best.v * (1 - p.yes + p.yes * y), b = burden(rows, now, p), score = value - b.cost;
  const send = score > p.tau, win = window(post, w, range);
  const parts = [...(b.unanswered ? [`${b.unanswered} unanswered`] : []), ...(b.notThisWeek ? ["said not this week"] : [])];
  const load = `burden ${b.cost.toFixed(2)}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  const why = `${send ? `asking at ${hh(best.h)}` : "not asking today"}: drew ${best.v.toFixed(2)} for an answer within 2 h at ${hh(best.h)} (replies usually ${hh(win.from)}-${hh(win.to)}, ${post.asked} asks seen), ${y.toFixed(2)} for a yes; ${load}; ${score.toFixed(2)} ${send ? ">" : "<="} ${p.tau}`;
  return { send, hour: best.h, value: +value.toFixed(3), cost: +b.cost.toFixed(3), score: +score.toFixed(3), why };
}
