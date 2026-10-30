// Unit tests for members (src/members/): a session is the gateway's own signature and nothing else, an agent joins by
// its public key, and on the agent channel only a fresh request signed by a registered, unrevoked key gets through;
// invites in the feed, where the poster's agent answers with facts made by code. No model, no network.
//   node --test test/members_unit.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-members-"));
Object.assign(process.env, { CLUBS_FILE: `${tmp}/clubs.json`, MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, NEEDS_FILE: `${tmp}/needs.json`, TASTE_FILE: `${tmp}/taste.json`, HUDDLE_FILE: `${tmp}/huddles.json`, FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off", AGENT_KEYS_DIR: `${tmp}/agent_keys`, CONSENT_LOG: `${tmp}/consent.jsonl`,
  LOOP_DIR: `${tmp}/loop`, STORE_FILE: `${tmp}/players.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off" });
delete process.env.FB_APP_ID; delete process.env.IG_APP_ID;
const M = await import("../src/members/members.js");
const { signToken, kidOf, HEADER } = await import("../src/a2a/peer.js");
const { use } = await import("../src/feed/deps.js");
const S = await import("../src/feed/store.js");
const P = await import("../src/feed/posts.js");

const CLUB = { name: "Test Club", sports: ["badminton"], members: [], feed: [] };
beforeEach(() => {
  M.reset(); S.reset();
  use({ reset: true });
  use({ screen: async () => ({ safe: true, categories: [] }), standard: async () => ({ verdict: "ok" }), injected: async (ts) => ts.map(() => ({ injected: false })), chatJSON: async () => ({ value: null }), now: () => Date.now(), club: () => CLUB });
});
const agentKey = () => { const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519"); return { privateKey, jwk: publicKey.export({ format: "jwk" }) }; };
const req = (method, headers = {}) => ({ method, headers });
const signed = (k, method, p, body) => ({ [HEADER]: signToken({ key: k.privateKey, kid: kidOf(k.jwk.x), aud: M.AUDIENCE, method, path: p, body }) });

test("a session: signed by this gateway, expires, and names a member who still exists", () => {
  assert.equal(M.providers().facebook, false, "no Facebook app set up here");
  const { member } = M.demo("Ana Lee");
  assert.ok(member.demo, "a demo account says so");
  const s = M.sessionFor(member.id);
  assert.equal(M.fromSession(s).id, member.id);
  const [body, sig] = s.split(".");
  const other = Buffer.from(JSON.stringify({ m: "fa-000000000000", exp: Date.now() + 1e9 })).toString("base64url");
  assert.equal(M.fromSession(`${other}.${sig}`), null, "a changed body fails the signature");
  assert.equal(M.fromSession(`${body}.x${sig.slice(1)}`), null, "a changed signature fails");
  assert.equal(M.fromSession(s, Date.now() + 31 * 864e5), null, "an expired session is no session");
  M.leave(member.id);
  assert.equal(M.fromSession(s), null, "a member who left has no session");
});

test("the same provider account is the same member, and only a hash of its id is kept", () => {
  const a = M.join({ provider: "facebook", providerId: "1234567890", name: "Ana <b>Lee</b>" });
  const b = M.join({ provider: "facebook", providerId: "1234567890", name: "Ana Lee" });
  assert.equal(a.id, b.id);
  assert.ok(!fs.readFileSync(process.env.MEMBERS_FILE, "utf8").includes("1234567890"), "the provider's id is not stored");
  assert.equal(M.get(a.id).name.includes("<"), false);
});

test("the login round trip: an unknown or reused state is refused", async () => {
  assert.match(M.start("facebook").error, /not set up/);
  assert.match((await M.callback("facebook", { code: "x", state: "made-up" })).error, /expired/);
});

test("an agent joins by its public key; never a private key, never another member's", () => {
  const { member } = M.demo("Ana");
  const k = agentKey();
  assert.match(M.addAgent(member.id, { name: "Ana's agent", jwk: { ...k.jwk, d: "secret" } }).error, /never the private part/);
  assert.match(M.addAgent(member.id, { name: "", jwk: k.jwk }).error, /name/);
  const r = M.addAgent(member.id, { name: "Ana's agent", jwk: k.jwk });
  assert.equal(r.agent.kid, kidOf(k.jwk.x));
  assert.match(M.addAgent(member.id, { name: "Again", jwk: k.jwk }).error, /already/);
  assert.match(M.addAgent("nobody", { name: "X", jwk: agentKey().jwk }).error, /Sign in/);
});

test("the agent channel: only a fresh request signed by a registered key, for this path and this body", () => {
  const { member } = M.demo("Ana");
  const k = agentKey(), { agent } = M.addAgent(member.id, { name: "Ana's agent", jwk: k.jwk });
  const p = "/api/agent-channel/post", body = JSON.stringify({ text: "Doubles Thursday?" });
  const h = signed(k, "POST", p, body);
  assert.equal(M.checkAgent(req("POST", h), body, p).agent.id, agent.id);
  assert.equal(M.checkAgent(req("POST", h), body, p).why, "replay", "the same request twice");
  assert.equal(M.checkAgent(req("POST", {}), body, p).why, "unsigned");
  assert.equal(M.checkAgent(req("POST", signed(k, "POST", p, body)), body.replace("Thursday", "Friday"), p).why, "wrong-body");
  assert.equal(M.checkAgent(req("POST", signed(k, "POST", p, body)), body, "/api/agent-channel/join").why, "wrong-request");
  assert.equal(M.checkAgent(req("POST", signed(agentKey(), "POST", p, body)), body, p).why, "unknown-peer", "a key nobody registered");
  M.revokeAgent(member.id, agent.id);
  assert.equal(M.checkAgent(req("POST", signed(k, "POST", p, body)), body, p).why, "unknown-peer", "a revoked key stops at once");
  assert.ok(M.refusals().length >= 5, "every refusal is logged");
});

test("an invite: checked, joined up to its spots, and the poster's agent answers with facts made by code", async () => {
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member;
  const k = agentKey(), { agent } = M.addAgent(ana.id, { name: "Ana's agent", jwk: k.jwk });
  assert.match((await P.post(ana.id, { invite: { sport: "darts", day: "Thu", start: "19:00", where: "Riverside", spots: 2 } })).error, /sport/);
  assert.match((await P.post(ana.id, { invite: { sport: "badminton", day: "Thu", start: "7pm", where: "Riverside", spots: 2 } })).error, /time/);
  const r = await P.post(agent.id, { text: "Doubles, all levels", invite: { sport: "badminton", day: "Thu", start: "19:00", where: "Riverside Sports Centre", spots: 1 }, agent: { id: agent.id, owner: ana.id } });
  assert.equal(r.post.kind, "invite");
  assert.equal(r.post.by.type, "agent"); assert.equal(r.post.by.name, "Ana's agent"); assert.equal(r.post.by.channel, "signed");
  const id = r.post.id;
  const j = P.join(ben.id, id);
  assert.equal(j.post.invite.going, 1); assert.ok(j.post.invite.full);
  assert.ok(P.join(cy.id, id).waitlisted, "a full game puts the next person on its waitlist");
  assert.match(P.join(ana.id, id).error, /own invite/);
  await P.comment(cy.id, id, "Is there still space?");
  const said = P.find(id).comments.filter((c) => c.by.type === "agent").map((c) => c.text);
  assert.match(said[0], /^Ben is in( \([^)]*\))?\. Full for badminton Thu 19:00 at Riverside Sports Centre\./);
  assert.match(said.at(-1), /^Full for badminton/);
  P.join(ben.id, id, false);
  assert.ok(P.view(P.find(id), cy.id).invite.joined, "the spot Ben gave up goes to Cy, first on the waitlist");
  P.forget(cy.id);
  assert.equal(P.find(id).invite.going.length, 0, "a member who leaves is out of the invite");
  assert.ok(!P.find(id).comments.some((c) => /Cy is in/.test(c.text)), "and the agent's line naming them is gone");
});

test("llms.txt: its A2A examples pass the very schemas the API checks", async () => {
  const D = await import("../src/members/discovery.js"), Sc = await import("../src/core/schema.js");
  const line = D.llmsTxt({ headers: { host: "x" } }).split("\n").find((l) => l.includes('"serve.proposal"'));
  const found = [];
  for (let i = line.indexOf('{"kind"'); i >= 0; i = line.indexOf('{"kind"', i + 1)) {
    let depth = 0, j = i;
    for (; j < line.length; j++) { if (line[j] === "{") depth++; if (line[j] === "}" && !--depth) break; }
    found.push(JSON.parse(line.slice(i, j + 1).replace(/<[^>]+>/g, "ref-1")));
  }
  assert.deepEqual(found.map((x) => x.kind), ["serve.proposal", "serve.hold", "serve.likely"]);
  for (const x of found) assert.deepEqual(Sc.validate({ "serve.proposal": Sc.PROPOSAL, "serve.hold": Sc.HOLD, "serve.likely": Sc.LIKELY }[x.kind], x), [], x.kind);
  assert.equal(found[0].proposal.minutes, undefined, "minutes is beside proposal, not in it");
  assert.ok(found[0].choices.length >= 1);
});

// ---- through the routes ----
const { Readable } = await import("node:stream");
const route = async (method, pathName, body, headers = {}) => {
  const api = await import("../src/members/api.js"), raw = body === undefined ? "" : JSON.stringify(body);
  const rq = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), { method, url: pathName, headers });
  let out = null; await api.route(rq, {}, new URL(`http://x${pathName}`), { json: (_res, code, b) => { out = { code, body: b }; }, o: {} });
  return out;
};
const feedJoin = async (player, body) => {
  const api = await import("../src/feed/api.js");
  return new Promise((ok) => {
    const res = { writeHead(code) { this.code = code; }, end(b) { ok({ code: this.code, body: JSON.parse(b) }); }, write() {} };
    api.handle(Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: "POST", headers: {} }), res, new URL("http://x/api/feed/join"), { as: player });
  });
};

