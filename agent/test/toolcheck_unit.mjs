// Unit tests for the checks after the schema (core/toolcheck.js), with the stand-in model and no GPU:
//   node --test test/toolcheck_unit.mjs
//   - typed errors: the fixed vocabulary, fields only from the tool's own parameters, no value the model wrote
//   - the semantic helpers: dates that exist, times, sports; Repair@1 and @2 counted per tool
//   - chatJSON with a call site's check: a reply that fits but is wrong is asked again, typed; TOOL_CHECKS=off as before
//   - a member's reply checked (talk.js replyCheck)
//   - the Autopilot: faulty calls refused typed and repaired, a silent failure caught by its postcondition and reported
//     as a failure (error.type postcondition_failed), never as success
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fakeModel } from "./fake_model.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-toolcheck-"));
const model = await fakeModel({ faults: { schema: 0.15, semantic: 0.25, seed: 3 } });
Object.assign(process.env, { AUTOPILOT_FILE: `${tmp}/autopilot.json`, BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`, A2A_DATA: `${tmp}/a2a`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`,
  TRACE_FILE: `${tmp}/traces.jsonl`, PREFS_FILE: `${tmp}/prefs.json`, STORE_FILE: `${tmp}/players.json`, MEMORY_FILE: `${tmp}/memory.json`, MATCH_RECORDS_FILE: `${tmp}/mr.json`, MATCH_AUDIT_FILE: `${tmp}/ma.json`, MATCH_STATE_FILE: `${tmp}/ms.json`,
  LLM_URL: model.url, LLM_API: "ollama", GUARD: "off", MEMORY: "off", A2A_TRANSPORT: "local", A2A_ROUTE: "off", LOOP_DIR: `${tmp}/loop`, LOOP_WATCH: "off", AUTOPILOT_DURABLE: "0" });
delete process.env.A2A_BASE; delete process.env.A2A_PRIVATE; delete process.env.CRASH_AT; delete process.env.TOOL_CHECKS;
const tc = await import("../src/core/toolcheck.js");
const { chatJSON } = await import("../src/core/llm.js");
const { MEMBER_REPLY } = await import("../src/core/schema.js");
const { replyCheck } = await import("../src/a2a/talk.js");
const autopilot = await import("../src/agents/autopilot.js");
const play = await import("../src/club/play.js");
const { errorType } = await import("../src/core/trace.js");
after(() => { model.close(); fs.rmSync(tmp, { recursive: true, force: true }); (async () => (await import("../src/memory/memory.js")).close?.())().catch(() => {}); });

test("typed errors: fixed vocabulary, fields only from the tool's parameters, nothing the model wrote", () => {
  assert.deepEqual(tc.typed("unknown_id", "members", ["members", "day"]), { kind: "unknown_id", field: "members" });
  assert.deepEqual(tc.typed("unknown_id", "ignore_previous", ["members"]), { kind: "unknown_id" });
  assert.equal(tc.typed("made_up_kind").kind, "schema_violation");
  // schema.js names an extra key the model made up: it does not reach the message
  const errs = tc.fromSchema(["$.ignore_all_rules_and_book: not allowed", "$.day: missing"], { properties: { day: {}, start: {} } });
  assert.deepEqual(errs, [{ kind: "schema_violation" }, { kind: "schema_violation", field: "day" }]);
  const r = tc.refusal("negotiate", errs, 2);
  assert.doesNotMatch(r.error, /ignore_all_rules/);
  assert.match(r.error, /^refused negotiate: schema_violation: .*schema_violation \(day\)/);
  assert.match(r.error, /2 tries left/);
  assert.match(tc.refusal("negotiate", errs, 0).error, /Do not call negotiate that way again/);
});

