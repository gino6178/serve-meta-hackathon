// Trust, on two tracks, kept on a chain no one can quietly change. Once a member's agent asks people beyond their friends
// (people nearby who are open to it, anyone who opens a game's link), two things decide whether a game happens: will
// that person turn up, and does their agent tell the truth about them. They are different questions, so Serve keeps two
// records, both counted by code from what happened, never from opinions:
//   The person (show-up): after a game, the players say who came (one tap each); someone most of the others say didn't
//   come counts as a miss. Leaving a game in its last six hours counts as a late drop. Rate = came / games; under three
//   games the person is "new", and a new person is never scored down for it.
//   The agent (kept promises): every time a member's agent says yes for them in a huddle (huddle.js) and the person is
//   then asked, the agent made a promise; the person's yes keeps it, a no breaks it. Rate = kept / said; under three it
//   is new. Two more marks against an agent: asking too many people's agents in a day (a prober walking the area's
//   calendars, the same worry as the disclosure budget, safety/disclosure.js), and requests on the agent channel with
//   its key that failed the signature check (members.js logs them).
// The chain. Every one of those events is an entry that carries the hash of the entry before it (SHA-256 over the
// entry's number, time, kind, subject, data and the previous hash), so changing, removing or reordering any past entry
// breaks every hash after it. The records anyone sees are not stored beside the chain: they are worked out from it,
// entry by entry, every time. Once a day the gateway signs the chain's head (the last hash and how many entries) with
// its own Ed25519 key, the one its Agent Cards are signed with (/a2a/keys.json), so anyone can check from outside that
// what they are shown is what was there that day: GET /api/trust/chain gives the entries and the signed heads, and
// verify() replays it. Subjects are pseudonyms (a hash of the member's id), never names. Leaving Serve adds a "left"
// entry: nothing is rewritten, and that subject's records stop counting.
// A game can set a gate (huddle.js, feed/posts.js): people under its show-up rate go on the waitlist; an agent that
// keeps too few promises, or is marked a prober, cannot say yes for its person, so the person is asked themself. No
// money is ever involved: no deposits, no fees.
//   data/trust.json (TRUST_FILE): { chain: [...entries], heads: [...signed heads], checks: {...games waiting for votes} }
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";

const FILE = () => path.resolve(process.env.TRUST_FILE || "data/trust.json");
let db = null, from = null, state = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), {}); db.chain ||= []; db.heads ||= []; db.checks ||= {}; from = FILE(); state = null; carry(); } return db; };
// records kept before the chain (plain counters) go onto it once, as "carried" entries, so nothing is lost
function carry() {
  if (db.chain.length || (!db.people && !db.agents)) return;
  const old = { people: db.people || {}, agents: db.agents || {} };
  delete db.people; delete db.agents;
  for (const [id, p] of Object.entries(old.people)) add("carried", id, { person: { games: p.games, came: p.came, missed: p.missed, late: p.late, level: p.level } });
  for (const [id, a] of Object.entries(old.agents)) add("carried", id, { agent: { said: a.said, kept: a.kept } });
}
const save = () => writeJSON(FILE(), data());
const HOUR = 3600e3, DAY = 24 * HOUR;
export const NEW_UNDER = 3, LATE_HOURS = 6, PROBE_ASKS = 30, AGENT_MIN = 0.8;
export const GENESIS = "0".repeat(64);
// a subject is an HMAC of the member's id under this server's own secret (data/trust.secret, made once, mode 600, never
// committed): a member's id can be seen in the app, so a plain hash of it could be worked back to them; this cannot
const SECRET_FILE = () => path.resolve(process.env.TRUST_SECRET_FILE || path.join(path.dirname(FILE()), "trust.secret"));
let secret = null, secretFrom = null;
function key() {
  if (secret && secretFrom === SECRET_FILE()) return secret;
  const f = SECRET_FILE();
  try { secret = fs.readFileSync(f, "utf8").trim(); } catch { secret = null; }
  if (!secret) { secret = crypto.randomBytes(32).toString("hex"); fs.mkdirSync(path.dirname(f), { recursive: true }); try { fs.writeFileSync(f, secret, { mode: 0o600, flag: "wx" }); } catch { secret = fs.readFileSync(f, "utf8").trim(); } }
  secretFrom = f;
  return secret;
}
export const subject = (id) => crypto.createHmac("sha256", key()).update(`serve-trust:${id}`).digest("hex").slice(0, 16);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const hashOf = (e) => sha(JSON.stringify([e.n, e.at, e.kind, e.who, e.d, e.prev]));
// the gateway's signature on a head; tests pass their own signer
let signer = null;
export function useSigner(fn) { signer = fn; }
async function sign(text) {
  if (signer) return signer(text);
  const { ownKey } = await import("../a2a/peer.js"), k = ownKey();
  return { kid: k.kid, alg: "EdDSA", sig: crypto.sign(null, Buffer.from(text), k.key).toString("base64url") };
}
export const headText = (h) => `serve-trust-head:${h.day}:${h.n}:${h.hash}`;

