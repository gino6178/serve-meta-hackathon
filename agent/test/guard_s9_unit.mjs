// Unit test for Llama Guard's S9 (indiscriminate weapons) in src/safety/guard.js: it counts only with a weapon in the
// text, so "round 27" or a smash "like a bomb" is not refused as a threat of violence. No model.
//   node --test test/guard_s9_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
const g = await import("../src/safety/guard.js");

test("S9 needs a weapon in the text; other categories stand as they were", () => {
  const s9 = { safe: false, categories: ["S9"] };
  assert.equal(g.blocks(s9, "Serve test round 27 (please ignore)"), false);
  assert.equal(g.blocks(s9, "Fun doubles, smashes like a bomb"), false);
  assert.equal(g.blocks(s9, "bring a gun to the court"), true);
  assert.equal(g.replaces(s9, "Round 3 starts at seven."), false);
  assert.deepEqual(g.stopsIn({ safe: false, categories: ["S9", "S1"] }, "round 27"), ["S1"]);
  assert.equal(g.stopsIn(s9, "round 27"), null);
});
