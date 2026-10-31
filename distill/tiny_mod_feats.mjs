// The tiny prefilter's inputs for each synthetic comment (agent/src/feed/tiny_text.js, the code the feed runs): the rule
// that sends it onward if any, its hashed n-gram indices, and the facts the doubt model reads (all but the last, which
// needs the trained weights and is computed by distill/tiny_mod.py from the same indices).
//   node distill/tiny_mod_feats.mjs items.jsonl out.jsonl
import fs from "node:fs";
import { hardRule, features, textFacts, DIM } from "../agent/src/feed/tiny_text.js";

const [IN, OUT] = process.argv.slice(2);
const zero = new Int8Array(DIM);
const rows = fs.readFileSync(IN, "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((x) => {
  const idx = features(x.text);
  return JSON.stringify({ id: x.id, rule: hardRule(x.text), idx, facts: textFacts(x.text, idx, zero).slice(0, -1) });
});
fs.writeFileSync(OUT, rows.join("\n") + "\n");
console.log(rows.length, "rows, dim", DIM);
