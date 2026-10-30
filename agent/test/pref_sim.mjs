// What shared preferences (voi.js PREF_SHARE) are worth, on simulated members, no model.
// The truth is a simulated club's free lists (club/population.js: 2 to 4 windows a week, one a day), with 10% of hours
// flipped, so a member's week has the structure real weeks have (an evening is free or not as a whole) without being
// exactly their list. Talks are proposed from the player's own week (talk.js), so what the player's agent has seen of
// each member is 1 to 4 past answers at hours the player is free, drawn from that truth, and a new request is at the
// player's free hours too. Two measures:
//   predict   the chance that a member is free at an hour the agent has never asked them about, against the truth:
//             Brier score and log loss (lower is better)
//   game      voi_sim.mjs's protocol on these members: 8 members and 6 times; the chance the first talk lands with no
//             question, and with one question by the value of information first (a talk lands when the member is free
//             then and says yes, by their band; the chance is read from the truth, not tossed)
// for four beliefs: flat Beta(1, 1); the club's population prior (what runs now with PREF_SHARE=off); the prior plus
// borrowed counts with rho from the club's free lists (shared calendars); and with the structural rho (private
// calendars, where no list is seen).
//   node test/pref_sim.mjs [trials] [out.json]
import fs from "node:fs";
const V = await import("../src/match/voi.js");
const { population } = await import("../src/club/population.js");

const N = +(process.argv[2] || 4000), OUT = process.argv[3] || null;
let seed = +(process.env.SIM_SEED || 11); const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// the hours a game can start: weeknights 18 to 20, weekends 8 to 16
const KEYS = DAYS.flatMap((d) => (["Sat", "Sun"].includes(d) ? [8, 9, 10, 11, 12, 13, 14, 15, 16] : [18, 19, 20]).map((h) => `${d} ${String(h).padStart(2, "0")}:00`));
const freeAt = (list, k) => { const [d, hh] = k.split(" "), h = parseInt(hh, 10); return (list || []).some((w) => { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m && m[1] === d && +m[2] <= h && h + 1.5 <= +m[3]; }); };
// a date in the week of 2026-11-01 (a Sunday) for a key, so voi.js can read its weekday
const slotOf = (k) => { const [d, hh] = k.split(" "); return { date: `2026-11-0${1 + DAYS.indexOf(d)}`, start: hh }; };

const club = population(600, +(process.env.SIM_CLUB || 3)), BAND = [0.15, 0.4, 0.65, 0.85];
// the club whose free lists make the prior and the data-driven rho: the first 300; the members simulated: the rest
const known = club.slice(0, 300), pool = club.slice(300);
const flipped = (m) => Object.fromEntries(KEYS.map((k) => [k, rnd() < 0.1 ? !freeAt(m.free, k) : freeAt(m.free, k)]));
const observe = (truth, hours) => { const mem = { yes: {}, no: {}, asked: {} }, n = 1 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++) { const k = hours[Math.floor(rnd() * hours.length)]; (truth[k] ? mem.yes : mem.no)[k] = (((truth[k] ? mem.yes : mem.no)[k]) || 0) + 1; } return mem; };

const prior = V.populationPrior({ members: known });
// what ran before: the same prior at 2 pseudo-answers (PSEUDO was 2), shared preferences off
const before = V.populationPrior({ members: known, pseudo: 2 });
const dataKernel = prior.kernel;
const structural = Object.assign((k) => prior(k), { kernel: V.structuralRho });
const flat = Object.assign(() => ({ a: 1, b: 1 }), { kernel: null });
const beliefs = {
  before: (mem, k) => { process.env.PREF_SHARE = "off"; return V.posterior(mem, slotOf(k), before).p; },
  flat: (mem, k) => { process.env.PREF_SHARE = "off"; return V.posterior(mem, slotOf(k), flat).p; },
  population: (mem, k) => { process.env.PREF_SHARE = "off"; return V.posterior(mem, slotOf(k), prior).p; },
  shared: (mem, k) => { process.env.PREF_SHARE = "on"; return V.posterior(mem, slotOf(k), Object.assign((x) => prior(x), { kernel: dataKernel })).p; },
  structural: (mem, k) => { process.env.PREF_SHARE = "on"; return V.posterior(mem, slotOf(k), structural).p; },
};
const names = Object.keys(beliefs);

