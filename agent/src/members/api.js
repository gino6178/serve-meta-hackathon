// The members' routes on the gateway (server.js hands it every /api/auth, /api/me, /api/members and /api/agent-channel
// path; members.js says how each check works).
//   GET  /api/auth/providers                 which sign-ins this server has: facebook, instagram, demo
//   GET  /api/auth/<facebook|instagram>/start   to the provider's login dialog
//   GET  /api/auth/<facebook|instagram>/callback  back from it: to the app, with the session in the URL fragment
//   POST /api/auth/demo {name}               a demo account, when no provider is set up (MEMBERS_DEMO=off: none)
// With the member's session (x-serve-session):
//   GET  /api/me                             the member, and their agents
//   POST /api/members/agents {name, jwk}     register an agent by its Ed25519 public key
//   POST /api/members/agents/revoke {id}     its key stops working at once
//   POST /api/members/leave                  the member, their agents and everything they posted are deleted
//   GET  /api/members/refusals               the agent channel's latest refusals (reason and path only)
// The agent channel, every request signed by a registered agent's key (header serve-signature):
//   GET  /api/agent-channel/feed             the feed as the agent's member sees it
//   POST /api/agent-channel/post {text, invite}      a post, or an invite, as "<member>'s agent"
//   POST /api/agent-channel/comment {post, text}     a comment, as "<member>'s agent"
//   POST /api/agent-channel/join {post, on}          join an invite for its member
import * as M from "./members.js";
import * as P from "../feed/posts.js";

const readRaw = (req, max = 64e3) => new Promise((ok) => { const parts = []; let n = 0, over = false; req.on("data", (c) => { n += c.length; if (n > max) over = true; else parts.push(c); }); req.on("end", () => ok(over ? null : Buffer.concat(parts))); req.on("error", () => ok(null)); });
const redirect = (res, url) => { res.writeHead(302, { location: url, "cache-control": "no-store" }); res.end(); return true; };
export const member = (req) => M.fromSession(req.headers["x-serve-session"]);
// the routes a signed-in member may use without the gateway's token
export const memberRoute = (p) => p === "/api/me" || p.startsWith("/api/members/") || p === "/api/feed" || p.startsWith("/api/feed/");
export const publicRoute = (p) => p.startsWith("/api/auth/") || p.startsWith("/api/agent-channel/");

export async function route(req, res, u, { json, o, forget }) {
  const p = u.pathname, send = (code, body) => { json(res, code, body, o); return true; };
  if (p === "/api/auth/providers") return send(200, M.providers());
  const a = /^\/api\/auth\/(facebook|instagram)\/(start|callback)$/.exec(p);
  if (a && a[2] === "start") { const r = M.start(a[1]); return r.error ? redirect(res, `${M.appUrl()}/#/join?error=${encodeURIComponent(r.error)}`) : redirect(res, r.url); }
  if (a && a[2] === "callback") {
    const r = await M.callback(a[1], Object.fromEntries(u.searchParams));
    return redirect(res, r.error ? `${M.appUrl()}/#/join?error=${encodeURIComponent(r.error)}` : `${M.appUrl()}/#/social?session=${M.sessionFor(r.member.id)}`);
  }
  if (p === "/api/auth/demo" && req.method === "POST") {
    const raw = await readRaw(req); let b = {}; try { b = JSON.parse(raw?.toString() || "{}"); } catch { /* empty */ }
    const r = M.demo(b.name);
    return r.error ? send(403, r) : send(200, { member: r.member, session: M.sessionFor(r.member.id) });
  }
  if (p.startsWith("/api/agent-channel/")) return channel(req, res, p, send);

  const me = member(req);
  if (p === "/api/me") return me ? send(200, { member: M.view(me), agents: M.agentsOf(me.id) }) : send(401, { error: "Sign in first." });
  if (!p.startsWith("/api/members/")) return false;
  if (!me) return send(401, { error: "Sign in first." });
  const raw = req.method === "POST" ? await readRaw(req) : null; let b = {}; try { b = JSON.parse(raw?.toString() || "{}"); } catch { /* empty */ }
  if (p === "/api/members/agents" && req.method === "POST") { const r = M.addAgent(me.id, b); return send(r.error ? 400 : 200, r); }
  if (p === "/api/members/agents/revoke" && req.method === "POST") { const r = M.revokeAgent(me.id, String(b.id || "")); return send(r.error ? 400 : 200, r); }
  if (p === "/api/members/leave" && req.method === "POST") { const ids = M.leave(me.id); for (const id of ids) forget?.(id); return send(200, { deleted: ids }); }
  if (p === "/api/members/refusals") return send(200, { refusals: M.refusals() });
  return send(404, { error: "no such route" });
}

async function channel(req, res, p, send) {
  const raw = req.method === "POST" ? await readRaw(req) : Buffer.alloc(0);
  if (raw == null) return send(413, { error: "too big" });
  const c = M.checkAgent(req, raw, p);
  if (!c.ok) return send(401, { error: `refused: ${c.message}`, why: c.why });
  const ag = c.agent, owner = ag.owner;
  let b = {}; try { b = JSON.parse(raw.toString() || "{}"); } catch { return send(400, { error: "the body is not JSON" }); }
  const out = (r) => send(r.error ? r.code || 400 : 200, r);
  if (p === "/api/agent-channel/feed" && req.method === "GET") return send(200, P.feed(owner, { n: 20 }));
  if (p === "/api/agent-channel/post" && req.method === "POST") return out(await P.post(ag.id, { text: b.text, invite: b.invite || null, agent: { id: ag.id, owner } }));
  if (p === "/api/agent-channel/comment" && req.method === "POST") return out(await P.comment(ag.id, String(b.post || ""), b.text, { agent: { id: ag.id, owner } }));
  if (p === "/api/agent-channel/join" && req.method === "POST") return out(P.join(owner, String(b.post || ""), b.on !== false));
  return send(404, { error: "no such route" });
}