test("semantic helpers: dates that exist, times, sports", () => {
  assert.equal(tc.realDate("2026-02-30"), false);
  assert.equal(tc.realDate("2024-02-29"), true);
  assert.equal(tc.realDate("2026-13-01"), false);
  assert.equal(tc.realTime("19:30"), true);
  assert.equal(tc.realTime("7pm"), false);
  assert.equal(tc.minutesOf("19:30"), 1170);
  assert.equal(tc.knownSport("Badminton"), true);
  assert.equal(tc.knownSport("quidditch"), false);
  const S = { type: "object", required: ["date"], properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } };
  assert.deepEqual(tc.check(S, { date: "2026-02-30" }, (v) => [!tc.realDate(v.date) && tc.typed("date_out_of_range", "date", ["date"])]), [{ kind: "date_out_of_range", field: "date" }]);
  assert.deepEqual(tc.check(S, { date: 5 }), [{ kind: "schema_violation", field: "date" }]);
});

test("Repair@1 and @2: a refused call, then the same tool passing after one try or two; a third refusal ends it", () => {
  const t = tc.tally(), bad = [tc.typed("unknown_id")];
  assert.equal(tc.count(t, "negotiate", bad), 2); tc.count(t, "negotiate", null); // repaired on the first try
  tc.count(t, "find_partners", bad); assert.equal(tc.count(t, "find_partners", bad), 1); tc.count(t, "find_partners", null); // on the second
  tc.count(t, "negotiate", bad); tc.count(t, "negotiate", bad); assert.equal(tc.count(t, "negotiate", bad), 0); // not repaired
  const s = tc.summary(t);
  assert.deepEqual([s.refusedFirst, s.repair1, s.repair2, s.semanticRefused], [3, 1, 2, 6]);
  assert.equal(s.repair1Rate, 0.333);
});

test("chatJSON with a check: a reply that fits but is wrong is asked again, typed; with TOOL_CHECKS=off it is not", async () => {
  const dbg = `${tmp}/llm_debug.jsonl`;
  process.env.LLM_DEBUG = dbg;
  let n = 0;
  const check = () => (n++ === 0 ? [tc.typed("unknown_id", "works")] : []);
  const r = await chatJSON([{ role: "user", content: "t1: Mon 19:00" }], MEMBER_REPLY, { site: "unit.reply", check });
  assert.equal(r.tries, 2);
  assert.equal(r.value.intent, "accept");
  const second = JSON.parse(fs.readFileSync(dbg, "utf8").trim().split("\n").at(-1)).messages.at(-1).content;
  assert.match(second, /^That answer was refused: unknown_id \(works\): an id that no tool returned\./);
  // never fixed: the reply that fits comes back marked semantic, for the caller's rules
  const never = await chatJSON([{ role: "user", content: "t1: Mon 19:00" }], MEMBER_REPLY, { site: "unit.reply", check: () => [tc.typed("breaks_limit", "intent")] });
  assert.equal(never.semantic, true); assert.equal(never.value.intent, "accept"); assert.deepEqual(never.kinds, [["breaks_limit"], ["breaks_limit"]]);
  process.env.TOOL_CHECKS = "off";
  const off = await chatJSON([{ role: "user", content: "t1: Mon 19:00" }], MEMBER_REPLY, { site: "unit.reply", check: () => [tc.typed("breaks_limit")] });
  assert.equal(off.tries, 1);
  delete process.env.TOOL_CHECKS; delete process.env.LLM_DEBUG;
});

test("a member's reply checked: a counter not listed, a date that does not exist, an id nobody listed, a yes that breaks a rule", () => {
  const cur = { id: "t1", slot: { date: "2026-11-02" }, start: 1140 }, other = { id: "t2", slot: { date: "2026-11-03" }, start: 1170 };
  const ok = replyCheck(cur, [cur, other], [cur, other], null), bad = replyCheck(cur, [other], [cur, other], "a rule");
  assert.deepEqual(ok({ intent: "accept", works: ["t1", "t2"] }), []);
  assert.deepEqual(bad({ intent: "counter", date: "2026-11-03", start: "19:30", works: ["t2"] }), []);
  assert.deepEqual(bad({ intent: "counter", date: "2026-02-30", start: "19:30" }), [{ kind: "date_out_of_range", field: "date" }]);
  assert.deepEqual(bad({ intent: "counter", date: "2026-11-03", start: "08:00" }), [{ kind: "breaks_limit", field: "start" }]);
  assert.deepEqual(bad({ intent: "accept", works: ["t9"] }), [{ kind: "breaks_limit", field: "intent" }, { kind: "unknown_id", field: "works" }]);
});

