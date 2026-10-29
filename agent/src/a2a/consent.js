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
