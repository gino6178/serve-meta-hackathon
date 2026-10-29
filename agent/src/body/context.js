// Your sports context, found by meaning (retrieval-augmented generation over what your agent knows about your body):
// what you told your agent hurts or how you feel, in your own words, and what your games and your health app recorded,
// as short notes, each with the day it comes from.
//   1. Notes: every body-log entry's words (Messenger, the app or a voice note), the player's live memory notes, each
//      week's sessions and load from the health app and the club's games, a game that ran past its booking. Code makes
//      the notes from the records; nothing another agent or a review wrote is one.
//   2. Retrieval: the planner's question ("planning my games this week…") against every note with Meta's DRAMA
//      (memory.js scoreIn, on the server's CPU), each score faded by the note's age: a body note keeps half its weight
//      after 7 days, a week's load after 14, a memory note after 30. So last Tuesday's sore knee outranks a month-old
//      one, and an old note gives way without being deleted. The top notes go to Muse Glimmer with the week.
//   3. Grounding: every limit the planner keeps (body.js organize: doubles first, shorter games, one game fewer)
//      cites the notes it comes from, by id, and code checks each citation: the note must exist and be about the same
//      body part, or be the load the limit counts. A limit is still decided by code from the records, never by the
//      model, so retrieval can only explain and order what the agent knows; it cannot add a rule.
// The scores shown are DRAMA's cosine similarities for this question (raw) and after the fade (score), as computed.
import * as memory from "../memory/memory.js";
import { keyOf, nameOf } from "./body.js";

const DAY = 864e5;
export const HALF_LIFE = { body: 7, health: 14, game: 14, said: 30 };
export const QUESTION = "Planning my games this week: how my body feels, anything sore or tired, my training load, and what to keep in mind.";
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const at = (s) => new Date(s.length > 10 ? s : `${s}T12:00:00`).getTime();

// the notes: { id, text, kind, at (ms), part (a body-log key), src }
export function notes(org, log = [], { said = [], now = Date.now() } = {}) {
  const out = [];
  for (const e of log) if (e.note && now - at(e.at) <= 60 * DAY) out.push({ id: e.id || `b-${e.at}-${keyOf(e)}`, text: e.note, kind: "body", at: at(e.at), part: keyOf(e), src: "you said" });
  for (const w of (org.weeks || []).slice(-4)) if (w.sessions) out.push({ id: `w-${w.week}`, text: `Week of ${w.week}: ${w.sessions} session${w.sessions > 1 ? "s" : ""}, ${w.minutes} minutes, load ${w.load}.`, kind: "health", at: at(w.week) + 6 * DAY, src: "your games and health app" });
  if (org.load?.acwr != null) out.push({ id: "load", text: `This week's load is ${org.load.acwr} times the four-week average (${org.load.acute} vs ${org.load.chronic} a week, minutes x effort).`, kind: "health", at: now, src: "your games and health app" });
  for (const l of org.linked || []) if (l.booked && l.minutes - l.booked >= 15) out.push({ id: `g-${l.date}-${l.start || ""}`, text: `${l.date} ${l.sport} game ran ${l.minutes} minutes (booked ${l.booked}), from ${l.source}.`, kind: "game", at: at(l.date), src: l.source });
  for (const n of said) if (n.text && !out.some((o) => o.text === n.text)) out.push({ id: `m-${n.id}`, text: n.text, kind: "said", at: n.at || now, src: "you told your agent" });
  return out;
}

// which notes each limit comes from: the body-log notes of the parts it names, the load for a load limit, the game a
// watch's minutes came from
export function citesFor(action, org, all) {
  const parts = (org.parts || []).filter((p) => action.text.includes(p.name)).map((p) => p.key);
  if (action.kind === "load") return all.filter((n) => n.id === "load").map((n) => n.id);
  if (action.kind === "learned") return all.filter((n) => n.kind === "game" && action.why?.includes(n.id.slice(2, 12))).map((n) => n.id);
  return all.filter((n) => n.kind === "body" && parts.includes(n.part)).sort((a, b) => b.at - a.at).slice(0, 3).map((n) => n.id);
}
// a citation holds when the note exists and is about what the limit is about
export function citationOk(action, id, org, all) {
  const n = all.find((x) => x.id === id);
  if (!n) return false;
  if (action.kind === "load") return n.id === "load";
  if (action.kind === "learned") return n.kind === "game";
  return n.kind === "body" && (org.parts || []).some((p) => p.key === n.part && action.text.includes(p.name));
}

// the context for a question: every note scored, the top k, and each limit with its checked citations
export async function retrieve(org, log = [], { question = QUESTION, said = [], k = 5, now = Date.now() } = {}) {
  const all = notes(org, log, { said, now });
  const fade = (n) => 0.5 ** (Math.max(0, now - n.at) / ((HALF_LIFE[n.kind] || 30) * DAY));
  const { by, hits } = await memory.scoreIn(all, question, { weight: fade });
  const shown = (h) => ({ id: h.id, text: h.text, kind: h.kind, src: h.src, on: ymd(h.at), raw: +h.raw.toFixed(3), score: +h.score.toFixed(3), ...(h.part ? { part: h.part } : {}) });
  const scored = hits.map(shown);
  const rules = (org.actions || []).filter((a) => a.kind !== "follow").map((a) => {
    const cites = citesFor(a, org, all).filter((id) => citationOk(a, id, org, all));
    return { kind: a.kind, text: a.text, why: a.why, cites: cites.map((id) => scored.find((s) => s.id === id)).filter(Boolean) };
  });
  return { by, question, top: scored.slice(0, k), all: scored, rules, halfLife: HALF_LIFE };
}
export const partName = (org, key) => (org.parts || []).find((p) => p.key === key)?.name || nameOf({ part: key.split(":")[0], side: key.split(":")[1] || null });
