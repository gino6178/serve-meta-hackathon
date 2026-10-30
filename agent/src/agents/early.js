// Early exit from Muse Glimmer's reasoning (A2A_EARLY; after DEER, arXiv 2504.15895): the full answer to a choice
// between times is streamed, and at each break in its reasoning (a paragraph, or 400 characters without one) the
// options' probabilities are read in one pass with the reasoning so far (decider.js decideAfter). The first read whose
// pick reaches A2A_EARLY_SURE stops the answer there: the generation is cut off and that time is the counter. Otherwise
// the full answer stands, as before. One read at a time, beside the stream (it takes a second model slot); a read still
// running when the answer ends is dropped.
// Only for the question the decider takes (the proposed time breaks a rule, two or more listed times keep them), and
// only the times code kept are options, so an early answer can't break a rule either.
// Measured on the RTX 3090 (submission/results/early_exit.json, 119 of the decider's cases): read after the fact, the
// reads become sure only late in the reasoning, so at 0.98 an answer would come 17% sooner (41.3 s to 34.5 s) and
// differ from the full one 2.5% of the time. Run for real, the reads share the GPU with the answer they read, and each
// reads the whole prompt and the reasoning again: one answer at a time on 30 cases, Glimmer wrote 34% fewer tokens
// (596 to 391) but read seven times as many (1,074 to 7,676), and the answer took as long (22.3 s off, 22.9 s on). So it
// stays off by default.
import { chatStream } from "../core/llm.js";
import { decideAfter } from "./decider.js";

export const earlyOn = () => process.env.A2A_EARLY === "on";
export const SURE = () => +(process.env.A2A_EARLY_SURE || 0.98);
const BREAK = /\n\s*\n\s*$/, EVERY = 400;

// msgs: the full answer's messages (talk.js answerMessages); q: the decider's question over the times that work.
// Returns { early: { pick, p, chars } } when a read was sure, { text } with the full answer's reply otherwise, or null
// when the server can't stream (another server than Ollama), and the caller asks as before.
export async function streamed(msgs, q, { schema, timeoutMs, site = "a2a.answer" } = {}) {
  let busy = false, at = 0, early = null, ended = false;
  const onThinking = (text, stop) => {
    if (busy || early || ended || !(BREAK.test(text) || text.length - at >= EVERY)) return;
    at = text.length; busy = true;
    decideAfter(q, text).then((r) => {
      busy = false;
      if (!ended && !early && r.pick?.x && r.p >= SURE()) { early = { pick: r.pick, p: r.p, chars: text.length }; stop(); }
    }, () => { busy = false; });
  };
  const r = await chatStream(msgs, { format: schema, maxTokens: 120, temperature: 0.3, site, timeoutMs, onThinking });
  ended = true;
  if (!r) return null;
  return early ? { early } : { text: r.text };
}
