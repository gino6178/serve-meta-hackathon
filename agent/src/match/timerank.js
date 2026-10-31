// The order of the times your agent lists (A2A_RANK, "prob" by default; "counts" is the order before it): each time
// scored by the chance that it works for everyone, the product over the members of p(free and willing then), each p
// the value-of-information posterior (voi.js: the club's prior, what your agent has seen of that member's agent at that
// weekday and hour, and the hours like it). Least misery (as in group recommendation): a time at which one member is
// very unlikely (p under FLOOR) goes after every time at which no one is, however good it is for the rest.
// The old order (counts) added 2 per past yes and took 3 per past no, summed over members, so two members' yeses could
// outweigh a third member's no. What the order changes:
//   - With shared calendars, the time proposed first is the one the members' agents answer: when it keeps everyone's
//     rules they say yes by code and no model is asked; when it breaks one member's rule, that member's agent has a
//     choice to make (the student, the decider or Glimmer's full answer). test/rank_calls_sim.mjs (seeds not used to
//     build it): the first time kept everyone's rules in 92.4% of singles requests instead of 89.8%, and 89.1% of
//     doubles instead of 73.9%; the choices asked of a model per doubles request fell from 0.261 to 0.109.
//   - With private calendars, whether a time is found at all: no difference (test/rank_sim.mjs), because twelve listed
//     times a round and three rounds already cover nearly every hour a player offers.
import { posterior } from "./voi.js";

export const FLOOR = 0.15;
export const rankOn = () => (process.env.A2A_RANK || "prob") === "prob";
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
