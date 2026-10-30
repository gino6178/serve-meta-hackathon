// What the order of the listed times is worth (match/timerank.js), on simulated members, no model.
// Private calendars (talk.js A2A_PRIVATE): your agent lists times from your own week, every hour a 90-minute game fits
// in your free stretches, the best twelve per round; each member's agent says which work; a round with no time that
// works for everyone rules those times out and lists the next twelve, three rounds at most. So the order decides how
// soon a game is found, and whether at all.
// The truth is a simulated club's free lists (club/population.js) with 10% of hours flipped; what your agent has seen
// of each member is 0 to 6 past answers at your free hours (earlier talks are proposed from your week). For singles
// (1 member) and doubles (3), the share of requests that find a time in round 1 and within 3 rounds, by:
//   counts  the old order: 2 per past yes and -3 per past no at that weekday and hour, summed over members
//   prob    the product of each member's posterior (voi.js, with shared preferences), with the least-misery floor
// The usual-hours term (weekday evenings, weekend late mornings) is added to both, as talk.js does.
//   node test/rank_sim.mjs [trials] [out.json]
import fs from "node:fs";
const { timeScore } = await import("../src/match/timerank.js");
const { populationPrior } = await import("../src/match/voi.js");
const { population } = await import("../src/club/population.js");

const N = +(process.argv[2] || 3000), OUT = process.argv[3] || null, FLIP = +(process.env.SIM_FLIP || 0.1);
let seed = +(process.env.SIM_SEED || 17); const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const club = population(600, +(process.env.SIM_CLUB || 9)), pool = club;
const win = (w) => { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m && { day: m[1], from: +m[2] * 60, to: +m[3] * 60 }; };
const keyOf = (day, start) => `${day} ${String(Math.floor(start / 60)).padStart(2, "0")}:00`;
const dateOf = (day) => `2026-11-0${1 + DAYS.indexOf(day)}`;
const freeAt = (list, day, start) => (list || []).map(win).some((w) => w && w.day === day && w.from <= start && start + 90 <= w.to);
const usual = (x) => (["Sat", "Sun"].includes(x.slot.day) ? (x.start >= 540 && x.start <= 840 ? 3 : 0) : x.start >= 1080 && x.start <= 1200 ? 3 : 0);

const res = {};
for (const size of [1, 3]) {
  const found = { counts: [0, 0], prob: [0, 0] };
  let trials = 0;
  while (trials < N) {
    const host = pool[Math.floor(rnd() * pool.length)];
    // your free stretches, widened by an hour either side (a host's week is longer than a club list), every hour a game fits
    const choices = host.free.map(win).filter(Boolean).flatMap((w) => { const out = []; for (let s = w.from - 60; s + 90 <= w.to + 60; s += 60) out.push({ slot: { date: dateOf(w.day), day: w.day }, start: s }); return out; });
    if (choices.length <= 12) continue; // the order can't matter with twelve or fewer
    const members = Array.from({ length: size }, () => {
      const m = pool[Math.floor(rnd() * pool.length)], truth = new Map(choices.map((x) => [keyOf(x.slot.day, x.start), rnd() < FLIP ? !freeAt(m.free, x.slot.day, x.start) : freeAt(m.free, x.slot.day, x.start)]));
      const mem = { yes: {}, no: {}, asked: {} }, n = Math.floor(rnd() * 7);
      for (let i = 0; i < n; i++) { const x = choices[Math.floor(rnd() * choices.length)], k = keyOf(x.slot.day, x.start); (truth.get(k) ? mem.yes : mem.no)[k] = ((truth.get(k) ? mem.yes : mem.no)[k] || 0) + 1; }
      return { truth, mem };
    });
    trials++;
    const mems = members.map((m) => m.mem), prior = populationPrior({ members: [], mems });
    const works = (x) => members.every((m) => m.truth.get(keyOf(x.slot.day, x.start)));
    for (const rank of ["counts", "prob"]) {
      const ordered = choices.map((x, i) => ({ x, s: timeScore(x, mems, prior, rank === "prob") + usual(x) - i * 0.01 })).sort((a, b) => b.s - a.s).map((y) => y.x);
      for (let round = 0; round < 3; round++) {
        const listed = ordered.slice(12 * round, 12 * round + 12);
        if (listed.some(works)) { if (round === 0) found[rank][0]++; found[rank][1]++; break; }
      }
    }
  }
  const r = (x) => +(x / N).toFixed(4), ci = (x) => { const p = x / N, h = 1.96 * Math.sqrt((p * (1 - p)) / N); return [+(p - h).toFixed(4), +(p + h).toFixed(4)]; };
  res[size === 1 ? "singles" : "doubles"] = Object.fromEntries(Object.entries(found).map(([k, [a, b]]) => [k, { round1: r(a), round1Ci: ci(a), within3: r(b) }]));
}
const out = { simulated: true, label: "The order of the listed times (match/timerank.js) with private calendars: requests that find a time in round 1 and within 3 rounds", trials: N, club: "population(600): free lists, 10% of hours flipped", seen: "0 to 6 past answers per member at the player's free hours", ...res };
console.log(JSON.stringify(out, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
