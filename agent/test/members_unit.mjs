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
Object.assign(process.env, { MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off",
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
  assert.match(P.join(cy.id, id).error, /full/);
  assert.match(P.join(ana.id, id).error, /own invite/);
  await P.comment(cy.id, id, "Is there still space?");
  const said = P.find(id).comments.filter((c) => c.by.type === "agent").map((c) => c.text);
  assert.match(said[0], /^Ben is in\. Full for badminton Thu 19:00 at Riverside Sports Centre\./);
  assert.match(said.at(-1), /^Full for badminton/);
  P.join(ben.id, id, false);
  assert.equal(P.view(P.find(id), cy.id).invite.going, 0);
  P.join(cy.id, id);
  P.forget(cy.id);
  assert.equal(P.find(id).invite.going.length, 0, "a member who leaves is out of the invite");
  assert.ok(!P.find(id).comments.some((c) => /Cy is in/.test(c.text)), "and the agent's line naming them is gone");
});