// ---- the chain ----
function add(kind, id, d = {}, now = Date.now()) {
  const c = data().chain, prev = c.length ? c[c.length - 1].hash : GENESIS;
  const e = { n: c.length, at: now, kind, who: subject(id), d, prev };
  e.hash = hashOf(e);
  c.push(e);
  state = null;
  sealDays(now);
  save();
  return e;
}
// the head of every day before today, signed once (the signature is added when it comes back)
function sealDays(now = Date.now()) {
  const c = data().chain, day = (t) => new Date(t).toISOString().slice(0, 10), today = day(now), done = new Set(data().heads.map((h) => h.day));
  for (let i = 0; i < c.length; i++) {
    const d = day(c[i].at), last = i === c.length - 1 || day(c[i + 1].at) !== d;
    if (!last || d >= today || done.has(d)) continue;
    const h = { day: d, n: i + 1, hash: c[i].hash };
    data().heads.push(h); done.add(d);
    sign(headText(h)).then((s) => { Object.assign(h, s); save(); }).catch(() => {});
  }
}
// today's head, signed now (for the app's "verified" line and for anyone who asks)
export async function head(now = Date.now()) {
  const c = data().chain, h = { day: new Date(now).toISOString().slice(0, 10), n: c.length, hash: c.length ? c[c.length - 1].hash : GENESIS, at: now };
  return { ...h, ...(await sign(headText(h)).catch(() => ({}))) };
}
// replay a chain: every hash, every link, and the records it adds up to; the first broken entry stops it
export function verify(chain = data().chain, heads = data().heads) {
  let prev = GENESIS;
  for (const e of chain) {
    if (e.prev !== prev) return { ok: false, at: e.n, why: "an entry does not point at the one before it" };
    if (hashOf(e) !== e.hash) return { ok: false, at: e.n, why: "an entry was changed after it was written" };
    prev = e.hash;
  }
  for (const h of heads) if (h.n > chain.length || (h.n && chain[h.n - 1].hash !== h.hash)) return { ok: false, at: h.n, why: `the chain no longer matches the head signed on ${h.day}` };
  return { ok: true, n: chain.length, head: prev };
}
// the records, worked out from the chain
function replay(now = Date.now()) {
  if (state && state.at > now - 60e3) return state;
  const people = {}, agents = {}, gone = new Set();
  const P = (w) => (people[w] ||= { games: 0, came: 0, missed: 0, late: 0, level: { ok: 0, off: 0 } }), A = (w) => (agents[w] ||= { said: 0, kept: 0, asks: [], probe: 0, sig: [], hosts: new Set() });
  const pair = new Map(); // a promise counts once a week per host and member: two accounts of one person can't pump it
  for (const e of data().chain) {
    const w = e.who, d = e.d || {};
    if (e.kind === "left") { gone.add(w); delete people[w]; delete agents[w]; continue; }
    if (gone.has(w)) continue;
    if (e.kind === "promise") {
      const k = `${d.host || "?"}>${w}`;
      if (d.host && pair.has(k) && e.at - pair.get(k) < 7 * DAY) continue;
      pair.set(k, e.at);
      const a = A(w); a.said++; if (d.kept) a.kept++; if (d.host) a.hosts.add(d.host);
    }
    if (e.kind === "asked") { const a = A(w); a.asks = [...a.asks.filter((x) => e.at - x.at < DAY), { at: e.at, n: d.n }]; if (a.asks.reduce((s, x) => s + x.n, 0) > PROBE_ASKS) a.probe = e.at; }
    if (e.kind === "sig") A(w).sig.push({ at: e.at, why: d.why });
    if (e.kind === "late") { const p = P(w); p.late++; p.games++; }
    if (e.kind === "game") { const p = P(w); p.games++; if (d.came) p.came++; else p.missed++; for (const l of d.level || []) p.level[l]++; }
    if (e.kind === "seed" || e.kind === "carried") { if (d.person) Object.assign(P(w), d.person); if (d.agent) { Object.assign(A(w), d.agent); A(w).hosts.add("seed-a").add("seed-b"); } }
  }
  return (state = { at: now, people, agents });
}

