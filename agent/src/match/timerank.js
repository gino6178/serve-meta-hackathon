// The order of the times your agent lists (A2A_RANK=prob; "counts", the default, is the order before it): each time
// scored by the chance that it works for everyone, the product over the members of p(free and willing then), each p
// the value-of-information posterior (voi.js: the club's prior, what your agent has seen of that member's agent at that
// weekday and hour, and the hours like it). A product puts first the time most likely to clear the whole intersection,
// which is what decides round 1: code books the first listed time that works for everyone, and only twelve are listed.
// Least misery (as in group recommendation): a time at which one member is very unlikely (p under FLOOR) goes after
// every time at which no one is, however good it is for the rest, so a time that suits three and almost surely fails
// the fourth does not take a place in the twelve.
// The old order (counts) added 2 per past yes and took 3 per past no at that weekday and hour, summed over members.
// test/rank_sim.mjs compares the two on simulated members: no difference in the requests that find a time (singles
// 88.4% and doubles 26.3% in round 1 either way, private calendars), because twelve listed times a round and three
// rounds already cover nearly every hour a player offers. So it stays off by default.
import { posterior } from "./voi.js";

export const FLOOR = 0.15;
export const rankOn = () => process.env.A2A_RANK === "prob";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const keyOf = (date, start) => `${DAYS[new Date(`${date}T12:00:00`).getDay()]} ${hm(start).slice(0, 2)}:00`;

// the old score: past yeses up, past noes down (mems: the members' faded counts, talk.js memoryOf)
export const countScore = (x, mems) => mems.reduce((s, mm) => { const k = keyOf(x.slot.date, x.start); return s + (mm ? 2 * ((mm.yes[k] || 0) + (mm.asked[k] || 0)) - 3 * (mm.no[k] || 0) : 0); }, 0);

// the chance a time works for everyone, and its least-likely member's chance
export function chanceAll(x, mems, prior) {
  let all = 1, least = 1;
  for (const mm of mems) { const p = posterior(mm, { date: x.slot.date, start: hm(x.start) }, prior).p; all *= p; least = Math.min(least, p); }
  return { all, least };
}

// a score for each time (higher first), in the old order's units so the other terms (the player's own day, the usual
// hours with private calendars) weigh as before: 10 x ln(chance all), less 100 under the floor
export function timeScore(x, mems, prior, rank = rankOn()) {
  if (!rank) return countScore(x, mems);
  const { all, least } = chanceAll(x, mems, prior);
  return 10 * Math.log(Math.max(all, 1e-6)) - (least < FLOOR ? 100 : 0);
}