// 1. predict
const brier = Object.fromEntries(names.map((b) => [b, 0])), loss = Object.fromEntries(names.map((b) => [b, 0]));
let cases = 0;
// the player's free hours (a host from the pool with at least 6)
const hostHours = () => { for (;;) { const h = KEYS.filter((k) => freeAt(pool[Math.floor(rnd() * pool.length)].free, k)); if (h.length >= 6) return h; } };
for (let t = 0; t < N; t++) {
  const hours = hostHours(), m = pool[Math.floor(rnd() * pool.length)], truth = flipped(m), mem = observe(truth, hours);
  const seen = new Set([...Object.keys(mem.yes), ...Object.keys(mem.no)]), unseen = hours.filter((k) => !seen.has(k));
  if (!unseen.length) { t--; continue; }
  const k = unseen[Math.floor(rnd() * unseen.length)], y = truth[k] ? 1 : 0;
  for (const b of names) { const p = Math.min(0.999, Math.max(0.001, beliefs[b](mem, k))); brier[b] += (p - y) ** 2; loss[b] -= y ? Math.log(p) : Math.log(1 - p); }
  cases++;
}

// 2. game: one request's 6 times, all on hours the members are often free; a member's chance of saying yes from a band
const wins = Object.fromEntries(names.map((b) => [b, 0])), first = Object.fromEntries(names.map((b) => [b, 0]));
for (let t = 0; t < N; t++) {
  const hours = hostHours(), slots = [...hours].sort(() => rnd() - 0.5).slice(0, 6);
  const members = Array.from({ length: 8 }, (_, i) => { const m = pool[Math.floor(rnd() * pool.length)], truth = flipped(m); return { id: `m${i}`, chance: BAND[Math.floor(rnd() * 4)], truth, mem: observe(truth, hours) }; });
  for (const b of names) {
    const p = (m, k) => beliefs[b](m.mem, k);
    const pairs = members.flatMap((m) => slots.map((k) => ({ m, k, v: m.chance * p(m, k) })));
    const best = (skip = null) => pairs.filter((x) => x !== skip).sort((a, c) => c.v - a.v)[0];
    // the value of information under this belief (voi.js bestQuestion's arithmetic)
    const p0 = best().v;
    let q = null, qv = -1;
    for (const x of pairs) { const rest = best(x)?.v ?? 0, pv = x.v / x.m.chance, after = pv * Math.max(x.m.chance, rest) + (1 - pv) * rest; if (after - p0 > qv) { qv = after - p0; q = x; } }
    // (the chance the talk lands, from the truth: free then, times their chance of a yes; no coin is tossed, so the
    // beliefs are compared on the same trials without luck in the way)
    const lands = (x) => (x.m.truth[x.k] ? x.m.chance : 0);
    const target = q.m.truth[q.k] ? q : best(q);
    wins[b] += lands(target);
    first[b] += lands(best());
  }
}
const r3 = (x) => +x.toFixed(4), ci = (w) => { const p = w / N, h = 1.96 * Math.sqrt((p * (1 - p)) / N); return [r3(p - h), r3(p + h)]; };
const res = {
  simulated: true, label: "Shared preferences (voi.js PREF_SHARE) on simulated members: prediction at hours never asked about, and games found with one question", trials: N, club: "population(600, seed 3): free lists of the first 300 make the prior; members drawn from the other 300; 10% of hours flipped", seen: "1 to 4 past answers per member at the player's free hours; requests at the player's free hours",
  predict: Object.fromEntries(names.map((b) => [b, { brier: r3(brier[b] / cases), logLoss: r3(loss[b] / cases) }])),
  game: Object.fromEntries(names.map((b) => [b, { noQuestion: r3(first[b] / N), oneQuestion: r3(wins[b] / N) }])),
};
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
