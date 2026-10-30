// Reads test/early_exit_eval.mjs's rows: what early exit from Muse Glimmer's reasoning saves, and how often it changes
// the answer. For a threshold tau, a case's answer is its first probe with p >= tau (ready at the checkpoint's time
// plus that probe's own seconds), else the full answer (at its own time). A changed answer is one that differs from the
// full answer's pick.
//   - The curve: for each tau, the share of cases that stop early, the share of answers changed, and the mean and median
//     seconds against the full answer's.
//   - tau by conformal risk control (as the decider's threshold, docs/decider.md): on a random half of the cases, the
//     smallest tau whose changed answers, (k + 1) / (n + 1), stay at or under 5%; then measured on the other half.
//     Repeated over 200 random halves; the means, and the tau most often chosen.
//   node test/early_exit_report.mjs rows.json [out.json]
import fs from "node:fs";

const [ROWS = "data/early_exit_rows.json", OUT = null] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(ROWS, "utf8")).filter((r) => r.full && !["none", "?"].includes(r.full));
const TAUS = [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.97, 0.98, 0.99, 0.995, 1.01];
const RISK = 0.05;
// a case's answer and its time under tau
const under = (r, tau) => { const cp = r.checkpoints.find((c) => c.p != null && c.p >= tau); return cp ? { pick: cp.pick, ms: cp.ms + cp.seconds * 1000, early: true } : { pick: r.full, ms: r.fullMs, early: false }; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const at = (rs, tau) => { const u = rs.map((r) => under(r, tau)); return { tau, early: u.filter((x) => x.early).length / rs.length, changed: u.filter((x, i) => x.pick !== rs[i].full).length / rs.length,
  seconds: u.reduce((a, x) => a + x.ms, 0) / rs.length / 1000, median: median(u.map((x) => x.ms)) / 1000 }; };
const r3 = (x) => +x.toFixed(3);
const full = { seconds: r3(rows.reduce((a, r) => a + r.fullMs, 0) / rows.length / 1000), median: r3(median(rows.map((r) => r.fullMs)) / 1000) };
const curve = TAUS.map((t) => { const a = at(rows, t); return { tau: t, early: r3(a.early), changed: r3(a.changed), seconds: r3(a.seconds), median: r3(a.median) }; });

let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const picked = {}, test = [];
for (let rep = 0; rep < 200; rep++) {
  const sh = [...rows].sort(() => rnd() - 0.5), cal = sh.slice(0, Math.floor(sh.length / 2)), ev = sh.slice(cal.length);
  const tau = TAUS.find((t) => { const k = cal.filter((r) => under(r, t).pick !== r.full).length; return (k + 1) / (cal.length + 1) <= RISK; }) ?? 1.01;
  picked[tau] = (picked[tau] || 0) + 1;
  test.push(at(ev, tau));
}
const mean = (k) => r3(test.reduce((a, x) => a + x[k], 0) / test.length);
const res = {
  label: "Early exit from Muse Glimmer's reasoning (after DEER): the options' probabilities read at each break in the full answer's reasoning, stopping at the first that is sure enough", cases: rows.length,
  reasoningChars: Math.round(rows.reduce((a, r) => a + r.reasoningChars, 0) / rows.length), checkpointsPerCase: r3(rows.reduce((a, r) => a + r.checkpoints.length, 0) / rows.length),
  full, curve,
  conformal: { risk: RISK, halves: 200, tauChosen: Object.fromEntries(Object.entries(picked).sort((a, b) => b[1] - a[1])), heldOut: { early: mean("early"), changed: mean("changed"), seconds: mean("seconds"), median: mean("median") } },
  note: "Times are wall seconds on the RTX 3090 with two full answers streaming at once; a probe's seconds were measured after the stream, alone, and are added to its checkpoint's time.",
};
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
