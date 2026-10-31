// The tiny time model's rows for the teacher sets (agent/src/agents/tiny.js timeRows, the code the gateway runs), with
// Muse Glimmer's answers beside them, for distill/tiny_times.py.
//   node distill/tiny_times_feats.mjs <data dir with train/, test/, ...> <out.json>
import fs from "node:fs";
import { timeRows } from "../agent/src/agents/tiny.js";

const [DIR = "jev/data", OUT = "tiny_times_rows.json"] = process.argv.slice(2);
const SETS = ["train", "trainshared", "asked", "val", "test", "decider", "shared", "demo", "varied"];
const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const read = (f) => fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const out = { sets: {}, dropped: {} };
for (const set of SETS) {
  if (!fs.existsSync(`${DIR}/${set}/cases.jsonl`)) continue;
  const cases = read(`${DIR}/${set}/cases.jsonl`).filter((c) => c.kind === "judge"), answers = {};
  let off = 0;
  for (const r of read(`${DIR}/${set}/teacher.jsonl`)) {
    const c = cases.find((x) => x.id === r.id), d = r.decision;
    if (!c || !d || !d.intent || d.intent === "none") continue;
    const y = d.intent === "decline" ? "decline" : d.intent === "counter" ? c.offers.find((x) => x.slot.date === d.date && hm(x.start) === d.start)?.id : null;
    if (!y || (y !== "decline" && !c.works.includes(y))) { off++; continue; } // a yes to a time that breaks a rule, or a time not listed
    (answers[r.id] ||= []).push({ sample: r.sample, y });
  }
  out.dropped[set] = off;
  out.sets[set] = cases.filter((c) => answers[c.id]).map((c) => {
    const cur = c.offers.find((x) => x.id === c.cur), ok = c.offers.filter((x) => c.works.includes(x.id));
    const { rows, caseX } = timeRows(c.member, cur, ok, c.offers, { minutes: c.minutes, why: c.curBad || "" });
    return { id: c.id, member: c.member.id, rule: c.rule || null, private: !!c.private, liked: c.liked ?? null, ids: rows.map((r) => (r.kind === "decline" ? "decline" : r.t.id)),
      first: c.offers.find((x) => x.id !== c.cur && c.works.includes(x.id))?.id, x: rows.map((r) => r.x.map((v) => +(+v).toFixed(4))), caseX, answers: answers[c.id] };
  });
  console.log(set, out.sets[set].length, "cases;", off, "answers off the options");
}
fs.writeFileSync(OUT, JSON.stringify(out));
