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
//   GET  /api/clubs?lat=&lon=                the clubs members started, nearest first (clubs.js)
//   POST /api/clubs {name, sport, about, where, at, privacy}    start one, public or private
//   POST /api/clubs/answer {club, member, yes}   the owner of a private club answers someone who asked to join
//   POST /api/clubs/join {club, on}          join a club, or leave it
//   GET  /api/clubs/suggest?lat=&lon=&sport=   the nearest club the member is not in, for their agent to recommend
//   POST /api/clubs/roster {club, names}     a children's club: the organiser's roster, first names only (programs.js)
//   POST /api/clubs/session {club, present, courts, perCourt, start, end, minutes, day}   today's rotations and the parents' note
//   POST /api/clubs/enter {club, level, pledge, on}   a charity tournament: enter (joins the club), change or withdraw
//   POST /api/clubs/draw {club, courts, start, minutes}   the organiser makes the draw; it is said in the club's feed
// Getting a game together, and how the member likes to play (huddle.js, taste.js, deals.js):
//   GET  /api/huddle/me                      what the agent knows about the member, their games being worked out, who they can ask
//   GET  /api/huddle/today                   what the agent puts in front of them now: yes-questions, a question, games near them, a deal
//   GET  /api/huddle/nudge                   at most one toast every six hours: a new game near them that fits
//   POST /api/huddle/home {lat, lon} | {place}   their rough area (rounded to about 1 km); a place name is looked up
//   POST /api/huddle/sports {sports}         the sports they play
//   GET  /api/huddle/question                the agent's next quick question (two games; pick one)
//   POST /api/huddle/answer {q, pick}        a or b or either: the agent learns from it and says what it learned
//   POST /api/huddle/reset                   forget what the agent learned
//   POST /api/huddle/open {on}               let nearby people's agents ask theirs for a game (about 5 km)
//   POST /api/huddle/attend {key, came, level}   after a game: who came ({ <id>: came|missed }), and who played at their level
//   GET  /api/huddle/needs                   what the agents keep running into, and which of it went to the club's ideas
//   GET  /api/huddle/trust                   the member's own two records: shows up, and their agent's kept promises
//   POST /api/huddle/start {sport, need, invite, club, nearby, gate, pin}   the agents work out a time and a place
//   GET  /api/huddle/one?id=                 one game being worked out: the agents' talk, the pick, who said yes
//   POST /api/huddle/reply {id, yes, why}    the member's one yes (or no, and why)
//   POST /api/huddle/cancel {id}             the host calls it off
//   POST /api/huddle/game {post, yes, why}   join a game the agent recommended, or say why not
//   GET  /api/huddle/places?sport=           courts near them: quiet hours, and for sports centres the venue agent's price
//   POST /api/huddle/deal {place, date, start, players, sport}   ask a venue's agent for a price
// The trust chain, for anyone (no sign-in):
//   GET  /api/trust/chain?after=&n=          entries (pseudonymous subjects) and the daily heads signed with /a2a/keys.json
//   GET  /api/trust/verify                   the gateway's own replay of the chain, and today's head, signed
// The agent channel, every request signed by a registered agent's key (header serve-signature):
//   GET  /api/agent-channel/feed             the feed as the agent's member sees it
//   POST /api/agent-channel/post {text, invite}      a post, or an invite, as "<member>'s agent"
//   POST /api/agent-channel/comment {post, text}     a comment, as "<member>'s agent"
//   POST /api/agent-channel/join {post, on}          join an invite for its member
import * as M from "./members.js";
import * as P from "../feed/posts.js";
import * as C from "./clubs.js";
import * as H from "./huddle.js";
import * as T from "./taste.js";
import * as D from "./deals.js";
import * as Tr from "./trust.js";
import * as N from "./needs.js";
import { signInHint } from "./discovery.js";

