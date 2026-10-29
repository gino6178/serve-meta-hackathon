// From what was said to what holds: once a week (or on ask), the player's live notes (memory.js, episodic: one thing
// said on one day) are abstracted by Muse Glimmer into a few standing beliefs about how they like to play ("prefers
// weekday evenings after 19:00", "keeps Wednesdays free"). Each belief must cite the notes it rests on, and code checks
// it: the cited notes exist and are live, at least two notes for a belief that generalizes ("usually", "prefers",
// "always"), and every number in it is in what it cites. A belief that fails is dropped, not repaired. The notes stay
// (the player's own words, /forget deletes both); the planner reads the beliefs first (autopilot.js get_week), each
// with how many notes stand behind it. BELIEFS=off turns it off.
//   data/beliefs.json (BELIEFS_FILE): { players: { [player]: { at, from: n, beliefs: [{ text, cites: [noteId], n }] } } }
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import { chat } from "../core/llm.js";
import * as memory from "./memory.js";

const FILE = () => path.resolve(process.env.BELIEFS_FILE || "data/beliefs.json");
let db = null;
const data = () => (db ||= readJSON(FILE(), { players: {} }));
const save = () => writeJSON(FILE(), data());
export const on = () => process.env.BELIEFS !== "off";
const WEEK = 7 * 864e5, MIN_NOTES = 3, MAX = 6;
const nums = (t) => (String(t).match(/\d+(?:[.:]\d+)?/g) || []);
const GENERAL = /\b(usually|prefers?|always|never|tends? to|mostly|every)\b|通常|總是|從不|偏好|都/i;

// the model's answer, checked by code (exported for the tests): only beliefs that cite live notes and say no number
// those notes do not
export function checked(raw, notes) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const out = [];
  for (const b of Array.isArray(raw) ? raw : []) {
    const text = String(b?.text || "").replace(/\s+/g, " ").trim().slice(0, 160), cites = [...new Set((Array.isArray(b?.cites) ? b.cites : []).map(String))].filter((id) => byId.has(id));
    if (text.length < 8 || !cites.length) continue;
    if (GENERAL.test(text) && cites.length < 2) continue;
    const said = new Set(cites.flatMap((id) => nums(byId.get(id).text)));
    if (!nums(text).every((x) => said.has(x))) continue;
    out.push({ text, cites, n: cites.length });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function consolidate(player, { now = Date.now(), ask = chat } = {}) {
  const notes = memory.list(player, now).filter((n) => n.status === "live").slice(0, 60).map((n) => ({ id: n.id, text: n.text, at: n.at }));
  if (notes.length < MIN_NOTES) return { beliefs: [], skipped: `fewer than ${MIN_NOTES} notes` };
  const sys = `You keep a sports player's standing preferences for their scheduling agent. From the notes (each: id, the day it was said, the words), write at most ${MAX} short beliefs that will still hold next week: when they like to play, with whom, where, what to avoid, how long. Generalize only what several notes support. Each belief cites the ids of the notes it rests on. Use only numbers that are in the notes. Never write he or she. Never give medical or training advice; a body note becomes a scheduling limit only. Return JSON only: {"beliefs": [{"text": "...", "cites": ["id", ...]}]}`;
  const user = notes.map((n) => `${n.id} | ${new Date(n.at).toISOString().slice(0, 10)} | ${n.text}`).join("\n");
  let raw = [];
  try {
    const r = await ask([{ role: "system", content: sys }, { role: "user", content: user }], { maxTokens: 900, temperature: 0, site: "memory.beliefs" });
    raw = JSON.parse((r.text.match(/\{[\s\S]*\}/) || ["{}"])[0]).beliefs;
  } catch (e) { return { beliefs: [], error: String(e.message || e).slice(0, 120) }; }
  const beliefs = checked(raw, notes);
  data().players[player] = { at: now, from: notes.length, offered: Array.isArray(raw) ? raw.length : 0, beliefs };
  save();
  return { beliefs, from: notes.length, dropped: (Array.isArray(raw) ? raw.length : 0) - beliefs.length };
}
export const of = (player) => data().players[player] || null;
// the planner's read: the beliefs, made again first when a week has passed and there are new notes
export async function current(player, { now = Date.now() } = {}) {
  if (!on()) return [];
  const have = of(player), newer = memory.list(player, now).filter((n) => n.status === "live" && (!have || n.at > have.at)).length;
  if (!have || (now - have.at > WEEK && newer > 0)) await consolidate(player, { now }).catch(() => null);
  return (of(player)?.beliefs || []).map((b) => ({ belief: b.text, notes: b.n }));
}
export function forget(player) { if (data().players[player]) { delete data().players[player]; save(); } }
