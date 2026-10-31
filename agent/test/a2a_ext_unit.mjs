// Unit tests for A2A v1.0 conformance of the members' agents (src/a2a/server.js, ext.js, client.js): the card's
// signature names its key set (jku, spec 8.4), the proposal and the hold are required versioned extensions (spec 4.6),
// and a request that does not name them is refused with the A2A error. No model, no network, no real data.
//   node --test test/a2a_ext_unit.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-a2a-ext-unit-"));
Object.assign(process.env, { BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`, A2A_DATA: `${tmp}/a2a`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`,
  MATCH_RECORDS_FILE: `${tmp}/records.json`, MATCH_AUDIT_FILE: `${tmp}/audit.json`, MATCH_DEMO_RECORDS: "0", AGENT_TOKEN: "unit-token", LLM_URL: "http://127.0.0.1:9/v1", A2A_TRANSPORT: "",
  ASK_FILE: `${tmp}/asks.json`, STORE_FILE: `${tmp}/players.json`, MEMORY_FILE: `${tmp}/memory.json`, MEMORY: "off", GUARD: "off", A2A_PEERS_FILE: `${tmp}/peers.json`, A2A_PEER_QUIET: "1" });
const srv = await import("../src/a2a/server.js");
const ext = await import("../src/a2a/ext.js");
const client = await import("../src/a2a/client.js");
const { readClub } = await import("../src/club/club.js");

const server = await new Promise((ok) => { const x = http.createServer((q, r) => srv.handle(q, r)).listen(0, "127.0.0.1", () => ok(x)); });
const BASE = `http://127.0.0.1:${server.address().port}`;
process.env.A2A_BASE = process.env.A2A_SELF = BASE;
after(() => server.close());
const club = readClub(), m = club.members[0], url = `${BASE}/a2a/members/${m.id}/`;
const header = (card) => JSON.parse(Buffer.from(card.signatures[0].protected, "base64url").toString("utf8"));
const hold = (ref) => ({ kind: "serve.hold", action: "hold", ref, date: "2026-11-05", start: "19:00", minutes: 90 });
const rpc = (data, h = {}, contextId = `c-${crypto.randomUUID().slice(0, 12)}`) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "A2A-Version": "1.0", authorization: "Bearer unit-token", ...h },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), contextId, role: "ROLE_USER", parts: [{ data, mediaType: "application/json" }] } } }) });

test("a signed card names its key set: jku next to kid, at the gateway's /a2a/keys.json", async () => {
  const card = await (await fetch(`${url}.well-known/agent-card.json`)).json();
  const h = header(card);
  assert.equal(h.alg, "EdDSA"); assert.equal(h.typ, "JOSE"); assert.ok(h.kid);
  assert.equal(h.jku, `${BASE}/a2a/keys.json`);
  assert.ok((await (await fetch(h.jku)).json()).keys.some((k) => k.kid === h.kid), "the key is at the jku");
  await client.verifierFor(BASE)(card);
  // a card whose jku names another place is refused, though the key that signed it is this gateway's
  process.env.A2A_BASE = "http://elsewhere.example";
  const moved = await srv.signCard(srv.cardFor(url.slice(0, -1), m, club));
  process.env.A2A_BASE = BASE;
  assert.equal(header(moved).jku, "http://elsewhere.example/a2a/keys.json");
  await assert.rejects(client.verifierFor(BASE)(moved), "no valid signature: its key set is not this address's");
});

test("the proposal and the hold are declared as required, versioned extensions; serve.likely stays optional", async () => {
  const card = await (await fetch(`${url}.well-known/agent-card.json`)).json(), xs = card.capabilities.extensions;
  for (const p of [ext.PROPOSAL_PATH, ext.HOLD_PATH]) {
    const e = xs.find((x) => x.uri === `${BASE}${p}`);
    assert.ok(e, `declares ${p}`); assert.equal(e.required, true); assert.match(e.uri, /\/v1$/); assert.equal(e.params.version, 1);
    const doc = await (await fetch(e.uri)).json();
    assert.equal(doc.version, 1); assert.match(doc.name, /^serve\.(proposal|hold)$/);
  }
  const lk = xs.find((x) => x.uri.endsWith("/a2a/ext/likely/v1"));
  assert.ok(!lk || !lk.required, "serve.likely is not required");
  // an opted-out member still declares the two it needs
  const out = srv.cardFor("http://x/a2a/members/z", { ...m, shares: { ...m.shares, likely: false } }, club);
  assert.deepEqual(out.capabilities.extensions.map((e) => e.uri), [`${BASE}/a2a/ext/proposal/v1`, `${BASE}/a2a/ext/hold/v1`]);
});

