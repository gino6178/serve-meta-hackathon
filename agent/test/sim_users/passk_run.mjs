// The same scenario k times, with the cooperative club or with difficult people in it (hard.mjs), on the real gateway:
// pass^1 and pass^k (tau-bench), success by the kind of person involved, games that fall apart after a yes, and false
// "booked" reports (passk.mjs).
//   node test/sim_users/passk_run.mjs --arm coop|hard [--scenarios 24] [--k 4] [--seed 11] [--par 2] [--out f.json]
//   node test/sim_users/passk_run.mjs --report a.jsonl b.jsonl ... --out submission/results/sim_users_hard.json
// One scenario: a person of the trial club (personas.json; they are the club, CLUB_PLAYERS=1, every one of them linked
// on Messenger) asks their agent for a game at one of their usual times. Their agent agrees it with the members'
// agents (the real code: the student, the decider and Muse Glimmer, over A2A on the gateway's own port), asks them to
// Book it, asks each partner to confirm (they keep "ask me first" on, the default), and books once all said yes. The
// people answer through the signed Messenger webhook, by code: the cooperative ones as the inertia model says, the
// difficult ones as hard.mjs says. Nothing the people write comes from a model, so the model time is the agent's.
// Each run is a fresh gateway in a folder of its own (cwd), on a clock that starts at the same Monday 09:00 every run
// (clock.mjs), with holds that lapse after --lease-ms (60 s here instead of 30 minutes, so "late" is 90 s, not 45
// minutes). The run ends when nothing is in flight, no answer is still to come, and nobody has spoken for --quiet-ms.
// LLM_TARGET: the model server (Ollama, /v1 and /api); unset, a fake model in this process (fake_model.mjs: every member's
// agent says yes to every listed time), the code-only slice. STUDENT_TARGET: the 1B student worker (unset: off).
// Never the live gateway's folder or data; nothing is sent anywhere but the gateway this script starts.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
process.env.TZ = "Asia/Taipei";
const { load: loadPersonas, asMember } = await import("./personas.mjs");
const I = await import("./inertia.mjs");
const H = await import("./hard.mjs");
const { u, stream, shuffle } = await import("./rng.mjs");
const { outcome, summarize, beliefOf, compare } = await import("./passk.mjs");

const HERE = path.dirname(fileURLToPath(import.meta.url)), AGENT = path.resolve(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg("seed", 11), CLUB_SEED = +arg("club-seed", 5), ARM = arg("arm", "coop"), NSCEN = +arg("scenarios", 24), K = +arg("k", 4), PAR = +arg("par", 2);
const LEASE = +arg("lease-ms", 60000), LATE = Math.round(LEASE * 1.5), BAIL = +arg("bail-ms", 15000), QUIET = +arg("quiet-ms", 15000), CAP = +arg("cap-ms", 12 * 60000), LOOP_MAX = +arg("loop-max", 5);
const START = arg("start", "2026-11-09T09:00:00"), OUT = arg("out", `data/passk_${ARM}_s${SEED}.json`), ONLY = arg("only"), KEEP = process.argv.includes("--keep");
const LLM_TARGET = (process.env.LLM_TARGET || "").replace(/\/+$/, ""), STUDENT_TARGET = (process.env.STUDENT_TARGET || "").replace(/\/+$/, "");
if (/:(8790)\b/.test(LLM_TARGET)) throw new Error("never the live gateway");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LONG = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const DAYN = Object.fromEntries(Object.entries(LONG).map(([k, v]) => [v, k]));

// ---- the club and the scenarios ----------------------------------------------------------------------------------------
const personas = loadPersonas(), byId = Object.fromEntries(personas.map((p) => [p.id, p]));
// who is difficult (the hard arm only), from the club seed; the scenarios from the run seed
const HARD = H.assign(personas, CLUB_SEED);
const kindOf = (id) => (ARM === "hard" ? HARD[id] || null : null);
const t0 = new Date(START), dateAt = (i) => { const d = new Date(t0); d.setDate(d.getDate() + i); return I.ymd(d); };
export function scenarios(n = NSCEN, seed = SEED) {
  const order = shuffle(stream(seed, "askers"), personas.map((p) => p.id)), out = [];
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const p = byId[order[i % order.length]], r = stream(seed, "scenario", i);
    const format = p.prefers === "doubles" ? "doubles" : p.prefers === "singles" ? "singles" : r() < 0.5 ? "singles" : "doubles";
    // one of their usual windows one to six days ahead (never the day the drifter dropped, so both arms ask the same)
    const cands = [];
    for (let d = 1; d <= 6; d++) for (const w of I.windows(p.free).filter((x) => x.day === I.dayOf(dateAt(d)))) if (!(HARD[p.id] === "drifter" && w.day === H.dropDay(CLUB_SEED, p))) cands.push({ date: dateAt(d), day: w.day, from: w.from, to: w.to });
    // only times a game can be had at by everyone's stated week: enough others free then who play the format (one for
    // singles, three for doubles), so a failure is the run's, not the calendar's
    const starts = cands.flatMap((c) => [c.from, ...(c.to - c.from >= 150 ? [c.from + 60] : [])].map((st) => ({ ...c, start: I.hm(st) })));
    const ok = starts.filter((c) => personas.filter((q) => q.id !== p.id && (q.prefers === "any" || q.prefers === format) && I.inWindow(q, c.date, c.start, 90)).length >= (format === "doubles" ? 3 : 1));
    if (!ok.length) continue;
    const c = ok[Math.floor(r() * ok.length)];
    if (out.some((x) => x.asker === p.id && x.slot.date === c.date && x.slot.start === c.start)) continue;
    out.push({ scen: `s${out.length + 1}`, asker: p.id, slot: { date: c.date, day: c.day, start: c.start, format } });
  }
  return out;
}

