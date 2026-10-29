// Active epistemic querying: when the talks for a game have not landed, the one yes-or-no question whose answer most
// raises the chance of a game, by the value of information.
//   For a member m and one of the player's times s: p(m free at s) is the mean of a Beta posterior, Beta(1 + yes, 1 + no)
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
// the Beta posterior's mean and spread for (member, time), from talk.js's faded counts
export function posterior(mem, s) {
  const k = keyOf(s), y = (mem?.yes?.[k] || 0) + (mem?.asked?.[k] || 0) * 0.5, n = mem?.no?.[k] || 0, a = 1 + y, b = 1 + n;
  return { p: a / (a + b), sd: Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1))), seen: +(y + n).toFixed(2) };
}
// members: [{ id, chance, mem }]; slots: [{ date, start }]; tried: Set of `${id}|${date}|${start}`
export function bestQuestion({ members, slots, tried = new Set(), min = MIN }) {
  const pairs = [];
  for (const m of members) for (const s of slots) {
    if (tried.has(`${m.id}|${s.date}|${s.start}`)) continue;
    const post = posterior(m.mem, s);
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