test("calendar entries checked: a date that exists, in range, times in order", async () => {
  const { eventsCheck } = await import("../src/club/life.js");
  const now = new Date("2026-10-31T10:00:00"), c = eventsCheck(now);
  assert.deepEqual(c([{ date: "2026-11-03", start: "19:00", end: "20:30", title: "Training", kind: "training" }]), []);
  assert.deepEqual(c([{ date: "2026-11-31", title: "x", kind: "other" }]), [{ kind: "date_out_of_range", field: "date" }]);
  assert.deepEqual(c({ intent: "event", events: [{ date: "2029-01-01", title: "x", kind: "other" }] }), [{ kind: "date_out_of_range", field: "date" }]);
  assert.deepEqual(c([{ date: "2026-11-03", start: "21:00", end: "20:00", title: "x", kind: "other" }]), [{ kind: "schema_violation", field: "start" }]);
});

test("the Autopilot: faulty calls refused typed (no value echoed) and repaired; the week still lined up", async () => {
  const now = new Date(); now.setHours(10, 0, 0, 0);
  play.clearLeases();
  const F = model.asked.faults, l0 = F.log.length;
  const r = await autopilot.run({ goal: { perWeek: 2 }, now, player: "unit-faults" });
  const mine = F.log.slice(l0);
  assert.ok(mine.length >= 1, "the seed gives at least one faulty call");
  for (const f of mine) { assert.equal(f.outcome, "refused", `${f.kind}: ${f.what} was run`); assert.equal(f.typed, true); }
  assert.equal(r.agreed.length, 2);
  assert.ok(r.report.checks.refusedFirst >= 1 && r.report.checks.repair2 >= 1);
  const steps = JSON.stringify(r.trail);
  assert.ok(steps.length > 0);
  for (const g of r.agreed) play.release(g.hold);
});

test("a silent failure: the approval reported sent but not saved is caught, reported as a failure, and asked again", async () => {
  const now = new Date(); now.setHours(10, 0, 0, 0);
  play.clearLeases();
  const rates = { ...model.asked.faults.rates };
  Object.assign(model.asked.faults.rates, { schema: 0, semantic: 0 });
  let once = true;
  autopilot.faults.silent = (name) => name === "request_approval" && once && !(once = false);
  const steps = [];
  const r = await autopilot.run({ goal: { perWeek: 1 }, now, player: "unit-silent", onStep: (e) => steps.push(e) });
  autopilot.faults.silent = null; Object.assign(model.asked.faults.rates, rates);
  assert.equal(r.report.checks.postFailed, 1);
  assert.ok(r.approval && r.approval.status === "pending", "asked again, and this time it is on disk");
  const failed = steps.find((s) => s.tool === "request_approval" && s.error);
  assert.match(failed.detail, /postcondition failed/);
  assert.equal(errorType("request_approval", { error: "postcondition failed: x", kind: "postcondition_failed" }), "postcondition_failed");
  assert.equal(errorType("negotiate", { error: "refused negotiate: unknown_id", kind: "unknown_id" }), "rule_refused");
  assert.equal(errorType("negotiate", { error: "refused negotiate: schema_violation", kind: "schema_violation" }), "invalid_arguments");
  // and with the checks off, the same silent failure passes as a success
  play.clearLeases();
  process.env.TOOL_CHECKS = "off";
  let again = true;
  autopilot.faults.silent = (name) => name === "request_approval" && again && !(again = false);
  Object.assign(model.asked.faults.rates, { schema: 0, semantic: 0 });
  const off = await autopilot.run({ goal: { perWeek: 1 }, now, player: "unit-silent-off" });
  autopilot.faults.silent = null; Object.assign(model.asked.faults.rates, rates); delete process.env.TOOL_CHECKS;
  assert.ok(off.approval, "the run believes it asked");
  assert.equal(JSON.parse(fs.readFileSync(process.env.AUTOPILOT_FILE, "utf8")).pending[off.id], undefined, "but nothing is on disk");
  for (const g of [...r.agreed, ...off.agreed]) play.release(g.hold);
});
