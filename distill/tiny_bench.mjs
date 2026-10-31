// The tiny models as the gateway runs them (agent/src/agents/tiny.js, agent/src/feed/tiny_text.js): the JS answers
// checked against the trainers' own on the same cases, the weights files' sizes, and the CPU time per call.
//   node distill/tiny_bench.mjs <data dir with test/cases.jsonl> <synthetic comments .jsonl> [out.json]
import fs from "node:fs";
import { loadTimes, tinyRead } from "../agent/src/agents/tiny.js";
import { loadText, readText } from "../agent/src/feed/tiny_text.js";

const [DIR, ITEMS, OUT] = process.argv.slice(2);
const read = (f) => fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const kb = (u) => +(fs.statSync(u).size / 1024).toFixed(1);
const res = {};

// times: the test set's choices, as the gateway would ask them
const net = loadTimes(), cases = read(`${DIR}/test/cases.jsonl`).filter((c) => c.kind === "judge");
const ask = (c) => { const cur = c.offers.find((x) => x.id === c.cur); return [c.member, cur, c.offers.filter((x) => c.works.includes(x.id)), c.offers, { minutes: c.minutes, why: c.curBad || "" }]; };
let worst = 0;
for (const k of net.check) { const c = cases.find((x) => x.id === k.id); const r = tinyRead(...ask(c)); worst = Math.max(worst, Math.abs(r.top - k.top), Math.abs(r.doubt - k.doubt)); }
for (let i = 0; i < 200; i++) tinyRead(...ask(cases[i % cases.length])); // warm
const ms = cases.map((c) => { const a = ask(c), t0 = process.hrtime.bigint(); tinyRead(...a); return Number(process.hrtime.bigint() - t0) / 1e6; });
res.times = { file_kb: kb(new URL("../agent/src/agents/tiny_times.json", import.meta.url)), parity_max_abs_diff: +worst.toExponential(2), calls: ms.length,
  ms_p50: +pct(ms, 0.5).toFixed(4), ms_p95: +pct(ms, 0.95).toFixed(4), ms_max: +Math.max(...ms).toFixed(3) };

// the feed's prefilter: every synthetic comment
const textFile = new URL("../agent/src/feed/tiny_text.json", import.meta.url);
if (fs.existsSync(textFile)) {
  const T = loadText(), items = read(ITEMS);
  let wrong = 0;
  for (const k of T.model.check) { const r = readText(k.text); if (r.pass !== k.pass || (k.doubt != null && Math.abs(r.p - k.p) > 1e-4)) wrong++; }
  for (let i = 0; i < 300; i++) readText(items[i % items.length].text);
  const tm = items.map((x) => { const t0 = process.hrtime.bigint(); readText(x.text); return Number(process.hrtime.bigint() - t0) / 1e6; });
  res.text = { file_kb: kb(textFile), weights_kb: +(T.weights.length / 1024).toFixed(1), parity_mismatches: wrong, of: T.model.check.length, calls: tm.length,
    ms_p50: +pct(tm, 0.5).toFixed(4), ms_p95: +pct(tm, 0.95).toFixed(4), ms_max: +Math.max(...tm).toFixed(3) };
}
res.cpu = `${(await import("node:os")).cpus()[0].model}, node ${process.version}, one thread`;
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
