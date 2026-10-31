// Tool-call reliability under injected faults, with the stand-in model and no GPU (simulated):
//   node test/tool_faults.mjs [out.json]
// The same Autopilot weeks twice, with the checks after the schema off (TOOL_CHECKS=off: the loop as it was) and on.
// The stand-in model (fake_model.mjs faults) sends each find_partners and negotiate call with arguments that break the
// schema (FAULT_SCHEMA, 10%) or fit it but are wrong (FAULT_SEMANTIC, 10%: a day that does not exist, a start outside
// the player's free windows or not HH:MM, an id nobody returned, the wrong number of members), and asks again for a
// call that was refused, faulty again at the same rates. A negotiate, request_approval or nudge that succeeded loses
// its effect at FAULT_SILENT (15%) while still reporting success: a tool that fails silently. The members' answers in
// the talks fit their schema but are wrong at FAULT_REPLY (10%). Same seeds both times.
// Counted from the model's side (what came back for each faulty call) and from the state after each run: games the
// run claimed whose holds are not there, an approval claimed that is not on disk.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fakeModel, rng } from "./fake_model.mjs";

const OUT = process.argv[2] || "../submission/results/tool_reliability.json";
const RATES = { schema: +(process.env.FAULT_SCHEMA ?? 0.1), semantic: +(process.env.FAULT_SEMANTIC ?? 0.1), reply: +(process.env.FAULT_REPLY ?? 0.1) }, SILENT = +(process.env.FAULT_SILENT ?? 0.15);
const RUNS = +(process.env.FAULT_RUNS || 120), SEED = +(process.env.FAULT_SEED || 7);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-faults-"));
const model = await fakeModel({ faults: { ...RATES, seed: SEED } });
Object.assign(process.env, { AUTOPILOT_FILE: `${tmp}/autopilot.json`, BOOKINGS_FILE: `${tmp}/bookings.json`, A2A_FILE: `${tmp}/a2a.json`, A2A_DATA: `${tmp}/a2a`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`,
  TRACE_FILE: `${tmp}/traces.jsonl`, PREFS_FILE: `${tmp}/prefs.json`, STORE_FILE: `${tmp}/players.json`, MEMORY_FILE: `${tmp}/memory.json`, MATCH_RECORDS_FILE: `${tmp}/mr.json`, MATCH_AUDIT_FILE: `${tmp}/ma.json`, MATCH_STATE_FILE: `${tmp}/ms.json`,
  LLM_URL: model.url, LLM_API: "ollama", GUARD: "off", MEMORY: "off", A2A_TRANSPORT: "local", A2A_ROUTE: "off", LOOP_DIR: `${tmp}/loop`, LOOP_WATCH: "off", AUTOPILOT_DURABLE: "0" });
delete process.env.A2A_BASE; delete process.env.A2A_PRIVATE; delete process.env.CRASH_AT;
const autopilot = await import("../src/agents/autopilot.js");
const play = await import("../src/club/play.js");
const { readJSON } = await import("../src/core/jsonfile.js");

// the weeks: one to three games, from ten different days
const weeks = Array.from({ length: RUNS }, (_, k) => { const now = new Date(); now.setDate(now.getDate() + (k % 12)); now.setHours(10, 0, 0, 0); return { perWeek: 1 + (k % 3), now }; });
const pct = (a, b) => (b ? +(a / b).toFixed(3) : null);

async function arm(checks) {
  process.env.TOOL_CHECKS = checks ? "on" : "off";
  const F = model.asked.faults;
  Object.assign(F, { log: [], chains: new Map(), all: [], rand: rng(SEED), clean: 0, reply: { faults: 0, retries: 0, repaired: 0, again: 0, open: 0 } });
  const silentRand = rng(SEED * 31 + 1);
  autopilot.faults.injected = 0;
  autopilot.faults.silent = (name) => ["negotiate", "request_approval", "nudge"].includes(name) && silentRand() < SILENT;
  const dec0 = model.asked.decisions;
  const out = { runs: 0, goal: 0, claimedGames: 0, gamesWithoutHolds: 0, approvalsClaimed: 0, approvalsMissing: 0, falseSuccessRuns: 0, gatewayRefused: 0, postChecked: 0, postFailed: 0 };
  for (const w of weeks) {
    play.clearLeases();
    const r = await autopilot.run({ goal: { perWeek: w.perWeek }, now: w.now, player: `faults-${checks}-${out.runs}` });
    out.runs++;
    // the state, read back by the harness: every game the run claims holds its partners' times, and an approval it
    // claims is on disk
    const leases = readJSON(process.env.BOOKINGS_FILE, {}).leases || [];
    const noHold = r.agreed.filter((o) => o.hold && !o.venue?.public && o.partners.some((p) => !leases.some((l) => l.member === p.id && l.ref === o.hold)));
    const pending = readJSON(process.env.AUTOPILOT_FILE, { pending: {} }).pending[r.id];
    const missing = !!r.approval && !(pending && ["pending", "draft"].includes(pending.status));
    out.claimedGames += r.agreed.length; out.gamesWithoutHolds += noHold.length;
    out.approvalsClaimed += r.approval ? 1 : 0; out.approvalsMissing += missing ? 1 : 0;
    if (noHold.length || missing) out.falseSuccessRuns++;
    if (r.agreed.length - noHold.length >= w.perWeek && r.approval && !missing) out.goal++;
    if (r.report.checks) { out.gatewayRefused += r.report.checks.schemaRefused + r.report.checks.semanticRefused; out.postChecked += r.report.checks.postChecked; out.postFailed += r.report.checks.postFailed; }
    // (the run's own leases go before the next week)
    for (const o of r.agreed) if (o.hold) play.release(o.hold);
  }
  // the model's side: each faulty call, refused or run; each chain of retries, repaired after one try or two
  const log = F.log, eligible = F.clean + log.length, chains = F.all;
  const by = (kind) => { const xs = log.filter((f) => f.kind === kind); return { sent: xs.length, rate: pct(xs.length, eligible), refused: xs.filter((f) => f.outcome === "refused").length, ran: xs.filter((f) => f.outcome === "run").length, caughtRate: pct(xs.filter((f) => f.outcome === "refused").length, xs.length) }; };
  const whats = {};
  for (const f of log) { const k = `${f.kind}: ${f.what}`; (whats[k] ||= { sent: 0, refused: 0 }); whats[k].sent++; if (f.outcome === "refused") whats[k].refused++; }
  const ch = (kind) => { const xs = chains.filter((c) => !kind || c.kind === kind); return { chains: xs.length, repair1: pct(xs.filter((c) => c.repairedAfter === 0).length, xs.length), repair2: pct(xs.filter((c) => c.repairedAfter != null && c.repairedAfter <= 1).length, xs.length), ranThrough: xs.filter((c) => c.ranThrough).length }; };
  const refusedFaults = log.filter((f) => f.outcome === "refused").length;
  return {
    toolChecks: checks ? "on" : "off", ...out, goalRate: pct(out.goal, out.runs),
    toolCalls: { eligible, schema: by("schema"), semantic: by("semantic"), typedRefusals: log.filter((f) => f.typed).length, refusalsEchoingTheModelsValue: log.filter((f) => f.echoed).length, byFault: whats,
      // refusals the gateway made of calls the model sent clean (false positives of the checks)
      cleanCallsRefused: checks ? Math.max(0, out.gatewayRefused - refusedFaults) : null },
    repair: { all: ch(null), schema: ch("schema"), semantic: ch("semantic") },
    silent: { injected: autopilot.faults.injected, caught: out.postFailed, passedAsSuccess: Math.max(0, autopilot.faults.injected - out.postFailed), gamesWithoutHolds: out.gamesWithoutHolds, approvalsMissing: out.approvalsMissing, falseSuccessRuns: out.falseSuccessRuns },
    // (a member's answer that was faulty again when asked again is the same fault, not a new one)
    memberReplies: { decisions: model.asked.decisions - dec0, faults: F.reply.faults - F.reply.again, faultyAgain: F.reply.again, askedAgain: F.reply.retries, repaired: F.reply.repaired, repairRate: pct(F.reply.repaired, F.reply.faults - F.reply.again), overruledByCode: F.reply.faults - F.reply.again - F.reply.repaired },
  };
}

const before = await arm(false), afterArm = await arm(true);
const res = { at: new Date().toISOString(), simulated: true, harness: "agent/test/tool_faults.mjs (fake_model.mjs faults; Autopilot loop with the stand-in model, no GPU)",
  rates: { ...RATES, silent: SILENT }, runs: RUNS, seed: SEED,
  notes: ["The stand-in model repairs a refused call by asking for the same call again, faulty again at the same rates whatever the error said: Repair@k here measures what the checks let reach a repair, not whether typed errors help a real model repair.",
    "Both arms start from the same seed; the random streams part once the arms behave differently (a call refused in one arm runs in the other), so the faults sent differ a little between them.",
    "TOOL_CHECKS=off is the loop as it was, with one fix in both arms: a negotiate whose members argument is a string no longer throws in its step label."],
  before, after: afterArm };
const real = path.resolve(OUT.replace(/\.json$/, "_real.json"));
if (fs.existsSync(real)) res.real = JSON.parse(fs.readFileSync(real, "utf8"));
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
for (const a of [before, afterArm]) console.log(`TOOL_CHECKS=${a.toolChecks}: goal ${a.goal}/${a.runs} · schema faults caught ${a.toolCalls.schema.refused}/${a.toolCalls.schema.sent} · semantic caught ${a.toolCalls.semantic.refused}/${a.toolCalls.semantic.sent} · Repair@1 ${a.repair.all.repair1} @2 ${a.repair.all.repair2} · silent ${a.silent.injected} injected, ${a.silent.caught} caught, ${a.silent.passedAsSuccess} passed as success · false-success runs ${a.silent.falseSuccessRuns} · member replies ${a.memberReplies.faults} faults, ${a.memberReplies.repaired} repaired`);
model.close();
fs.rmSync(tmp, { recursive: true, force: true });
(await import("../src/memory/memory.js")).close?.();
process.exit(0);
