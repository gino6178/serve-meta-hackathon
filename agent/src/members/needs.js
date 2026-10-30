// What the agents need from Serve. The members' agents meet the platform's limits first: no time fits a group of four,
// a court is too far for half of them, half the people nearby wait on a waitlist. Each such moment is counted here by
// kind (never who or where), and once the same kind has happened in three different huddles, the agents put it to the
// club as a suggestion in the community loop (loop/signals.js), beside the members' own ideas: it is clustered, voted
// on, specified and shipped through the same gates as theirs. So the platform changes toward what the agents keep
// running into. The sentences are fixed and written by code, so there is nothing personal in them to check.
//   data/needs.json (NEEDS_FILE): { kinds: { <kind>: { huddles: [ids], sent: at|null } } }
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

const FILE = () => path.resolve(process.env.NEEDS_FILE || "data/needs.json");
let db = null, from = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), { kinds: {} }); db.kinds ||= {}; from = FILE(); } return db; };
const save = () => writeJSON(FILE(), data());
export const AT = 3; // different huddles before the agents suggest a change
export const KINDS = {
  no_time: { area: "match", aspect: "option", text: "Agents often find no time that suits the whole group: offer a smaller game, or let part of the group play." },
  no_courts: { area: "courts", aspect: "data", text: "Agents find no courts for the sport near the group: let members add a court to the map." },
  too_far: { area: "courts", aspect: "option", text: "Players often say no because the court is too far: weigh the longest trip more when picking the place." },
  too_dear: { area: "booking", aspect: "option", text: "Players often say no because of the price: ask venues for their quiet-hour prices first." },
  busy: { area: "calendar", aspect: "data", text: "Players are often busy at the time the agents agree: let people mark the times they are never free." },
  waitlist: { area: "club", aspect: "reach", text: "Many people nearby end up on waitlists: let a host invite people with no record yet, or run a second game." },
  agent_unsure: { area: "talk", aspect: "approval", text: "Agents often can't answer for their person: ask members a few more quick questions before a game." },
};
// one moment in one huddle; a kind seen in AT different huddles is suggested once a month
export async function saw(kind, huddle, { now = Date.now(), suggest = toLoop } = {}) {
  if (!KINDS[kind] || !huddle) return null;
  const k = (data().kinds[kind] ||= { huddles: [], sent: null });
  if (!k.huddles.includes(huddle)) k.huddles = [...k.huddles, huddle].slice(-50);
  let sent = null;
  if (k.huddles.length >= AT && (!k.sent || now - k.sent > 30 * 864e5)) { sent = await suggest(kind).catch(() => null); if (sent) { k.sent = now; k.huddles = []; } }
  save();
  return sent;
}
async function toLoop(kind) {
  const signals = await import("../loop/signals.js");
  return signals.fromAgents({ kind, ...KINDS[kind] });
}
// what the agents have run into, for the app: each kind, how many huddles, whether it went to the club's ideas
export const view = () => Object.entries(KINDS).map(([kind, x]) => { const k = data().kinds[kind]; return { kind, text: x.text, huddles: k?.huddles.length || 0, of: AT, sent: k?.sent || null }; });