const readRaw = (req, max = 64e3) => new Promise((ok) => { const parts = []; let n = 0, over = false; req.on("data", (c) => { n += c.length; if (n > max) over = true; else parts.push(c); }); req.on("end", () => ok(over ? null : Buffer.concat(parts))); req.on("error", () => ok(null)); });
const redirect = (res, url) => { res.writeHead(302, { location: url, "cache-control": "no-store" }); res.end(); return true; };
export const member = (req) => M.fromSession(req.headers["x-serve-session"]);
P.joinRoomWith((room, id) => C.joinById(String(room), id, M.get(id)?.name));
// the routes a signed-in member may use without the gateway's token
export const memberRoute = (p) => p === "/api/me" || p.startsWith("/api/members/") || p === "/api/feed" || p.startsWith("/api/feed/") || p === "/api/clubs" || p.startsWith("/api/clubs/") || p.startsWith("/api/huddle/");
export const publicRoute = (p) => p.startsWith("/api/auth/") || p.startsWith("/api/agent-channel/") || p === "/api/invite" || p.startsWith("/api/trust/") || p === "/api/openapi.json";

export async function route(req, res, u, { json, o, forget }) {
  const p = u.pathname, send = (code, body) => { json(res, code, body, o); return true; };
  if (p === "/api/auth/providers") return send(200, M.providers());
  // an invite link (#/i/<id>) opened by someone who has no account yet
  if (p === "/api/invite" && req.method === "GET") {
    const v = P.publicInvite(String(u.searchParams.get("id") || ""), (room) => C.canSee(room, null));
    // signed in: whether they are already in it (so a reload doesn't ask them to join again)
    const who = member(req), post = v && who ? P.find(v.id) : null;
    return v ? send(200, { invite: { ...v, ...(post ? { joined: post.invite.going.includes(who.id), mine: (post.by.player || post.by.agentOf) === who.id } : {}) } }) : send(404, { error: "That game is not open any more." });
  }
  const a = /^\/api\/auth\/(facebook|instagram)\/(start|callback)$/.exec(p);
  // (a browser goes back to the app with the reason; an agent or script gets it as JSON)
  if (a && a[2] === "start") { const r = M.start(a[1]); if (r.error && !String(req.headers.accept || "").includes("text/html")) return send(404, { error: r.error, providers: "/api/auth/providers" }); return r.error ? redirect(res, `${M.appUrl()}/#/join?error=${encodeURIComponent(r.error)}`) : redirect(res, r.url); }
  if (a && a[2] === "callback") {
    const r = await M.callback(a[1], Object.fromEntries(u.searchParams));
    return redirect(res, r.error ? `${M.appUrl()}/#/join?error=${encodeURIComponent(r.error)}` : `${M.appUrl()}/#/social?session=${M.sessionFor(r.member.id)}`);
  }
  if (p === "/api/auth/demo" && req.method === "POST") {
    const raw = await readRaw(req); let b = {}; try { b = JSON.parse(raw?.toString() || "{}"); } catch { /* empty */ }
    if (b.name !== undefined && (typeof b.name !== "string" || b.name.trim().length > 40)) return send(400, { error: "name is text, up to 40 characters." });
    const r = M.demo(b.name);
    return r.error ? send(403, r) : send(200, { member: r.member, session: M.sessionFor(r.member.id) });
  }
  if (p.startsWith("/api/agent-channel/")) return channel(req, res, p, send);
  // the trust chain, for anyone to check (trust.js): its entries (pseudonymous), the signed daily heads, and a replay
  if (p === "/api/trust/chain" && req.method === "GET" && [["after", -1], ["n", 1]].some(([k, min]) => u.searchParams.get(k) != null && !(Number.isInteger(+u.searchParams.get(k)) && +u.searchParams.get(k) >= min))) return send(400, { error: "after and n are whole numbers." });
  if (p === "/api/trust/chain" && req.method === "GET") return send(200, { ...Tr.publicChain({ after: +(u.searchParams.get("after") ?? -1), n: +(u.searchParams.get("n") || 500) }), today: await Tr.head() });
  if (p === "/api/trust/verify" && req.method === "GET") return send(200, { ...Tr.verify(), head: await Tr.head() });

  const me = member(req);
  if (p === "/api/me") return me ? send(200, { member: M.view(me), agents: M.agentsOf(me.id) }) : send(401, { error: "Sign in first.", ...signInHint(req) });
  if (p === "/api/clubs" || p.startsWith("/api/clubs/")) {
    if (!me) return send(401, { error: "Sign in first.", ...signInHint(req) });
    const u2 = new URL(req.url, "http://x");
    { const la = u2.searchParams.get("lat"), lo = u2.searchParams.get("lon"), num = (x, m) => x != null && x.trim() !== "" && isFinite(+x) && Math.abs(+x) <= m;
      if (p === "/api/clubs" && req.method === "GET" && (la != null || lo != null) && !(num(la, 90) && num(lo, 180))) return send(400, { error: "lat (-90..90) and lon (-180..180) go together, or leave both out." }); }
    if (p === "/api/clubs" && req.method === "GET") return send(200, C.list(me.id, { lat: u2.searchParams.get("lat"), lon: u2.searchParams.get("lon") }));
    if (p === "/api/clubs/suggest" && req.method === "GET") return send(200, C.suggest(me.id, { lat: u2.searchParams.get("lat"), lon: u2.searchParams.get("lon"), sport: u2.searchParams.get("sport") }));
    let cb = {}; try { cb = JSON.parse((await readRaw(req))?.toString() || "{}"); } catch { /* empty */ }
    const out = (r) => send(r.error ? r.code || 400 : 200, r);
    if (p === "/api/clubs" && req.method === "POST") return out(await C.start(me, cb, (t, who) => P.moderate(t, who)));
    if (p === "/api/clubs/join" && req.method === "POST" && cb.on !== undefined && typeof cb.on !== "boolean") return send(400, { error: "on is true (join) or false (leave)." });
    if (p === "/api/clubs/join" && req.method === "POST") return out(C.join(me, String(cb.club || ""), cb.on !== false));
    if (p === "/api/clubs/answer" && req.method === "POST") return out(C.answer(me, String(cb.club || ""), String(cb.member || ""), cb.yes === true));
    if (p === "/api/clubs/roster" && req.method === "POST") return out(await C.setRoster(me, String(cb.club || ""), cb.names, (t, who) => P.moderate(t, who)));
    if (p === "/api/clubs/session" && req.method === "POST") return out(C.planSession(me, String(cb.club || ""), cb));
    if (p === "/api/clubs/enter" && req.method === "POST") return out(C.enter(me, String(cb.club || ""), cb));
    if (p === "/api/clubs/draw" && req.method === "POST") {
      const r = C.makeDraw(me, String(cb.club || ""), cb);
      // the draw, said in the club's feed by the organiser
      if (r.draw) await P.post(me.id, { text: `The draw is out: ${r.draw.teams.length} teams, ${r.draw.matches.length} match${r.draw.matches.length === 1 ? "" : "es"} on ${r.draw.courts} court${r.draw.courts > 1 ? "s" : ""}, ${r.draw.start} to ${r.draw.end}. Your matches are on the club's page.`, room: String(cb.club) }).catch(() => null);
      return out(r);
    }
    return send(404, { error: "no such route" });
  }
  if (p.startsWith("/api/huddle/")) {
    if (!me) return send(401, { error: "Sign in first.", ...signInHint(req) });
    return huddle(req, res, p, new URL(req.url, "http://x").searchParams, me.id, send);
  }
  if (!p.startsWith("/api/members/")) return false;
  if (!me) return send(401, { error: "Sign in first.", ...signInHint(req) });
  const raw = req.method === "POST" ? await readRaw(req) : null; let b = {}; try { b = JSON.parse(raw?.toString() || "{}"); } catch { /* empty */ }
  if (p === "/api/members/agents" && req.method === "POST") { const r = M.addAgent(me.id, b); return send(r.error ? 400 : 200, r); }
  if (p === "/api/members/agents/revoke" && req.method === "POST") { const r = M.revokeAgent(me.id, String(b.id || "")); return send(r.error ? 400 : 200, r); }
  if (p === "/api/members/leave" && req.method === "POST") { const ids = M.leave(me.id); for (const id of ids) { forget?.(id); C.forget(id); H.forget(id); } return send(200, { deleted: ids }); }
  if (p === "/api/members/refusals") return send(200, { refusals: M.refusals() });
  return send(404, { error: "no such route" });
}