// ---- the agent's record ----
// a promise: the agent said (or, for a person asked directly, would have said) yes for its person, and the person was
// asked; kept is their answer; host is whose game it was (a promise counts once a week per host)
export function promise(id, kept, host = null) { add("promise", id, { kept: !!kept, ...(host ? { host: subject(host) } : {}) }); }
// the agent asked `n` people's agents at once (a huddle); too many in a day marks it a prober for a week
export function asked(id, n, now = Date.now()) { if (n > 0) add("asked", id, { n }, now); }
// a request with the agent's key that failed the check (replayed, changed, expired)
export function badSignature(id, why, now = Date.now()) { add("sig", id, { why: String(why || "bad") }, now); }

// ---- the person's record ----
// leaving a game: in its last six hours it is a late drop
export function left(id, startMs, now = Date.now()) {
  if (!startMs || startMs - now > LATE_HOURS * HOUR || now > startMs) return false;
  add("late", id, {}, now);
  return true;
}
// a game that is on: after it, the players are asked who came (the votes wait here; only the outcome goes on the chain)
export function expect(key, players, startMs) {
  if (!key || players.length < 2) return;
  const c = data().checks[key];
  if (c) { if (!c.settled) c.players = [...new Set([...c.players, ...players])]; } // more people joined the same game
  else data().checks[key] = { at: startMs, players: [...players], votes: {}, settled: false };
  save();
}
// someone who left a game before it started is off its after-game check
export function unexpect(key, id) { const c = data().checks[key]; if (c && !c.settled) { c.players = c.players.filter((x) => x !== id); delete c.votes[id]; save(); } }
// one player's answers: { <player>: "came" | "missed" }, and optionally whether each played at the level they said
export function vote(me, key, came = {}, level = {}, now = Date.now()) {
  const c = data().checks[key];
  if (!c || !c.players.includes(me)) return { error: "That game isn't one you played.", code: 404 };
  if (now < c.at + 60 * 60e3) return { error: "Ask again after the game.", code: 409 };
  if (c.settled) return { error: "Already settled.", code: 409 };
  c.votes[me] = Object.fromEntries(c.players.filter((x) => x !== me).map((x) => [x, { came: came[x] !== "missed", level: ["ok", "off"].includes(level[x]) ? level[x] : null }]));
  if (c.players.every((x) => c.votes[x]) || now > c.at + 72 * HOUR) settle(key, now);
  save();
  return { ok: true, settled: c.settled };
}
// most of the others who answered decide whether a player came; nobody answering about them leaves them uncounted
function settle(key, now = Date.now()) {
  const c = data().checks[key];
  for (const x of c.players) {
    const said = Object.entries(c.votes).filter(([v]) => v !== x).map(([, v]) => v[x]).filter(Boolean);
    if (!said.length) continue;
    const yes = said.filter((v) => v.came).length;
    add("game", x, { came: yes * 2 >= said.length, level: said.map((v) => v.level).filter(Boolean), game: sha(key).slice(0, 12) }, now);
  }
  c.settled = true; c.votes = {}; // the outcome is on the chain; who voted what is not kept
}
// the games a member still has to say who came to (an hour after the start, for three days)
export function pending(me, now = Date.now()) {
  for (const [k, c] of Object.entries(data().checks)) if (!c.settled && now > c.at + 72 * HOUR) settle(k, now);
  return Object.entries(data().checks).filter(([, c]) => !c.settled && c.players.includes(me) && !c.votes[me] && now > c.at + 60 * 60e3).map(([key, c]) => ({ key, at: c.at, players: c.players.filter((x) => x !== me) }));
}

