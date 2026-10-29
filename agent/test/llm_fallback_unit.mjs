// The fallback to Muse Spark (core/llm.js, LLM_FALLBACK=on): when the model server can't be reached, the same call goes
// once to the Meta Model API, in its protocol. A stand-in for the API checks what it is sent; no network, no key.
//   node --test test/llm_fallback_unit.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const seen = [];
const api = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const body = JSON.parse(b);
    seen.push({ auth: req.headers.authorization, path: req.url, body });
    const tools = !!body.tools;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ finish_reason: tools ? "tool_calls" : "stop", message: tools
      ? { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "get_week", arguments: "{}" } }] }
      : { role: "assistant", content: "Thursday 19:00 works." } }], usage: { prompt_tokens: 40, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 22 } } }));
  });
});
await new Promise((ok) => api.listen(0, "127.0.0.1", ok));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-fallback-"));
Object.assign(process.env, { LLM_URL: "http://127.0.0.1:9/v1", LLM_FALLBACK: "on", META_API_KEY: "test-key", LLM_FALLBACK_URL: `http://127.0.0.1:${api.address().port}/v1`,
  LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl` });
delete process.env.MODEL_API_KEY; delete process.env.LLM_API_KEY;
const llm = await import("../src/core/llm.js");
after(() => api.close());

test("a chat the model server can't take goes to Muse Spark, in its protocol, and the ledger says so", async () => {
  assert.ok(llm.fallbackOn());
  const r = await llm.chat([{ role: "user", content: "When can I play?" }], { maxTokens: 50, site: "unit.fallback" });
  assert.equal(r.text, "Thursday 19:00 works.");
  assert.ok(r.fallback);
  const s = seen.at(-1);
  assert.equal(s.auth, "Bearer test-key");
  assert.equal(s.path, "/v1/chat/completions");
  assert.equal(s.body.model, "muse-spark-1.3");
  assert.equal(s.body.reasoning_effort, "low", "Muse Spark always reasons: the lowest effort, never none");
  assert.ok(s.body.max_completion_tokens >= 50 + 600, "room for its reasoning on top of the reply");
  const row = fs.readFileSync(process.env.LEDGER_FILE, "utf8").trim().split("\n").map((l) => JSON.parse(l)).find((x) => x.site === "unit.fallback");
  assert.equal(row.model, "muse-spark-1.3"); assert.ok(row.fallback); assert.equal(row.reasoning, 22);
});

test("a tool turn mid-run: Ollama's tool calls get ids and each result the id of its call", async () => {
  const tools = [{ type: "function", function: { name: "get_week", parameters: { type: "object", properties: {} } } }];
  const history = [{ role: "user", content: "Plan my week" },
    { role: "assistant", content: "", tool_calls: [{ function: { name: "get_week", arguments: {} } }, { function: { name: "check_body", arguments: { why: "x" } } }] },
    { role: "tool", content: "{\"week\":1}", tool_name: "get_week" }, { role: "tool", content: "{\"sore\":[]}", tool_name: "check_body" }];
  const out = await llm.chatTools(history, tools, { site: "unit.fallback.tools" });
  assert.ok(out.fallback);
  assert.deepEqual(out.calls.map((c) => c.name), ["get_week"]);
  const m = seen.at(-1).body.messages;
  assert.equal(typeof m[1].tool_calls[1].function.arguments, "string");
  assert.deepEqual(m.slice(2).map((x) => x.tool_call_id), m[1].tool_calls.map((c) => c.id));
  assert.ok(m.slice(2).every((x) => !("tool_name" in x)));
});
