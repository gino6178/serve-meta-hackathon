// Who pays what for a venue's court. Each player says the most they will pay (limitEach in taste.js, a hard limit) and
// whether they are happy to cover more than an equal share, up to that limit, so the game happens (cover). The split
// starts equal; a player whose limit is under the equal share pays their limit, and the gap is shared out evenly among
// the players who said they would cover, never past anyone's own limit. No one pays more than they said, and no one
// covers who didn't offer to. A spot not filled yet pays an equal share. Whole New Taiwan dollars that add up to the
// price. Serve only works the shares out: nothing is paid in the app.
//   split(price, people, slots) -> { shares: { id: NT$ }, open: NT$ per unfilled spot, covered: [{ by, amount }] } or null
//   most(people, slots) -> the highest price the group can split, the group's agent's budget when it talks to a venue
const lim = (p) => (p.cap == null ? Infinity : Math.max(0, +p.cap));

export function split(price, people, slots = people.length) {
  const n = Math.max(slots, people.length, 1), open = n - people.length, even = price / n;
  const pay = Object.fromEntries(people.map((p) => [p.id, Math.min(even, lim(p))]));
  let gap = price - Object.values(pay).reduce((s, x) => s + x, 0) - open * even;
  // the gap shared evenly among those who offered to cover, each up to their own limit
  for (let guard = 0; gap > 1e-6 && guard < 50; guard++) {
    const room = people.filter((p) => p.cover && lim(p) - pay[p.id] > 1e-6);
    if (!room.length) return null;
    const step = gap / room.length;
    for (const p of room) { const add = Math.min(step, lim(p) - pay[p.id]); pay[p.id] += add; gap -= add; }
  }
  if (gap > 1e-6) return null;
  // whole dollars: round down, then hand the leftover dollars to whoever has room, biggest fraction first
  const whole = Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, Math.floor(v + 1e-9)]));
  const openEach = Math.ceil(even - 1e-9);
  let left = price - Object.values(whole).reduce((s, x) => s + x, 0) - open * openEach;
  for (const p of [...people].sort((a, b) => (pay[b.id] % 1) - (pay[a.id] % 1))) {
    if (left <= 0) break;
    if (whole[p.id] + 1 <= lim(p)) { whole[p.id] += 1; left -= 1; }
  }
  if (left > 0) return null;
  const evenEach = Math.ceil(even - 1e-9);
  const covered = people.filter((p) => whole[p.id] > evenEach).map((p) => ({ by: p.id, amount: whole[p.id] - evenEach }));
  return { shares: whole, open: open ? openEach : 0, even: evenEach, covered };
}

// the highest price (in steps of 10) the group can split, up to `upto`; Infinity when no one has a limit
export function most(people, slots = people.length, { upto = 20000 } = {}) {
  let lo = 0, hi = upto;
  if (people.every((p) => p.cap == null) || split(hi, people, slots)) return Infinity;
  while (hi - lo > 10) { const mid = Math.round((lo + hi) / 20) * 10; if (split(mid, people, slots)) lo = mid; else hi = mid; }
  return lo;
}
