// A critic in the loop: every counter-offer a member's agent makes is reviewed for the player before their agent may
// take it (talk.js, the round's counters). Code only, so another agent's words cannot talk it round:
//   probing   a member's agent that asks for more than PROBE_MAX different times in one talk is mapping the player's
//             week rather than agreeing a game: its further counters are refused (the disclosure budget, 3.13, guards
//             the members' side the same way)
//   fairness  the trips of the games the player's agent agreed are kept (who had the longest); when the player had the
//             longest trip in 2 of their last 3 games, a counter that again gives them the longest trip, by more than
//             FAIR_MARGIN minutes over the next one, is refused, and the talk carries on with the other times
// A refused counter is said in the trail, with why. CRITIC=off turns it off. test/critic_unit.mjs.
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

const FILE = () => path.resolve(process.env.FAIRNESS_FILE || "data/fairness.json");
let db = null;
const data = () => (db ||= readJSON(FILE(), { games: [] }));
const save = () => writeJSON(FILE(), data());
export const PROBE_MAX = 2, FAIR_MARGIN = 10;
const asked = new Map(); // talk id -> member id -> Set of times it countered with

export const on = () => process.env.CRITIC !== "off";
// a game agreed: who travelled how far (option.travel), kept for the fairness check (the last 50)
export function record(option, player = "you") {
  if (!option?.travel?.length) return;
  const t = [...option.travel].sort((a, b) => b.min - a.min);
  data().games = [...data().games, { at: Date.now(), player, longest: t[0].id, trips: Object.fromEntries(t.map((x) => [x.id, x.min])) }].slice(-50);
  save();
}
// the review of one counter: { ok } or { ok: false, why, check }
export function review({ talk, member, counter, player = "you" }) {
  if (!on()) return { ok: true };
  const byTalk = asked.get(talk) || new Map(); asked.set(talk, byTalk);
  const seen = byTalk.get(member.id) || new Set(); byTalk.set(member.id, seen);
  seen.add(`${counter.slot?.date} ${counter.start}`);
  if (seen.size > PROBE_MAX) return { ok: false, check: "probing", why: `${member.name.split(" ")[0]}'s agent has asked about ${seen.size} different times in this talk, more than a game needs: its other times are not taken` };
  const t = counter.travel || [], mine = t.find((x) => x.id === player), others = t.filter((x) => x.id !== player).map((x) => x.min);
  if (mine && others.length) {
    const last = data().games.filter((g) => g.player === player).slice(-3), mostly = last.length >= 3 && last.filter((g) => g.longest === player).length >= 2;
    if (mostly && mine.min > Math.max(...others) + FAIR_MARGIN) return { ok: false, check: "fairness", why: `you had the longest trip in ${last.filter((g) => g.longest === player).length} of your last 3 games, and this time would be ${mine.min} min against at most ${Math.max(...others)} for the others` };
  }
  return { ok: true };
}
export const forgetTalk = (talk) => asked.delete(talk);
export const reset = () => { db = { games: [] }; asked.clear(); };
