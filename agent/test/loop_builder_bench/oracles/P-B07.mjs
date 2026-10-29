// P-B07 (C3): a new module club/streak.js, streak(history, now), weeks in a row with a game; get_week carries playStreak
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { WT, load, source, body } from "./_env.mjs";

assert.ok(fs.existsSync(path.join(WT, "agent/src/club/streak.js")), "agent/src/club/streak.js exists");
const { streak } = await load("agent/src/club/streak.js");
const WED = new Date(2026, 9, 28, 12, 0); // Wednesday 28 Oct 2026; its week is Mon 26 Oct to Sun 1 Nov
const g = (...dates) => dates.map((date) => ({ date, start: "19:00" }));

test("a run ending this week, in any order", () => {
  assert.equal(streak(g("2026-10-27", "2026-10-13", "2026-10-20", "2026-10-06"), WED), 4);
  assert.equal(streak(g("2026-10-26", "2026-10-26", "2026-10-25"), WED), 2, "two games in one week count once; Sunday the 25th is last week");
});
test("nothing yet this week: the run ending last week still counts", () => {
  assert.equal(streak(g("2026-10-24", "2026-10-17", "2026-10-10"), WED), 3);
});
test("a gap ends it; neither this week nor last: 0", () => {
  assert.equal(streak(g("2026-10-27", "2026-10-13", "2026-10-06"), WED), 1);
  assert.equal(streak(g("2026-10-13", "2026-10-06"), WED), 0);
  assert.equal(streak([], WED), 0);
});
test("a game after now does not count", () => {
  assert.equal(streak(g("2026-10-30", "2026-10-20"), WED), 1, "Friday the 30th is after Wednesday noon; last week's game still counts");
  assert.equal(streak(g("2026-11-03"), WED), 0);
});
test("get_week's result carries playStreak from streak(hist, now)", () => {
  const src = source("agent/src/agents/autopilot.js");
  // (the spec says "import streak from ../club/streak.js": a named import or the module's default both do)
  assert.match(src, /import\s+(streak|\{[^}]*\bstreak\b[^}]*\})\s+from\s*["']\.\.\/club\/streak\.js["']/);
  assert.match(body(src, "get_week() {"), /playStreak\s*:\s*streak\(\s*hist\s*,\s*now\s*\)/);
});
