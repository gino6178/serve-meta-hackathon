// The one-pass decider's 196 seed-7 cases (agent/test/decider_eval.mjs on master, docs/decider.md), rebuilt with the
// same code, in distill/cases.mjs's form, with its two full answers (full, full2) as the teacher rows, so the distilled
// student is scored on exactly the cases and references the decider was.
//   TZ=Asia/Taipei node distill/decider_cases.mjs <out dir> <decider_raw.json> <decider_raw_full2.json>
// (the cases were made on the GPU server, in Taipei time: the fixed week is local time)
import fs from "node:fs";
import path from "node:path";

const [OUT = "jev/data/decider", RAW, RAW2] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const abs = (f) => path.resolve(OUT, f);
for (const [k, v] of Object.entries({ A2A_LEASE: "off", SIM_ONLY: "1", SIM_MEMBERS: "300", A2A_TRANSPORT: "local", BOOKINGS_FILE: abs("bookings.json"), A2A_FILE: abs("a2a.json"),
  NEGOTIATIONS_FILE: abs("negotiations.json"), TRACE_FILE: abs("traces.jsonl"), LEDGER_FILE: abs("ledger.jsonl") })) process.env[k] ||= v;
if (!fs.existsSync(abs("bookings.json"))) fs.writeFileSync(abs("bookings.json"), JSON.stringify({ bookings: [], leases: [] }));
const { population } = await import("../agent/src/club/population.js");
const { shared, court, breaks, when, first } = await import("../agent/src/a2a/talk.js");
const { readClub } = await import("../agent/src/club/club.js");
const { helpers } = await import("../agent/src/club/play.js");
const { toMin, hm, DAYS, dateOf } = helpers;

// (from decider_eval.mjs, unchanged)
const SEED = 7, MEMBERS = 1200, N = 240, PER = 2, MIN = 90, now = new Date("2026-11-02T07:00:00");
const club = readClub(), venues = helpers.readVenues();
const me = { id: "you", name: "You", area: club.you.area, free: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `${d} 08-22`) };
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
function liked(m, works) {
  let set = works;
  if (/prefers the earliest start/.test(m.agent)) { const e = [...works].sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.start - b.start)[0]; set = set.filter((x) => x === e); }
  if (/rather play weekends/.test(m.agent)) { const we = works.filter((x) => ["Sat", "Sun"].includes(x.slot.day)); if (we.length && we.length < works.length) set = set.filter((x) => we.includes(x)); }
  return set.length < works.length && set.length ? set.map((x) => x.id) : null;
}
const cases = [];
for (const m of population(MEMBERS, SEED)) {
  if (cases.length >= N) break;
  if (!Object.keys(m.rules).length || m.prefers === "doubles" || !m.sports.includes("badminton")) continue;
  const R = m.rules, base = listing(m, null), asks = [];
  if (R.noDays) for (const s of base.times) if (R.noDays.includes(s.day)) asks.push({ rule: "noDays", prefer: { day: s.day, start: hm(s.from) } });
  if (R.endBy) for (const s of base.times) { const st = Math.max(s.from, Math.ceil((toMin(R.endBy) - MIN + 30) / 30) * 30); if (st + MIN <= s.to) asks.push({ rule: "endBy", prefer: { day: s.day, start: hm(st) } }); }
  if (R.maxTrip != null) for (const x of base.choices) if (/trip/.test(breaks(m, x, MIN) || "")) asks.push({ rule: "maxTrip", prefer: { day: x.slot.day, start: hm(x.start) } });
  let k = 0;
  for (const a of asks) {
    if (k >= PER || cases.length >= N) break;
    const { cur, listed } = listing(m, a.prefer);
    const why = cur && breaks(m, cur, MIN);
    if (!why || /not free|already/.test(why)) continue;
    const works = listed.filter((x) => !breaks(m, x, MIN));
    if (works.length < 2) continue;
    if (cases.some((c) => c.m.id === m.id && c.cur.id === cur.id && c.cur.slot.date === cur.slot.date && c.cur.start === cur.start)) continue;
    cases.push({ id: `${m.id}-${a.rule}-${cur.slot.day}-${hm(cur.start)}`, m, rule: a.rule, why, cur, listed, works, liked: liked(m, works) });
    k++;
  }
}
// in distill/cases.mjs's form: the times in the order the member's agent sees them (the proposed one first), each with the
// member's own trip
const trip = (x, m) => x.c.travel.find((t) => t.id === m.id)?.min ?? null;
const side = (x, m) => ({ id: x.id, slot: { date: x.slot.date, day: DAYS[dateOf(x.slot.date).getDay()] }, start: x.start, trip: trip(x, m), text: x.text });
const rows = cases.map((c) => ({ id: c.id, kind: "judge", rule: c.rule, member: c.m, sport: "badminton", format: "singles", minutes: MIN, private: false, week: "all", cur: c.cur.id, curBad: c.why,
  offers: [c.cur, ...c.listed.filter((x) => x !== c.cur)].map((x) => side(x, c.m)), works: c.works.map((x) => x.id), liked: c.liked }));
fs.writeFileSync(abs("cases.jsonl"), rows.map((c) => JSON.stringify(c)).join("\n") + "\n");
// the two full answers as teacher rows (sample 0: full, sample 1: full2), checked against the rebuilt cases
const raw = [...JSON.parse(fs.readFileSync(RAW, "utf8")), ...JSON.parse(fs.readFileSync(RAW2, "utf8"))].filter((r) => r.system === "full" || r.system === "full2");
const byId = Object.fromEntries(rows.map((c) => [c.id, c]));
let bad = 0;
const t = raw.map((r) => {
  const c = byId[r.id];
  if (!c || JSON.stringify(c.works) !== JSON.stringify(r.works)) { bad++; return null; }
  const x = c.offers.find((o) => o.id === r.pick);
  const decision = x ? { intent: "counter", date: x.slot.date, start: hm(x.start), works: r.worksSaid, tier: r.tier } : { intent: r.pick === "Z" ? "decline" : "none" };
  return { id: r.id, sample: r.system === "full" ? 0 : 1, kind: "judge", decision, tokens: { calls: r.calls, prompt: r.prompt, cached: r.cached, output: r.output, reasoning: r.reasoning, empty: r.empty }, seconds: r.seconds, compute: r.compute, hw: r.hw };
}).filter(Boolean);
fs.writeFileSync(abs("teacher.jsonl"), t.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`${rows.length} cases rebuilt (${rows.filter((c) => c.liked).length} with a graded preference); ${t.length} full answers matched, ${bad} did not match a rebuilt case`);