async function channel(req, res, p, send) {
  const raw = req.method === "POST" ? await readRaw(req) : Buffer.alloc(0);
  if (raw == null) return send(413, { error: "too big" });
  const c = M.checkAgent(req, raw, p);
  if (!c.ok) return send(401, { error: `refused: ${c.message}`, why: c.why, docs: "/llms.txt" });
  const ag = c.agent, owner = ag.owner;
  if (p === "/api/agent-channel/feed/post") p = "/api/agent-channel/post"; // the feed's own path, under the channel
  let b = {}; try { b = JSON.parse(raw.toString() || "{}"); } catch { return send(400, { error: "the body is not JSON" }); }
  const out = (r) => send(r.error ? r.code || 400 : 200, r);
  if (p === "/api/agent-channel/me" && req.method === "GET") return send(200, { member: M.view(M.get(owner)), agent: M.view(ag), audience: M.AUDIENCE });
  if (p === "/api/agent-channel/feed" && req.method === "GET") return send(200, P.feed(owner, { n: 20 }));
  if (p === "/api/agent-channel/post" && req.method === "POST" && b.invite) {
    const t = T.get(owner), v = b.invite, date = /^\d{4}-/.test(String(v.day)) ? v.day : null;
    const why = date && /^\d{2}:\d{2}$/.test(String(v.start)) ? T.hardNos(t, { date, start: v.start, km: t.home && v.at ? +T.km(t.home, v.at).toFixed(1) : null, each: +v.each || 0 }) : [];
    if (why.length) return send(403, { error: `That game is outside what your person set (${why.map((x) => T.NO[x] || x).join(", ")}); your person can post it themself.`, needs: "person" });
    // posting a game commits the person as its host: within the price they let the agent say yes to
    const dl = t.delegate;
    if (dl?.on && dl.maxEach != null && (+v.each || 0) > dl.maxEach) return send(403, { error: `NT$${+v.each} each is over the NT$${dl.maxEach} your person lets you say yes to; your person can post it themself.`, needs: "person" });
    // a game the agent posts keeps the person's rule about new people, as one it starts (below)
    const d = t.delegate;
    if (d?.on && !d.newPeople) {
      const asked = +v.gate?.minShow || 0;
      b = { ...b, invite: { ...v, gate: { minShow: Math.max(0.6, asked), newOk: false, agentMin: v.gate?.agentMin } } };
      const r = await P.post(ag.id, { text: b.text, invite: b.invite, agent: { id: ag.id, owner } });
      return out(r.error ? r : { ...r, note: `Your person's delegation wants people with a record, so new people wait${asked < 0.6 ? " and the game is gated at 60%" : ""}.` });
    }
  }
  if (p === "/api/agent-channel/post" && req.method === "POST") return out(await P.post(ag.id, { text: b.text, invite: b.invite || null, agent: { id: ag.id, owner } }));
  if (p === "/api/agent-channel/comment" && req.method === "POST") return out(await P.comment(ag.id, String(b.post || ""), b.text, { agent: { id: ag.id, owner } }));
  if (p === "/api/agent-channel/join" && req.method === "POST") {
    // joining commits the person: the same permission as a yes (taste.js delegate), with its limits
    if (b.on !== undefined && typeof b.on !== "boolean") return send(400, { error: "on is true (join) or false (leave)." });
    if (b.on !== false) { const ok = H.mayAgentSayYes(owner, { post: String(b.post || "") }); if (ok.error) return send(ok.code || 403, ok); }
    return out(P.join(owner, String(b.post || ""), b.on !== false, { agent: true }));
  }
  // the huddle routes, signed with the member's own agent key; committing them (a yes, joining a game) needs the
  // member's standing permission (taste.js delegate), with its limits
  if (p.startsWith("/api/agent-channel/huddle/")) {
    const sub = p.replace("/api/agent-channel", "");
    if (["/huddle/reply", "/huddle/game"].includes(sub) && b.yes === true) { const ok = H.mayAgentSayYes(owner, sub === "/huddle/reply" ? { huddle: String(b.id || "") } : { post: String(b.post || "") }); if (ok.error) return send(ok.code || 403, ok); }
    if (["/huddle/delegate", "/huddle/open", "/huddle/home"].includes(sub)) return send(403, { error: "Only your person changes this, with their own session: it is their permission, not yours." });
    // over the channel limits only get tighter: loosening them is the person's call
    if (sub === "/huddle/limits" && req.method === "POST") {
      const t = T.get(owner), _mins = (ws) => (ws || []).reduce((n, w) => n + w.days.length * ((+w.to.slice(0, 2) * 60 + +w.to.slice(3)) - (+w.from.slice(0, 2) * 60 + +w.from.slice(3))), 0);
      const looser = (b.maxKm != null && t.limitKm != null && +b.maxKm > t.limitKm) || (b.maxEach != null && t.limitEach != null && +b.maxEach > t.limitEach)
        || (b.maxKm === null && t.limitKm != null) || (b.maxEach === null && t.limitEach != null)
        || (b.windows === null && t.windows?.length) || (Array.isArray(b.windows) && t.windows?.length && (!b.windows.length || !b.windows.every((w) => (w.days || []).every((d) => t.windows.some((o) => o.days.includes(d) && o.from <= w.from && w.to <= o.to)))));
      if (looser) return send(403, { error: "Over the agent channel limits can only get tighter; loosening them needs your person's session.", needs: "person" });
    }
    // a game the agent starts keeps the person's rule about new people
    if (sub === "/huddle/start" && req.method === "POST") { const d = T.get(owner).delegate; if (d?.on && !d.newPeople) { const asked = +b.gate?.minShow || 0; b = { ...b, gate: { minShow: Math.max(0.6, asked), newOk: false, agentMin: b.gate?.agentMin }, gateWhy: `Your person's delegation wants people with a record, so new people wait${asked < 0.6 ? " and the game is gated at 60%" : ""}.` }; } }
    const fake = { method: req.method, url: sub, headers: req.headers, on: () => {} };
    return huddle(Object.assign(fake, { [Symbol.asyncIterator]: undefined, byAgent: true }), res, `/api${sub}`, new URL(req.url, "http://x").searchParams, owner, send, b);
  }
  return send(404, { error: "no such route", docs: "/llms.txt" });
}

