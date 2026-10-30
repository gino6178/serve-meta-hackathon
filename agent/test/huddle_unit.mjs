// Unit tests for how a member's agent learns how they like to play (members/taste.js) and how a venue's agent talks
// price (members/deals.js). No network: places are made up here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TASTE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taste-")), "taste.json");
const T = await import("../src/members/taste.js");
const D = await import("../src/members/deals.js");

test("a few picks teach the agent what matters to its member", () => {
  for (let i = 0; i < 6; i++) {
    const q = T.question("near", { force: true });
    T.choose("near", q, q.a.km <= q.b.km ? "a" : "b"); // always the closer game
  }
  const w = T.weights(T.get("near"));
  assert.ok(w.place > 0.3 && w.place === Math.max(...Object.values(w)), JSON.stringify(w));
  assert.match(T.view(T.get("near")).summary, /How far it is matters most/);
});
test("before any answer, weekday evenings beat weekday mornings", () => {
  const t = T.get("new");
  assert.ok(T.timeFit(t, "Thu evening") > T.timeFit(t, "Thu morning"));
});
test("a no for the time moves that slot down and says so", () => {
  const o = { date: "2026-11-05", start: "19:30", km: 2, each: 80, busy: 0.4 };
  const before = T.timeFit(T.get("x"), "Thu evening");
  const r = T.reply("x", o, false, "time");
  assert.ok(T.timeFit(T.get("x"), "Thu evening") < before);
  assert.match(r.line, /Thursday evenings/);
});
test("a venue's agent never goes under its floor, and a full hour is the list price", () => {
  const v = { id: "v1", name: "Hall", kind: "venue", sport: "badminton", list: 300, lat: 0, lon: 0 };
  const quiet = D.talk(v, { date: "2026-11-04", start: "14:00", players: 4, push: 1 });
  const t = D.terms(v, "2026-11-04", "14:00");
  assert.ok(quiet.price >= t.floor && quiet.price < quiet.list, JSON.stringify(quiet));
  const full = D.talk(v, { date: "2026-11-04", start: "19:00", players: 4, push: 1 });
  if (D.busy(v, "2026-11-04", "19:00") >= 0.85) assert.equal(full.price, full.list);
  assert.ok(full.price >= quiet.price);
});

process.env.TRUST_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "trust-")), "trust.json");
const Tr = await import("../src/members/trust.js");
test("the gate: low show-up waits, an agent that breaks its yeses can't answer, new people get in", () => {
  Tr.seed("bob", { person: { games: 3, came: 1 } });
  Tr.seed("dan", { agent: { said: 25, kept: 13 } });
  const gate = { minShow: 0.9 };
  assert.equal(Tr.check("bob", gate).verdict, "waitlist");
  assert.equal(Tr.check("dan", gate).verdict, "confirm");
  assert.equal(Tr.check("newcomer", gate).verdict, "ok");
  assert.equal(Tr.check("bob", {}).verdict, "ok"); // no show-up gate: anyone plays
});
test("after a game, most of the others decide who came; leaving late counts", () => {
  const start = Date.now() - 2 * 3600e3;
  Tr.expect("g1", ["a", "b", "c"], start);
  Tr.vote("a", "g1", { b: "came", c: "missed" });
  Tr.vote("b", "g1", { a: "came", c: "missed" });
  Tr.vote("c", "g1", { a: "came", b: "came" });
  assert.equal(Tr.badge("c").show.games, 1);
  assert.equal(Tr.badge("a").show.games, 1);
  assert.equal(Tr.left("d", Date.now() + 2 * 3600e3), true);
  assert.equal(Tr.left("d", Date.now() + 30 * 3600e3), false);
  Tr.promise("e", true); Tr.promise("e", false); Tr.promise("e", true);
  assert.equal(Tr.badge("e").agent.rate, 0.67);
});

process.env.NEEDS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "needs-")), "needs.json");
const N = await import("../src/members/needs.js");
test("what the agents keep running into goes to the club's ideas after three huddles, once", async () => {
  const sent = [];
  const suggest = async (kind) => { sent.push(kind); return { kind }; };
  await N.saw("too_far", "h1", { suggest }); await N.saw("too_far", "h1", { suggest }); await N.saw("too_far", "h2", { suggest });
  assert.equal(sent.length, 0); // the same huddle twice counts once
  await N.saw("too_far", "h3", { suggest });
  assert.deepEqual(sent, ["too_far"]);
  for (const h of ["h4", "h5", "h6"]) await N.saw("too_far", h, { suggest });
  assert.equal(sent.length, 1); // once a month
});

test("the trust chain: records come from it, and any change to a past entry is caught", async () => {
  const { privateKey, publicKey } = (await import("node:crypto")).generateKeyPairSync("ed25519");
  const crypto = await import("node:crypto");
  Tr.useSigner((text) => ({ kid: "test", alg: "EdDSA", sig: crypto.sign(null, Buffer.from(text), privateKey).toString("base64url") }));
  Tr.promise("zed", true); Tr.promise("zed", true); Tr.promise("zed", false);
  assert.equal(Tr.badge("zed").agent.rate, 0.67);
  const pub = Tr.publicChain({ n: 2000 });
  assert.equal(Tr.verify(pub.entries, pub.heads).ok, true);
  assert.ok(!JSON.stringify(pub).includes("zed")); // subjects are pseudonyms
  // someone edits a broken promise into a kept one, or drops an entry: the replay stops there
  const edited = structuredClone(pub.entries); const k = edited.findLastIndex((e) => e.kind === "promise"); edited[k].d.kept = true;
  assert.equal(Tr.verify(edited, []).ok, false);
  const dropped = pub.entries.filter((_, i) => i !== k - 1);
  assert.equal(Tr.verify(dropped, []).ok, false);
  // today's head is signed with the gateway's key, and the signature checks out; cutting the end off fails against it
  const h = await Tr.head();
  assert.equal(Tr.verify(pub.entries.slice(0, -1), [h]).ok, false);
  assert.equal(crypto.verify(null, Buffer.from(Tr.headText(h)), publicKey, Buffer.from(h.sig, "base64url")), true);
  // leaving adds an entry; the chain still verifies and the records stop counting
  Tr.forget("zed");
  assert.equal(Tr.verify().ok, true);
  assert.equal(Tr.badge("zed").agent.said, 0);
});
