// Unit tests for early exit from the full answer's reasoning (src/agents/early.js, A2A_EARLY=on), on a stand-in for
// Ollama that streams /api/chat's reasoning a paragraph at a time and answers /api/generate with the next token's
// probabilities: no model, no GPU.
//   node --test test/early_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

// the stand-in: the reasoning comes in PARAS paragraphs, 60 ms apart, then the reply; `sureAfter` paragraphs read, the
// next token is sure of B (else it leans to A); what was asked, and how far the stream got, is kept
const PARAS = 8, seen = { generate: [], sent: 0, closed: false };
let sureAfter = Infinity;
const reply = { intent: "counter", date: "2026-11-03", start: "19:00", works: ["t2", "t3"] };
const srv = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", async () => {
    const j = JSON.parse(b || "{}");
    if (req.url === "/api/generate") {
      seen.generate.push(j.prompt);
      const read = (j.prompt.match(/Paragraph \d+/g) || []).length;
      const top = read >= sureAfter ? [[" B", 0.99], [" A", 0.01]] : [[" A", 0.55], [" B", 0.45]];
      const lp = top.map(([token, p]) => ({ token, logprob: Math.log(p) }));
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ response: lp[0].token, done: true, prompt_eval_count: 300, eval_count: 1, logprobs: [{ ...lp[0], top_logprobs: lp }] }));
    }
    res.writeHead(200, { "content-type": "application/x-ndjson" });
    seen.sent = 0; seen.closed = false;
    res.on("close", () => { seen.closed = true; });
    for (let i = 1; i <= PARAS && !seen.closed; i++) {
      res.write(JSON.stringify({ message: { role: "assistant", thinking: `Paragraph ${i}: weighing the times.\n\n` }, done: false }) + "\n");
      seen.sent = i;
      await new Promise((ok) => setTimeout(ok, 60));
    }
    if (seen.closed) return;
    res.write(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(reply) }, done: false }) + "\n");
    res.end(JSON.stringify({ message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 400, eval_count: 300 }) + "\n");
  });
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-early-"));
Object.assign(process.env, { A2A_TINY: "off", A2A_STUDENT: "off", A2A_DECIDER: "off", A2A_EARLY: "on", A2A_EARLY_FROM: "0", LLM_URL: `http://127.0.0.1:${srv.address().port}/v1`, LLM_MODEL: "muse-glimmer", BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`,
  NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, A2A_LEASE: "off" });
const { fullAnswer } = await import("../src/a2a/talk.js");
const { withNotes } = await import("../src/agents/decider.js");
test.after(() => srv.close());

// a member who doesn't play Mondays, asked for a Monday; Tuesday 19:00 (t2) and Wednesday 19:00 (t3) keep the rule
const m = { id: "s1", name: "Mira Okafor", agent: "A simulated member. Mira doesn't play on Fridays.", rules: { noDays: ["Mon"] }, rulesComplete: true, free: ["Mon 18-22", "Tue 18-22", "Wed 18-22"], area: { x: 3, y: 4.9 } };
const time = (id, date, day, start) => ({ id, slot: { date, day }, start, text: `${day} ${start / 60}:00 at Riverside` });
const cur = time("t1", "2026-11-02", "Mon", 1140), times = [cur, time("t2", "2026-11-03", "Tue", 1140), time("t3", "2026-11-04", "Wed", 1140)];

test("a read that is sure part way through stops the answer: its pick is the counter, and the stream is cut off", async () => {
  sureAfter = 3; seen.generate = [];
  const j = await fullAnswer(m, cur, times, [], "singles", "badminton", 90);
  assert.equal(j.tier, "early");
  assert.equal(j.intent, "counter"); assert.equal(j.date, "2026-11-04"); assert.equal(j.start, "19:00", "B is the second time that works: Wednesday");
  assert.ok(j.confidence >= 0.98);
  assert.deepEqual(j.works, ["t2", "t3"], "the times that work are code's");
  await new Promise((ok) => setTimeout(ok, 100));
  assert.ok(seen.sent < PARAS, `the stream stopped after ${seen.sent} of ${PARAS} paragraphs`);
  assert.ok(seen.generate.every((p) => !/Paragraph 1:/.test(p) || /thought it over/.test(p)), "the reasoning goes in as the agent's own thoughts");
});

test("no sure read: the full answer streams to its end and is used as it came", async () => {
  sureAfter = Infinity; seen.generate = [];
  const j = await fullAnswer(m, cur, times, [], "singles", "badminton", 90);
  assert.equal(j.tier, "agent");
  assert.equal(j.date, "2026-11-03"); assert.equal(j.start, "19:00");
  assert.equal(seen.sent, PARAS);
  assert.ok(seen.generate.length >= 1, "it read the options at the breaks");
});

test("A2A_EARLY off: no stream and no reads", async () => {
  process.env.A2A_EARLY = "off"; seen.generate = [];
  try {
    const j = await fullAnswer(m, cur, times, [], "singles", "badminton", 90);
    assert.notEqual(j.tier, "early");
    assert.equal(seen.generate.length, 0);
  } finally { process.env.A2A_EARLY = "on"; }
});

test("the notes go in before the cue, and an empty note leaves the prompt as it was", () => {
  assert.equal(withNotes("facts\nThe time Mira likes best is option", "Mira", "  "), "facts\nThe time Mira likes best is option");
  assert.equal(withNotes("facts\nThe time Mira likes best is option", "Mira", "I think Wednesday."), "facts\nMira's agent has thought it over:\nI think Wednesday.\nThe time Mira likes best is option");
});
