// The send gate (match/gate.js) and how agents/ask.js uses it: the plan is the same for the same player and day, it
// learns the hour a player answers in, the burden stops it after unanswered asks and "not this week", its line fits on
// one line, a withheld trial day never reaches it, the arm does not change with it, and the weekly cap still holds.
// No model, no network.   node --test test/ask_gate_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-ask-gate-"));
Object.assign(process.env, { ASK_FILE: `${tmp}/asks.json`, BOOKINGS_FILE: `${tmp}/bookings.json`, STORE_FILE: `${tmp}/players.json`, MATCH_RECORDS_FILE: `${tmp}/records.json`, MATCH_AUDIT_FILE: `${tmp}/audit.json`,
  MATCH_STATE_FILE: `${tmp}/state.json`, MATCH_DEMO_RECORDS: "0", A2A_TRANSPORT: "local", LLM_URL: "http://127.0.0.1:9/v1", GUARD: "off", MEMORY: "off", TRACE_FILE: `${tmp}/traces.jsonl`, LEDGER_FILE: `${tmp}/ledger.jsonl` });
for (const k of ["ASK_TRIAL_P", "ASK_WEEK_CAP", "ASK_GATE", "ASK_GATE_HOURS", "ASK_GATE_TAU"]) delete process.env[k];
const gate = await import("../src/match/gate.js");
const ask = await import("../src/agents/ask.js");
const { run } = await import("./ask_gate_sim.mjs");
const at = (d, h = 9) => new Date(2026, 10, d, h, 0); // November 2026: Mon 2, Mon 9
const H = 36e5;
// a history of asks: sent at hour h on weekdays of October 2026, answered within an hour or not at all
const past = (h, answered, n = 12, extra = {}) => Array.from({ length: n }, (_, k) => { const t = new Date(2026, 9, 5 + k + 2 * Math.floor(k / 5), h).getTime(); return { who: "x", day: `d${k}`, at: t, sentAt: t, asked: true, arm: "ask", p: 0, response: answered ? "yes" : null, respondedAt: answered ? t + 0.5 * H : null, ...extra }; });

test("the plan is the same for the same player and day, learns the reply hour, and explains itself in one line", () => {
  const rows = [...past(19, true), ...past(10, false)], now = at(3, 8).getTime();
  const a = gate.plan({ rows, who: "x", day: "2026-11-03", now, range: [8, 21] }), b = gate.plan({ rows, who: "x", day: "2026-11-03", now, range: [8, 21] });
  assert.deepEqual(a, b);
  // over 40 days the chosen hour is near 19:00 nearly always, and the posterior says so
  let near = 0; for (let d = 0; d < 40; d++) { const p = gate.plan({ rows, who: "x", day: `day-${d}`, now, range: [8, 21], p: { ...gate.PARAMS, lambda: 0 } }); if (Math.abs(p.hour - 19) <= 2) near++; }
  assert.ok(near >= 34, `near 19:00 on ${near} of 40 days`);
  const post = gate.posterior(rows, gate.club([]), now), w = gate.window(post, false, [8, 21]);
  assert.ok(w.from >= 17 && w.to <= 21, JSON.stringify(w));
  assert.ok(!/\n/.test(a.why) && a.why.length < 260 && /answer within 2 h/.test(a.why) && /burden/.test(a.why), a.why);
  // hours already gone are not drawn
  assert.ok(gate.plan({ rows, who: "x", day: "late", now: at(3, 20).getTime(), range: [8, 21] }).hour >= 20);
  assert.equal(gate.plan({ rows, who: "x", day: "late", now: at(3, 22).getTime(), range: [8, 21] }).send, false);
});

test("the burden: grows with asks left unanswered, is large after 'not this week', and then it does not send", () => {
  const now = at(3, 8).getTime(), recent = (n, extra) => past(19, false, n).map((r, k) => ({ ...r, at: now - (k + 1) * 864e5, sentAt: now - (k + 1) * 864e5, ...extra }));
  assert.ok(gate.burden(recent(4), now).cost > gate.burden(recent(1), now).cost);
  assert.equal(gate.burden(recent(3), now).unanswered, 3);
  const muted = [{ ...recent(1)[0], response: "week", respondedAt: now - 864e5 + H }];
  assert.ok(gate.burden(muted, now).notThisWeek);
  // a player who left six recent asks unanswered and said not this week is asked on few of 40 days; one who answered
  // the same six asks within the hour, on most (the same draws: only the burden and the answers differ)
  const rows = [...recent(6), ...muted], answered = recent(6, { response: "yes" }).map((r) => ({ ...r, respondedAt: r.sentAt + 0.5 * H }));
  let quiet = 0, keen = 0;
  for (let d = 0; d < 40; d++) { quiet += gate.plan({ rows, who: "y", day: `d${d}`, now, range: [8, 21] }).send; keen += gate.plan({ rows: answered, who: "y", day: `d${d}`, now, range: [8, 21] }).send; }
  assert.ok(quiet <= 6 && keen >= 30, `asked on ${quiet} and ${keen} of 40 days`);
  // asks under 2 hours old are not counted yet, either way
  assert.equal(gate.burden([{ ...recent(1)[0], sentAt: now - H, at: now - H }], now).unanswered, 0);
});

