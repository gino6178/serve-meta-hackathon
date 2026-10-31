// More from Muse Glimmer on cases already built (distill/cases.mjs or decider_cases.mjs form), for the decision model's
// soft labels, rationale and active selection. Two modes, both resumable, both writing beside the case file and never
// over the original teacher.jsonl:
//   full     Glimmer's reasoned answer, as the gateway asks it (talk.js answerMessages: the same system prompt, the
//            member's times that work in the case's order, reply checked against MEMBER_REPLY, think "low", a 900-token reasoning
//            budget, temperature 0.3), with its reasoning text kept (Ollama returns it beside the reply):
//            teacher_more.jsonl, rows in teacher.jsonl's form plus "thinking".
//   decider  the one-token decider's letter distribution (agents/decider.js decisionPrompt, the default "habits"
//            prompt, raw, one token at temperature 0, top 20 log probabilities), read in several orders of the times
//            (as listed, reversed, and seeded shuffles), each letter matched back to its time id: decider_dist.jsonl.
//            The letter distribution leans hard on position, so the orders are averaged before it is used.
//   node distill/glimmer_more.mjs full <dir> <samples> <first sample index> [ids file] [par=32]
//   node distill/glimmer_more.mjs decider <dir> [orders=4] [ids file or -] [par=32]
//   OLLAMA (default http://127.0.0.1:11434), MODEL (default muse-glimmer)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [MODE, DIR, A, B, IDS, PAR_] = process.argv.slice(2);
for (const [k, v] of Object.entries({ A2A_LEASE: "off", A2A_TRANSPORT: "local", BOOKINGS_FILE: "/tmp/gm_bookings.json", A2A_FILE: "/tmp/gm_a2a.json", NEGOTIATIONS_FILE: "/tmp/gm_neg.json",
  TRACE_FILE: "/tmp/gm_traces.jsonl", LEDGER_FILE: "/tmp/gm_ledger.jsonl" })) process.env[k] ||= v;
if (!fs.existsSync("/tmp/gm_bookings.json")) fs.writeFileSync("/tmp/gm_bookings.json", JSON.stringify({ bookings: [], leases: [] }));
const { answerMessages, deciderQuestion } = await import("../agent/src/a2a/talk.js");
const { decisionPrompt, readOptions } = await import("../agent/src/agents/decider.js");
const { MEMBER_REPLY, validate } = await import("../agent/src/core/schema.js");
const { asChoices } = await import("./cases.mjs");
// no header or body time limit in fetch itself (a long answer queued behind many others can take more than undici's five
// minutes); each call still has its own limit below
try { const { createRequire } = await import("node:module"); const { setGlobalDispatcher, Agent } = createRequire(new URL("../agent/package.json", import.meta.url))("undici"); setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 })); }
catch { console.log("fetch: undici's default limits (npm install undici in agent/ to lift them)"); }
const OLLAMA = process.env.OLLAMA || "http://127.0.0.1:11434", MODEL = process.env.MODEL || "muse-glimmer";