// ---- what anyone sees ----
const rate = (a, b) => (b ? a / b : null);
export function badge(id, now = Date.now()) {
  const s = replay(now), w = subject(id);
  const p = s.people[w] || { games: 0, came: 0, late: 0, level: { ok: 0, off: 0 } }, a = s.agents[w] || { said: 0, kept: 0, probe: 0, sig: [] };
  const show = rate(p.came, p.games), kept = rate(a.kept, a.said);
  return {
    show: { rate: show == null ? null : +show.toFixed(2), games: p.games, late: p.late, new: p.games < NEW_UNDER, levelOk: p.level.ok + p.level.off ? +(p.level.ok / (p.level.ok + p.level.off)).toFixed(2) : null },
    agent: { rate: kept == null ? null : +kept.toFixed(2), said: a.said, new: a.said < NEW_UNDER || (a.hosts?.size ?? 0) < 2, probe: !!a.probe && now - a.probe < 7 * DAY, badSig: a.sig.filter((x) => now - x.at < 30 * DAY).length },
  };
}
// a member's own entries on the chain, for them to check
export const mine = (id) => { const w = subject(id); return { subject: w, entries: data().chain.filter((e) => e.who === w).map(({ n, at, kind, d, hash }) => ({ n, at, kind, d, hash })) }; };
// the chain as anyone may read it: pseudonymous subjects, no names, and the signed daily heads
export const publicChain = ({ after = -1, n = 500 } = {}) => ({ entries: data().chain.filter((e) => e.n > after).slice(0, Math.min(2000, n)), heads: data().heads, genesis: GENESIS, length: data().chain.length,
  how: "hash = sha256(JSON.stringify([n, at, kind, who, d, prev])); each prev is the hash before it; heads are signed as 'serve-trust-head:<day>:<n>:<hash>' with the Ed25519 key at /a2a/keys.json" });
