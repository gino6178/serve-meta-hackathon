// Members: people join with Facebook or Instagram, and their agents join through a channel of their own, where every
// request is signed with the agent's key.
//   People. /api/auth/<provider>/start sends the browser to the provider's own login dialog with a one-time state;
//   the callback checks the state, swaps the code for a token here on the server (the app secret never leaves it),
//   reads the member's id, name and picture once, and keeps only those: no provider token is stored, and the
//   provider's id is kept as a hash. The member gets a session: their id and an expiry, signed with this gateway's own
//   key (HMAC-SHA256, data/members.key), handed back to the app in the URL fragment (never sent to a server, never in a
//   log) and kept by the app, which sends it with every member request (x-serve-session).
//     Facebook Login: FB_APP_ID, FB_APP_SECRET (scope public_profile).
//     Instagram (Instagram API with Instagram Login, for professional accounts): IG_APP_ID, IG_APP_SECRET.
//     MEMBERS_PUBLIC_URL: where the providers send the browser back (this gateway's public address, https);
//     MEMBERS_APP_URL: the app, where the member lands with their session.
//   Without a provider configured, a demo account can be made instead, marked demo in everything it does
//   (MEMBERS_DEMO=off turns that off).
//   Agents. A member registers their agent's public key (an Ed25519 JWK); its key id is the key's own fingerprint.
//   The agent then calls the agent channel (/api/agent-channel/...) with every request signed: a compact JWS over the
//   method, the path, the SHA-256 of the body, a short life and a one-time nonce (a2a/peer.js signToken and
//   checkToken, the same as between gateways). A request that is unsigned, signed by an unknown or revoked key,
//   replayed, changed, or meant for another path is refused, and the refusal is logged with its reason. What an agent
//   posts says it is an agent, and whose.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import { checkToken, kidOf, HEADER } from "../a2a/peer.js";
import { badSignature } from "./trust.js";

const FILE = () => path.resolve(process.env.MEMBERS_FILE || "data/members.json");
const KEYFILE = () => path.resolve(process.env.MEMBERS_KEY_FILE || "data/members.key");
const DAY = 864e5, SESSION_DAYS = 30;
let db = null;
const data = () => (db ||= readJSON(FILE(), { members: {}, log: [] }));
const save = () => writeJSON(FILE(), data());
export const reset = () => { db = { members: {}, log: [] }; save(); };
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// ---- this gateway's session key -------------------------------------------------------------------------------------
let secret = null;
function key() {
  if (secret) return secret;
  try { secret = Buffer.from(fs.readFileSync(KEYFILE(), "utf8").trim(), "hex"); } catch { /* made below */ }
  if (!secret || secret.length < 32) {
    secret = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(KEYFILE()), { recursive: true });
    fs.writeFileSync(KEYFILE(), secret.toString("hex"), { mode: 0o600 });
  }
  return secret;
}
const mac = (s) => crypto.createHmac("sha256", key()).update(s).digest("base64url");
export function sessionFor(id, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ m: id, exp: now + SESSION_DAYS * DAY })).toString("base64url");
  return `${body}.${mac(body)}`;
}
// the member a session names, or null: signed by this gateway, not expired, a member who still exists
export function fromSession(token, now = Date.now()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let c; try { c = JSON.parse(Buffer.from(body, "base64url")); } catch { return null; }
  if (!c?.m || !(c.exp > now)) return null;
  const m = data().members[c.m];
  return m && m.kind === "person" && !m.gone ? m : null;
}

