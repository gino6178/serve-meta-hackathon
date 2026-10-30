// Proof of consent: a game is booked only with the signature of every player's agent over the same game. When a talk
// agrees a game, each member's agent that said yes signs the game's record (the canonical JSON of the date, start,
// minutes, venue, sport and the sorted player ids) with its own Ed25519 key (data/agent_keys, one per agent,
// mode 600); the player's own agent signs when the player says yes. play.book checks every signature against the game
// it is asked to book: a record changed after it was signed (another time or venue, a player added) or a
// signature by any other key is refused. CONSENT=require also refuses a game with none (by default a game made
// outside a talk, such as the play search's, still books, and the booking says it had no proof). test/consent_unit.mjs.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = () => path.resolve(process.env.AGENT_KEYS_DIR || "data/agent_keys");
const b64u = (b) => Buffer.from(b).toString("base64url");
const safe = (id) => String(id).replace(/[^\w.-]/g, "_").slice(0, 64);
// the agent's key, made the first time it is needed
function keyOf(id) {
  const f = path.join(DIR(), `${safe(id)}.pem`);
  if (!fs.existsSync(f)) {
    fs.mkdirSync(DIR(), { recursive: true });
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(f, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  }
  return crypto.createPrivateKey(fs.readFileSync(f));
}
export const publicOf = (id) => crypto.createPublicKey(keyOf(id)).export({ format: "jwk" }).x;
// the game as every agent signs it
export function canonical(o) {
  const players = ["you", ...(o.partners || []).map((p) => p.id)].map(String).sort();
  return JSON.stringify({ date: o.date, start: o.start, minutes: o.minutes || 90, venue: o.venue?.id || null, sport: o.sport || "badminton", players });
}
export function sign(id, o) {
  const body = canonical(o), sig = crypto.sign(null, Buffer.from(body), keyOf(id));
  return { by: String(id), kid: publicOf(id).slice(0, 16), sig: b64u(sig) };
}
// every player's signature, over this game: { ok, signed, of, missing, bad }
export function verify(o, sigs = []) {
  const body = Buffer.from(canonical(o)), players = JSON.parse(canonical(o)).players, bad = [], signed = new Set();
  for (const s of sigs) {
    let ok = false;
    try { ok = players.includes(s.by) && crypto.verify(null, body, crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: publicOf(s.by) }, format: "jwk" }), Buffer.from(s.sig, "base64url")); } catch { ok = false; }
    if (ok) signed.add(s.by); else bad.push(s.by);
  }
  const missing = players.filter((p) => !signed.has(p));
  return { ok: !bad.length && !missing.length, signed: signed.size, of: players.length, missing, bad };
}
export const required = () => process.env.CONSENT === "require";
// a member on a peer gateway (id@club) confirms through its own gateway instead (play.js hooks.confirm, a mandate)
export const remote = (id) => String(id).includes("@");

// ---- each yes, signed and chained ----
// Every yes a person gives (or their agent gives for them) is kept as a record signed with that member's agent key: a
// yes in a huddle (members/huddle.js reply), joining a game in the feed (feed/posts.js join), a yes to a game their agent
// put in front of them (huddle.js answerGame, via "ask"), and confirming a spot that opened (via "confirm"). Each record
// carries the hash of the one before it, as members/trust.js chains its entries, so a record changed, removed or
// reordered breaks every hash after it, and a changed game or member breaks its signature. verifyLog() replays both.
//   data/consent.jsonl (CONSENT_LOG): one record a line, { n, at, by, via, ref, game, agent, kid, sig, prev, hash }
const LOG = () => path.resolve(process.env.CONSENT_LOG || path.join(path.dirname(DIR()), "consent.jsonl"));
export const GENESIS = "0".repeat(64);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
// JSON with its keys sorted all the way down, so one game always reads the same
export const stable = (x) => (Array.isArray(x) ? `[${x.map(stable).join(",")}]` : x && typeof x === "object" ? `{${Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(",")}}` : JSON.stringify(x ?? null));
// what the member's key signs, and what the chain hashes
export const yesText = (r) => `serve-yes:${stable([r.by, r.via, r.ref, r.game, r.agent, r.at])}`;
export const hashOf = (r) => sha(stable([r.n, r.at, r.by, r.via, r.ref, r.game, r.agent, r.kid, r.sig, r.prev]));
// the log as written
export function records(file = LOG()) {
  let text = ""; try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
let end = null; // { file, size, n, hash }: where the log ends, so a yes doesn't read the whole log again
function tail() {
  const f = LOG(); let size = 0; try { size = fs.statSync(f).size; } catch { size = 0; }
  if (end?.file === f && end.size === size) return end;
  const all = records(f), last = all.at(-1);
  return (end = { file: f, size, n: all.length, hash: last ? last.hash : GENESIS });
}
// one yes: signed, chained and appended; game is what was agreed (sport, day or date, start, place, players...)
export function record(id, game, { via, ref, agent = false, now = Date.now() } = {}) {
  const t = tail(), r = { n: t.n, at: now, by: String(id), via: String(via), ref: String(ref ?? ""), game, agent: !!agent, prev: t.hash };
  r.kid = publicOf(id).slice(0, 16);
  r.sig = b64u(crypto.sign(null, Buffer.from(yesText(r)), keyOf(id)));
  r.hash = hashOf(r);
  fs.mkdirSync(path.dirname(t.file), { recursive: true });
  fs.appendFileSync(t.file, JSON.stringify(r) + "\n");
  end = { file: t.file, size: fs.statSync(t.file).size, n: r.n + 1, hash: r.hash };
  return r;
}
// a member's public key, only if they have one (checking never makes a key)
const pubOf = (id) => (fs.existsSync(path.join(DIR(), `${safe(id)}.pem`)) ? crypto.createPublicKey(keyOf(id)) : null);
// replay the log: every link, every hash, every signature; the first broken record stops it
export function verifyLog(list = records()) {
  let prev = GENESIS;
  for (const [i, r] of list.entries()) {
    if (r.n !== i || r.prev !== prev) return { ok: false, at: i, why: "a record does not point at the one before it" };
    if (hashOf(r) !== r.hash) return { ok: false, at: i, why: "a record was changed after it was written" };
    let ok = false;
    try { const k = pubOf(r.by); ok = !!k && crypto.verify(null, Buffer.from(yesText(r)), k, Buffer.from(r.sig, "base64url")); } catch { ok = false; }
    if (!ok) return { ok: false, at: i, why: "a record's signature doesn't match its member's key" };
    prev = r.hash;
  }
  return { ok: true, n: list.length, head: prev };
}
// the yeses a member gave, for them to check
export const yesesOf = (id) => records().filter((r) => r.by === String(id));
