// Trust, on two tracks. Once a member's agent asks people beyond their friends (people nearby who are open to it,
// anyone who opens a game's link), two things decide whether a game happens: will that person turn up, and does their
// agent tell the truth about them. They are different questions, so Serve keeps two records, both counted by code from
// what happened, never from opinions:
//   The person (show-up): after a game, the players say who came (one tap each); someone most of the others say didn't
//   come counts as a miss. Leaving a game in its last six hours counts as a late drop. Rate = came / games; under three
//   games the person is "new", and a new person is never scored down for it.
//   The agent (kept promises): every time a member's agent says yes for them in a huddle (huddle.js) and the person is
//   then asked, the agent made a promise; the person's yes keeps it, a no breaks it. Rate = kept / said; under three it
//   is new. Two more marks against an agent: asking too many people's agents too often (a prober walking the area's
//   calendars, the same worry as the disclosure budget, safety/disclosure.js), and requests on the agent channel with
//   its key that failed the signature check (members.js logs them).
// A game can set a gate (huddle.js, feed/posts.js): people under its show-up rate go on the waitlist; an agent that
// keeps too few promises, or is marked a prober, cannot say yes for its person, so the person is asked themself. No
// money is ever involved: no deposits, no fees.
//   data/trust.json (TRUST_FILE): { people: {...}, agents: {...}, checks: {...} }
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

const FILE = () => path.resolve(process.env.TRUST_FILE || "data/trust.json");
let db = null, from = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), { people: {}, agents: {}, checks: {} }); for (const k of ["people", "agents", "checks"]) db[k] ||= {}; from = FILE(); } return db; };
const save = () => writeJSON(FILE(), data());
const HOUR = 3600e3, DAY = 24 * HOUR;
export const NEW_UNDER = 3, LATE_HOURS = 6, PROBE_ASKS = 30, AGENT_MIN = 0.8;
const person = (id) => (data().people[id] ||= { games: 0, came: 0, missed: 0, late: 0, level: { ok: 0, off: 0 } });
const agent = (id) => (data().agents[id] ||= { said: 0, kept: 0, asks: [], probe: 0, sig: [] });

// ---- the agent's record ----
// a promise: the agent said yes for its person, and the person was asked; kept is their answer
export function promise(id, kept) { const a = agent(id); a.said++; if (kept) a.kept++; save(); }
// the agent asked `n` people's agents at once (a huddle); too many in a day marks it a prober for a week
export function asked(id, n, now = Date.now()) {
  const a = agent(id);
  a.asks = [...a.asks.filter((x) => now - x.at < DAY), { at: now, n }];
  if (a.asks.reduce((s, x) => s + x.n, 0) > PROBE_ASKS) a.probe = now;
  save();
}
// a request with the agent's key that failed the check (replayed, changed, expired)
export function badSignature(id, why, now = Date.now()) { const a = agent(id); a.sig = [...a.sig.filter((x) => now - x.at < 30 * DAY), { at: now, why }].slice(-20); save(); }

// ---- the person's record ----
// leaving a game: in its last six hours it is a late drop
export function left(id, startMs, now = Date.now()) {
  if (!startMs || startMs - now > LATE_HOURS * HOUR || now > startMs) return false;
  const p = person(id); p.late++; p.games++; save();
  return true;
}
// a game that is on: after it, the players are asked who came
export function expect(key, players, startMs) {
  if (!key || players.length < 2) return;
  const c = data().checks[key];
  if (c) { if (!c.settled) c.players = [...new Set([...c.players, ...players])]; } // more people joined the same game
  else data().checks[key] = { at: startMs, players: [...players], votes: {}, settled: false };
  save();
}
// one player's answers: { <player>: "came" | "missed" }, and optionally whether each played at the level they said
export function vote(me, key, came = {}, level = {}, now = Date.now()) {
  const c = data().checks[key];
  if (!c || !c.players.includes(me)) return { error: "That game isn't one you played.", code: 404 };
  if (now < c.at + 60 * 60e3) return { error: "Ask again after the game.", code: 409 };
  if (c.settled) return { error: "Already settled.", code: 409 };
  c.votes[me] = Object.fromEntries(c.players.filter((x) => x !== me).map((x) => [x, { came: came[x] !== "missed", level: ["ok", "off"].includes(level[x]) ? level[x] : null }]));
  if (c.players.every((x) => c.votes[x]) || now > c.at + 72 * HOUR) settle(key);
  save();
  return { ok: true, settled: c.settled };
}
// most of the others who answered decide whether a player came; nobody answering about them leaves them uncounted
function settle(key) {
  const c = data().checks[key];
  for (const x of c.players) {
    const said = Object.entries(c.votes).filter(([v]) => v !== x).map(([, v]) => v[x]).filter(Boolean);
    if (!said.length) continue;
    const p = person(x), yes = said.filter((v) => v.came).length;
    p.games++; if (yes * 2 >= said.length) p.came++; else p.missed++;
    for (const v of said) if (v.level) p.level[v.level]++;
  }
  c.settled = true;
}
// the games a member still has to say who came to (an hour after the start, for three days)
export function pending(me, now = Date.now()) {
  for (const [k, c] of Object.entries(data().checks)) if (!c.settled && now > c.at + 72 * HOUR) settle(k);
  return Object.entries(data().checks).filter(([, c]) => !c.settled && c.players.includes(me) && !c.votes[me] && now > c.at + 60 * 60e3).map(([key, c]) => ({ key, at: c.at, players: c.players.filter((x) => x !== me) }));
}

