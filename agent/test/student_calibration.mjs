// Is the 1B student's confidence calibrated, and where should A2A_STUDENT_SURE sit? From its saved predictions, CPU only:
//   node test/student_calibration.mjs [--out ../submission/results/student_calibration.json] [--eps 0.05] [--delta 0.05]
//   node test/student_calibration.mjs --self-test      (synthetic cases with a known answer; no files read or written)
//
// The data: submission/results/decision_model/preds_1b_v3_{test,decider}.jsonl, one line per case with the student's
// probability for each option (probs), its reading of which times work (works_p), code's (works), and how many of
// Muse Glimmer's answers (the teacher's) picked each option (glimmer: 3 answers per test case, 2 per decider case, full
// and full2). These are the bf16 1B v3 on the short prompt (distill/final_report.sh). The served int4 file
// (serve-jev-1b-v3-Q4_K_M) picks the same option on 492 of 500 test cases and 183 of 196 decider cases; its per-case
// probabilities stayed on the VM, so the numbers here are the bf16 model's.
//   confidence   the pick's probability (the largest)
//   answered     confidence >= the threshold and the student's reading of which times work matches code's (as student.js)
//   loss         the share of the teacher's answers that differ from the pick, 0 .. 1 ("each answer", as the docs grade)
// Per set:
//   1. ECE over 10 bins of confidence against agreement (1 - loss), and the reliability table.
//   2. The risk-coverage curve: at each threshold, the share answered and the disagreement among them.
//   3. Thresholds chosen on the calibration half (by member on the decider's cases; the test file names no member, so
//      by case there), reported on the other half:
//      - conformal risk control, as test/cascade_analysis.mjs: a case's loss is its disagreement when the student
//        answers it, else 0. That only falls as the threshold rises, so the lowest threshold whose calibration risk R
//        passes (n R + 1) / (n + 1) <= EPS bounds the expected disagreement over all cases (answered or not) by EPS.
//      - the same goal among answered cases only ("disagreement <= EPS among what the student answers"), which no
//        monotone loss gives: learn-then-test (Angelopoulos, Bates et al., 2021) with the Hoeffding-Bentkus p-value,
//        each threshold of a fixed grid (0.50, 0.55 .. 0.95, 0.99) tested at DELTA / 11 (Bonferroni; a sequence from
//        the top stalls on the few cases there), the lowest that passes chosen: with chance at least 1 - DELTA its
//        disagreement among answered cases is at most EPS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r3 = (x) => (x == null || Number.isNaN(x) ? null : +x.toFixed(3));
// halves by a hash of the member (cascade_analysis.mjs's hash)
const hash = (t) => [...t].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const half = (k) => (hash(k) % 2 ? "test" : "calibration");
const GRID = [0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95], SURE = 0.6;

// one saved prediction -> { id, member, conf, pick, read, loss }
export function score(r, memberOf = (id) => id) {
  const [pick, conf] = Object.entries(r.probs).reduce((a, b) => (b[1] > a[1] ? b : a));
  const said = new Set(Object.entries(r.works_p || {}).filter(([, p]) => p >= 0.5).map(([t]) => t));
  const truth = new Set((r.works || []).filter((t) => t in (r.works_p || {})));
  const read = said.size === truth.size && [...truth].every((t) => said.has(t));
  const all = Object.values(r.glimmer).reduce((a, b) => a + b, 0);
  return { id: r.id, member: memberOf(r.id), conf, pick, read, loss: all ? 1 - (r.glimmer[pick] || 0) / all : null };
}
const answered = (rows, t) => rows.filter((r) => r.read && r.conf >= t);

// 1 and 2. ECE, reliability, risk-coverage
export function calibration(rows) {
  const bins = Array.from({ length: 10 }, (_, i) => { const b = rows.filter((r) => (i === 9 ? r.conf >= 0.9 : r.conf >= i / 10 && r.conf < (i + 1) / 10));
    return { from: i / 10, n: b.length, confidence: b.length ? r3(mean(b.map((r) => r.conf))) : null, agreement: b.length ? r3(mean(b.map((r) => 1 - r.loss))) : null }; });
  // (unrounded for the sum)
  const ece = bins.reduce((a, b, i) => { if (!b.n) return a; const x = rows.filter((r) => (i === 9 ? r.conf >= 0.9 : r.conf >= i / 10 && r.conf < (i + 1) / 10));
    return a + (b.n / rows.length) * Math.abs(mean(x.map((r) => r.conf)) - mean(x.map((r) => 1 - r.loss))); }, 0);
  const at = (t) => { const k = answered(rows, t); return { threshold: t, coverage: r3(k.length / rows.length), disagreement: k.length ? r3(mean(k.map((r) => r.loss))) : null }; };
  const levels = [...new Set(rows.map((r) => r.conf))].sort((a, b) => b - a), curve = levels.map(at);
  return { cases: rows.length, readMatches: rows.filter((r) => r.read).length, ece: r3(ece), agreement: r3(mean(rows.map((r) => 1 - r.loss))), meanConfidence: r3(mean(rows.map((r) => r.conf))),
    bins: bins.filter((b) => b.n), riskCoverage: GRID.map(at), riskCoverageFine: curve.filter((_, i) => i % Math.max(1, Math.floor(curve.length / 12)) === 0 || i === curve.length - 1) };
}