const cases = fs.readFileSync(path.join(DIR, "cases.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((c) => c.kind === "judge");
const want = MODE === "full" && IDS ? new Set(fs.readFileSync(IDS, "utf8").split(/\s+/).filter(Boolean)) : null;
const todoCases = want ? cases.filter((c) => want.has(c.id)) : cases;
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const first = (n) => n.split(" ")[0];
// the case's facts as fullAnswer has them once code has kept the member's rules: the times that work, in the case's order
function facts(c) {
  const all = asChoices(c), cur = all.find((x) => x.id === c.cur), works = new Set(c.works);
  return { m: c.member, cur, choices: all.filter((x) => works.has(x.id) && x.id !== c.cur), why: c.curBad || "it does not fit the member's calendar or rules" };
}
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffled = (xs, seedStr) => { const r = rng(parseInt(crypto.createHash("sha256").update(seedStr).digest("hex").slice(0, 8), 16)); const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function post(url, body, ms = 900000) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

async function full(c, s) {
  const { m, cur, choices, why } = facts(c);
  const log = [{ from: "you", intent: "propose", when: cur.text, round: 0 }];
  const messages = answerMessages(m, cur, choices, log, c.format, c.sport, why);
  const t0 = Date.now();
  // (without the JSON Schema as a grammar: on this llama-server, grammar sampling runs on one CPU thread for every slot
  // and held 24 parallel answers to the speed of one; the reply is parsed from the text, which the prompt asks to be JSON
  // only, and checked against MEMBER_REPLY. GRAMMAR=1 puts it back.)
  const j = await post(`${OLLAMA}/api/chat`, { model: MODEL, messages, stream: false, think: "low", keep_alive: "24h", ...(process.env.GRAMMAR === "1" ? { format: MEMBER_REPLY } : {}), options: { num_predict: 120 + 900, temperature: 0.3, seed: crypto.randomInt(1 << 30) } });
  let v = null; try { const t = j.message?.content || ""; v = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); if (validate(MEMBER_REPLY, v).length) v = null; } catch { /* no answer */ }
  // as fullAnswer settles it: a counter must name a listed time that works; anything else is no label here
  const x = v?.intent === "counter" && choices.find((y) => y.slot.date === v.date && hm(y.start) === v.start);
  const decision = v?.intent === "decline" ? { intent: "decline", date: "", start: "" } : x ? { intent: "counter", date: v.date, start: v.start, works: v.works ?? null } : { intent: "none", raw: v };
  return { id: c.id, sample: s, kind: c.kind, decision, thinking: j.message?.thinking || "", tokens: { prompt: j.prompt_eval_count || 0, output: j.eval_count || 0 }, seconds: +((Date.now() - t0) / 1000).toFixed(2) };
}

async function decider(c, orders) {
  const { m, cur, choices, why } = facts(c);
  const views = [["listed", choices], ["reversed", [...choices].reverse()]];
  for (let k = 0; views.length < orders; k++) views.push([`shuffle${k}`, shuffled(choices, `${c.id}|${k}`)]);
  const out = {};
  for (const [name, times] of views) {
    const q = deciderQuestion(m, cur, times, why, c.format, c.sport);
    const { text, opts } = decisionPrompt(q);
    const j = await post(`${OLLAMA}/api/generate`, { model: MODEL, prompt: text, raw: true, stream: false, keep_alive: "24h", logprobs: true, top_logprobs: 20, options: { num_predict: 1, temperature: 0 } }, 120000);
    const lp = (j.logprobs || [])[0];
    const read = readOptions(lp?.top_logprobs || [], opts);
    // letters back to time ids ("decline" for Z)
    const dist = {};
    for (const o of opts) { const p = read.dist[o.id]; if (p) dist[o.x ? o.x.id : "decline"] = p; }
    out[name] = { dist, mass: read.mass, order: times.map((x) => x.id) };
  }
  return { id: c.id, views: out };
}

const PAR = +(MODE === "full" ? PAR_ || 32 : IDS || 32);
let todo = [], outFile;
if (MODE === "full") {
  const n = +A, s0 = +B; outFile = path.join(DIR, "teacher_more.jsonl");
  const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.decision.intent !== "none").map((r) => `${r.id}|${r.sample}`) : []);
  for (let s = s0; s < s0 + n; s++) for (const c of todoCases) if (!done.has(`${c.id}|${s}`)) todo.push(() => full(c, s));
} else if (MODE === "decider") {
  const orders = +(A || 4); outFile = path.join(DIR, "decider_dist.jsonl");
  const ids2 = B && B !== "-" ? new Set(fs.readFileSync(B, "utf8").split(/\s+/).filter(Boolean)) : null;
  const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
  for (const c of cases) if ((!ids2 || ids2.has(c.id)) && !done.has(c.id)) todo.push(() => decider(c, orders));
} else { console.error("mode: full | decider"); process.exit(2); }
console.log(`${MODE} ${DIR}: ${todo.length} to do`);
const out = fs.openSync(outFile, "a"), t0 = Date.now();
let k = 0, n = 0, errs = 0;
await Promise.all(Array.from({ length: PAR }, async () => {
  while (k < todo.length) {
    const f = todo[k++];
    try { fs.writeSync(out, JSON.stringify(await f()) + "\n"); } catch (e) { errs++; if (errs < 5) console.log("error", String(e.message || e).slice(0, 160), String(e.cause?.stack || e.cause || "").slice(0, 400)); }
    if (++n % 100 === 0) console.log(`${n}/${todo.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${errs} errors`);
  }
}));
console.log(`GLIMMER_MORE_DONE ${MODE} ${DIR} ${n} in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${errs} errors`);
