// Preferences as typed records, newest first (upgrade #10). A player's agent used to read what they like from several
// places at once (the notes, the weekly beliefs, the habit in their games, the taste a member's answers taught), none
// of them dated against the others, so a preference that changed ("no more Friday evenings", "doubles from now on")
// lost to the habit or the older note behind it. PersonaMem (Jiang et al., 2025) found frontier models weakest at
// exactly that: applying the latest preference after it changed. Mem0 (Chhikara et al., 2025, arXiv 2504.19413) keeps
// memory as small structured facts instead of the whole history. Here every preference is one record:
//   { kind, key, value, since, source: { type, id, text }, confidence, explicit, until? }
//   kind time     key "fri-evening", "fri" (the whole day) or "any-evening"; value "yes" | "no"
//   kind partner  key a club member's id; value "yes" | "no"
//   kind venue    key a venue's name; value "yes" | "no"
//   kind format   key "format"; value "singles" | "doubles" | "any"
// and code, not a model, settles a conflict: for the same kind and key the newest record wins; within SAME_AGE (a day)
// a statement in the player's own words beats an inference (a belief, a habit, an answer); then the more confident.
// The losers are kept, marked superseded (by which record), and shown that way. A record past its last day (until)
// has expired, and one from a note that a newer note replaced has ended; the one before it holds again. Only a record at HARD confidence or more is kept as a hard rule;
// a weaker one still supersedes what is older, so an old hard "no" does not outlive a newer "yes".
// Extraction here is code (words for days, parts of the day, formats, members, venues); the notes' model-checked rules
// (memory_update.js: a member left out, a weekday off) come in as records too. PREF_RECORDS=off reads nothing (as before).
//   data/pref_records.json (PREF_RECORDS_FILE): { players: { [id]: [record] } }: records not in any note (a member's answers, settings)
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import { people, daysIn, norm, DAYS } from "./memory_update.js";

