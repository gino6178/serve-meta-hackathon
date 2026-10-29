// The learned intent router (src/match/router.js), no model: the head picks the most likely class, and the router says
// no when it is off, for a command, or with no embedder.   node --test test/router_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.MEMORY_EMBED = "bm25"; // no embedder in this test
const router = await import("../src/match/router.js");

test("the head: a softmax over the classes, the most likely one named", () => {
  const h = { classes: ["play", "played", "chat"], W: [[2, 0], [0, 2], [0, 0]], b: [0, 0, 0.5] };
  const a = router.classify([1, 0], h), b = router.classify([0, 0], h);
  assert.equal(a.best, "play"); assert.ok(Math.abs(Object.values(a.p).reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.equal(b.best, "chat");
});

test("the shipped head has the five classes and one row per class", async () => {
  const fs = await import("node:fs"), h = JSON.parse(fs.readFileSync(new URL("../src/match/router_head.json", import.meta.url), "utf8"));
  assert.deepEqual(h.classes, ["play", "played", "body", "question", "chat"]);
  assert.equal(h.W.length, 5); assert.equal(h.b.length, 5); assert.equal(h.W[0].length, 768);
});

test("no: when it is off, for a command, and with no embedder", async () => {
  assert.equal(await router.isPlay("need a doubles game tmr after work"), false, "no embedder: no");
  process.env.INTENT_ROUTER = "off"; assert.equal(await router.isPlay("anyone free for singles thu night"), false); delete process.env.INTENT_ROUTER;
  assert.equal(await router.isPlay("/game"), false);
});
