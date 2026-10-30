// Early exit from Muse Glimmer's reasoning (after DEER, arXiv 2504.15895): while the full answer reasons, read the
// options' probabilities at each break in its reasoning, and stop as soon as they are sure enough. This measures how
// much time that would save and how often it would change the answer, on the decider's cases (test/decider_eval.mjs:
// the proposed time breaks one of the member's rules and two or more listed times keep them, so the member's agent
// picks the one its member likes best).
// For each case:
//   1. the full answer exactly as the gateway asks it (talk.js answerMessages, Ollama /api/chat, thinking "low", the
//      reply's JSON Schema, 120 + 900 tokens), streamed, with the time each piece of reasoning arrived;
//   2. afterwards, at every paragraph break in that reasoning (and every 400 characters without one), and once with no
//      reasoning at all, a probe: decider.js decideAfter, the decider's prompt (habits) with the reasoning so far
//      inserted before its cue, one token at temperature 0, read as the options' probabilities (as early.js reads them).
// Each row: the full answer's pick, its seconds, and each checkpoint's time into the stream, characters, pick, p and
// the probe's own seconds. test/early_exit_report.mjs reads the rows: for a threshold tau, the answer is the first
// probe with p >= tau (at the checkpoint's time plus the probe's), else the full answer; tau is chosen on half the
// cases by conformal risk control (a changed answer at most 5% of the time) and reported on the other half.
//   node test/early_exit_eval.mjs rows.json   (EE_N=120 cases, EE_PAR=2 streams at once, EE_MAX_MIN=60)
import fs from "node:fs";

for (const [k, v] of Object.entries({ A2A_STUDENT: "off", A2A_LEASE: "off", SIM_ONLY: "1", SIM_MEMBERS: "300", A2A_TRANSPORT: "local", BOOKINGS_FILE: "data/ee-bookings.json", A2A_FILE: "data/ee-a2a.json",
  NEGOTIATIONS_FILE: "data/ee-negotiations.json", TRACE_FILE: "data/ee-traces.jsonl", LEDGER_FILE: "data/ee-ledger.jsonl" })) process.env[k] ||= v;
const { population } = await import("../src/club/population.js");
const { shared, court, breaks, when, first, answerMessages, deciderQuestion } = await import("../src/a2a/talk.js");
const { decideAfter } = await import("../src/agents/decider.js");
const { MEMBER_REPLY } = await import("../src/core/schema.js");
const { readClub } = await import("../src/club/club.js");
const { helpers } = await import("../src/club/play.js");
const { toMin, hm } = helpers;

const OUT = process.argv[2] || "data/early_exit_rows.json";
const N = +(process.env.EE_N || 120), PAR = +(process.env.EE_PAR || 2), MAX_MS = +(process.env.EE_MAX_MIN || 60) * 60000;
const ROOT = (process.env.LLM_URL || "http://127.0.0.1:11435/v1").replace(/\/v1\/?$/, ""), MODEL = process.env.LLM_MODEL || "muse-glimmer";
const MIN = 90, now = new Date("2026-11-02T07:00:00");
const club = readClub(), venues = helpers.readVenues();
const me = { id: "you", name: "You", area: club.you.area, free: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `${d} 08-22`) };

// the cases, as test/decider_eval.mjs makes them (seed 7, the first 1,200 members, at most 2 per member)
function listing(m, prefer) {
  const people = [me, m], times = shared(people, MIN, now);
  const offer = (s, start) => { const c = court(s, start, MIN, people, venues, "badminton"); return c && { slot: s, start, c, text: `${when(s.date, hm(start))}–${hm(start + MIN)} at ${c.v.name}, court ${c.court} (trips: ${c.travel.map((t) => `${t.id === "you" ? "you" : first(t.name)} ${t.min} min`).join(", ")})` }; };
  const starts = (s) => [s.from, ...(s.to - s.from >= MIN + 60 ? [s.from + 60] : [])];
  const choices = times.flatMap((s) => starts(s).map((st) => offer(s, st))).filter(Boolean);
  const ps = prefer && times.find((s) => s.day === prefer.day && s.from <= toMin(prefer.start) && toMin(prefer.start) + MIN <= s.to);
  if (ps && !choices.some((x) => x.slot.date === ps.date && x.start === toMin(prefer.start))) { const x = offer(ps, toMin(prefer.start)); if (x) choices.push(x); }
  const ordered = choices.map((x, i) => ({ x, s: -i * 0.01 + (prefer && x.slot.day === prefer.day ? 20 - Math.abs(x.start - toMin(prefer.start)) / 30 : 0) })).sort((a, b) => b.s - a.s).map((y) => y.x);
  ordered.forEach((x, i) => { x.id = `t${i + 1}`; });
  return { times, choices, cur: ordered[0], listed: ordered.slice(0, 12) };
}
const cases = [];
for (const m of population(1200, 7)) {
  if (cases.length >= N) break;
  if (!Object.keys(m.rules).length || m.prefers === "doubles" || !m.sports.includes("badminton")) continue;
  const R = m.rules, base = listing(m, null), asks = [];
  if (R.noDays) for (const s of base.times) if (R.noDays.includes(s.day)) asks.push({ rule: "noDays", prefer: { day: s.day, start: hm(s.from) } });
  if (R.endBy) for (const s of base.times) { const st = Math.max(s.from, Math.ceil((toMin(R.endBy) - MIN + 30) / 30) * 30); if (st + MIN <= s.to) asks.push({ rule: "endBy", prefer: { day: s.day, start: hm(st) } }); }
  if (R.maxTrip != null) for (const x of base.choices) if (/trip/.test(breaks(m, x, MIN) || "")) asks.push({ rule: "maxTrip", prefer: { day: x.slot.day, start: hm(x.start) } });
  let k = 0;
  for (const a of asks) {
    if (k >= 2 || cases.length >= N) break;
    const { cur, listed } = listing(m, a.prefer);
    const why = cur && breaks(m, cur, MIN);
    if (!why || /not free|already/.test(why)) continue;
    const works = listed.filter((x) => !breaks(m, x, MIN));
    if (works.length < 2) continue;
    if (cases.some((c) => c.m.id === m.id && c.cur.id === cur.id && c.cur.slot.date === cur.slot.date && c.cur.start === cur.start)) continue;
    cases.push({ id: `${m.id}-${a.rule}-${cur.slot.day}-${hm(cur.start)}`, m, rule: a.rule, why, cur, listed, works });
    k++;
  }
}

