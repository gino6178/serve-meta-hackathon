// Judging ahead on "courts near you" (src/club/places.js, PLACES_SPECULATE), for real: Muse Glimmer judges, places
// from OpenStreetMap, the forecast from Open-Meteo (no Google key, so no Google quota is spent). Each location is
// searched at 19:00, the person looks for THINK seconds, then moves the time to 20:00 (the guess judging ahead makes).
// With judging ahead off, then on, on different dates (so no verdict is reused across the two); the 20:00 search's
// wall time is the person's wait. Also the judgings done in all: what a wrong guess (18:00) costs the GPU.
//   node test/places_ahead_eval.mjs [out.json]    PLACES_THINK=20 (seconds)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-ahead-"));
Object.assign(process.env, { PLACES_FILE: `${tmp}/places.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GOOGLE_MAPS_API_KEY: "" });
const places = await import("../src/club/places.js");
const OUT = process.argv[2] || "../submission/results/places_ahead.json", THINK = +(process.env.PLACES_THINK || 20) * 1000;
// city parks and courts in several places (the map is public; nothing is written anywhere)
const LOCS = [["Taipei Da'an", 25.0306, 121.5363, "basketball"], ["Taichung", 24.1477, 120.6736, "basketball"], ["Ljubljana", 46.0569, 14.5058, "basketball"],
  ["Lisbon", 38.7223, -9.1393, "soccer"]];
const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const rows = [], totals = {};
for (const [mode, date] of [["off", day(2)], ["on", day(3)]]) {
  process.env.PLACES_SPECULATE = mode;
  const m0 = { ...places.verdictStats };
  for (const [name, lat, lon, sport] of LOCS) {
    const s0 = { ...places.verdictStats }, t0 = Date.now();
    let first, second, err = null;
    try {
      first = await places.search({ lat, lon, sport, date, start: "19:00", limit: 5 });
      const t1 = Date.now();
      await sleep(THINK);
      const t2 = Date.now();
      second = await places.search({ lat, lon, sport, date, start: "20:00", limit: 5 });
      rows.push({ mode, name, sport, date, places: first.places.length, firstSec: +((t1 - t0) / 1000).toFixed(1), secondSec: +((Date.now() - t2) / 1000).toFixed(1),
        judged: places.verdictStats.judged - s0.judged, reused: places.verdictStats.reused - s0.reused, joined: places.verdictStats.joined - s0.joined });
    } catch (e) { err = String(e.message || e).slice(0, 160); rows.push({ mode, name, error: err }); }
    console.log(JSON.stringify(rows.at(-1)));
    await sleep(mode === "on" ? 60000 : 2000); // let the background judging of the 18:00 guess finish before the next place
  }
  totals[mode] = Object.fromEntries(Object.keys(m0).map((k) => [k, places.verdictStats[k] - m0[k]]));
}
const ok = (m) => rows.filter((r) => r.mode === m && !r.error && r.places);
const mean = (xs) => +(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
const sum = (m, k) => ok(m).reduce((a, r) => a + r[k], 0);
const out = { label: "Judging ahead on courts near you (places.js PLACES_SPECULATE): the wait for a search after the person moves the time an hour, with judging ahead off and on; Muse Glimmer on the RTX 3090, OpenStreetMap and Open-Meteo, no Google key",
  think: THINK / 1000, locations: LOCS.length, rows,
  off: { searches: ok("off").length, secondMeanSec: mean(ok("off").map((r) => r.secondSec)), firstMeanSec: mean(ok("off").map((r) => r.firstSec)), ...totals.off },
  on: { searches: ok("on").length, secondMeanSec: mean(ok("on").map((r) => r.secondSec)), firstMeanSec: mean(ok("on").map((r) => r.firstSec)), ...totals.on } };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ off: out.off, on: out.on }));
fs.rmSync(tmp, { recursive: true, force: true });