// ---- one run -----------------------------------------------------------------------------------------------------------
const freePort = () => new Promise((ok) => { const s = http.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const SECRET = crypto.randomBytes(16).toString("hex");

async function runOne(sc, trial, model) {
  const ctx0 = { scen: sc.scen, trial }, asker = sc.asker, tStart = Date.now();
  const dir = path.join(os.tmpdir(), "serve-passk", `${ARM}-${sc.scen}-t${trial}-${crypto.randomBytes(3).toString("hex")}`);
  fs.mkdirSync(path.join(dir, "data"), { recursive: true }); fs.mkdirSync(path.join(dir, "members"), { recursive: true });
  fs.writeFileSync(path.join(dir, "members/members.json"), JSON.stringify({ simulated: true, members: personas.map(asMember) }));
  const linked = t0.getTime() - 36e5;
  fs.writeFileSync(path.join(dir, "data/players.json"), JSON.stringify({ players: Object.fromEntries(personas.map((p) => [p.id, { id: p.id, name: p.name, linkedAt: linked, lastSeen: linked, memories: [], history: [], events: [], logs: [], games: [], prefs: { reminderHour: 7, ask: false } }])) }));
  const log = [], human = {}, beliefs = {}, saidYes = [], backedOut = [], gaveUp = new Set(), seen = {}, involved = new Set([asker]);
  let timers = 0, hooks = 0, llm = 0, last = Date.now(), llmCalls = 0, llmSec = 0, studentCalls = 0, studentSec = 0;
  const T = () => +((Date.now() - tStart) / 1000).toFixed(1);
  const nowSim = () => t0.getTime() + (Date.now() - tStart);
  // the day and time a message is about ("Thursday 19:00"), as a date in the week from the clock's start
  const whenIn = (text) => { const m = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d\d:\d\d)/.exec(text || ""); if (!m) return null; for (let i = 0; i < 8; i++) if (I.dayOf(dateAt(i)) === DAYN[m[1]]) return `${dateAt(i)} ${m[2]}`; return null; };
  // ---- the fake Graph API: what the gateway sends each person, and what they do about it
  const graph = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    let body = {}; try { body = JSON.parse(b || "{}"); } catch { /* a typing indicator */ }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ recipient_id: body.recipient?.id, message_id: `m${log.length}` }));
    const to = body.recipient?.id, m = body.message;
    if (to && m?.text) { last = Date.now(); const x = { t: T(), to, text: m.text, buttons: m.quick_replies?.map((q) => q.title) || [], payloads: m.quick_replies?.map((q) => q.payload) || [] }; log.push(x); react(x).catch((e) => log.push({ t: T(), error: String(e.stack || e).slice(0, 300) })); }
  }); });
  const proxy = (target, kind) => http.createServer((req, res) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", async () => {
    const a = Date.now(); if (kind === "llm") { llm++; llmCalls++; } else studentCalls++;
    try {
      const r = await fetch(`${target}${req.url}`, { method: req.method, headers: { "content-type": req.headers["content-type"] || "application/json" }, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks), signal: AbortSignal.timeout(300000) });
      const buf = Buffer.from(await r.arrayBuffer()); res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" }); res.end(buf);
    } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: String(e.message || e) })); }
    finally { const s = (Date.now() - a) / 1000; if (kind === "llm") { llm--; llmSec += s; } else studentSec += s; last = Date.now(); }
  }); });
  const [gp, lp, sp, port] = [await freePort(), await freePort(), await freePort(), await freePort()];
  const servers = [graph.listen(gp, "127.0.0.1"), proxy(model.url, "llm").listen(lp, "127.0.0.1"), ...(STUDENT_TARGET ? [proxy(STUDENT_TARGET, "student").listen(sp, "127.0.0.1")] : [])];
  const TOKEN = `passk-${crypto.randomBytes(8).toString("hex")}`;
  const env = { ...process.env, TZ: "Asia/Taipei", PORT: String(port), WEBHOOK_PORT: "0", SIM_CLOCK_START: String(t0.getTime()),
    MESSENGER_PAGE_TOKEN: "SIM", MESSENGER_APP_SECRET: SECRET, MESSENGER_VERIFY_TOKEN: "sim-verify", MESSENGER_PAGE_NAME: "Serve (pass^k simulated users)", MESSENGER_API: `http://127.0.0.1:${gp}/v21.0`,
    AGENT_TOKEN: TOKEN, ALLOW_ORIGINS: "http://127.0.0.1:5191", MAINTAINER_TOKEN: crypto.randomBytes(12).toString("hex"),
    LLM_URL: `http://127.0.0.1:${lp}${model.v1 ? "/v1" : ""}`, ...(model.api ? { LLM_API: model.api } : {}), LLM_MODEL: process.env.LLM_MODEL || "muse-glimmer", LLM_SLOTS: process.env.PASSK_LLM_SLOTS || "1",
    ...(STUDENT_TARGET ? { A2A_STUDENT_URL: `http://127.0.0.1:${sp}` } : { A2A_STUDENT: "off" }),
    GUARD: "off", MEMORY_EMBED: "bm25", CLUB_PLAYERS: "1", SIM_ONLY: "1", SIM_USERS: path.join(dir, "members"), SIM_MEMBERS: "", MATCH_DEMO_RECORDS: "0", A2A_LEASE_MS: String(LEASE),
    ASK_HOUR: "99", NIGHTLY: "0", LOOP_NIGHTLY: "0", LOOP_WATCH: "off", FEED_DEMO: "off", LLM_FALLBACK: "off" };
  for (const k of ["LLM_API_KEY", "MODEL_API_KEY", "META_API_KEY", "PUBLIC_URL", "A2A_BASE"]) delete env[k];
  if (!model.api) delete env.LLM_API;
  const gw = spawn(process.execPath, ["--import", pathToFileURL(path.join(HERE, "clock.mjs")).href, path.join(AGENT, "src/server.js")], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  let gwOut = ""; gw.stdout.on("data", (d) => { gwOut = (gwOut + d).slice(-4000); }); gw.stderr.on("data", (d) => { gwOut = (gwOut + d).slice(-4000); });
  const G = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${G}/api/status`, { headers: { authorization: `Bearer ${TOKEN}` } })).status === 200) break; } catch { /* starting */ } await sleep(500); }
  async function hook(id, message, what) {
    const body = JSON.stringify({ object: "page", entry: [{ id: "page", time: nowSim(), messaging: [{ sender: { id }, recipient: { id: "page" }, timestamp: nowSim(), message: { mid: `sim.${crypto.randomUUID()}`, ...message } }] }] });
    hooks++; last = Date.now(); log.push({ t: T(), from: id, what, text: message.text, payload: message.quick_reply?.payload });
    try { await fetch(`${G}/webhook/messenger`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex") }, body }); }
    catch (e) { log.push({ t: T(), error: `webhook: ${e.message}` }); } finally { hooks--; last = Date.now(); }
  }
  const later = (ms, fn) => { timers++; setTimeout(() => { Promise.resolve().then(fn).catch((e) => log.push({ t: T(), error: String(e).slice(0, 200) })).finally(() => { timers--; last = Date.now(); }); }, ms); };
  const set = (id, g, v) => { if (g) (human[id] ||= {})[g] = v; };
  // the game a question is about, from the gateway's own records (reading, not acting)
  const gameOf = async (payload) => {
    const [kind, id] = payload.split(":");
    for (let k = 0; k < 10; k++) {
      if (kind === "pc" || kind === "pl") { const o = readJ(path.join(dir, "data/partner_confirm.json"), {})[id]?.option; if (o) return `${o.date} ${o.start}`; }
      if (kind === "gm") { const a = readJ(path.join(dir, "data/asks.json"), { asks: {} }).asks?.[id], o = a?.agreed || a?.opening; if (o) return `${o.date} ${o.start}`; }
      await sleep(300);
    }
    return null;
  };
  const flipped = new Set();
  // a search that goes round and round (the asker asked to Book the same game again and again): the run stops after
  // LOOP_MAX such questions, as a failure of its own, so a loop costs minutes, not the whole cap
  let books = 0, loop = false;
  // (one answer per person and ask: a nudge about an ask they already answered, or chose to leave, changes nothing;
  // only vague words leave it open, so the question asked again gets a fresh answer)
  const decided = new Map();
  async function react(x) {
    const id = x.to, p = byId[id];
    if (!p) return;
    const kind = kindOf(id), s = (seen[id] ||= { questions: 0, messages: 0 });
    s.messages++; if (x.payloads.length) s.questions++;
    const b = beliefOf(x.text);
    if (b) (beliefs[id] ||= []).push({ kind: b, game: b === "none" ? null : whenIn(x.text), t: x.t });
    const pl = x.payloads, q = pl[0] || "", qk = /^pc:/.test(q) ? "confirm" : /^(gm:[^:]+:book|pl:[^:]+:yes)$/.test(q) ? "book" : /^gm:[^:]+:yes$/.test(q) ? "ask" : null;
    // "Drop out of ...?" (the gateway checking a back-out in words): yes from the one who backed out, else no
    if (/^pd:/.test(q)) { const mine = backedOut.some((y) => y.id === id); log.push({ t: T(), decide: id, kind: "drop", act: mine ? "yes" : "no" }); return hook(id, { text: x.buttons[mine ? 0 : 1], quick_reply: { payload: pl[mine ? 0 : 1] } }, `drop:${mine ? "yes" : "no"}`); }
    const askId = /^pc:/.test(q) ? `${id}|${q.split(":")[1]}` : null;
    if (askId && decided.has(askId) && decided.get(askId) !== "text") { log.push({ t: T(), note: `${id} already answered ${q.split(":")[1]}` }); return; }
    if (qk) {
      involved.add(id);
      if (id === asker && qk === "book" && ++books > LOOP_MAX) { loop = true; log.push({ t: T(), note: `stopped: asked to Book ${books} times` }); return; }
      // (a question whose record is gone, its game dropped meanwhile, is still read off its words)
      const g = (await gameOf(q)) || whenIn(x.text); if (!g) { log.push({ t: T(), note: `no game found for ${q}` }); return; }
      const [date, start] = g.split(" ");
      const a = H.answer(SEED, p, kind, { ...ctx0, step: `${qk}:${g}:${s.questions}`, kind: qk, date, start, asked: id === asker ? sc.slot : null, seen: s, club: CLUB_SEED });
      if (a.gaveUp) gaveUp.add(id);
      if (askId) decided.set(askId, a.act);
      log.push({ t: T(), decide: id, kind: qk, game: g, act: a.act, delay: a.delay, why: a.why });
      const go = async () => {
        if (a.act === "silent") return;
        if (a.act === "text") return hook(id, { text: a.text }, "vague");
        if (a.act === "yes") { set(id, g, "in"); saidYes.push({ id, game: g }); return hook(id, { text: x.buttons[0], quick_reply: { payload: pl[0] } }, `${qk}:yes`); }
        // another time where there is such a button (Want a game?), else no
        const k = qk === "ask" ? (a.act === "other" ? 1 : 2) : a.act === "other" && pl.length > 2 ? 2 : 1;
        set(id, g, "out"); return hook(id, { text: x.buttons[k], quick_reply: { payload: pl[k] } }, `${qk}:${a.act}`);
      };
      if (a.delay === "late") later(LATE, go); else await go();
      return;
    }
    // a booking: someone booked without being asked hears it now (they keep it or not); someone in it may back out
    if (b === "booked") {
      const g = whenIn(x.text);
      if (!g) return;
      involved.add(id);
      if (human[id]?.[g] === undefined) {
        const [date, start] = g.split(" ");
        const a = H.answer(SEED, p, kind, { ...ctx0, step: `notice:${g}`, kind: "notice", date, start, asked: id === asker ? sc.slot : null, seen: s, club: CLUB_SEED });
        log.push({ t: T(), decide: id, kind: "notice", game: g, act: a.act, why: a.why });
        if (a.act === "yes") set(id, g, "in");
        else if (a.act !== "silent" && a.act !== "text") { set(id, g, "out"); later(BAIL, () => hook(id, { text: H.bailText(p, I.dayOf(date), start) }, "bail")); }
      }
      if (human[id]?.[g] === "in" && !flipped.has(`${id} ${g}`) && H.backsOut(SEED, p, kind, ctx0)) {
        flipped.add(`${id} ${g}`);
        later(BAIL, () => { set(id, g, "out"); backedOut.push({ id, game: g }); const [date, start] = g.split(" "); return hook(id, { text: H.bailText(p, I.dayOf(date), start) }, "back-out"); });
      }
    }
  }
  // ---- the run: the drifter tells their agent first (the hard arm), then the asker asks
  const drifter = ARM === "hard" ? Object.keys(HARD).find((k) => HARD[k] === "drifter") : null;
  if (drifter) { const n0 = log.length; await hook(drifter, { text: H.driftText(CLUB_SEED, byId[drifter]) }, "drift"); for (let i = 0; i < 240 && !log.slice(n0).some((m) => m.to === drifter); i++) await sleep(500); }
  const text = H.requestText(byId[asker], kindOf(asker), sc.slot);
  await hook(asker, { text }, "request");
  for (;;) {
    await sleep(500);
    // (an ask still open at the gateway, or a late yes waiting for the asker, keeps the run going: its clock may act)
    const open = Object.values(readJ(path.join(dir, "data/partner_confirm.json"), {})).some((x) => x && (x.status === "open" || x.late));
    if (!timers && !hooks && !llm && !open && Date.now() - last > QUIET) break;
    if (loop) break;
    if (Date.now() - tStart > CAP) { log.push({ t: T(), note: "cap reached" }); break; }
  }
  // ---- what the gateway booked (its own file), and the outcome
  const bk = readJ(path.join(dir, "data/bookings.json"), { bookings: [] }).bookings || [];
  const bookings = bk.map((b) => ({ date: b.option?.date, start: b.option?.start, players: [...new Set([b.option?.by, ...(b.option?.partners || []).map((x) => x.id)].filter(Boolean))], cancelled: !!b.cancelled })).filter((b) => b.players.includes(asker));
  for (const b of bookings) b.players.forEach((x) => involved.add(x));
  const pending = Object.values(readJ(path.join(dir, "data/partner_confirm.json"), {})).map((x) => ({ by: x.by, waiting: x.waiting, game: `${x.option?.date} ${x.option?.start}` }));
  const out = { ...outcome({ asker, bookings, human, beliefs, saidYes, backedOut, gaveUp: [...gaveUp] }), loop, capped: log.some((m) => m.note === "cap reached") };
  try { gw.kill(); } catch { /* gone */ }
  servers.forEach((x) => x.close());
  await sleep(300);
  // (on Windows the gateway may hold a file a moment after it is told to stop)
  if (!KEEP) for (let k = 0; k < 10; k++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await sleep(500); } }
  const inv = [...involved];
  return { arm: ARM, scen: sc.scen, trial, asker, askerKind: kindOf(asker), format: sc.slot.format, slot: sc.slot, request: text, involved: inv, kinds: inv.map(kindOf), bookings, pending, outcome: out,
    model: { calls: llmCalls, seconds: +llmSec.toFixed(1), studentCalls, studentSeconds: +studentSec.toFixed(1) }, wallSec: T(), log, ...(log.some((m) => m.error) || !log.some((m) => m.to) ? { gateway: gwOut.slice(-1500) } : {}) };
}

// ---- the arms, and the report -------------------------------------------------------------------------------------------
async function main() {
  if (process.argv.includes("--report")) return report();
  let model = { url: LLM_TARGET, v1: true }, fake = null;
  if (!LLM_TARGET) { const { fakeModel } = await import("../fake_model.mjs"); fake = await fakeModel(); model = { url: fake.url.replace(/\/v1$/, ""), v1: true, api: "ollama" }; }
  const scs = scenarios().filter((s) => !ONLY || ONLY.split(",").includes(s.scen));
  const jl = OUT.replace(/\.json$/, "") + ".jsonl";
  fs.mkdirSync(path.dirname(path.resolve(jl)), { recursive: true });
  const done = new Set(fs.existsSync(jl) ? fs.readFileSync(jl, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.scen}:${r.trial}`; }) : []);
  const jobs = []; for (let t = 0; t < K; t++) for (const s of scs) if (!done.has(`${s.scen}:${t}`)) jobs.push([s, t]);
  console.log(`${ARM}: ${scs.length} scenarios x ${K} trials, ${jobs.length} to run, ${PAR} at a time; difficult: ${ARM === "hard" ? JSON.stringify(HARD) : "none"}; model ${fake ? "fake (code only)" : LLM_TARGET}`);
  const t1 = Date.now();
  let i = 0;
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (i < jobs.length) {
      const [s, t] = jobs[i++];
      const r = await runOne(s, t, model).catch((e) => ({ arm: ARM, scen: s.scen, trial: t, error: String(e.stack || e).slice(0, 400) }));
      fs.appendFileSync(jl, JSON.stringify(r) + "\n");
      console.log(`${s.scen} t${t} ${r.error ? `ERROR ${r.error.slice(0, 120)}` : `${r.outcome.pass ? "pass" : "fail"} asker=${r.askerBelief || r.outcome.askerBelief} standing=${r.outcome.standing.length} falseBooked=${r.outcome.falseBooked.length} kinds=${r.kinds.filter(Boolean).join("+") || "-"} model ${r.model.calls} calls ${r.model.seconds}s wall ${r.wallSec}s`}`);
    }
  }));
  console.log(`done in ${((Date.now() - t1) / 60000).toFixed(1)} min`);
  fake?.close?.();
  process.argv.push("--report", jl); report([jl]);
  process.exit(0);
}
// the report over one or more arms' rows (jsonl): a summary per arm, and the setup
function report(files = null) {
  const fs_ = files || process.argv.slice(process.argv.indexOf("--report") + 1).filter((f) => f.endsWith(".jsonl"));
  // (an arm is named by its folder and file: real/coop, fake/hard)
  const rows = fs_.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => ({ ...JSON.parse(l), file: `${path.basename(path.dirname(path.resolve(f)))}/${path.basename(f, ".jsonl")}` })));
  const ok = rows.filter((r) => !r.error), groups = {};
  for (const r of ok) (groups[r.file] ||= []).push(r);
  const arms = Object.fromEntries(Object.entries(groups).map(([k, rs]) => [k, { arm: rs[0].arm, ...summarize(rs, { kMax: 8, seed: SEED }),
    model: { calls: rs.reduce((a, r) => a + r.model.calls, 0), seconds: Math.round(rs.reduce((a, r) => a + r.model.seconds, 0)), studentCalls: rs.reduce((a, r) => a + r.model.studentCalls, 0),
      // (only the real model takes measurable time; the fake answers at once)
      llm: rs.some((r) => r.model.seconds > 1) ? "muse-glimmer (Ollama :11435), student worker :11447 wired in" : "fake model (code only)", wallMinutes: Math.round(rs.reduce((a, r) => a + r.wallSec, 0) / 60) } }]));
  const res = { simulated: true, note: "Simulated people only (agent/test/sim_users/personas.json); the gateway, its agents and the model are real. pass^k after tau-bench (arXiv 2406.12045); difficult people after Sim2Real (arXiv 2603.11245).",
    at: new Date().toISOString(), seeds: { scenarios: SEED, club: CLUB_SEED, persona: JSON.parse(fs.readFileSync(path.join(HERE, "personas.json"), "utf8")).seed }, difficult: HARD, kinds: H.KINDS, share: H.SHARE,
    setup: { start: START, leaseMs: LEASE, lateMs: LATE, bailMs: BAIL, quietMs: QUIET },
    errors: rows.filter((r) => r.error).length, arms,
    // hard against coop on the same scenarios, where both arms of a folder ran
    hardMinusCoop: Object.fromEntries(Object.keys(groups).filter((k) => k.endsWith("/hard") && groups[k.replace(/hard$/, "coop")]).map((k) => [k.replace(/\/hard$/, ""), compare(groups[k.replace(/hard$/, "coop")], groups[k], { kMax: 8, seed: SEED })])) };
  const out = arg("out", "data/passk_report.json");
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1));
  for (const [k, a] of Object.entries(arms)) console.log(`${k}: pass^1 ${a.passk[1]?.value} pass^${a.trials} ${a.passk[a.trials]?.value}; false booked ${a.falseBooked.k}/${a.runs}; fell apart ${a.fellApartAfterYes.k}; left waiting ${a.leftWaiting.k}`);
  return res;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