// (beside the taste file when only that is moved, so a run with its own taste file keeps its records there too)
const FILE = () => path.resolve(process.env.PREF_RECORDS_FILE || (process.env.TASTE_FILE ? path.join(path.dirname(process.env.TASTE_FILE), "pref_records.json") : "data/pref_records.json"));
let db = null, from = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), { players: {} }); db.players ||= {}; from = FILE(); } return db; };
const save = () => writeJSON(FILE(), data());
export const on = () => process.env.PREF_RECORDS !== "off";
export const KINDS = ["time", "partner", "venue", "format"];
export const PARTS = ["early", "morning", "afternoon", "evening"];
export const SAME_AGE = 864e5, HARD = 0.7;
// how sure each source is: the player's words (and the rules checked from them), a belief that cites two notes or
// more, the habit in their games, one answer to one game
export const CONF = { said: 0.9, belief: 0.7, habit: 0.6, reply: 0.5 };
const LONG = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const partOf = (start) => { const h = +String(start).slice(0, 2); return h < 9 ? "early" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

// ---- from words to records (code) ----
const PART_RE = [["evening", /\b(evenings?|nights?|after work|after 6|after six|late)\b/], ["morning", /\bmornings?\b/], ["afternoon", /\b(afternoons?|lunch ?times?|midday)\b/], ["early", /\b(early|before 9|before nine|dawn)\b/]];
// a clause that says yes again outright, before any no in it is read
const YES_AGAIN = /\b(no problem|not a problem|don'?t mind|do not mind|fine again|ok again|okay again|works again|good again|back on|happy to|can do|again)\b/;
const NO = /\b(no|not|never|don'?t|doesn'?t|do not|does not|can'?t|cannot|can not|won'?t|isn'?t|aren'?t|stop|avoid|skip|done with|no longer|no more|rather not|hate|impossible|without)\b|\b(is|are) out\b|\bleave\b.*\bout\b|\bkeep\b.*\bfree\b|\bout from\b/;
// (a bare "now" or "from now on" is not a yes: "Friday evening is family time now" says no)
const YES = /\b(fine|ok|okay|loves?|likes?|prefers?|favou?rite|happy|good|great|works?|can|wants?|keen|only|free|open|best|usually|mostly|always|plays?|switch(ed|ing)? to|moving to|rather)\b/;
// someone's schedule, not a preference (the calendar holds those)
const SCHEDULE = /\b(busy|away|travel\w*|holiday|vacation|injured|sick|exam)\b/;
const FIRST = /\b(i|i'm|im|me|my|we|us)\b/;
const PLAYCUE = /\b(play|playing|game|games|pair|partner|match|matches|with|against|leave|out|avoid|book|booking)\b/;
// the value of a clause: no, yes, or nothing it says either way
const sense = (c) => (YES_AGAIN.test(c) ? "yes" : NO.test(c) ? "no" : YES.test(c) ? "yes" : null);
const clauses = (text) => norm(text).replace(/[’']/g, "'").split(/[.;!?\n]+|,\s*but\b|\bbut\b/).map((s) => s.trim()).filter(Boolean);
// the format a clause asks for: from X to Y, Y instead of X, no more X (so the other one), only Y
function formatIn(c) {
  const has = { singles: /\bsingles?\b/.test(c), doubles: /\bdoubles?\b/.test(c) };
  if (!has.singles && !has.doubles) return null;
  const other = (f) => (f === "singles" ? "doubles" : "singles");
  if (/\b(either|any|both)\b/.test(c) && has.singles && has.doubles) return "any";
  if (has.singles && has.doubles) {
    let m = /\b(instead of|rather than|over|not)\s+(singles|doubles)\b/.exec(c); if (m) return other(m[2]);
    m = /(?:\bto|->|→|=>)\s*(singles|doubles)\b/.exec(c); if (m) return m[1];
    return null;
  }
  const f = has.singles ? "singles" : "doubles", s = sense(c);
  return s === "no" ? other(f) : s === "yes" || /\b(singles|doubles) (now|only|from)\b/.test(c) ? f : null;
}
// records in a text: { kind, key, value } each (no dates, no source: the caller adds them)
export function extract(text, { members = [], venues = [] } = {}) {
  const out = [], put = (r) => { if (!out.some((x) => x.kind === r.kind && x.key === r.key)) out.push(r); };
  for (const c of clauses(text)) {
    const s = sense(c), who = people(c, members), sched = SCHEDULE.test(c);
    const f = formatIn(c);
    if (f) put({ kind: "format", key: "format", value: f });
    if (who.length && s && !sched && (PLAYCUE.test(c) || YES_AGAIN.test(c))) for (const id of who) put({ kind: "partner", key: id, value: s });
    for (const v of venues) {
      const w = norm(v).split(/\s+/)[0];
      if (w.length >= 4 && new RegExp(`\\b${w.replace(/[^a-z0-9]/g, "")}\\b`).test(c) && s && !sched) put({ kind: "venue", key: v, value: s });
    }
    // the player's own times; a clause about a member's days, or anyone's schedule, is not one
    if (f || sched || (who.length && !FIRST.test(c)) || !s) continue;
    const days = daysIn(c), parts = PART_RE.filter(([, re]) => re.test(c)).map(([p]) => p);
    if (/\bweekdays?\b/.test(c)) days.push("Mon", "Tue", "Wed", "Thu", "Fri");
    if (!days.length && !parts.length) continue;
    for (const d of days.length ? [...new Set(days)] : ["any"]) for (const p of parts.length ? parts : [null]) put({ kind: "time", key: `${d.toLowerCase()}${p ? `-${p}` : ""}`, value: s });
  }
  return out;
}
// a model-checked rule of a note (memory_update.js) as a record
export const fromRule = (rule) => (rule?.kind === "avoid_day" && rule.day ? { kind: "time", key: rule.day.toLowerCase(), value: "no" } : rule?.kind === "avoid_person" && rule.who ? { kind: "partner", key: rule.who, value: "no" } : null);
export function make(r, { since, source, confidence, explicit, until = null }) {
  return { id: crypto.createHash("sha1").update(`${r.kind}|${r.key}|${r.value}|${since}|${source?.type}|${source?.id || ""}`).digest("hex").slice(0, 10), kind: r.kind, key: r.key, value: r.value, since, source, confidence, explicit: !!explicit, ...(until ? { until } : {}) };
}

// ---- settling conflicts (code) ----
// a before b when a should win: newer; within SAME_AGE, the player's own words; then the more confident; then newer
export const beats = (a, b) => (Math.abs(a.since - b.since) >= SAME_AGE ? a.since > b.since : a.explicit !== b.explicit ? a.explicit : a.confidence !== b.confidence ? a.confidence > b.confidence : a.since >= b.since);
// every record with its status: current, superseded (by which) or expired; current: one per kind and key
export function resolve(records, now = Date.now()) {
  const groups = new Map(), today = ymd(now);
  for (const r of records) { if (!KINDS.includes(r.kind)) continue; const k = `${r.kind}:${r.key}`; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  const all = [], current = [];
  for (const rs of groups.values()) {
    const order = [...rs].sort((a, b) => (beats(a, b) ? -1 : 1));
    let win = null;
    for (const r of order) {
      if (r.until && r.until < today) { all.push({ ...r, status: "expired" }); continue; }
      // from a note a newer note replaced (memory_update.js, checked by code to share a subject): ended, not current
      if (r.ended && r.ended.at <= now) { all.push({ ...r, status: "ended" }); continue; }
      if (!win) { win = r; all.push({ ...r, status: "current" }); current.push(r); continue; }
      all.push({ ...r, status: "superseded", by: win.id });
    }
  }
  return { current, all: all.sort((a, b) => b.since - a.since) };
}
export const empty = () => ({ current: [], all: [] });

// ---- what a decision reads ----
// the newest current record about a time of the week: the cell (fri-evening), its day (fri) and its part (any-evening)
export function timeAt(P, day, start) {
  const d = String(day).slice(0, 3).toLowerCase(), p = partOf(start), keys = [`${d}-${p}`, d, `any-${p}`];
  const hits = (P?.current || []).filter((r) => r.kind === "time" && keys.includes(r.key));
  return hits.sort((a, b) => (beats(a, b) ? -1 : 1))[0] || null;
}
// a habit as a record: the latest game the player played at that weekday and part of the day
const at = (date, start = "12:00") => new Date(`${date}T${start}:00`).getTime();
const dayOf = (date) => DAYS[new Date(`${date}T12:00:00`).getDay()];
export function habitTime(hist, day, start) {
  const games = (hist || []).filter((h) => h.date && dayOf(h.date) === day && partOf(h.start || "12:00") === partOf(start));
  if (!games.length) return null;
  const last = games.map((h) => at(h.date, h.start)).sort((a, b) => b - a)[0];
  return make({ kind: "time", key: `${day.toLowerCase()}-${partOf(start)}`, value: "yes" }, { since: last, source: { type: "habit", text: `${games.length} games ${day} ${partOf(start)}s` }, confidence: CONF.habit, explicit: false });
}
// may the agent ask for this time: null, or why not (a hard "no" newer than the habit there)
export function slotAllowed(P, { day, start, hist = [] }) {
  const r = timeAt(P, day, start);
  if (!r || r.value !== "no" || r.confidence < HARD) return null;
  const h = habitTime(hist, day, start);
  if (h && beats(h, r)) return null; // they played there after they said no: the newer habit holds
  return `you said ${say(r)} on ${ymd(r.since)}`;
}
// the times the player said yes to in words (a slot to ask about even where the habit has faded)
export const wantedTimes = (P) => (P?.current || []).filter((r) => r.kind === "time" && r.value === "yes" && r.explicit && /^(sun|mon|tue|wed|thu|fri|sat)-/.test(r.key)).map((r) => { const [d, p] = r.key.split("-"); return { day: d[0].toUpperCase() + d.slice(1), part: p, rec: r }; });
// the format by habit, as ask.js always chose it: what they played at that weekday and start, by majority, or the
// format the player gave when they have no games there
export function formatByHabit(hist, day, start, prefers = null) {
  const fmts = (hist || []).filter((h) => h.date && dayOf(h.date) === day && h.start === start).map((h) => h.format || "singles");
  return !fmts.length && prefers === "doubles" ? "doubles" : fmts.filter((f) => f === "doubles").length > fmts.length / 2 ? "doubles" : "singles";
}
// the format: a stated one, unless the games played at that time since it say otherwise (by majority); else the habit
export function formatFor(P, { hist = [], day, start, prefers = null } = {}) {
  const r = (P?.current || []).find((x) => x.kind === "format");
  if (!r || r.value === "any") return { format: formatByHabit(hist, day, start, prefers), rec: null };
  const after = (hist || []).filter((h) => h.date && dayOf(h.date) === day && h.start === start && at(h.date, h.start) > r.since + SAME_AGE).map((h) => h.format || "singles");
  if (after.length && after.filter((f) => f !== r.value).length > after.length / 2) return { format: r.value === "doubles" ? "singles" : "doubles", rec: null, habitSince: true };
  return { format: r.value, rec: r };
}
const hard = (P, kind, value) => (P?.current || []).filter((r) => r.kind === kind && r.value === value && r.confidence >= HARD);
// members left out, and whole weekdays off, as hard rules
export const leftOut = (P) => hard(P, "partner", "no").map((r) => r.key);
export const offDays = (P) => hard(P, "time", "no").filter((r) => /^(sun|mon|tue|wed|thu|fri|sat)$/.test(r.key)).map((r) => r.key[0].toUpperCase() + r.key.slice(1));
// the hook for a member's agent answering a proposal (a2a/talk.js breaks, one line): a hard "no" to that time, in the
// member's own records (data/pref_records.json), or null. x: { slot: { day }, start (minutes) }
export function prefsBreak(m, x) {
  if (!on() || !m?.id || !x?.slot?.day) return null;
  const P = resolve(stored(m.id));
  const st = typeof x.start === "number" ? `${String(Math.floor(x.start / 60)).padStart(2, "0")}:${String(x.start % 60).padStart(2, "0")}` : String(x.start);
  const r = timeAt(P, x.slot.day, st);
  return r && r.value === "no" && r.confidence >= HARD ? `not ${x.slot.day} ${partOf(st)}s, as of ${ymd(r.since)}` : null;
}

// ---- in words ----
const cellText = (key) => { const [d, p] = key.split("-"); const day = d === "any" ? "" : LONG[d[0].toUpperCase() + d.slice(1)]; return p ? `${day ? `${day} ` : ""}${p === "early" ? "early starts" : `${p}s`}` : `${day}s`; };
export function say(r, names = {}) {
  if (r.kind === "time") return r.value === "no" ? `no ${cellText(r.key)}` : `${cellText(r.key)} are fine`;
  if (r.kind === "partner") return r.value === "no" ? `leave ${names[r.key] || r.key} out` : `happy to play with ${names[r.key] || r.key}`;
  if (r.kind === "venue") return r.value === "no" ? `not at ${r.key}` : `likes ${r.key}`;
  return r.value === "any" ? "singles or doubles" : r.value;
}
// for the Memory page: current first, then superseded (struck through, with what replaced it) and expired
export function view(P, names = {}) {
  const byId = new Map(P.all.map((r) => [r.id, r]));
  return P.all.map((r) => ({ kind: r.kind, key: r.key, value: r.value, text: say(r, names), since: ymd(r.since), source: r.source, confidence: r.confidence, explicit: r.explicit, status: r.status, ...(r.until ? { until: r.until } : {}), ...(r.by ? { supersededBy: say(byId.get(r.by), names), supersededOn: ymd(byId.get(r.by).since) } : {}) }))
    .sort((a, b) => (a.status === "current") === (b.status === "current") ? b.since.localeCompare(a.since) : a.status === "current" ? -1 : 1);
}

// ---- records not in any note (a member's answers, a setting) ----
export const stored = (id) => (data().players[id] || []);
export function record(id, r, { since = Date.now(), source = { type: "setting" }, confidence = CONF.said, explicit = true, until = null } = {}) {
  if (!on() || !id || !KINDS.includes(r?.kind) || !r.key || r.value == null) return null;
  const rec = make(r, { since, source, confidence, explicit, until });
  const have = (data().players[id] ||= []);
  if (have.some((x) => x.id === rec.id)) return rec;
  data().players[id] = [...have, rec].slice(-200); save();
  return rec;
}
export function forget(id) { if (data().players[id]) { delete data().players[id]; save(); } }
