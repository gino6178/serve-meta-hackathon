// Active epistemic querying: when the talks for a game have not landed, the one yes-or-no question whose answer most
// raises the chance of a game, by the value of information.
//   For a member m and one of the player's times s: p(m free at s) is the mean of a Beta posterior, Beta(a + yes, b + no)
//   (a, b: the club's population prior for that weekday, hour and sport, populationPrior below; Beta(1, 1) without data)
//   over what the player's agent has seen of that member's agent at that weekday and hour (talk.js memoryOf: faded
//   counts, never their calendar); c(m) is the chance of a yes from the member's agent's band (match/model.js). A game
//   at (m, s) then comes with probability c * p.
//   Without asking, the agent would try the best pair: P0 = max c * p. Asking about (m, s) and hearing yes (with
//   probability p) makes that pair's chance c; hearing no makes it 0. The question's value is the expected best chance
//   after the answer, less P0; the question asked is the one of greatest value, and only if it is worth asking (MIN).
//   Pairs already talked about in this request are left out. Code only, no model: tested in test/voi_unit.mjs.
const BAND_C = { unlikely: 0.15, maybe: 0.4, likely: 0.65, "very likely": 0.85 };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MIN = 0.05;
export const chanceOf = (c) => (c.p != null ? c.p : BAND_C[c.band] ?? 0.4);
const keyOf = (s) => `${DAYS[new Date(`${s.date}T12:00:00`).getDay()]} ${String(s.start).slice(0, 2)}:00`;
// The cold start: a population prior per (weekday-hour, sport) instead of a flat Beta(1, 1). f is the share of the
// club's members who play the sport and are free at that weekday and hour ("Thu 19-22" lists), or, with private
// calendars (no lists), the pooled yes rate of what the player's agent has seen of everyone at that hour; smoothed as
// (k + 1) / (n + 2), weighted by PSEUDO, so a few answers from the member soon outweigh it. No data: Beta(1, 1).
// 0.5: a member's week is mostly a yes or a no at a given hour, not a coin, so one answer from them should count for
// more than the club's average (test/pref_sim.mjs: at 2 the first talk went to a worse pair, 71.4% against 77.2%).
export const PSEUDO = () => +(process.env.VOI_PSEUDO || 0.5);
const FLAT = { a: 1, b: 1 };
// (free at an hour: a game of `minutes` that starts then fits in the window, as talk.js lists times; "Thu 19-22" is
// free at 19:00 and 20:00, not at 21:00)
const freeAt = (list, day, h, minutes = 90) => (list || []).some((w) => { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m && m[1] === day && +m[2] <= h && h * 60 + minutes <= +m[3] * 60; });
// members: [{ free, sports }]; mems: talk.js memories (used when no member has a free list); -> key => { a, b }
export function populationPrior({ members = [], sport = "badminton", mems = [], pseudo = PSEUDO() } = {}) {
  const plays = members.filter((m) => (m.sports || ["badminton"]).includes(sport)), lists = plays.filter((m) => m.free?.length);
  const cache = new Map();
  const out = (k) => {
    if (cache.has(k)) return cache.get(k);
    const [day, hh] = k.split(" "), h = +String(hh).slice(0, 2);
    let yes = 0, n = 0;
    if (lists.length) { n = lists.length; yes = lists.filter((m) => freeAt(m.free, day, h)).length; }
    else for (const mem of mems) { const y = (mem?.yes?.[k] || 0) + (mem?.asked?.[k] || 0) * 0.5, no = mem?.no?.[k] || 0; yes += y; n += y + no; }
    const f = (yes + 1) / (n + 2), ab = n > 0 ? { a: pseudo * f, b: pseudo * (1 - f) } : FLAT;
    cache.set(k, ab);
    return ab;
  };
  out.kernel = slotKernel(lists);
  return out;
}
// Shared preferences (PREF_SHARE, on by default): one answer is evidence about the hours like it, not only its own. A
// member who can't do Tuesday 19:00 most likely can't do Tuesday 20:00 either; one who plays Mondays at 19:00 is more
// likely free Wednesdays at 19:00 than Saturdays at 9:00. Each other hour j lends its counts to hour k, weighted by
// rho(k, j) * SHARE (only positive links): a structured prior over how hours go together, as in Pep (arXiv 2602.15012)
// and VPL (2408.10075), here as borrowed Beta counts so it stays one line of arithmetic and a member's own answers at
// k still count most. rho comes from the club's free lists when 8 or more members give them (the correlation between
// "free at k" and "free at j" across members), else from how clubs play: the same day an hour apart 0.7, two hours
// 0.4; the same hour on another weeknight 0.3, on the other weekend day 0.5.
export const SHARE = () => +(process.env.PREF_SHARE_W || 0.5);
const WEEKNIGHT = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
export function structuralRho(k, j) {
  if (k === j) return 1;
  const [d1, h1] = k.split(" "), [d2, h2] = j.split(" "), dh = Math.abs(parseInt(h1, 10) - parseInt(h2, 10));
  if (d1 === d2) return dh === 1 ? 0.7 : dh === 2 ? 0.4 : 0;
  if (dh) return 0;
  if (WEEKNIGHT.has(d1) && WEEKNIGHT.has(d2)) return 0.3;
  if (!WEEKNIGHT.has(d1) && !WEEKNIGHT.has(d2)) return 0.5;
  return 0;
}
export function slotKernel(lists = []) {
  if (lists.length < 8) return structuralRho;
  const cache = new Map(), n = lists.length;
  const at = (k) => { if (!cache.has(k)) { const [d, hh] = k.split(" "), h = parseInt(hh, 10); cache.set(k, lists.map((m) => (freeAt(m.free, d, h) ? 1 : 0))); } return cache.get(k); };
  return (k, j) => {
    if (k === j) return 1;
    const x = at(k), y = at(j), mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let c = 0, vx = 0, vy = 0;
    for (let i = 0; i < n; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
    return vx && vy ? c / Math.sqrt(vx * vy) : structuralRho(k, j);
  };
}
const shareOn = () => process.env.PREF_SHARE !== "off";
// the Beta posterior's mean and spread for (member, time), from talk.js's faded counts over the prior (flat by default)
export function posterior(mem, s, prior = null) {
  const k = keyOf(s), pr = (typeof prior === "function" ? prior(k) : prior?.[k]) || FLAT;
  let y = (mem?.yes?.[k] || 0) + (mem?.asked?.[k] || 0) * 0.5, n = mem?.no?.[k] || 0;
  const kernel = prior?.kernel || null; // (a bare prior, or none, borrows nothing)
  if (kernel && shareOn()) for (const j of new Set([...Object.keys(mem?.yes || {}), ...Object.keys(mem?.no || {}), ...Object.keys(mem?.asked || {})])) {
    if (j === k) continue;
    const w = Math.max(0, kernel(k, j)) * SHARE();
    if (w) { y += w * ((mem.yes?.[j] || 0) + (mem.asked?.[j] || 0) * 0.5); n += w * (mem.no?.[j] || 0); }
  }
  const a = pr.a + y, b = pr.b + n;
  return { p: a / (a + b), sd: Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1))), seen: +(y + n).toFixed(2) };
}
// members: [{ id, chance, mem }]; slots: [{ date, start }]; tried: Set of `${id}|${date}|${start}`; prior: populationPrior
export function bestQuestion({ members, slots, tried = new Set(), min = MIN, prior = null }) {
  const pairs = [];
  for (const m of members) for (const s of slots) {
    if (tried.has(`${m.id}|${s.date}|${s.start}`)) continue;
    const post = posterior(m.mem, s, prior);
    pairs.push({ id: m.id, slot: s, c: m.chance, p: post.p, sd: post.sd, seen: post.seen, v: m.chance * post.p });
  }
  if (!pairs.length) return null;
  const sorted = [...pairs].sort((a, b) => b.v - a.v), p0 = sorted[0].v;
  let best = null;
  for (const q of pairs) {
    const rest = sorted.find((x) => x !== q)?.v ?? 0;
    const after = q.p * Math.max(q.c, rest) + (1 - q.p) * rest, value = after - p0;
    if (!best || value > best.value) best = { ...q, before: +p0.toFixed(3), after: +after.toFixed(3), value: +value.toFixed(3) };
  }
  return best && best.value >= min ? best : null;
}
