// Unit tests for the second round when no listed time works for everyone (src/a2a/stretch.js), with no model:
//   node --test test/stretch_unit.mjs
//   - how far a time stretches a member's own limits, and only those it allowed (never the calendar or days off)
//   - the time picked: the smallest largest stretch, counting what each member stretched before (the burden ledger)
//   - a talk in process: no common time, the second round, the game at a stretched time, and the ledger
//   - the decision with marks fits the A2A schema; A2A_STRETCH=off ends the talk as before
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-stretch-"));
Object.assign(process.env, { BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`,
  PREFS_FILE: `${tmp}/prefs.json`, MATCH_RECORDS_FILE: `${tmp}/records.json`, MATCH_AUDIT_FILE: `${tmp}/audit.json`, MATCH_STATE_FILE: `${tmp}/state.json`, ASK_FILE: `${tmp}/asks.json`, DISCLOSURE_FILE: `${tmp}/disclosure.json`,
  STRETCH_FILE: `${tmp}/stretch.json`, LLM_URL: "http://127.0.0.1:9/v1", A2A_TRANSPORT: "local", A2A_LEASE: "off", MEMORY: "off", A2A_STUDENT: "off", A2A_DECIDER: "off" });
delete process.env.A2A_PRIVATE; delete process.env.A2A_BASE; delete process.env.A2A_STRETCH;
const a2a = await import("../src/a2a/talk.js");
const st = await import("../src/a2a/stretch.js");
const { helpers } = await import("../src/club/play.js");
const { validate, DECISION, PROPOSAL } = await import("../src/core/schema.js");
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const T0 = new Date("2026-11-02T08:00:00").getTime(), D = 86400000;
const slot = (day, date) => ({ day, date });
const x = (day, date, start, trip = 10, id = "t1") => ({ id, slot: slot(day, date), start, c: { travel: [{ id: "m1", min: trip }] } });

test("a time stretches only the limits a member allowed, by how many minutes", () => {
  const m = { id: "m1", free: ["Tue 18-23", "Fri 18-23"], rules: { endBy: "21:00", maxTrip: 20, noDays: ["Fri"], stretch: { endBy: 30, maxTrip: 10 } } };
  const breaks = a2a.breaks;
  assert.equal(st.stretchOf(m, x("Tue", "2026-11-03", 19 * 60 + 30), 90, breaks), null, "it works as it is: nothing to stretch");
  assert.equal(st.stretchOf(m, x("Tue", "2026-11-03", 20 * 60), 90, breaks), 30, "ends 21:30, 30 past 21:00");
  assert.equal(st.stretchOf(m, x("Tue", "2026-11-03", 20 * 60 + 30), 90, breaks), null, "60 past: more than allowed");
  assert.equal(st.stretchOf(m, x("Tue", "2026-11-03", 19 * 60, 27), 90, breaks), 7, "a 27-minute trip, 7 over");
  assert.equal(st.stretchOf(m, x("Fri", "2026-11-06", 19 * 60), 90, breaks), null, "a day off never stretches");
  assert.equal(st.stretchOf(m, x("Tue", "2026-11-03", 22 * 60), 60, breaks), null, "past its free time (the calendar) never stretches");
  assert.equal(st.stretchOf({ ...m, rules: { ...m.rules, stretch: undefined } }, x("Tue", "2026-11-03", 20 * 60), 90, breaks), null, "no allowance, no stretch");
});

test("the time that asks least of whoever has given way least", () => {
  st.forgetBurden();
  const offered = [{ id: "t1" }, { id: "t2" }], members = [{ id: "a" }, { id: "b" }], works = [new Set(["t2"]), new Set(["t1"])];
  const marks = [{ t1: 20 }, { t2: 15 }];
  assert.equal(st.pickStretched(offered, members, works, marks, T0).x.id, "t2", "b stretches 15 rather than a 20");
  st.noteStretch({ b: 15 }, "g1", T0);
  assert.equal(st.burdenOf("b", T0), 15);
  assert.equal(st.pickStretched(offered, members, works, marks, T0 + D).x.id, "t1", "b gave way last time: a 20 against b 15 + 15");
  assert.equal(st.pickStretched(offered, members, works, marks, T0 + D, false).x.id, "t2", "without the ledger, b again");
  assert.equal(st.burdenOf("b", T0 + 61 * D), 0, "gone after 60 days");
  assert.equal(st.pickStretched(offered, members, works, [{}, {}], T0), null, "a time someone can't make at all is never taken");
  assert.deepEqual(st.cleanMarks({ t1: 20, t9: 5, t2: 0, t3: 1.5, x: 4 }, new Set(["t1", "t2", "t3"])), { t1: 20 });
});

test("a talk with no common time agrees one with a limit stretched, and the ledger keeps it", async () => {
  st.forgetBurden();
  const venues = helpers.readVenues(), area = { x: 3, y: 5 };
  // you are free from 20:00; Ann must end by 21:00 but lets her agent stretch that by 30 minutes
  const me = { id: "you", name: "You", area, free: ["Tue 20-23"] };
  const ann = { id: "sa1", name: "Ann Stretch", area, free: ["Tue 18-23"], rules: { endBy: "21:00", stretch: { endBy: 30 } }, rulesComplete: true, sports: ["badminton"] };
  const r = await a2a.negotiate({ me, members: [ann], venues, format: "singles", sport: "badminton", minutes: 90, now: new Date(T0) });
  assert.ok(r.agreed, r.reason);
  assert.deepEqual(r.agreed.stretch, { sa1: 30 });
  assert.equal(r.agreed.start, "20:00");
  assert.equal(st.burdenOf("sa1", T0), 30);
  // and off, the talk ends as before
  process.env.A2A_STRETCH = "off";
  try {
    const r2 = await a2a.negotiate({ me, members: [ann], venues, format: "singles", sport: "badminton", minutes: 90, now: new Date(T0 + 7 * D) });
    assert.equal(r2.agreed, null);
  } finally { delete process.env.A2A_STRETCH; }
});

test("the marks and the second round fit the A2A schemas", () => {
  assert.deepEqual(validate(DECISION, { intent: "decline", works: [], stretch: { t1: 30 }, tier: "rules" }), []);
  assert.deepEqual(validate(DECISION, { intent: "counter", date: "2026-11-03", start: "19:00", tier: "agree", confidence: 0.6 }), [], "the agree and early tiers are A2A answers too");
  assert.notDeepEqual(validate(DECISION, { intent: "decline", stretch: { t1: 0 } }), []);
  const o = { id: "t1", date: "2026-11-03", start: "20:30", venue: "riverside", court: 1 };
  assert.deepEqual(validate(PROPOSAL, { kind: "serve.proposal", sport: "badminton", format: "singles", proposal: o, choices: [o], stretch: true }), []);
});
