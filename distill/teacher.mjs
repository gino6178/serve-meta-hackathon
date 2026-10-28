// Teacher data for the decision model: Muse Glimmer answering member decisions through the real a2a.js fullAnswer
// (the same prompt, schema, reasoning level, temperature and budget as the gateway), on cases from jev/cases.mjs.
// Each case is asked `samples` times (at the gateway's temperature, 0.3), so the labels are a distribution over the
// options, and how often Glimmer agrees with itself is measured too. Done answers are kept, so a run can be resumed.
//   node distill/teacher.mjs <dir> <seed> <n> <popSeed> [samples=2] [par=24] [popSize=2000]
//   LLM_URL (default http://127.0.0.1:11434/v1), LLM_MODEL (default muse-glimmer)
import fs from "node:fs";
import path from "node:path";

const [DIR = "jev/data/train", SEED = "1", N = "100", POP = "11", SAMPLES = "2", PAR = "24", POPSIZE = "2000"] = process.argv.slice(2);
fs.mkdirSync(DIR, { recursive: true });
const abs = (f) => path.resolve(DIR, f);
if (!fs.existsSync(abs("bookings.json"))) fs.writeFileSync(abs("bookings.json"), JSON.stringify({ bookings: [], leases: [] }));
// (the time limits are raised: with many answers at once on one GPU an answer takes minutes, and a cut-off answer
// is no label; they change nothing else in the call)
for (const [k, v] of Object.entries({ A2A_LEASE: "off", A2A_TRANSPORT: "local", BOOKINGS_FILE: abs("bookings.json"), A2A_FILE: abs("a2a.json"), NEGOTIATIONS_FILE: abs("negotiations.json"),
  TRACE_FILE: abs("traces.jsonl"), LEDGER_FILE: abs("ledger.jsonl"), LLM_SLOTS: PAR, LLM_URL: "http://127.0.0.1:11434/v1", LLM_MODEL: "muse-glimmer",
  LLM_TIMEOUT_MS: "900000", A2A_TIMEOUT_MS: "1900000" })) process.env[k] ||= v;
const { buildCases, askedCases, asChoices } = await import("./cases.mjs");
// no header or body time limit in fetch itself (undici's own is five minutes, and a call queued behind many others on
// one GPU can take longer): llm.js's own time limit still applies
try { const { createRequire } = await import("node:module"); const { setGlobalDispatcher, Agent } = createRequire(new URL("../agent/package.json", import.meta.url))("undici"); setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 })); console.log("fetch: no header or body time limit"); }
catch { console.log("fetch: undici's default limits (npm install undici in agent/ to lift them)"); }
const { fullAnswer } = await import("../agent/src/a2a/talk.js");
const ledger = await import("../agent/src/core/ledger.js");

const casesFile = abs("cases.jsonl"), outFile = abs("teacher.jsonl");
let cases;
if (fs.existsSync(casesFile)) cases = fs.readFileSync(casesFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
else { cases = process.env.JEV_ASKED === "1" ? askedCases({ seed: +SEED, n: +N, popSeed: +POP, popSize: +POPSIZE, variety: +(process.env.JEV_VARIETY || 0) })
  : buildCases({ seed: +SEED, n: +N, popSeed: +POP, popSize: +POPSIZE, variety: +(process.env.JEV_VARIETY || 0), demo: process.env.JEV_DEMO === "1", shared: process.env.JEV_SHARED === "1" }); fs.writeFileSync(casesFile, cases.map((c) => JSON.stringify(c)).join("\n") + "\n"); }
const kinds = {}; cases.forEach((c) => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
console.log(`${cases.length} cases`, JSON.stringify(kinds));
// an answer that never came (no decision, or the call cut off) is asked again: those rows are dropped first
if (fs.existsSync(outFile)) {
  const kept = fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).filter((l) => { const j = JSON.parse(l); return j.decision && j.decision.intent !== "none" && !j.error; });
  fs.writeFileSync(outFile, kept.length ? kept.join("\n") + "\n" : "");
}
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => { const j = JSON.parse(l); return `${j.id}|${j.sample}`; }) : []);
const todo = [];
for (let s = 0; s < +SAMPLES; s++) for (const c of cases) if (c.kind !== "none" && !done.has(`${c.id}|${s}`)) todo.push([c, s]);
console.log(`${todo.length} answers to get (${done.size} already done)`);

const t0 = Date.now(); let k = 0, n = 0;
const out = fs.openSync(outFile, "a");
await Promise.all(Array.from({ length: +PAR }, async () => {
  while (k < todo.length) {
    const [c, s] = todo[k++];
    const choices = asChoices(c), cur = choices.find((x) => x.id === c.cur);
    const log = [{ from: "you", intent: "propose", when: cur.text, round: 0 }];
    const row = await ledger.job("teacher", async (jb) => {
      const a = Date.now();
      let d = null, err = null;
      try { d = await fullAnswer(c.member, cur, choices, log, c.format, c.sport, c.minutes); } catch (e) { err = String(e.message || e).slice(0, 200); }
      const t = ledger.totals(jb.calls);
      return { id: c.id, sample: s, kind: c.kind, decision: d && { intent: d.intent, date: d.date || "", start: d.start || "", works: d.works ?? null, worksRaw: d.worksRaw ?? null, tier: d.tier }, error: err,
        tokens: { calls: t.calls, prompt: t.prompt, cached: t.cached, output: t.output, reasoning: t.reasoning, empty: t.empty }, seconds: +((Date.now() - a) / 1000).toFixed(2) };
    });
    fs.writeSync(out, JSON.stringify(row) + "\n");
    if (++n % 50 === 0) console.log(`${n}/${todo.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s (${(n / ((Date.now() - t0) / 3600000)).toFixed(0)}/h)`);
  }
}));
console.log(`TEACHER_DONE ${n} answers in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
