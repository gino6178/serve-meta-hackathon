// Unit tests for the planner's tool list and loop notes (src/agents/planner_tools.js), with no model:
//   node --test test/planner_tools_unit.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-ptools-"));
process.env.PLANNER_TOOLS_FILE = `${tmp}/tools.json`;
const pt = await import("../src/agents/planner_tools.js");
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const T = ["get_week", "check_limits", "find_places", "find_partners", "negotiate", "recall", "request_approval", "nudge", "finish"].map((name) => ({ type: "function", function: { name } }));
const names = (ts) => ts.map((t) => t.function.name);

test("what the week can use: read by code first, courts only outdoors or after no court, approval only once agreed", () => {
  pt.forgetRuns();
  assert.deepEqual(names(pt.offered(T, { pre: true, agreed: 0 })), ["get_week", "find_partners", "negotiate", "nudge", "finish"]);
  assert.ok(names(pt.offered(T, { pre: true, outdoor: true })).includes("find_places"));
  assert.ok(names(pt.offered(T, { pre: true, courtFailed: true })).includes("find_places"), "a club court that was not free brings it back");
  assert.ok(names(pt.offered(T, { pre: true, notes: true })).includes("recall"));
  const agreed = names(pt.offered(T, { pre: true, agreed: 1 }));
  assert.ok(agreed.includes("request_approval") && !agreed.includes("nudge"));
  assert.ok(names(pt.offered(T, { pre: false })).includes("check_limits"), "without code reading the body first, the model asks for it");
  process.env.PLANNER_PRUNE = "off";
  try { assert.equal(pt.offered(T, {}).length, T.length); } finally { delete process.env.PLANNER_PRUNE; }
});

test("by use: a tool no run used in the last 10 is left out, never the core of the loop", () => {
  pt.forgetRuns();
  for (let k = 0; k < 9; k++) pt.noteRun(["find_partners", "negotiate", "finish"]);
  assert.ok(names(pt.offered(T, { pre: true })).includes("get_week"), "fewer than 10 runs: no judgement yet");
  pt.noteRun(["find_partners", "negotiate", "finish"]);
  const now = names(pt.offered(T, { pre: true }));
  assert.ok(!now.includes("get_week"), "unused in 10 runs");
  for (const core of ["find_partners", "negotiate", "finish", "nudge"]) assert.ok(now.includes(core));
  assert.ok(names(pt.offered(T, { pre: true, used: new Set(["get_week"]) })).includes("get_week"), "used in this run: kept");
});

test("a loop gets one note: the same call failing twice, or three failures in a row; at most twice a run", () => {
  const w = pt.loopWatch();
  const no = { agreed: null, reason: "Leo can't play" };
  assert.equal(w.after("negotiate", { members: ["s1"], day: "Tue", start: "19:00", reason: "a" }, no), null);
  const n1 = w.after("negotiate", { members: ["s1"], day: "Tue", start: "19:00", reason: "b" }, no);
  assert.match(n1, /same arguments has failed 2 times/);
  assert.equal(w.after("find_partners", { day: "Wed" }, { candidates: [] }), null, "a call that worked resets the streak");
  w.after("negotiate", { members: ["s2"] }, no); w.after("negotiate", { members: ["s3"] }, no);
  assert.match(w.after("negotiate", { members: ["s4"] }, no), /last three calls failed/);
  assert.equal(w.after("negotiate", { members: ["s4"] }, no), null, "at most two notes");
  assert.equal(w.notes, 2);
  process.env.PLANNER_LOOPS = "off";
  try { const v = pt.loopWatch(); v.after("negotiate", { a: 1 }, no); assert.equal(v.after("negotiate", { a: 1 }, no), null); } finally { delete process.env.PLANNER_LOOPS; }
});
