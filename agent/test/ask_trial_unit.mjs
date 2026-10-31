// The Match helper's daily ask under its weekly cap and the "asks first" trial (src/agents/ask.js): the cap refuses a
// further ask that week, the arm is a pure function of (player, day), and with ASK_TRIAL_P unset nothing is withheld.
// No model (the ask is worded by its template), no network.   node --test test/ask_trial_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-ask-trial-"));
Object.assign(process.env, { ASK_FILE: `${tmp}/asks.json`, BOOKINGS_FILE: `${tmp}/bookings.json`, STORE_FILE: `${tmp}/players.json`, MATCH_RECORDS_FILE: `${tmp}/records.json`, MATCH_AUDIT_FILE: `${tmp}/audit.json`,
  MATCH_STATE_FILE: `${tmp}/state.json`, MATCH_DEMO_RECORDS: "0", A2A_TRANSPORT: "local", LLM_URL: "http://127.0.0.1:9/v1", GUARD: "off", MEMORY: "off", TRACE_FILE: `${tmp}/traces.jsonl`, LEDGER_FILE: `${tmp}/ledger.jsonl` });
delete process.env.ASK_TRIAL_P; delete process.env.ASK_WEEK_CAP;
// the behaviour before the send gate (ASK_GATE=off): ask_gate_unit.mjs tests the gate with the trial and the cap
process.env.ASK_GATE = "off";
const ask = await import("../src/agents/ask.js");
const at = (d, h = 9) => new Date(2026, 10, d, h, 0); // November 2026: Mon 2, Mon 9

test("off by default: every daily ask point is in the ask arm, asked, and logged with its answer within 24 hours", async () => {
  for (let i = 0; i < 500; i++) assert.equal(ask.armOf(`p${i}`, `2026-11-${String(1 + (i % 28)).padStart(2, "0")}`), "ask");
  const r = await ask.ask({ who: "off-1", now: at(2), daily: true });
  assert.ok(r.id, JSON.stringify(r)); assert.equal(r.arm, "ask");
  const row = ask.trialLog().find((x) => x.id === r.id);
  assert.deepEqual({ who: row.who, day: row.day, p: row.p, arm: row.arm, asked: row.asked, response: row.response }, { who: "off-1", day: "2026-11-02", p: 0, arm: "ask", asked: true, response: null });
  // ids, times and choices only: no words of the ask in the log
  assert.ok(!Object.values(row).some((v) => typeof v === "string" && v.length > 40));
  await ask.answer(r.id, "week", { now: new Date(at(2).getTime() + 36e5) });
  assert.equal(ask.trialLog().find((x) => x.id === r.id).response, "week");
  // an answer after 24 hours is not the trial's response
  const late = await ask.ask({ who: "off-2", now: at(3), daily: true });
  await ask.answer(late.id, "week", { now: new Date(at(3).getTime() + 25 * 36e5) });
  assert.equal(ask.trialLog().find((x) => x.id === late.id).response, null);
});

test("the arm is deterministic in (player, day), with the chance asked for", async () => {
  assert.equal(ask.armOf("pa", "2026-11-04", 0.5), ask.armOf("pa", "2026-11-04", 0.5));
  let w = 0; const n = 4000;
  for (let i = 0; i < n; i++) w += ask.armOf(`player-${i % 200}`, `2026-11-${String(1 + Math.floor(i / 200)).padStart(2, "0")}`, 0.3) === "withhold";
  assert.ok(Math.abs(w / n - 0.3) < 0.03, `withheld ${w} of ${n}`);
  assert.equal(ask.armOf("pa", "2026-11-04", 1), "withhold"); assert.equal(ask.armOf("pa", "2026-11-04", 0), "ask");
  // with the trial on, a withheld point asks nothing, and is logged as such; the same day gives the same arm again
  process.env.ASK_TRIAL_P = "1";
  try {
    const r = await ask.ask({ who: "trial-1", now: at(4), daily: true });
    assert.equal(r.withheld, true); assert.ok(!r.id);
    const row = ask.trialLog().filter((x) => x.who === "trial-1").at(-1);
    assert.deepEqual([row.arm, row.asked, row.p, row.id], ["withhold", false, 1, null]);
    // an ask the player asked for is never withheld
    assert.ok((await ask.ask({ who: "trial-1", now: at(4) })).id);
  } finally { delete process.env.ASK_TRIAL_P; }
});

test("the weekly cap: a further daily ask that week is refused, the next week asks again", async () => {
  process.env.ASK_WEEK_CAP = "2";
  try {
    assert.ok((await ask.ask({ who: "cap-1", now: at(2), daily: true })).id);
    assert.ok((await ask.ask({ who: "cap-1", now: at(3), daily: true })).id);
    assert.equal(ask.askedThisWeek("cap-1", at(4)), 2);
    const third = await ask.ask({ who: "cap-1", now: at(4), daily: true });
    assert.equal(third.capped, true); assert.ok(!third.id);
    // a capped point is not a trial point, and the player asking still gets an answer
    assert.equal(ask.trialLog().filter((x) => x.who === "cap-1").length, 2);
    assert.ok((await ask.ask({ who: "cap-1", now: at(4) })).id);
    assert.equal(ask.askedThisWeek("cap-1", at(9)), 0);
    assert.ok((await ask.ask({ who: "cap-1", now: at(9), daily: true })).id, "a new week");
    // /forget takes the player's trial rows too
    ask.forget("cap-1"); assert.equal(ask.trialLog().filter((x) => x.who === "cap-1").length, 0);
  } finally { delete process.env.ASK_WEEK_CAP; }
  // unset, the cap is 3
  for (const d of [2, 3, 4]) assert.ok((await ask.ask({ who: "cap-2", now: at(d), daily: true })).id);
  assert.equal((await ask.ask({ who: "cap-2", now: at(5), daily: true })).capped, true, "the default cap is 3");
});