test("in agents/ask.js: the gate plans the day once, waits for its hour, logs its line; a withheld day never reaches it", async () => {
  process.env.ASK_GATE_HOURS = "8-21"; process.env.ASK_GATE_TAU = "-1";
  try {
    const first = await ask.ask({ who: "g-1", now: at(2, 8), daily: true });
    const row = ask.trialLog().find((x) => x.who === "g-1" && x.day === "2026-11-02");
    assert.ok(row?.gate?.why && row.gate.send, JSON.stringify(row));
    if (row.gate.hour > 8) {
      assert.equal(first.later, true); assert.equal(row.asked, false);
      // an hour before its hour: still waiting; at its hour: asked, with the gate's line
      if (row.gate.hour > 9) assert.equal((await ask.ask({ who: "g-1", now: at(2, row.gate.hour - 1), daily: true })).later, true);
      const sent = await ask.ask({ who: "g-1", now: at(2, row.gate.hour), daily: true });
      assert.ok(sent.id, JSON.stringify(sent)); assert.equal(sent.why, row.gate.why);
    } else assert.ok(first.id);
    assert.equal(ask.trialLog().filter((x) => x.who === "g-1").length, 1, "one point a day");
    assert.equal(row.asked, true); assert.ok(row.sentAt >= row.at);
    // the day is settled: no second daily ask
    assert.equal((await ask.ask({ who: "g-1", now: at(2, 21), daily: true })).settled, true);
    // the trial's arm is drawn before the gate and the same with the gate on or off
    for (let i = 0; i < 200; i++) { const day = `2026-11-${String(1 + (i % 28)).padStart(2, "0")}`; process.env.ASK_GATE = "off"; const a = ask.armOf(`q${i}`, day, 0.4); delete process.env.ASK_GATE; assert.equal(ask.armOf(`q${i}`, day, 0.4), a); }
    process.env.ASK_TRIAL_P = "1";
    const w = await ask.ask({ who: "g-2", now: at(3, 8), daily: true });
    assert.equal(w.withheld, true);
    const wr = ask.trialLog().find((x) => x.who === "g-2");
    assert.deepEqual([wr.arm, wr.asked, wr.gate], ["withhold", false, undefined]);
    assert.equal((await ask.ask({ who: "g-2", now: at(3, 12), daily: true })).settled, true, "withheld all day");
  } finally { delete process.env.ASK_TRIAL_P; delete process.env.ASK_GATE_TAU; delete process.env.ASK_GATE_HOURS; }
});

test("a day the gate passes on is in the ask arm, asked false; the weekly cap still holds with the gate", async () => {
  process.env.ASK_GATE_TAU = "5"; // a bar no value reaches
  try {
    const r = await ask.ask({ who: "g-3", now: at(4, 9), daily: true });
    assert.equal(r.gated, true); assert.ok(r.why.startsWith("not asking today"));
    const row = ask.trialLog().find((x) => x.who === "g-3");
    assert.deepEqual([row.arm, row.asked, row.gate.send], ["ask", false, false]);
    assert.equal((await ask.ask({ who: "g-3", now: at(4, 15), daily: true })).settled, true);
    assert.equal(ask.askedThisWeek("g-3", at(4)), 0, "a passed day does not count toward the cap");
  } finally { delete process.env.ASK_GATE_TAU; }
  process.env.ASK_GATE_TAU = "-1"; process.env.ASK_GATE_HOURS = "9-9"; process.env.ASK_WEEK_CAP = "2";
  try {
    for (const d of [2, 3]) assert.ok((await ask.ask({ who: "g-4", now: at(d, 9), daily: true })).id);
    assert.equal((await ask.ask({ who: "g-4", now: at(4, 9), daily: true })).capped, true);
  } finally { delete process.env.ASK_GATE_TAU; delete process.env.ASK_GATE_HOURS; delete process.env.ASK_WEEK_CAP; }
  // ASK_GATE=off: asked at once, as before
  process.env.ASK_GATE = "off";
  try { const r = await ask.ask({ who: "g-5", now: at(2, 9), daily: true }); assert.ok(r.id); assert.equal(r.why, undefined); } finally { delete process.env.ASK_GATE; }
});

test("the simulation runs and keeps its invariants (cap 3 a week: at most 36 asks in 12 weeks)", () => {
  const r = run(9, "gate", { n: 20 }), c = run(9, "fixed", { n: 20, hour: 12 });
  for (const x of [r, c]) { assert.ok(x.asks <= 36 && x.fast <= x.answered && x.yes <= x.answered && x.games <= x.yes && x.optOuts <= 1, JSON.stringify(x)); }
  assert.deepEqual(run(9, "gate", { n: 20 }), r, "seeded");
});