test("a request that does not name the required extensions is refused with the A2A error, before any agent reads it", async () => {
  const none = await (await rpc(hold("r1"))).json();
  assert.equal(none.error?.code, -32008, JSON.stringify(none));
  assert.match(none.error.message, /required extensions/); assert.match(none.error.message, /proposal\/v1/); assert.ok(!none.result);
  // one of the two is not enough
  const half = await (await rpc(hold("r2"), { "A2A-Extensions": `${BASE}${ext.PROPOSAL_PATH}` })).json();
  assert.equal(half.error?.code, -32008); assert.match(half.error.message, /hold\/v1/);
  // both: answered, and the one the message used is said back as activated
  const ctx = "c-both", r = await rpc(hold(ctx), ext.header(BASE), ctx), j = await r.json();
  assert.ok(j.result?.task, JSON.stringify(j));
  assert.equal(r.headers.get("a2a-extensions"), `${BASE}${ext.HOLD_PATH}`);
});

test("Serve's own client names them by itself: a hold over A2A is answered", async () => {
  const ctx = "c-client", t = await client.send(url, { messageId: crypto.randomUUID(), contextId: ctx, parts: [{ data: hold(ctx) }] });
  assert.equal(t.status.state, "TASK_STATE_COMPLETED");
  // (no talk with this agent in that context: not held, but answered)
  assert.equal(client.dataOf(t, "hold").held, false);
});

test("the card takes JSON only, and a text message is refused as ContentTypeNotSupportedError (A2A v1.0), naming the data part", async () => {
  const card = await (await fetch(`${url}.well-known/agent-card.json`)).json();
  assert.deepEqual(card.defaultInputModes, ["application/json"]);
  assert.ok(card.skills.every((s) => s.inputModes.every((x) => x === "application/json")));
  const r = await (await fetch(url, { method: "POST", headers: { "content-type": "application/json", "A2A-Version": "1.0", authorization: "Bearer unit-token", ...ext.header(BASE) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), contextId: "c-text", role: "ROLE_USER", parts: [{ text: "Badminton Thursday?", mediaType: "text/plain" }] } } }) })).json();
  assert.equal(r.error?.code, -32005, JSON.stringify(r)); assert.match(r.error.message, /text\/plain/); assert.match(r.error.message, /application\/json/); assert.ok(!r.result);
  // a text part with no media type gets past that check: the task fails with the format to send
  const t = await (await fetch(url, { method: "POST", headers: { "content-type": "application/json", "A2A-Version": "1.0", authorization: "Bearer unit-token", ...ext.header(BASE) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), contextId: "c-text2", role: "ROLE_USER", parts: [{ text: "Badminton Thursday?" }] } } }) })).json();
  const task = t.result?.task;
  assert.equal(task?.status?.state, "TASK_STATE_FAILED", JSON.stringify(t));
  assert.match(JSON.stringify(task.status.message), /serve\.proposal.*application\/json/);
});

test("a card read at the public address names it (interface, likely extension, key set); read on the gateway's base, that base", async () => {
  const club = readClub(), m = club.members[0], was = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = "https://play.example.com/";
  try {
    const root = srv.rootFor({ headers: { host: "play.example.com" } });
    assert.equal(root, "https://play.example.com");
    assert.equal(srv.rootFor({ headers: { host: "127.0.0.1:8790" } }), process.env.A2A_BASE || "http://127.0.0.1:8790");
    const card = await srv.signCard(srv.cardFor(`${root}/a2a/members/${m.id}`, m, club, root), root);
    const all = JSON.stringify(card);
    assert.ok(!/127\.0\.0\.1|localhost/.test(all), "nothing names the loopback");
    assert.equal(card.supportedInterfaces[0].url, `https://play.example.com/a2a/members/${m.id}/`);
    const jws = card.signatures[0].protected, hdr = JSON.parse(Buffer.from(jws, "base64url").toString());
    assert.equal(hdr.jku, "https://play.example.com/a2a/keys.json");
  } finally { if (was === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = was; }
});
