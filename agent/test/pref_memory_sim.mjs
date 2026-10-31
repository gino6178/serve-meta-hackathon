// A preference that changes mid-stream, on simulated players, no model (memory/prefs.js, upgrade #10).
// Each player has three habitual weekly times (Friday 19:00 and two of five others), eight weeks of games behind them
// (85% of weeks played, 85% singles), and their agent decides each week, at each habitual time, whether to ask for a
// game and in which format, as ask.js opening() does: the times from the habit (autopilot.js habits, two games in
// eight weeks), the format by majority at that time (prefs.formatByHabit is that rule). Then the truth changes:
//   A  week 4:  no more Friday evenings
//   B  week 6:  singles to doubles
//   C  week 12: Friday evenings fine again
// With chance SAY the player tells their agent in words (a phrasing drawn from a pool of 10 to 12 per change; code
// extracts the record, prefs.extract, and a phrasing it misses gives nothing). The player says no to a Friday they
// don't want; to the wrong format they say no, or with chance SELF arrange it themselves in the right one (the game
// goes on their record); to a right one they play with chance 0.9.
//   before  the decision as it runs today: ask.js reads the habit, not the notes
//   after   the same with the preference records settled by code (prefs.slotAllowed, formatFor, wantedTimes)
// Counted per change: decisions until the agent first follows the new preference (lag; a player it never follows in
// the 8 to 14 weeks left is censored at what was left), and decisions that used the stale one.
//   node test/pref_memory_sim.mjs [players] [out.json]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-prefsim-"));
Object.assign(process.env, { PREF_RECORDS_FILE: `${tmp}/pref_records.json`, MEMORY_FILE: `${tmp}/memory.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl` });
delete process.env.PREF_RECORDS;
const P = await import("../src/memory/prefs.js");
const { habits } = await import("../src/agents/autopilot.js");

const N = +(process.argv[2] || 400), OUT = process.argv[3] || null, SELF = 0.3, WEEKS = 20;
let seed = +(process.env.SIM_SEED || 7); const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0"), ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const T0 = new Date(2026, 5, 1); // a Monday: week 0 of the decisions
const dateIn = (week, day) => { const d = new Date(T0); d.setDate(d.getDate() + 7 * week + ((DAYS.indexOf(day) + 6) % 7)); return ymd(d); };
const monday8 = (week) => new Date(T0.getTime() + week * 7 * 864e5 + 8 * 36e5).getTime();
const OTHERS = [["Mon", "19:00"], ["Tue", "19:00"], ["Thu", "18:30"], ["Sat", "09:00"], ["Sun", "10:00"]];

// the phrasings, written before the extractor was run on them (the same author wrote both, so recall here is optimistic);
// one rule changed after the first run: a bare "now" was read as a yes, which turned 2 of the 12 A phrasings into the
// opposite record ("Friday evening is family time now"); now they give none
const POOL = {
  A: ["No more Friday evenings for me.", "I can't do Friday nights anymore.", "Fridays after work don't work for me now.", "Please stop booking Friday evening games.", "Friday evenings are out from now on.", "I'd rather keep my Friday evenings free.",
    "New job: Friday nights are impossible now.", "Skip Fridays in the evening please.", "I'm done with Friday night badminton.", "Friday evening is family time now.", "Not Friday evenings any more, thanks.", "Got a class on Friday evenings from now on."],
  B: ["I'd like to play doubles from now on.", "Switching from singles to doubles.", "No more singles for me.", "Doubles only please.", "I prefer doubles now.", "Can you book me doubles instead of singles?",
    "My knee says doubles from here.", "Let's do doubles going forward.", "Singles is too much for me now, doubles please.", "Put me in doubles games."],
  C: ["Friday evenings are fine again.", "I can play Friday nights again.", "Fridays after work work for me again.", "Friday evening is back on.", "Happy to play Friday evenings again.", "My class ended, so Friday evenings are free again.",
    "You can book Friday evenings again.", "Friday nights are open again.", "Friday evenings are OK now.", "I'm free on Friday evenings now."],
};
const TARGET = { A: { kind: "time", key: "fri-evening", value: "no" }, B: { kind: "format", key: "format", value: "doubles" }, C: { kind: "time", key: "fri-evening", value: "yes" } };
const hit = (recs, t) => recs.some((r) => r.kind === t.kind && r.key === t.key && r.value === t.value);
// extraction on each phrasing, with what it found besides the target (a wrong record counts against precision)
const extraction = Object.fromEntries(Object.entries(POOL).map(([k, xs]) => {
  const rows = xs.map((t) => { const recs = P.extract(t); return { text: t, found: hit(recs, TARGET[k]), wrong: recs.filter((r) => !(r.kind === TARGET[k].kind && r.key === TARGET[k].key && r.value === TARGET[k].value)).map((r) => `${r.kind}:${r.key}=${r.value}`) }; });
  return [k, { phrasings: xs.length, found: rows.filter((r) => r.found).length, withWrongRecord: rows.filter((r) => r.wrong.length).length, missed: rows.filter((r) => !r.found).map((r) => r.text), wrong: rows.filter((r) => r.wrong.length) }];
}));

