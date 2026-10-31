// Preloaded into a gateway or a test (node --import ../distill/text_capture.mjs) to keep Muse Glimmer's answers at
// each call site as training data for the short-text 1B (distill/text_train.py). Every Ollama /api/chat call is
// written to CAPTURE_FILE as one JSON line: the call site (from the "chat <model>" span llm.js opens, serve.site),
// the model, the messages, the JSON Schema it was constrained to, the options, and the reply. A driver can tag the
// calls one input makes (globalThis.captureTag(tag, fn)) so that the split can keep an input's source together.
// Message contents are written here and nowhere else; the file is health data like the store, and stays on the server.
import fs from "node:fs";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";

const FILE = process.env.CAPTURE_FILE;
const api = createRequire(`${process.cwd()}/package.json`)("@opentelemetry/api");
const tags = new AsyncLocalStorage();
globalThis.captureTag = (tag, fn) => tags.run(tag, fn);
const real = globalThis.fetch;
if (FILE) globalThis.fetch = async (url, init = {}) => {
  const res = await real(url, init);
  if (!/\/api\/chat$/.test(String(url)) || !init.body || !res.ok) return res;
  try {
    const req = JSON.parse(init.body), span = api.trace.getActiveSpan(), attrs = span?.attributes || {};
    const j = await res.clone().json();
    fs.appendFileSync(FILE, JSON.stringify({ at: Date.now(), site: attrs["serve.site"] || "unknown", tier: attrs["serve.tier"] || null, tag: tags.getStore() || null,
      model: req.model, messages: req.messages, format: req.format || null, think: req.think, options: req.options,
      reply: j.message?.content || "", thinking: (j.message?.thinking || "").length, done: j.done_reason, prompt_tokens: j.prompt_eval_count, output_tokens: j.eval_count }) + "\n");
  } catch { /* capture never stops the call */ }
  return res;
};
