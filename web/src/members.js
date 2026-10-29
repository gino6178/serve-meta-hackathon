// Members in this browser: the session the gateway signed when the member joined with Facebook, Instagram or a demo
// account (agent/src/members), and the member's own agent, whose key lives here.
//   The session comes back from the provider's login in the address (#/social?session=...); it is moved into this
//   browser's storage at once and taken out of the address. agent.js sends it with every call.
//   The agent: an Ed25519 key made in this browser with Web Crypto. Its public half is registered with the gateway;
//   the private half never leaves this browser. Every call the agent makes on the agent channel is signed with it: a
//   compact JWS over the method, the path, the SHA-256 of the body, a 60-second life and a one-time nonce, the same
//   token the gateway checks between gateways (agent/src/a2a/peer.js).
import { useEffect, useState } from "react";
import { AGENT_URL, agentFetch, SESSION_KEY } from "./agent.js";

const AGENT_KEY = "serve.agentKey.v1";
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private window */ } } };
const listeners = new Set();
const changed = () => listeners.forEach((f) => f());

// the session in the address after a provider's login: kept, and taken out of the address
export function takeSession() {
  const m = /[?&]session=([A-Za-z0-9_.-]+)/.exec(location.hash);
  if (!m) return false;
  store.set(SESSION_KEY, m[1]);
  history.replaceState(null, "", location.pathname + location.hash.replace(/[?&]session=[A-Za-z0-9_.-]+/, ""));
  changed();
  return true;
}
const json = async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `The gateway answered ${r.status}.`); return j; };
export const providers = () => fetch(`${AGENT_URL}/api/auth/providers`).then(json);
export const startUrl = (p) => `${AGENT_URL}/api/auth/${p}/start`;
export async function demo(name) {
  const r = await json(await fetch(`${AGENT_URL}/api/auth/demo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }));
  store.set(SESSION_KEY, r.session); changed();
  return r.member;
}
export const me = () => agentFetch("/api/me").then(json);
export function signOut() { store.set(SESSION_KEY, null); changed(); }
export async function leave() { await agentFetch("/api/members/leave", { method: "POST" }).then(json); store.set(AGENT_KEY, null); signOut(); }
// the member, as the app sees them: undefined while asking, null when signed out
export function useMember() {
  const [m, setM] = useState(undefined);
  useEffect(() => {
    const load = () => (store.get(SESSION_KEY) ? me().then(setM, () => { store.set(SESSION_KEY, null); setM(null); }) : setM(null));
    takeSession(); load(); listeners.add(load);
    return () => listeners.delete(load);
  }, []);
  return [m, () => me().then(setM)];
}

// ---- the member's agent, with its key in this browser ----------------------------------------------------------------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const utf8 = (s) => new TextEncoder().encode(s);
async function kidOf(x) { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(x))); return `serve-${[...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("")}`; }
export const canSign = () => !!crypto?.subtle;
// the agent's key: made once, kept here (only the public half is ever sent)
async function agentKey() {
  const kept = store.get(AGENT_KEY);
  if (kept) { const k = JSON.parse(kept); return { ...k, privateKey: await crypto.subtle.importKey("jwk", k.priv, { name: "Ed25519" }, false, ["sign"]) }; }
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey), priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const k = { pub: { kty: "OKP", crv: "Ed25519", x: pub.x }, priv, kid: await kidOf(pub.x) };
  store.set(AGENT_KEY, JSON.stringify(k));
  return { ...k, privateKey: pair.privateKey };
}
export const agentKid = () => { try { return JSON.parse(store.get(AGENT_KEY))?.kid || null; } catch { return null; } };
export async function registerAgent(name) {
  const k = await agentKey();
  return agentFetch("/api/members/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, jwk: k.pub }) }).then(json);
}
export const revokeAgent = (id) => agentFetch("/api/members/agents/revoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).then(json);
async function sign(method, path, body) {
  const k = await agentKey(), t = Math.floor(Date.now() / 1000);
  const header = { alg: "EdDSA", typ: "serve-request+jwt", kid: k.kid };
  const claims = { iss: k.kid, aud: "serve-agent-channel", method, path, body: b64u(await crypto.subtle.digest("SHA-256", utf8(body))), iat: t, exp: t + 60, jti: crypto.randomUUID() };
  const input = `${b64u(utf8(JSON.stringify(header)))}.${b64u(utf8(JSON.stringify(claims)))}`;
  return `${input}.${b64u(await crypto.subtle.sign({ name: "Ed25519" }, k.privateKey, utf8(input)))}`;
}
// one call on the agent channel, as the agent: no session, no token, only its signature
export async function asAgent(path, body = null) {
  const method = body ? "POST" : "GET", text = body ? JSON.stringify(body) : "";
  const r = await fetch(AGENT_URL + path, { method, headers: { "serve-signature": await sign(method, path, text), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: text } : {}) });
  return json(r);
}