// 1. the full answer, streamed: the reasoning with the time each piece arrived, then the reply
async function stream(msgs) {
  const t0 = Date.now(), r = await fetch(`${ROOT}/api/chat`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: msgs, stream: true, think: "low", keep_alive: "24h", format: MEMBER_REPLY, options: { num_predict: 120 + 900, temperature: 0.3 } }) });
  const pieces = []; let content = "", buf = "", firstContent = null;
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      const j = JSON.parse(line), ms = Date.now() - t0;
      if (j.message?.thinking) pieces.push({ ms, text: j.message.thinking });
      if (j.message?.content) { content += j.message.content; firstContent ??= ms; }
    }
  }
  return { pieces, content, ms: Date.now() - t0, firstContent };
}
// the checkpoints: the reasoning so far at each paragraph break (and every 400 characters without one), with the time
// its last piece arrived
function checkpoints(pieces) {
  const out = [{ chars: 0, ms: 0, text: "" }];
  let text = "", last = 0;
  for (const p of pieces) {
    text += p.text;
    if (/\n\s*\n\s*$/.test(text) || text.length - last >= 400) { out.push({ chars: text.length, ms: p.ms, text }); last = text.length; }
  }
  if (text.length > last) out.push({ chars: text.length, ms: pieces.at(-1)?.ms ?? 0, text });
  return out;
}
// 2. a probe: the decider's prompt with the reasoning so far before its cue
async function probe(c, text) {
  const q = deciderQuestion(c.m, c.cur, c.works, c.why, "singles", "badminton");
  const t0 = Date.now(), read = await decideAfter(q, text, { site: "ee.probe", timeoutMs: 120000 });
  return { pick: read.pick ? (read.pick.x ? read.pick.x.id : "Z") : null, p: read.p, seconds: +((Date.now() - t0) / 1000).toFixed(3) };
}
const idOf = (c, j) => (j?.intent === "counter" ? c.works.find((x) => x.slot.date === j.date && hm(x.start) === j.start)?.id || "?" : j?.intent === "decline" ? "Z" : j?.intent || "none");

const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const have = new Set(done.map((r) => r.id)), todo = cases.filter((c) => !have.has(c.id));
console.log(`${cases.length} cases, ${todo.length} to do`);
const t00 = Date.now();
let k = 0;
await Promise.all(Array.from({ length: PAR }, async () => {
  while (k < todo.length && Date.now() - t00 < MAX_MS) {
    const c = todo[k++];
    try {
      const s = await stream(answerMessages(c.m, c.cur, c.works, [], "singles", "badminton", c.why));
      let j = null; try { j = JSON.parse(s.content); } catch { /* an answer that does not parse is "none" */ }
      const cps = [];
      for (const cp of checkpoints(s.pieces)) cps.push({ ms: cp.ms, chars: cp.chars, ...(await probe(c, cp.text)) });
      done.push({ id: c.id, rule: c.rule, works: c.works.map((x) => x.id), full: idOf(c, j), fullMs: s.ms, firstContentMs: s.firstContent, reasoningChars: s.pieces.reduce((a, p) => a + p.text.length, 0), checkpoints: cps, at: new Date().toISOString() });
      fs.writeFileSync(OUT, JSON.stringify(done));
      console.log(`${done.length}/${cases.length} ${c.id} full ${idOf(c, j)} ${(s.ms / 1000).toFixed(1)} s, ${cps.length} checkpoints, picks ${cps.map((x) => `${x.pick}:${x.p}`).join(" ")}`);
    } catch (e) { console.log(`${c.id} error ${String(e.message || e).slice(0, 120)}`); }
  }
}));
console.log(done.length >= cases.length ? "EE_DONE" : `EE_PARTIAL ${cases.length - done.length} left`);
