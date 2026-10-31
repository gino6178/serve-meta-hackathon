// Labels for the feed's tiny prefilter: each synthetic comment (distill/tiny_mod_data.mjs) through the feed's own checks
// (feed/posts.js moderate), one check at a time so each verdict is kept: code (text.js personProblems), Llama Guard 3
// (guard.js screen, the feed's policy and BLOCK_POST), and the club's standard (Muse Glimmer, deps.js standard, the
// real prompt and schema). Prompt Guard 2 runs apart (distill/tiny_mod_pg.py on its CPU host) and is merged in by
// distill/tiny_mod.py. Resumable: items already labeled are kept. TINY_LABEL=guard or standard runs one model only (on
// one GPU, Ollama swapping Glimmer and Llama Guard in and out at many requests at once timed out most calls).
//   LLM_URL=<ollama>/v1 GUARD_URL=<ollama with llama-guard3:1b> node distill/tiny_mod_label.mjs items.jsonl labels.jsonl [par=8]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [IN = "mod_items.jsonl", OUT = "mod_labels.jsonl", PAR = "8"] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-tinymod-"));
Object.assign(process.env, { LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, FEED_DEMO: "off", PROMPT_GUARD: "off", GUARD_PAUSE_MS: "1" });
const { deps, guardRules } = await import("../agent/src/feed/deps.js");
const T = await import("../agent/src/feed/text.js");
const { BLOCK_POST, folded } = await import("../agent/src/feed/posts.js");
const NAMES = ["Leo Park", "Hana Chen", "Priya Nair", "Kenji Wu", "Mia Lopez", "Tom Reed", "Wei Zhang", "Sara Cohen", "Omar Haddad", "Yuki Sato", "Ana Silva", "Ben Ford", "Chloe Martin", "Raj Patel", "Lin Wang"];

const items = fs.readFileSync(IN, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const ONLY = process.env.TINY_LABEL || "";
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => (ONLY === "guard" || r.standard != null) && (ONLY === "standard" || r.llamaGuard != null)).map((r) => r.id) : []);
// in a fixed shuffled order, so a run stopped early has labeled every kind and split alike
const key = (id) => { let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// TINY_INTENT=benign labels only the comments written as benign (Glimmer's standard at about 16 a minute on one A100:
// a hostile or injected one is not fine whatever it says, so its verdict only measures the checks), the test split first
const only = process.env.TINY_INTENT;
const todo = items.filter((x) => !done.has(x.id) && (!only || x.intent === only)).sort((a, b) => (a.split === b.split ? 0 : a.split === "test" ? -1 : 1) || key(a.id) - key(b.id));
console.log(`${todo.length} to label (${done.size} done)`);
const out = fs.openSync(OUT, "a");
let k = 0, n = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: +PAR }, async () => {
  while (k < todo.length) {
    const x = todo[k++], text = x.text;
    const code = T.personProblems(text, { author: null, names: NAMES }).map((b) => b.code);
    // (a check that did not answer, a model still loading or busy, is asked again a few times)
    let g = { safe: null };
    for (let t = 0; t < 5 && g.safe == null && ONLY !== "standard"; t++) { if (t) await new Promise((ok) => setTimeout(ok, 3000 * t)); g = await deps.screen([{ role: "user", content: text }], { site: "guard.eval", timeoutMs: 60000 }); }
    const stop = guardRules.stopsIn(g, text);
    const lg = g.safe == null ? null : { safe: g.safe, categories: g.categories, blocks: !!(stop?.includes("S11") || (g.safe === false && g.categories.some((c) => BLOCK_POST.includes(c)))) };
    const a = Date.now();
    let st = { verdict: null };
    for (let t = 0; t < 3 && st.verdict == null && ONLY !== "guard"; t++) st = await deps.standard(text);
    fs.writeSync(out, JSON.stringify({ id: x.id, folded: folded(text), code, llamaGuard: lg, standard: st.verdict, standardSeconds: (Date.now() - a) / 1000 }) + "\n");
    if (++n % 100 === 0) console.log(`${n}/${todo.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}));
console.log(`LABEL_DONE ${n}`);
fs.rmSync(tmp, { recursive: true, force: true });