// 3a. conformal risk control (bounded loss in [0, 1]), as cascade_analysis.mjs
export function crc(rows, eps) {
  const n = rows.length, levels = [...new Set(rows.filter((r) => r.read).map((r) => r.conf))].sort((a, b) => b - a), steps = [];
  let threshold = null;
  for (const t of levels) {
    const k = answered(rows, t), risk = k.reduce((a, r) => a + r.loss, 0) / n, bound = (n * risk + 1) / (n + 1);
    steps.push({ threshold: r3(t), answered: k.length, risk: r3(risk), bound: r3(bound) });
    if (bound > eps) break; // the risk only grows as the threshold falls
    threshold = t;
  }
  return { eps, n, threshold, steps: steps.filter((_, i) => i % Math.max(1, Math.floor(steps.length / 10)) === 0 || i === steps.length - 1) };
}

// 3b. learn-then-test on the disagreement among answered cases
const binomCdf = (k, n, p) => { if (k < 0) return 0; if (k >= n) return 1; let s = 0, lc = 0; for (let i = 0; i <= k; i++) { if (i > 0) lc += Math.log((n - i + 1) / i); s += Math.exp(lc + i * Math.log(p) + (n - i) * Math.log1p(-p)); } return Math.min(1, s); };
const h1 = (a, b) => (a <= 0 ? -Math.log1p(-b) : a * Math.log(a / b) + (1 - a) * Math.log((1 - a) / (1 - b)));
// Hoeffding-Bentkus p-value for "the mean of m losses in [0, 1] is above eps", given their mean rhat
export const hbP = (rhat, m, eps) => (m ? Math.min(Math.exp(-m * h1(Math.min(rhat, eps), eps)), Math.E * binomCdf(Math.ceil(m * rhat - 1e-9), m, eps)) : 1);
export const LTT_GRID = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99];
export function ltt(rows, eps, delta) {
  const steps = LTT_GRID.map((t) => { const k = answered(rows, t), rhat = k.length ? mean(k.map((r) => r.loss)) : 0, p = hbP(rhat, k.length, eps);
    return { threshold: t, answered: k.length, disagreement: k.length ? r3(rhat) : null, p: +p.toPrecision(3), passes: p <= delta / LTT_GRID.length }; });
  return { eps, delta, n: rows.length, level: +(delta / LTT_GRID.length).toPrecision(3), threshold: steps.find((x) => x.passes)?.threshold ?? null, steps };
}

// a threshold on held-out rows
const heldOut = (rows, t) => { if (t == null) return { coverage: 0, disagreement: null, answered: 0 }; const k = answered(rows, t);
  return { cases: rows.length, answered: k.length, coverage: r3(k.length / rows.length), disagreement: k.length ? r3(mean(k.map((r) => r.loss))) : null, allCasesRisk: r3(k.reduce((a, r) => a + r.loss, 0) / rows.length) }; };

export function analyse(rows, { eps = 0.05, delta = 0.05 } = {}) {
  const cal = rows.filter((r) => half(r.member) === "calibration"), test = rows.filter((r) => half(r.member) === "test");
  const c = crc(cal, eps), l = ltt(cal, eps, delta);
  return { calibration: calibration(rows), served: { threshold: SURE, ...heldOut(rows, SURE) },
    split: { calibration: { cases: cal.length, members: new Set(cal.map((r) => r.member)).size }, test: { cases: test.length, members: new Set(test.map((r) => r.member)).size } },
    crc: { ...c, threshold: r3(c.threshold), onTest: heldOut(test, c.threshold) }, ltt: { ...l, threshold: r3(l.threshold), onTest: heldOut(test, l.threshold) } };
}

