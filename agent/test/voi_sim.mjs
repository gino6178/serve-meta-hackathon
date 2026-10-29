// How much one question by the value of information is worth (match/voi.js), on simulated members, no model.
// Each trial: 8 members and 6 times. A member's true chance of being free at a time is drawn per (member, hour); what
// the player's agent has seen of it is a few faded yes/no counts drawn from that truth (as talk.js keeps them); a
// member's chance of saying yes when free comes from their band. Then one move before one talk:
//   none       no question: talk with the best pair by chance x posterior
//   voi        ask voi.bestQuestion's pair yes or no (the true answer), then talk with it on a yes, else the best other
//   random     ask a random pair, the same way
//   likeliest  ask the best pair itself
// A talk succeeds when the member is free then (the truth) and says yes (their chance).
//   node test/voi_sim.mjs [trials] [out.json]
import fs from "node:fs";
const { bestQuestion, posterior } = await import("../src/match/voi.js");

const N = +(process.argv[2] || 20000), OUT = process.argv[3] || null;
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const beta = (a, b) => { const g = (k) => { let x = 0; for (let i = 0; i < k; i++) x -= Math.log(rnd()); return x; }; const x = g(a), y = g(b); return x / (x + y); };
const DATES = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"], HOURS = ["19:00", "19:00", "20:00", "19:00", "18:00", "09:00"];
const SLOTS = DATES.map((date, i) => ({ date, start: HOURS[i] }));
const BAND = [0.15, 0.4, 0.65, 0.85];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], keyOf = (s) => `${DAY[new Date(`${s.date}T12:00:00`).getDay()]} ${s.start.slice(0, 2)}:00`;

const wins = { none: 0, voi: 0, random: 0, likeliest: 0 }, asked = { voi: 0 };
for (let t = 0; t < N; t++) {
  const members = Array.from({ length: 8 }, (_, i) => {
    const chance = BAND[Math.floor(rnd() * 4)], truth = {}, mem = { yes: {}, no: {} };
    for (const s of SLOTS) {
      const q = beta(1, 2), k = keyOf(s); truth[k] = rnd() < q;
      const seen = Math.floor(rnd() * 4); // 0 to 3 past answers at that hour
      for (let j = 0; j < seen; j++) (rnd() < q ? mem.yes : mem.no)[k] = ((rnd() < q ? mem.yes : mem.no)[k] || 0) + 1;
    }
    return { id: `m${i}`, chance, mem, truth };
  });
  const pairs = members.flatMap((m) => SLOTS.map((s) => ({ m, s, v: m.chance * posterior(m.mem, s).p })));
  const best = (skip = null) => pairs.filter((x) => x !== skip).sort((a, b) => b.v - a.v)[0];
  const talk = (x) => x.m.truth[keyOf(x.s)] && rnd() < x.m.chance;
  const after = (x) => (x.m.truth[keyOf(x.s)] ? talk(x) : talk(best(x)));
  wins.none += talk(best()) ? 1 : 0;
  const q = bestQuestion({ members: members.map((m) => ({ id: m.id, chance: m.chance, mem: m.mem })), slots: SLOTS, min: 0 });
  const qx = q ? pairs.find((x) => x.m.id === q.id && x.s.date === q.slot.date) : best();
  if (q) asked.voi++;
  wins.voi += after(qx) ? 1 : 0;
  wins.random += after(pairs[Math.floor(rnd() * pairs.length)]) ? 1 : 0;
  wins.likeliest += after(best()) ? 1 : 0;
}
const rate = (k) => +(wins[k] / N).toFixed(3), ci = (k) => { const p = wins[k] / N, h = 1.96 * Math.sqrt((p * (1 - p)) / N); return [+(p - h).toFixed(3), +(p + h).toFixed(3)]; };
const res = { simulated: true, trials: N, members: 8, times: SLOTS.length, games: Object.fromEntries(Object.keys(wins).map((k) => [k, { rate: rate(k), ci: ci(k) }])) };
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
