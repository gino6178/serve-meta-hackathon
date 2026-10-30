// Unit tests for how a member's agent learns how they like to play (members/taste.js) and how a venue's agent talks
// price (members/deals.js). No network: places are made up here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TASTE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taste-")), "taste.json");
const T = await import("../src/members/taste.js");
const D = await import("../src/members/deals.js");

test("a few picks teach the agent what matters to its member", () => {
  for (let i = 0; i < 6; i++) {
    const q = T.question("near", { force: true });
    T.choose("near", q, q.a.km <= q.b.km ? "a" : "b"); // always the closer game
  }
  const w = T.weights(T.get("near"));
  assert.ok(w.place > 0.3 && w.place === Math.max(...Object.values(w)), JSON.stringify(w));
  assert.match(T.view(T.get("near")).summary, /How far it is matters most/);
});
test("before any answer, weekday evenings beat weekday mornings", () => {
  const t = T.get("new");
  assert.ok(T.timeFit(t, "Thu evening") > T.timeFit(t, "Thu morning"));
});
test("a no for the time moves that slot down and says so", () => {
  const o = { date: "2026-11-05", start: "19:30", km: 2, each: 80, busy: 0.4 };
  const before = T.timeFit(T.get("x"), "Thu evening");
  const r = T.reply("x", o, false, "time");
  assert.ok(T.timeFit(T.get("x"), "Thu evening") < before);
  assert.match(r.line, /Thursday evenings/);
});
test("a venue's agent never goes under its floor, and a full hour is the list price", () => {
  const v = { id: "v1", name: "Hall", kind: "venue", sport: "badminton", list: 300, lat: 0, lon: 0 };
  const quiet = D.talk(v, { date: "2026-11-04", start: "14:00", players: 4, push: 1 });
  const t = D.terms(v, "2026-11-04", "14:00");
  assert.ok(quiet.price >= t.floor && quiet.price < quiet.list, JSON.stringify(quiet));
  const full = D.talk(v, { date: "2026-11-04", start: "19:00", players: 4, push: 1 });
  if (D.busy(v, "2026-11-04", "19:00") >= 0.85) assert.equal(full.price, full.list);
  assert.ok(full.price >= quiet.price);
});
