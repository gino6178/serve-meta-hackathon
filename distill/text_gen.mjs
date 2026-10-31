// Muse Glimmer's answers at the short call sites, through each site's real code (distill/text_inputs.mjs makes the
// inputs). Run from agent/ with the capture preloaded and routing off, so every call goes to Glimmer:
//   CAPTURE_FILE=../data/glimmer.jsonl LLM_ROUTE=off LLM_SLOTS=2 node --import ../distill/text_capture.mjs ../distill/text_gen.mjs \
//     --out ../data/results.jsonl [--only site,site] [--limit N] [--conc 2] [--shard i/n] [--thin site=share,...]
// Each input's calls are tagged with its index; what the site's code made of them (the verdict it kept, the reasons
// that passed its checks, the answer it sent) goes to --out, for the dataset to keep only what the code accepted.
// The feed's standard is also put to Llama Guard 3, whose verdict goes beside Glimmer's.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inputs } from "./text_inputs.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("out", "../data/results.jsonl"), ONLY = arg("only", ""), LIMIT = +arg("limit", 0), CONC = +arg("conc", 2), [SHARD, SHARDS] = arg("shard", "0/1").split("/").map(Number);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-text1b-"));
Object.assign(process.env, { STORE_FILE: `${tmp}/players.json`, FEED_FILE: `${tmp}/feed.json`, LOOP_FLAGS_FILE: `${tmp}/flags.json`, LOOP_HISTORY_FILE: `${tmp}/history.json`, LOOP_NOTES_FILE: `${tmp}/notes.json` });
const life = await import("../agent/src/club/life.js");
const answer = await import("../agent/src/agents/answer.js");
const signals = await import("../agent/src/loop/signals.js");
const memup = await import("../agent/src/memory/memory_update.js");
const { deps } = await import("../agent/src/feed/deps.js");
const places = await import("../agent/src/club/places.js");
const body = await import("../agent/src/body/body.js");
const store = await import("../agent/src/core/store.js");
const guard = await import("../agent/src/safety/guard.js");

const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).tag) : []);
let all = inputs().map((x, i) => ({ ...x, tag: `i${i}` }));
if (ONLY) all = all.filter((x) => ONLY.split(",").includes(x.site));
if (LIMIT) all = all.slice(0, LIMIT);
all = all.filter((x) => +x.tag.slice(1) % SHARDS === SHARD);
// (--thin site=0.6,...: keep that share of a site's inputs, the same ones on every run, when labelling has to be cut short)
const THIN = Object.fromEntries(arg("thin", "").split(",").filter(Boolean).map((kv) => kv.split("=")).map(([k, v]) => [k, +v]));
all = all.filter((x) => !(x.site in THIN) || ((+x.tag.slice(1) * 2654435761) % 4294967296) / 4294967296 < THIN[x.site]); // (--shard i/n: one of n processes, each on its own model server)
const todo = all.filter((x) => !done.has(x.tag));
console.log(`${todo.length} inputs to run (${all.length - todo.length} done)`);

async function run(x) {
  switch (x.site) {
    case "life.read": return life.read(x.input, new Date(x.now));
    case "answer.learn": { const id = `p-${x.tag}`; store.link(id, "Alex"); const r = await answer.learn(id, x.input); store.forget(id); return r; }
    case "loop.paraphrase": return signals.paraphrase(x.input);
    case "memory.update": {
      const at = Date.parse("2026-11-04T12:00");
      return memup.decide({ text: x.input, at }, x.cands.map((c, k) => ({ id: `m${k}`, text: c.text, at: at - c.daysAgo * 864e5, about: memup.people(c.text), cos: c.cos })), { venues: ["Riverside Hall", "Northside Courts", "Eastgate Park"] });
    }
    case "feed.standard": { const [s, g] = await Promise.all([deps.standard(x.input), guard.screen([{ role: "user", content: x.input }], { site: "text1b.guard" }).catch(() => null)]); return { ...s, guard: g ? { safe: g.safe, categories: g.categories || g.category || null } : null }; }
    case "places.judge": { const { p, sport, date, start, w } = x.input; return { ...(await places.judge(structuredClone(p), sport, date, start, w)), rules: places.rules(p, sport, start, w).verdict }; }
    case "body.summary": return body.summary(x.input);
    case "answer": {
      const id = `a-${x.tag}`, s = x.player;
      store.link(id, "Alex");
      store.update(id, (q) => { q.events = s.events; q.logs = s.logs; q.games = s.games; q.memories = s.memories.map((text) => ({ text, at: Date.now(), source: "chat" })); q.prefs.goal = { perWeek: s.goal }; });
      const r = await answer.answer({ text: x.input, playerId: id, now: new Date(`2026-11-0${1 + (+x.tag.slice(1) % 4)}T10:00`) });
      store.forget(id);
      return r;
    }
  }
  throw new Error(`no driver for ${x.site}`);
}

let k = 0, ok = 0, t0 = Date.now();
await Promise.all(Array.from({ length: CONC }, async () => {
  while (k < todo.length) {
    const x = todo[k++];
    let result = null, error = null;
    try { result = await globalThis.captureTag(x.tag, () => run(x)); ok++; } catch (e) { error = String(e?.message || e).slice(0, 200); }
    fs.appendFileSync(OUT, JSON.stringify({ tag: x.tag, site: x.site, source: x.source, input: x.input, ...(x.cands ? { cands: x.cands } : {}), ...(x.player ? { player: x.player } : {}), ...(x.now ? { now: x.now } : {}), result, error }) + "\n");
    if (k % 25 === 0) console.log(`${k}/${todo.length} ${ok} ok, ${((Date.now() - t0) / k / 1000).toFixed(1)} s each`);
  }
}));
console.log(`TEXTGEN_DONE ${ok}/${todo.length}`);
process.exit(0);