// values a route can't take, said before anything changes (a 200 that quietly ignores them misleads the caller)
const REASONS = ["busy", "time", "place", "price", "quiet", "none"];
const isNum = (x) => (typeof x === "number" && isFinite(x)) || (typeof x === "string" && x.trim() !== "" && isFinite(+x));
function badInput(r, b) {
  if (r === "/huddle/sports" && (!Array.isArray(b.sports) || !b.sports.length || b.sports.some((x) => !T.SPORTS.includes(String(x).toLowerCase())))) return `sports is a list of: ${T.SPORTS.join(", ")}.`;
  if (r === "/huddle/open" && typeof b.on !== "boolean") return "on is true or false.";
  if (r === "/huddle/limits" && b.windows !== undefined && b.windows !== null && !Array.isArray(b.windows)) return "windows is a list of {days, from, to}, or null to clear them.";
  if (r === "/huddle/delegate") {
    if (typeof b.on !== "boolean") return "on is true or false.";
    if (b.on && b.maxEach != null && !(isNum(b.maxEach) && +b.maxEach >= 0 && +b.maxEach <= 5000)) return "maxEach is a price from 0 to 5000, or null for any price.";
    if (b.newPeople !== undefined && typeof b.newPeople !== "boolean") return "newPeople is true or false.";
  }
  if ((r === "/huddle/reply" || r === "/huddle/game") && typeof b.yes !== "boolean") return "yes is true or false.";
  if ((r === "/huddle/reply" || r === "/huddle/game") && b.yes === false && b.why != null && !REASONS.includes(String(b.why))) return `why is one of: ${REASONS.join(", ")}.`;
  if (r === "/huddle/start") {
    if (b.need !== undefined && !(isNum(b.need) && Number.isInteger(+b.need))) return "need is a whole number of players (you included).";
    for (const k of ["nearby", "hostYes"]) if (b[k] !== undefined && typeof b[k] !== "boolean") return `${k} is true or false.`;
    if (b.invite !== undefined && !Array.isArray(b.invite)) return "invite is a list of member ids.";
    if (b.gate?.minShow !== undefined && !(isNum(b.gate.minShow) && +b.gate.minShow >= 0 && +b.gate.minShow <= 1)) return "gate.minShow is from 0 to 1 (0.75 is 75%).";
    if (b.sport !== undefined && !T.SPORTS.includes(String(b.sport).toLowerCase())) return `sport is one of: ${T.SPORTS.join(", ")}.`;
  }
  return null;
}
async function huddle(req, res, p, q, me, send, given = null) {
  let b = given || {};
  if (req.method === "POST" && !given) { const raw = await readRaw(req); if (raw == null) return send(413, { error: "too big" }); try { b = JSON.parse(raw.toString() || "{}"); } catch { return send(400, { error: "the body is not JSON" }); } }
  const out = (r) => send(r?.error ? r.code || 400 : 200, r);
  const get = req.method === "GET", post = req.method === "POST";
  if (post) { const why = badInput(p.replace(/^\/api/, ""), b); if (why) return send(400, { error: why, docs: "/llms.txt" }); }
  if (p === "/api/huddle/me" && get) return send(200, { taste: T.view(T.get(me)), huddles: H.mineFor(me), ...H.people(me) });
  if (p === "/api/huddle/today" && get) return send(200, await H.today(me));
  if (p === "/api/huddle/nudge" && get) return send(200, H.nudge(me));
  if (p === "/api/huddle/home" && post) {
    if (b.place && b.lat == null) { const pl = await import("../club/places.js"); try { const at = await pl.where(String(b.place).slice(0, 120)); const r = T.setHome(me, at); return out(r.error ? r : { ...r, found: at.name }); } catch (e) { return send(404, { error: `No place called "${String(b.place).slice(0, 60)}" found. Try a district and a city, e.g. "Xinyi District, Taipei".` }); } }
    return out(T.setHome(me, b));
  }
  if (p === "/api/huddle/sports" && post) return out(T.setSports(me, b.sports));
  if (p === "/api/huddle/open" && post) return out(T.setOpen(me, b.on === true));
  if (p === "/api/huddle/limits" && post) return out(T.setLimits(me, b));
  if (p === "/api/huddle/delegate" && post) return out(T.setDelegate(me, b));
  if (p === "/api/huddle/attend" && post) return out(Tr.vote(me, String(b.key || ""), b.came || {}, b.level || {}));
  if (p === "/api/huddle/trust" && get) return send(200, { trust: H.trustOf(me), explain: Tr.explain(me), chain: { ...Tr.mine(me), ...Tr.verify() } });
  if (p === "/api/huddle/needs" && get) return send(200, { needs: N.view() });
  if (p === "/api/huddle/reset" && post) return send(200, { taste: T.view(T.reset(me)) });
  // the question is rebuilt from the member's state, so the answer carries the two games it showed
  if (p === "/api/huddle/question" && get) { const t = T.get(me); const places = t.home ? (await D.placesNear(t.home, t.sports[0] || "badminton", { wait: false })).map((x) => ({ ...x, km: +T.km(t.home, x).toFixed(1) })) : []; return send(200, { question: T.question(me, { places, force: true }) }); }
  if (p === "/api/huddle/answer" && post) { if (!["a", "b", "either"].includes(b.pick)) return send(400, { error: "pick is a, b or either" }); return out(T.choose(me, b.q ?? b.id, b.pick)); }
  if (p === "/api/huddle/start" && post) { const r = H.start(me, b); if (!r.error && !req.byAgent && (b.when || b.wantEach != null)) T.askedFor(me, b.when, b.wantEach); return out(r); }
  if (p === "/api/huddle/one" && get) { await H.sweep(); const h = H.find(String(q.get("id") || "")); return h && (h.host === me || h.invited.includes(me)) ? send(200, { huddle: H.view(h, me) }) : send(404, { error: "No such game." }); }
  if (p === "/api/huddle/reply" && post) return out(await H.reply(me, String(b.id || ""), b.yes === true, b.why ? String(b.why) : null, { byAgent: !!req.byAgent }));
  if (p === "/api/huddle/cancel" && post) { if (b.game !== undefined && typeof b.game !== "boolean") return send(400, { error: "game is true or false." }); return out(H.cancel(me, String(b.id || ""), { game: b.game === true })); }
  if (p === "/api/huddle/game" && post) return out(H.answerGame(me, String(b.post || ""), b.yes === true, b.why ? String(b.why) : null, { byAgent: !!req.byAgent }));
  if (p === "/api/huddle/places" && get) {
    const t = T.get(me), sport = String(q.get("sport") || t.sports[0] || "badminton").toLowerCase();
    if (!T.SPORTS.includes(sport)) return send(400, { error: `sport is one of: ${T.SPORTS.join(", ")}.` });
    if (!t.home) return send(200, { places: [], home: false });
    const places = await D.placesNear(t.home, sport, { venues: 4, courts: 4, wait: false });
    const looking = D.loading(t.home, sport);
    // only the courts inside the member's distance limit
    const inKm = (x) => t.limitKm == null || T.km(t.home, x) <= t.limitKm;
    const down = !looking && !places.length && D.lookupFailed(t.home, sport);
    return send(200, { home: true, sport, currency: D.CURRENCY, looking, ...(looking ? { retryAfter: 20 } : {}), ...(down ? { note: "The map of courts isn't answering right now. Name the place yourself (pin: {place}) or try again in ten minutes." } : {}), places: places.filter(inKm).map((x) => {
      const k = +T.km(t.home, x).toFixed(1), qt0 = D.quietest(x, { n: 50 });
      // the quietest hours shown are ones the member can play at, when they set time windows
      const okTime = (g) => !t.windows?.length || !T.hardNo({ ...t, limitKm: null, limitEach: null, busyAt: [], declined: [] }, { ...g, km: null, each: 0 });
      const qt = { grid: qt0.grid, quiet: qt0.quiet.filter(okTime).slice(0, 3) };
      const good = qt.grid.filter((g) => !T.hardNo(t, { ...g, km: k, each: x.kind === "venue" ? D.bestEach(x, g.date, g.start, 4) : 0 })).map((g) => ({ ...g, s: T.worth(t, { ...g, km: k, each: 0 }) + (1 - g.busy) })).sort((a1, b1) => b1.s - a1.s)[0];
      return { id: x.id, name: x.name, kind: x.kind, indoor: x.kind === "venue", km: k, lat: x.lat, lon: x.lon, quiet: qt.quiet, grid: qt.grid, ...(x.kind === "venue" ? { list: x.list, sample: true, offer: good && (() => { const o = D.talk(x, { date: good.date, start: good.start, players: 4, push: Math.min(1, T.weights(t).price * 2.5), group: "Your" }); return t.limitEach != null && o.each > t.limitEach ? { ...o, overLimit: true } : o; })(), at: good } : {}) };
    }) });
  }
  if (p === "/api/huddle/deal" && post) {
    const t = T.get(me), sport = String(b.sport || t.sports[0] || "badminton").toLowerCase();
    if (b.players !== undefined && !(Number.isInteger(+b.players) && +b.players >= 2 && +b.players <= 12)) return send(400, { error: "players is a whole number from 2 to 12." });
    if (!T.SPORTS.includes(sport)) return send(400, { error: `sport is one of: ${T.SPORTS.join(", ")}.` });
    if (!t.home) return send(400, { error: "Share your rough area first." });
    const x = (await D.placesNear(t.home, sport, { venues: 4, courts: 4 })).find((y) => y.id === b.place);
    if (x && x.kind !== "venue") return send(400, { error: "That's a public court: it's free, so there's no price to ask. Its quiet hours are in GET /api/huddle/places." });
    if (!x) return send(404, { error: "That venue isn't among the courts near you (GET /api/huddle/places lists them)." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)) return send(400, { error: "Say the date and the time (HH:MM)." });
    { const [y, mo, d] = b.date.split("-").map(Number), [hh, mm] = b.start.split(":").map(Number), t = new Date(y, mo - 1, d, hh, mm).getTime(); if (!(t > Date.now() && t < Date.now() + 30 * 864e5)) return send(400, { error: "Pick a time in the next 30 days." }); if (hh < 6 || hh * 60 + mm + 90 > 22 * 60) return send(400, { error: "Venues here open 06:00 to 22:00; pick a 90-minute game inside that." }); }
    // a quote commits nobody, so it is given; what it breaks of the member's own limits is said with it
    const deal = D.talk(x, { date: b.date, start: b.start, players: Math.min(12, Math.max(2, +b.players || 4)), weekly: !!b.weekly, push: Math.min(1, T.weights(t).price * 2.5), group: "Your" });
    const outside = T.hardNos({ ...t, busyAt: [], declined: [] }, { date: b.date, start: b.start, km: +T.km(t.home, x).toFixed(1), each: deal.each || 0 }).filter((r) => ["time", "place", "price"].includes(r) && (r !== "place" || t.limitKm != null) && (r !== "price" || t.limitEach != null) && (r !== "time" || t.windows?.length));
    return send(200, { deal, currency: D.CURRENCY, ...(outside.length ? { outside, note: `A quote only: it is outside your limits (${outside.map((r) => T.NO[r] || r).join(", ")}), so no game is agreed there.` } : {}) });
  }
  return send(404, { error: "no such route" });
}
