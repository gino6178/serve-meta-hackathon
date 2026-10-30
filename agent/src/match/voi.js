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
export const PSEUDO = 2;
const FLAT = { a: 1, b: 1 };
const freeAt = (list, day, h) => (list || []).some((w) => { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m && m[1] === day && +m[2] <= h && h < +m[3]; });
// members: [{ free, sports }]; mems: talk.js memories (used when no member has a free list); -> key => { a, b }
export function populationPrior({ members = [], sport = "badminton", mems = [], pseudo = PSEUDO } = {}) {
  const plays = members.filter((m) => (m.sports || ["badminton"]).includes(sport)), lists = plays.filter((m) => m.free?.length);
  const cache = new Map();
  return (k) => {
    if (cache.has(k)) return cache.get(k);
    const [day, hh] = k.split(" "), h = +String(hh).slice(0, 2);
    let yes = 0, n = 0;
    if (lists.length) { n = lists.length; yes = lists.filter((m) => freeAt(m.free, day, h)).length; }
    else for (const mem of mems) { const y = (mem?.yes?.[k] || 0) + (mem?.asked?.[k] || 0) * 0.5, no = mem?.no?.[k] || 0; yes += y; n += y + no; }
    const f = (yes + 1) / (n + 2), out = n > 0 ? { a: pseudo * f, b: pseudo * (1 - f) } : FLAT;
    cache.set(k, out);
    return out;
  };
}
// the Beta posterior's mean and spread for (member, time), from talk.js's faded counts over the prior (flat by default)
export function posterior(mem, s, prior = null) {
  const k = keyOf(s), pr = (typeof prior === "function" ? prior(k) : prior?.[k]) || FLAT;
  const y = (mem?.yes?.[k] || 0) + (mem?.asked?.[k] || 0) * 0.5, n = mem?.no?.[k] || 0, a = pr.a + y, b = pr.b + n;
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