// ---- the self-test: synthetic cases whose confidence is calibrated by construction -----------------------------
function selfTest() {
  let s = 3;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const make = (n, bend) => Array.from({ length: n }, (_, i) => { const conf = 1 - 0.5 * r() ** 3, agree = bend(conf), g = [0, 1, 2].reduce((a) => a + (r() < agree ? 1 : 0), 0);
    return score({ id: `m${i % 400}-${i}`, probs: { t1: conf, t2: 1 - conf }, works_p: { t1: 1, t2: 1 }, works: ["t1", "t2"], glimmer: { t1: g, t2: 3 - g } }, (id) => id.split("-")[0]); });
  const ok = (c, m) => { if (!c) throw new Error(`self-test: ${m}`); console.log(`ok  ${m}`); };
  const good = make(6000, (c) => c), over = make(6000, (c) => c * c);
  const a = analyse(good), b = analyse(over);
  ok(a.calibration.ece < 0.03, `calibrated cases: ECE ${a.calibration.ece} < 0.03`);
  ok(b.calibration.ece > 0.05, `overconfident cases: ECE ${b.calibration.ece} > 0.05`);
  ok(a.crc.onTest.allCasesRisk <= 0.06, `conformal risk control holds on the held-out half: ${a.crc.onTest.allCasesRisk} <= 0.05 (+ noise)`);
  ok(a.ltt.threshold != null && a.ltt.onTest.disagreement <= 0.06, `learn-then-test holds among answered: ${a.ltt.onTest.disagreement} at ${a.ltt.threshold}`);
  ok(b.ltt.threshold == null || b.ltt.threshold >= a.ltt.threshold, "an overconfident model gets a threshold no lower");
  ok(hbP(0, 300, 0.05) < 1e-5 && hbP(0.05, 300, 0.05) > 0.5, "Hoeffding-Bentkus p-values at the edges");
  const rc = a.calibration.riskCoverage;
  ok(rc.every((x, i) => i === 0 || x.coverage <= rc[i - 1].coverage), "coverage falls as the threshold rises");
}

const self = (() => { try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1] || "")); } catch { return false; } })();
if (self && process.argv.includes("--self-test")) selfTest();
else if (self) {
  const eps = +arg("eps", 0.05), delta = +arg("delta", 0.05), dir = path.join(HERE, "../../submission/results/decision_model");
  const out = path.resolve(arg("out", path.join(HERE, "../../submission/results/student_calibration.json")));
  const read = (f) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const sets = {
    // the test file's ids name no member (s7-p7-<n>): halves by case
    test: { file: "preds_1b_v3_test.jsonl", teacher: "Glimmer's 3 answers per case", memberOf: (id) => id },
    // s009-endBy-Tue-20:30: the member is s009
    decider: { file: "preds_1b_v3_decider.jsonl", teacher: "Glimmer's full and full2 answers", memberOf: (id) => id.split("-")[0] },
  };
  const result = {
    label: "Calibration of the 1B student's confidence against agreement with its teacher (Muse Glimmer), the risk-coverage curve, and thresholds by conformal risk control and learn-then-test. bf16 1B v3 predictions; the served int4 picks the same option on 492/500 test and 183/196 decider cases.",
    at: new Date().toISOString(), model: "Llama 3.2 1B Instruct, distilled (1b_v3), bf16, short prompt", served: { model: "serve-jev-1b-v3-Q4_K_M", sure: SURE }, eps, delta,
    sets: Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, { file: `submission/results/decision_model/${s.file}`, teacher: s.teacher, ...analyse(read(s.file).map((r) => score(r, s.memberOf)), { eps, delta }) }])),
  };
  fs.writeFileSync(out, JSON.stringify(result, null, 1) + "\n");
  console.log(`-> ${path.relative(process.cwd(), out)}`);
  for (const [k, s] of Object.entries(result.sets)) {
    const c = s.calibration;
    console.log(`\n${k}: ${c.cases} cases, agreement ${c.agreement}, mean confidence ${c.meanConfidence}, ECE ${c.ece}; at ${SURE}: coverage ${s.served.coverage}, disagreement ${s.served.disagreement}`);
    console.log(`  reliability: ${c.bins.map((b) => `[${b.from}: n ${b.n}, conf ${b.confidence}, agree ${b.agreement}]`).join(" ")}`);
    console.log(`  risk-coverage: ${c.riskCoverage.map((x) => `${x.threshold}: ${x.coverage}/${x.disagreement}`).join("  ")}`);
    console.log(`  CRC (all cases <= ${eps}): threshold ${s.crc.threshold}; held out: coverage ${s.crc.onTest.coverage}, disagreement among answered ${s.crc.onTest.disagreement}, over all ${s.crc.onTest.allCasesRisk}`);
    console.log(`  LTT (answered <= ${eps}, 1 - ${delta}): threshold ${s.ltt.threshold}; held out: coverage ${s.ltt.onTest.coverage}, disagreement among answered ${s.ltt.onTest.disagreement}`);
  }
}