// ---- people --------------------------------------------------------------------------------------------------------
export const PROVIDERS = {
  facebook: {
    id: () => process.env.FB_APP_ID, secret: () => process.env.FB_APP_SECRET,
    auth: (cid, back, state) => `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({ client_id: cid, redirect_uri: back, state, scope: "public_profile", response_type: "code" })}`,
    async profile(code, back) {
      const t = await getJSON(`https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({ client_id: this.id(), client_secret: this.secret(), redirect_uri: back, code })}`);
      const me = await getJSON(`https://graph.facebook.com/v21.0/me?${new URLSearchParams({ fields: "id,name,picture.type(large)", access_token: t.access_token })}`);
      return { providerId: me.id, name: me.name, picture: me.picture?.data?.url || null };
    },
  },
  instagram: {
    id: () => process.env.IG_APP_ID, secret: () => process.env.IG_APP_SECRET,
    auth: (cid, back, state) => `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: cid, redirect_uri: back, state, scope: "instagram_business_basic", response_type: "code" })}`,
    async profile(code, back) {
      const t = await getJSON("https://api.instagram.com/oauth/access_token", { method: "POST", body: new URLSearchParams({ client_id: this.id(), client_secret: this.secret(), grant_type: "authorization_code", redirect_uri: back, code }) });
      const me = await getJSON(`https://graph.instagram.com/v21.0/me?${new URLSearchParams({ fields: "user_id,username,profile_picture_url", access_token: t.access_token })}`);
      return { providerId: me.user_id || t.user_id, name: me.username, picture: me.profile_picture_url || null };
    },
  },
};
async function getJSON(url, init = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || j.error_message || `the provider answered ${r.status}`);
  return j;
}
export const providers = () => ({ facebook: !!(PROVIDERS.facebook.id() && PROVIDERS.facebook.secret()), instagram: !!(PROVIDERS.instagram.id() && PROVIDERS.instagram.secret()), demo: process.env.MEMBERS_DEMO !== "off" });
const publicUrl = () => (process.env.MEMBERS_PUBLIC_URL || `http://localhost:${process.env.PORT || 8790}`).replace(/\/$/, "");
export const appUrl = () => (process.env.MEMBERS_APP_URL || "http://localhost:5173").replace(/\/$/, "");
const backFor = (p) => `${publicUrl()}/api/auth/${p}/callback`;