const truth = (w) => ({ fri: w < 4 || w >= 12, format: w < 6 ? "singles" : "doubles" });
function player(arm, say) {
  const slots = [["Fri", "19:00"], ...[...OTHERS].sort(() => rnd() - 0.5).slice(0, 2)];
  const hist = [];
  for (let w = -8; w < 0; w++) for (const [d, s] of slots) if (rnd() < 0.85) hist.push({ date: dateIn(w, d), start: s, format: rnd() < 0.85 ? "singles" : "doubles", sport: "badminton" });
  const records = [], log = { A: [], B: [], C: [] };
  for (let w = 0; w < WEEKS; w++) {
    for (const [k, at] of [["A", 4], ["B", 6], ["C", 12]]) if (w === at && rnd() < say) {
      const text = pick(POOL[k]);
      for (const r of P.extract(text)) records.push(P.make(r, { since: monday8(w), source: { type: "note", text }, confidence: P.CONF.said, explicit: true }));
    }
    const Ps = arm === "after" ? P.resolve(records, monday8(w) + 36e5) : P.empty();
    // the times the agent may ask about: the habit (share 0.25, two games in eight weeks, as ask.js), and with the
    // records, the times the player said yes to
    const lastDate = hist.map((h) => h.date).sort().at(-1);
    const usual = habits(hist.filter((h) => h.date <= lastDate)).filter((h) => h.share >= 0.25).map((h) => [h.day, h.start]);
    if (arm === "after") for (const x of P.wantedTimes(Ps)) if (x.day === "Fri" && x.part === "evening" && !usual.some(([d]) => d === "Fri")) usual.push(["Fri", "19:00"]);
    const t = truth(w);
    let friAsked = false;
    for (const [day, start] of usual) {
      if (arm === "after" && P.slotAllowed(Ps, { day, start, hist })) continue;
      if (day === "Fri") friAsked = true;
      const format = arm === "after" ? P.formatFor(Ps, { hist, day, start }).format : P.formatByHabit(hist, day, start);
      if (w >= 6) log.B.push(format === "doubles");
      const date = dateIn(w, day);
      if (day === "Fri" && !t.fri) continue; // said no
      if (format !== t.format) { if (rnd() < SELF) hist.push({ date, start, format: t.format, sport: "badminton" }); continue; }
      if (rnd() < 0.9) hist.push({ date, start, format, sport: "badminton" });
    }
    if (w >= 4 && w < 12) log.A.push(!friAsked);
    if (w >= 12) log.C.push(friAsked);
  }
  return log;
}
// per change: lag (decisions before the first one that follows), censored when none does; stale decisions
function measure(arm, say) {
  const out = { A: { lag: [], censored: 0, stale: 0, decisions: 0 }, B: { lag: [], censored: 0, stale: 0, decisions: 0 }, C: { lag: [], censored: 0, stale: 0, decisions: 0 } };
  for (let i = 0; i < N; i++) {
    const log = player(arm, say);
    for (const k of ["A", "B", "C"]) {
      const xs = log[k], f = xs.indexOf(true), o = out[k];
      o.decisions += xs.length; o.stale += xs.filter((x) => !x).length;
      if (f < 0) { o.censored++; o.lag.push(xs.length); } else o.lag.push(f);
    }
  }
  const mean = (xs) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2), med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return Object.fromEntries(Object.entries(out).map(([k, o]) => [k, { lagMean: mean(o.lag), lagMedian: med(o.lag), neverFollowed: o.censored, staleDecisions: o.stale, decisions: o.decisions, staleShare: +(o.stale / o.decisions).toFixed(3) }]));
}

const t0 = performance.now();
const runs = [1, 0.5, 0].map((say) => { seed = +(process.env.SIM_SEED || 7); const before = measure("before", say); seed = +(process.env.SIM_SEED || 7); const after = measure("after", say); return { say, before, after }; });
// what settling costs: 400 records (the most notes a player keeps), 100 keys, resolved
const many = Array.from({ length: 400 }, (_, i) => P.make({ kind: "time", key: `k${i % 100}`, value: i % 2 ? "yes" : "no" }, { since: 1e12 + i * 6e4, source: { type: "note" }, confidence: 0.9, explicit: i % 3 > 0 }));
const r0 = performance.now(); for (let i = 0; i < 200; i++) P.resolve(many); const resolveMs = +((performance.now() - r0) / 200).toFixed(3);
const result = {
  simulated: true, what: "a player's preference changes mid-stream: A no more Friday evenings (week 4), B singles to doubles (week 6), C Friday evenings fine again (week 12); the agent's weekly decisions at each habitual time, before (ask.js as it ran: habit only) and after (memory/prefs.js records settled by code, newest wins)",
  players: N, weeks: WEEKS, selfArrange: SELF, seed: +(process.env.SIM_SEED || 7), model: "none (code extraction, prefs.extract)",
  decisions: { A: "each week 4-11: whether the agent asked for Friday 19:00 (following = not asking)", B: "each game asked for from week 6: its format (following = doubles)", C: "each week 12-19: whether the agent asked for Friday 19:00 (following = asking)" },
  extractionNote: "phrasings by the same author as the extractor; one rule (a bare 'now' read as yes) was changed after the first run, when it turned 2 of 12 A phrasings into the opposite record",
  extraction, runs, resolveMsFor400Records: resolveMs, seconds: +((performance.now() - t0) / 1000).toFixed(1),
};
console.log(JSON.stringify({ extraction: Object.fromEntries(Object.entries(extraction).map(([k, v]) => [k, `${v.found}/${v.phrasings}`])), runs, resolveMs }, null, 1));
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n"); }
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(0);
