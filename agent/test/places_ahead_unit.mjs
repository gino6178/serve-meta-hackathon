// Unit tests for judging ahead on courts near you (src/club/places.js): a verdict kept by its facts, a judging still
// running joined, the hours judged ahead. A stand-in for Ollama (/api/chat) on a local port: no model, no network.
//   node --test test/places_ahead_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

let asked = 0;
const srv = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    asked++;
    const content = JSON.stringify({ verdict: "good", reasons: [{ text: "The map shows a court with hoops.", cite: "map", quote: "" }] });
    setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ model: "muse-glimmer", message: { role: "assistant", content }, done: true, done_reason: "stop", prompt_eval_count: 50, eval_count: 20 })); }, 150);
  });
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-ahead-"));
Object.assign(process.env, { LLM_URL: `http://127.0.0.1:${srv.address().port}/v1`, LLM_MODEL: "muse-glimmer", LLM_ROUTE: "off", PLACES_FILE: `${tmp}/places.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GOOGLE_MAPS_API_KEY: "" });
const places = await import("../src/club/places.js");
test.after(() => { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const p = { id: "osm:1", name: "Riverside Park", kind: "pitch", dist: 300, tags: { sport: "basketball", hoops: "2" } };

test("the same facts are judged once; a judging still running is joined", async () => {
  asked = 0;
  const [a, b] = await Promise.all([places.judge(p, "basketball", "2026-11-05", "19:00", null), places.judge(p, "basketball", "2026-11-05", "19:00", null)]);
  assert.equal(asked, 1); assert.equal(a.verdict, "good"); assert.deepEqual(a, b);
  await places.judge(p, "basketball", "2026-11-05", "19:00", null);
  assert.equal(asked, 1, "kept");
  await places.judge(p, "basketball", "2026-11-05", "20:00", null);
  assert.equal(asked, 2, "another hour is other facts");
  await places.judge(p, "basketball", "2026-11-05", "20:00", { rain: 80, temp: 14, wind: 20 });
  assert.equal(asked, 3, "another forecast is other facts");
  assert.ok(places.verdictStats.reused >= 1 && places.verdictStats.joined >= 1);
});

test("the hours judged ahead: the hour after and the hour before, inside the day", () => {
  assert.deepEqual(places.nextStarts("19:00"), ["20:00", "18:00"]);
  assert.deepEqual(places.nextStarts("07:00"), ["08:00"]);
  assert.deepEqual(places.nextStarts("22:00"), ["21:00"]);
  process.env.PLACES_SPECULATE = "off";
  try { assert.equal(places.speculateOn(), false); } finally { delete process.env.PLACES_SPECULATE; }
});