export const showText = (b) => (b.show.new ? `new · ${b.show.games} game${b.show.games === 1 ? "" : "s"}` : `shows up ${Math.round(b.show.rate * 100)}% · ${b.show.games} games`);
export const agentText = (b) => (b.agent.probe ? "asks too many agents" : b.agent.badSig ? "signature problems" : b.agent.new ? "agent new" : `agent keeps ${Math.round(b.agent.rate * 100)}% of its yeses`);
// a game's gate: { minShow (0..1, 0 = anyone), agentMin (0..1) }; the verdict for one person:
//   ok        their agent may answer for them
//   confirm   they can play, but their agent can't say yes for them: they are asked themself
//   waitlist  under the game's show-up rate (new people are let in unless the gate says otherwise)
// a 90% gate wants people with a record (new people wait); at 75% new people are let in
export function gateOf(g = {}) { const m = Math.max(0, Math.min(1, +g.minShow || 0)), minShow = Math.round(m * 100) / 100; return { minShow, agentMin: g.agentMin === 0 ? 0 : AGENT_MIN, newOk: g.newOk == null ? minShow < 0.9 : g.newOk !== false }; }
// the rate a gate compares: smoothed toward 85% by two games, so one miss in a short record doesn't shut someone out
export const gateRate = (b) => (b.show.rate * b.show.games + 1.7) / (b.show.games + 2);
// the cut-offs and the way back, in words an agent can pass on
export function explain(id, now = Date.now()) {
  const b = badge(id, now), out = [];
  if (b.show.new) out.push(`Shows up: new (${b.show.games} of ${NEW_UNDER} games counted). Games at 90% wait-list new people; at 75% or less they let you in.`);
  else { const came = Math.round(b.show.rate * b.show.games), need = (r) => Math.max(0, Math.ceil((r * (b.show.games + 2) - came - 1.7) / (1 - r))); out.push(`Shows up ${Math.round(b.show.rate * 100)}% (${came} of ${b.show.games}). A game's gate compares ${Math.round(gateRate(b) * 100)}% (your record, smoothed). To clear 75%: ${need(0.75) ? `${need(0.75)} more game${need(0.75) > 1 ? "s" : ""} you turn up to` : "you do"}; 90%: ${need(0.9) ? `${need(0.9)} more` : "you do"}.`); }
  if (b.agent.probe) out.push("Your agent asked too many people's agents today: nearby asks pause for a day; your clubs still work.");
  if (b.agent.badSig) out.push("Requests with your agent's key failed their check in the last 30 days: for now you are asked directly. Check the key's signing (see /llms.txt).");
  if (b.agent.new) out.push(`Your agent: new (${b.agent.said} yes${b.agent.said === 1 ? "" : "es"} counted; it needs ${NEW_UNDER} from two different hosts).`);
  else { const kept = Math.round(b.agent.rate * b.agent.said), n = Math.max(0, Math.ceil((AGENT_MIN * b.agent.said - kept) / (1 - AGENT_MIN))); out.push(`Your agent keeps ${Math.round(b.agent.rate * 100)}% of its yeses (${kept} of ${b.agent.said}). ${b.agent.rate >= AGENT_MIN ? "It may answer for you." : `Under ${AGENT_MIN * 100}% it can't say yes for you, so you're asked directly; each time you answer the way it would have, it counts. ${n} more like that and it answers for you again.`}`); }
  return out;
}
export function check(id, gate = {}, now = Date.now()) {
  const g = gateOf(gate), b = badge(id, now);
  if (g.minShow && (b.show.new ? !g.newOk : gateRate(b) < g.minShow)) return { verdict: "waitlist", badge: b, why: b.show.new ? "new, and this game wants people with a record" : `${showText(b)}; this game needs ${Math.round(g.minShow * 100)}%` };
  if (b.agent.probe) return { verdict: "confirm", badge: b, why: "their agent asked too many people's agents today" };
  if (b.agent.badSig) return { verdict: "confirm", badge: b, why: "requests with their agent's key failed the signature check" };
  if (g.agentMin && !b.agent.new && b.agent.rate < g.agentMin) return { verdict: "confirm", badge: b, why: `their agent keeps only ${Math.round(b.agent.rate * 100)}% of its yeses` };
  return { verdict: "ok", badge: b };
}
// leaving Serve: a "left" entry (the chain is never rewritten), and the games waiting for votes forget them
export function forget(id) {
  add("left", id);
  for (const c of Object.values(data().checks)) { c.players = c.players.filter((x) => x !== id); delete c.votes[id]; }
  save();
}
// for the local demo's test accounts only (seed scripts), never called by a route; marked "seed" on the chain
export function seed(id, { person: p, agent: a } = {}) { add("seed", id, { ...(p ? { person: p } : {}), ...(a ? { agent: a } : {}) }); }
