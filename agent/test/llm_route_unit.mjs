// Unit tests for routing by length (src/core/llm.js tierOf, LLM_ROUTE): a short call to our 1B, a longer one to Muse
// Glimmer, a very long one to the Meta Model API, and a 1B reply that does not fit asked again of Glimmer. Stand-ins
// for Ollama (/api/chat) and for the Meta Model API (/v1/chat/completions) on one local port: no model, no network.
//   node --test test/llm_route_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

// what each model was asked, in order; `bad` models answer with JSON that does not fit the schema
const asked = [];
let bad = new Set();
const srv = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const j = JSON.parse(b || "{}"), out = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    asked.push({ url: req.url, model: j.model, think: j.think, images: (j.messages || []).some((m) => m.images?.length), auth: req.headers.authorization || null });
    const content = bad.has(j.model) ? JSON.stringify({ wrong: 1 }) : JSON.stringify({ caption: `from ${j.model}` });
    if (req.url === "/v1/chat/completions") return out({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 20 } });
    out({ model: j.model, message: { role: "assistant", content }, done: true, done_reason: "stop", prompt_eval_count: 100, eval_count: 20, eval_duration: 1e8 });
  });
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const port = srv.address().port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-route-"));
Object.assign(process.env, { LLM_URL: `http://127.0.0.1:${port}/v1`, LLM_MODEL: "muse-glimmer", LLM_FALLBACK_URL: `http://127.0.0.1:${port}/v1`, META_API_KEY: "test-key", LLM_SMALL_MAX: "200", LLM_LONG_MIN: "2000", LLM_SMALL_SITES: "social.caption",
  LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl` });
const { chatJSON, chat, tierOf, tokensOf } = await import("../src/core/llm.js");
test.after(() => srv.close());

const SCHEMA = { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false };
const msgs = (chars, extra = {}) => [{ role: "system", content: "Write a caption." }, { role: "user", content: "x".repeat(chars), ...extra }];
const reset = () => { asked.length = 0; bad = new Set(); };

test("the tiers by length: short to the 1B (at a checked site), longer to Glimmer, very long to the API", () => {
  assert.equal(tierOf(msgs(300), { site: "social.caption" }), "small");
  assert.equal(tierOf(msgs(300), { site: "feed.standard" }), "local", "a site not checked with the 1B");
  assert.equal(tierOf(msgs(2000), { site: "social.caption" }), "local");
  assert.equal(tierOf(msgs(9000)), "api", "very long goes to the API from any site");
  assert.equal(tokensOf([{ role: "user", content: "x".repeat(700) }]), 200, "3.5 characters a token");
  assert.equal(tierOf(msgs(300, { images: ["iVBORw0"] }), { site: "social.caption" }), "local", "the 1B reads text only");
  assert.equal(tierOf(msgs(300), { site: "social.caption", tools: true }), "local", "a tool loop never goes to the 1B");
  assert.equal(tierOf(msgs(9000), { tools: true }), "api");
});

test("a short call is answered by the 1B, with no reasoning", async () => {
  reset();
  const r = await chatJSON(msgs(300), SCHEMA, { site: "social.caption" });
  assert.equal(r.value.caption, "from serve-1b");
  assert.equal(asked.length, 1); assert.equal(asked[0].model, "serve-1b"); assert.equal(asked[0].think, false);
});

test("a 1B reply that does not fit is asked again of Glimmer", async () => {
  reset(); bad = new Set(["serve-1b"]);
  const r = await chatJSON(msgs(300), SCHEMA, { site: "social.caption" });
  assert.equal(r.value.caption, "from muse-glimmer");
  assert.deepEqual(asked.map((a) => a.model), ["serve-1b", "muse-glimmer"]);
});

test("longer calls go to Glimmer; very long ones to the Meta Model API with its key", async () => {
  reset();
  assert.equal((await chatJSON(msgs(2000), SCHEMA, { site: "feed.photo" })).value.caption, "from muse-glimmer");
  assert.equal((await chatJSON(msgs(9000), SCHEMA, { site: "autopilot.week" })).value.caption, "from muse-spark-1.3");
  assert.equal(asked[1].url, "/v1/chat/completions"); assert.equal(asked[1].auth, "Bearer test-key");
});

test("LLM_ROUTE=off: everything to Glimmer, as before", async () => {
  reset(); process.env.LLM_ROUTE = "off";
  try {
    await chat(msgs(300), { site: "social.caption" });
    await chat(msgs(9000), { site: "autopilot.week" });
    assert.deepEqual(asked.map((a) => a.model), ["muse-glimmer", "muse-glimmer"]);
  } finally { delete process.env.LLM_ROUTE; }
});