test("a join outside the person's own limits stands with a note; their agent is refused it, a full game's waitlist too", async () => {
  const T = await import("../src/members/taste.js");
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member;
  T.setLimits(ben.id, { windows: [{ days: ["Sat"], from: "09:00", to: "12:00" }] });
  T.setDelegate(ben.id, { on: true, maxEach: 500, newPeople: true });
  const k = agentKey(); M.addAgent(ben.id, { name: "Ben's agent", jwk: k.jwk });
  const open = (await P.post(ana.id, { invite: { sport: "badminton", day: "Thu", start: "19:00", where: "Riverside", spots: 3 } })).post.id;
  const full = (await P.post(ana.id, { invite: { sport: "badminton", day: "Wed", start: "19:00", where: "Riverside", spots: 1 } })).post.id;
  P.join(cy.id, full);
  const viaAgent = async (post) => { const p = "/api/agent-channel/join", body = { post }; return route("POST", p, body, signed(k, "POST", p, JSON.stringify(body))); };
  for (const post of [open, full]) {
    const r = await viaAgent(post);
    assert.equal(r.code, 403, JSON.stringify(r.body)); assert.equal(r.body.needs, "person"); assert.match(r.body.error, /outside their limits \(not a good time\)/);
  }
  assert.ok(!P.find(open).invite.going.includes(ben.id) && !(P.find(full).invite.waitlist || []).includes(ben.id), "the agent changed nothing");
  // the person's own join: allowed, and said (a weekday game too)
  const own = await feedJoin(ben.id, { post: open });
  assert.equal(own.code, 200); assert.ok(own.body.post.invite.joined);
  assert.match(own.body.note, /outside the limits you set for your agent \(not a good time\)\. You joined it yourself, so it stands/);
  const wait = await feedJoin(ben.id, { post: full });
  assert.ok(wait.body.waitlisted); assert.match(wait.body.note, /You put yourself on its waitlist, so it stands/);
  // inside the limits: no note
  T.setLimits(ben.id, { windows: null });
  const fine = (await P.post(ana.id, { invite: { sport: "badminton", day: "Fri", start: "19:00", where: "Riverside", spots: 3 } })).post.id;
  assert.equal((await feedJoin(ben.id, { post: fine })).body.note, undefined);
});