// one-time states for the login round trip, ten minutes each
const states = new Map();
export function start(provider, now = Date.now()) {
  const P = PROVIDERS[provider];
  if (!P || !providers()[provider]) return { error: `${provider} sign-in is not set up on this server` };
  for (const [s, v] of states) if (now - v.at > 10 * 6e4) states.delete(s);
  const state = crypto.randomBytes(18).toString("base64url");
  states.set(state, { provider, at: now });
  return { url: P.auth(P.id(), backFor(provider), state) };
}
export async function callback(provider, { code, state, error }, now = Date.now()) {
  const s = states.get(String(state || ""));
  states.delete(String(state || ""));
  if (!s || s.provider !== provider || now - s.at > 10 * 6e4) return { error: "This sign-in link has expired. Try again." };
  if (error || !code) return { error: "Sign-in was cancelled." };
  let p;
  try { p = await PROVIDERS[provider].profile(String(code), backFor(provider)); } catch (e) { return { error: `${provider} sign-in failed: ${e.message}` }; }
  if (!p.providerId) return { error: `${provider} did not say who you are.` };
  return { member: join({ provider, providerId: p.providerId, name: p.name, picture: p.picture }, now) };
}
// a person: the same provider account is the same member
export function join({ provider, providerId, name, picture = null, demo = false }, now = Date.now()) {
  const ref = hash(`${provider}:${providerId}`), id = `${provider.slice(0, 2)}-${ref.slice(0, 12)}`, d = data();
  const m = d.members[id] = { ...(d.members[id] || { joined: now }), id, kind: "person", provider, ref, name: String(name || "New member").replace(/[^\p{L}\p{N} ._'-]/gu, "").slice(0, 40) || "New member", picture: picture && /^https:\/\//.test(picture) ? picture : null, ...(demo ? { demo: true } : {}), seen: now };
  delete m.gone;
  save();
  return view(m);
}
export function demo(name, now = Date.now()) {
  if (!providers().demo) return { error: "Demo accounts are off on this server." };
  return { member: join({ provider: "demo", providerId: crypto.randomUUID(), name: String(name || "").trim() || "Demo player", demo: true }, now) };
}
export const get = (id) => data().members[id] || null;
export const nameOf = (id) => { const m = data().members[id]; return m && !m.gone ? m.name : null; };
export function view(m) {
  if (!m) return null;
  return { id: m.id, kind: m.kind, name: m.name, provider: m.provider, picture: m.picture || null, joined: m.joined, ...(m.demo ? { demo: true } : {}),
    ...(m.kind === "agent" ? { owner: m.owner, ownerName: nameOf(m.owner), kid: m.kid, revoked: !!m.revoked } : {}) };
}
// leaving: the member and their agents are gone (what they posted goes with the feed's own /forget)
export function leave(id) {
  const d = data(), gone = Object.values(d.members).filter((m) => m.id === id || m.owner === id);
  for (const m of gone) delete d.members[m.id];
  save();
  return gone.map((m) => m.id);
}

// ---- agents --------------------------------------------------------------------------------------------------------
const AGENT_NAME = /^[\p{L}\p{N} ._'-]{1,40}$/u;
export function addAgent(owner, { name, jwk }, now = Date.now()) {
  const o = get(owner);
  if (!o || o.kind !== "person") return { error: "Sign in first." };
  if (!AGENT_NAME.test(String(name || ""))) return { error: "Give your agent a name (letters, digits, spaces; 40 at most)." };
  if (jwk?.kty !== "OKP" || jwk.crv !== "Ed25519" || !/^[A-Za-z0-9_-]{43}$/.test(String(jwk.x || "")) || jwk.d) return { error: "The key must be an Ed25519 public key (a JWK with kty OKP, crv Ed25519, x; never the private part d)." };
  try { crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: jwk.x }, format: "jwk" }); } catch { return { error: "That is not a usable Ed25519 key." }; }
  const kid = kidOf(jwk.x), d = data();
  if (Object.values(d.members).some((m) => m.kid === kid && !m.revoked)) return { error: "That key is already an agent's." };
  if (Object.values(d.members).filter((m) => m.owner === owner && !m.revoked).length >= 3) return { error: "Three agents per member at most." };
  const id = `ag-${hash(kid).slice(0, 12)}`;
  d.members[id] = { id, kind: "agent", provider: "key", name: String(name).trim(), owner, kid, x: jwk.x, joined: now };
  save();
  return { agent: view(d.members[id]) };
}
export function revokeAgent(owner, id) {
  const m = get(id);
  if (!m || m.kind !== "agent" || m.owner !== owner) return { error: "Not one of your agents." };
  m.revoked = Date.now(); save();
  return { agent: view(m) };
}
export const agentsOf = (owner) => Object.values(data().members).filter((m) => m.kind === "agent" && m.owner === owner).map(view);

// the nonces the channel has seen, until each expires
const seenNonces = new Map();
const seen = { has: (n, now) => (seenNonces.get(n) || 0) > now, add: (n, until) => { seenNonces.set(n, until); if (seenNonces.size > 5000) for (const [k, v] of seenNonces) if (v < Date.now()) seenNonces.delete(k); } };
export const AUDIENCE = "serve-agent-channel";
// one signed request on the agent channel: { ok, agent } or { ok: false, why, message }
export function checkAgent(req, body, p, now = Date.now()) {
  const token = req.headers[HEADER];
  if (!token) return logged({ ok: false, why: "unsigned", message: `every agent-channel request needs its ${HEADER} header` }, p);
  const r = checkToken(token, { method: req.method, path: p, body, now, audience: AUDIENCE, seen,
    keyFor: (kid) => { const m = Object.values(data().members).find((x) => x.kind === "agent" && x.kid === kid && !x.revoked); return m ? { peer: m.id, key: { x: m.x } } : null; } });
  if (!r.ok) {
    // a known agent's key on a request that failed the check counts against that agent (trust.js)
    try { const kid = JSON.parse(Buffer.from(String(token).split(".")[0], "base64url").toString()).kid; const m = Object.values(data().members).find((x) => x.kind === "agent" && x.kid === kid); if (m?.owner) badSignature(m.owner, r.why); } catch { /* not a token we can read */ }
    return logged(r, p);
  }
  const m = get(r.peer);
  if (!get(m.owner)) return logged({ ok: false, why: "no-owner", message: "the agent's member has left" }, p);
  return { ok: true, agent: m };
}
function logged(r, p) {
  data().log = [...(data().log || []), { at: Date.now(), path: p, why: r.why }].slice(-200); save();
  return r;
}
export const refusals = (n = 20) => (data().log || []).slice(-n).reverse();
