// Three clubs in a federation (a2a/peer.js), over real HTTP, no model: this process is club A's gateway; clubs B and C
// are small servers with keys of their own, publishing their cards and key sets. A finds them by address only, pins
// each key on first use, accepts their signed requests, follows B's key rotation through its signed statement, and
// refuses C's rotation when the statement is signed by a key C never had. A fourth address that isn't a club card is
// left out.   node --test test/federation_unit.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-fed-"));
const dirs = Object.fromEntries(["a", "b", "c"].map((k) => { const d = path.join(tmp, k); fs.mkdirSync(d); return [k, d]; }));
Object.assign(process.env, { A2A_DATA: dirs.a, A2A_PEER_REFRESH_MS: "0", A2A_FEDERATION_FILE: path.join(tmp, "federation.json") });
delete process.env.A2A_PEERS_FILE;
const peer = await import("../src/a2a/peer.js");

// clubs B and C: a card and a key set each (C's key set can be swapped for a forged one)
const forged = { c: null };
function club(name, dir, members) {
  const s = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/a2a/club.json") return res.end(JSON.stringify({ kind: "serve.club", name, protocol: "a2a/1.0", keys: "/a2a/keys.json", members }));
    if (req.url === "/a2a/keys.json") return res.end(JSON.stringify(name === "clubC" && forged.c ? forged.c : peer.keySet(dir)));
    res.statusCode = 404; res.end("{}");
  });
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok({ s, origin: `http://127.0.0.1:${s.address().port}` })));
}
const B = await club("clubB", dirs.b, [{ id: "mia", name: "Mia Lopez", level: "B", sports: ["tennis"], prefers: "singles" }]);
const C = await club("clubC", dirs.c, [{ id: "ken", name: "Ken Ito", level: "C", sports: ["badminton"], prefers: "doubles" }]);
const junk = http.createServer((req, res) => res.end("<html>not a club</html>"));
await new Promise((ok) => junk.listen(0, "127.0.0.1", ok));
after(() => { B.s.close(); C.s.close(); junk.close(); });
fs.writeFileSync(process.env.A2A_FEDERATION_FILE, JSON.stringify({ clubs: [{ origin: B.origin }, { origin: C.origin }, { origin: `http://127.0.0.1:${junk.address().port}` }] }));

const getJSON = (url) => fetch(url).then((r) => r.json());
const card = (o) => getJSON(`${o}/a2a/club.json`), keys = (o) => getJSON(`${o}/a2a/keys.json`);
// a signed request from club k to club A
const from = (k, dirK, p = "/a2a/members/hana", body = "{\"jsonrpc\":\"2.0\"}") => {
  const me = peer.ownKey(dirK), aud = peer.ownKey(dirs.a).kid;
  return { method: "POST", path: p, body, headers: { [peer.HEADER]: peer.signToken({ key: me.key, kid: me.kid, aud, method: "POST", path: p, body }) } };
};

test("A finds the clubs by address: names and members from their own cards; a page that isn't a card is left out", async () => {
  const found = await peer.discover(card);
  assert.deepEqual(found.sort(), ["clubB", "clubC"]);
  assert.equal(peer.byName("clubB").origin, B.origin);
  assert.equal(peer.member("mia@clubB").name, "Mia Lopez");
  assert.equal(peer.member("ken@clubC").prefers, "doubles");
  assert.ok(peer.serves("clubB", "hana"), "a made-up member may be asked by a club of the federation");
  assert.ok(!peer.serves("clubB", { id: "you", real: true }), "a real player's agent never answers another club");
});

test("each club's signed request: its key pinned on first use, then accepted; a replay refused", async () => {
  const rb = from("b", dirs.b), rc = from("c", dirs.c);
  assert.equal((await peer.verify(rb, keys)).peer, "clubB");
  assert.equal((await peer.verify(rc, keys)).peer, "clubC");
  assert.equal((await peer.verify(rb, keys)).why, "replay");
  assert.equal(peer.pinOf("clubB").kid, peer.ownKey(dirs.b).kid);
});

test("B rotates its key: A follows the statement signed by the old key, and pins the new one", async () => {
  const old = peer.ownKey(dirs.b).kid, firstPin = { ...peer.pinOf("clubB") };
  const next = peer.rotateOwnKey(dirs.b);
  assert.notEqual(next.kid, old);
  const v = await peer.verify(from("b", dirs.b), keys);
  assert.ok(v.ok, v.message); assert.equal(v.peer, "clubB");
  assert.equal(peer.pinOf("clubB").kid, next.kid);
  // and after a second rotation, the chain from the first key, two statements long, still holds
  const third = peer.rotateOwnKey(dirs.b);
  assert.equal(peer.followRotations(firstPin, peer.keySet(dirs.b))?.kid, third.kid);
});

test("C's 'rotation' signed by a key C never had: refused, and A keeps its pin", async () => {
  const pinned = peer.pinOf("clubC");
  const intruder = crypto.generateKeyPairSync("ed25519").privateKey, ix = crypto.createPublicKey(intruder).export({ format: "jwk" }).x;
  const fake = crypto.generateKeyPairSync("ed25519").privateKey, fx = crypto.createPublicKey(fake).export({ format: "jwk" }).x;
  // the statement claims to come from C's pinned key, but the intruder signed it
  const stmt = peer.rotationToken({ oldKey: intruder, oldKid: pinned.kid, newX: fx });
  forged.c = { keys: [{ kty: "OKP", crv: "Ed25519", x: fx, kid: peer.kidOf(fx), alg: "EdDSA", use: "sig" }], rotations: [stmt] };
  const body = "{}", p = "/a2a/members/hana";
  const req = { method: "POST", path: p, body, headers: { [peer.HEADER]: peer.signToken({ key: fake, kid: peer.kidOf(fx), aud: peer.ownKey(dirs.a).kid, method: "POST", path: p, body }) } };
  const v = await peer.verify(req, keys);
  assert.equal(v.ok, false);
  assert.equal(peer.pinOf("clubC").kid, pinned.kid);
  assert.equal(peer.followRotations(pinned, forged.c), null);
  void ix;
});