// ---- what anyone sees ----
const rate = (a, b) => (b ? a / b : null);
export function badge(id, now = Date.now()) {
  const p = data().people[id] || { games: 0, came: 0, late: 0, level: { ok: 0, off: 0 } }, a = data().agents[id] || { said: 0, kept: 0, probe: 0, sig: [] };
  const show = rate(p.came, p.games), kept = rate(a.kept, a.said);
  return {
    show: { rate: show == null ? null : +show.toFixed(2), games: p.games, late: p.late, new: p.games < NEW_UNDER, levelOk: p.level.ok + p.level.off ? +(p.level.ok / (p.level.ok + p.level.off)).toFixed(2) : null },
    agent: { rate: kept == null ? null : +kept.toFixed(2), said: a.said, new: a.said < NEW_UNDER, probe: !!a.probe && now - a.probe < 7 * DAY, badSig: a.sig.filter((x) => now - x.at < 30 * DAY).length },
  };
}
export const showText = (b) => (b.show.new ? `new · ${b.show.games} game${b.show.games === 1 ? "" : "s"}` : `shows up ${Math.round(b.show.rate * 100)}% · ${b.show.games} games`);
export const agentText = (b) => (b.agent.probe ? "asks too many agents" : b.agent.badSig ? "signature problems" : b.agent.new ? "agent new" : `agent keeps ${Math.round(b.agent.rate * 100)}% of its yeses`);
// a game's gate: { minShow (0..1, 0 = anyone), agentMin (0..1) }; the verdict for one person:
//   ok        their agent may answer for them
//   confirm   they can play, but their agent can't say yes for them: they are asked themself
//   waitlist  under the game's show-up rate (new people are let in unless the gate says otherwise)
export function gateOf(g = {}) { const minShow = [0, 0.75, 0.9].includes(+g.minShow) ? +g.minShow : 0; return { minShow, agentMin: g.agentMin === 0 ? 0 : AGENT_MIN, newOk: g.newOk !== false }; }
export function check(id, gate = {}, now = Date.now()) {
  const g = gateOf(gate), b = badge(id, now);
  if (g.minShow && (b.show.new ? !g.newOk : b.show.rate < g.minShow)) return { verdict: "waitlist", badge: b, why: b.show.new ? "new, and this game wants people with a record" : `${showText(b)}; this game needs ${Math.round(g.minShow * 100)}%` };
  if (b.agent.probe) return { verdict: "confirm", badge: b, why: "their agent asked too many people's agents today" };
  if (b.agent.badSig) return { verdict: "confirm", badge: b, why: "requests with their agent's key failed the signature check" };
  if (g.agentMin && !b.agent.new && b.agent.rate < g.agentMin) return { verdict: "confirm", badge: b, why: `their agent keeps only ${Math.round(b.agent.rate * 100)}% of its yeses` };
  return { verdict: "ok", badge: b };
}
export function forget(id) { const d = data(); delete d.people[id]; delete d.agents[id]; for (const c of Object.values(d.checks)) { c.players = c.players.filter((x) => x !== id); delete c.votes[id]; } save(); }
// for the local demo's test accounts only (seed scripts), never called by a route
export function seed(id, { person: p, agent: a } = {}) { if (p) Object.assign(person(id), p); if (a) Object.assign(agent(id), a); save(); }