test("a club's invite link: members share it, a public club is joined by it, a private one asks its organiser", async () => {
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member;
  const as = (m) => ({ "x-serve-session": M.sessionFor(m.id) }), at = { lat: 25.03, lon: 121.56 };
  const pub = (await route("POST", "/api/clubs", { name: "Riverside Smash", sport: "badminton", at }, as(ana))).body.club;
  const priv = (await route("POST", "/api/clubs", { name: "Quiet Doubles", sport: "badminton", at, privacy: "private" }, as(ana))).body.club;
  const link = await route("GET", `/api/clubs/${pub.id}/invite`, undefined, as(ana));
  assert.equal(link.code, 200); assert.match(link.body.link, /^\/#\/club\?join=[\w-]{8}$/); assert.equal(link.body.link, `/#/club?join=${link.body.code}`);
  assert.equal((await route("GET", `/api/clubs/${pub.id}/invite`, undefined, as(ana))).body.code, link.body.code, "the same link each time");
  assert.equal((await route("GET", `/api/clubs/${pub.id}/invite`, undefined, as(ben))).code, 403, "only members share it");
  assert.equal((await route("GET", `/api/clubs/${priv.id}/invite`, undefined, as(ben))).code, 404, "a private club's, not to outsiders");
  // what the link shows before sign-in: the club, never who is in it
  const pre = await route("GET", `/api/clubs/invite?code=${link.body.code}`);
  assert.equal(pre.code, 200); assert.equal(pre.body.club.name, "Riverside Smash"); assert.equal(pre.body.club.members, 1);
  assert.doesNotMatch(JSON.stringify(pre.body), /Ana|names/);
  assert.equal((await route("GET", "/api/clubs/invite?code=nope")).code, 404);
  const j = await route("POST", "/api/clubs/join", { code: link.body.code }, as(ben));
  assert.equal(j.code, 200); assert.ok(j.body.club.joined); assert.equal(j.body.via, "link");
  // private: the link asks; the organiser hears it once and says yes
  const code = (await route("GET", `/api/clubs/${priv.id}/invite`, undefined, as(ana))).body.code;
  const ask = await route("POST", "/api/clubs/join", { code }, as(cy));
  assert.ok(ask.body.asked && !ask.body.club.joined, JSON.stringify(ask.body));
  await route("POST", "/api/clubs/join", { code }, as(cy));
  assert.equal((S.data().notices || []).filter((x) => x.player === ana.id && x.kind === "club").length, 1, "the organiser, once");
  assert.ok((await route("POST", "/api/clubs/answer", { club: priv.id, member: cy.id, yes: true }, as(ana))).body.club.members === 2);
  assert.equal((await route("POST", "/api/clubs/join", { code: "nope" }, as(cy))).code, 404);
});
