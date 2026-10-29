// Private calendars through the planning code (src/agents/freebusy.js), no model: with private calendars a member's
// free times are read only by its own agent, which answers yes or no for one time asked about, under a daily budget
// per asker; without them the shared calendar is read as before.   node --test test/freebusy_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-fb-"));
Object.assign(process.env, { BOOKINGS_FILE: path.join(tmp, "bookings.json"), A2A_PROBE_BUDGET: "24" });
const fb = await import("../src/agents/freebusy.js");
const play = await import("../src/club/play.js");
const WEB = path.join(import.meta.dirname, "..", "..", "web", "public", "data");
const club0 = JSON.parse(fs.readFileSync(path.join(WEB, "club.json"), "utf8")), venues = JSON.parse(fs.readFileSync(path.join(WEB, "venues.json"), "utf8"));
const MON = new Date(2026, 10, 2, 9, 0); // Monday 2 Nov 2026, 09:00

// a member whose calendar throws when anything but its own agent (freebusy.js answering) reads it
const sealed = (m) => { const free = m.free; const o = { ...m }; delete o.free; Object.defineProperty(o, "free", { enumerable: true, get() { if (!fb.reading()) throw new Error(`${m.id}'s calendar read outside its agent`); return free; } }); return o; };

test("one member, one asker: 24 different times a day, then no; a time asked again costs nothing", () => {
  fb.resetProbes();
  const hana = { id: "hana", free: ["Mon 06-23"] };
  for (let h = 0; h < 24; h++) assert.equal(fb.free(hana, { date: "2026-11-02", start: 6 * 60 + h * 30, minutes: 30, priv: true }), true);
  assert.equal(fb.free(hana, { date: "2026-11-02", start: "20:00", minutes: 30, priv: true }), false, "past the budget: no, though she is free");
  assert.equal(fb.free(hana, { date: "2026-11-02", start: 6 * 60, minutes: 30, priv: true }), true, "asked before: answered again");
  assert.equal(fb.free(hana, { date: "2026-11-03", start: "20:00", minutes: 30, priv: true }), false, "another day has its own budget (and she is not free Tuesday)");
  assert.equal(fb.free(hana, { date: "2026-11-02", start: "20:00", minutes: 30, priv: true, asker: "kenji" }), true, "another asker has its own budget");
  assert.deepEqual(fb.probes(), { asked: 26, refused: 1, budget: 24 });
});

test("without private calendars: the shared calendar, no budget", () => {
  fb.resetProbes();
  const m = { id: "ravi", free: ["Mon 19-22"] };
  for (let i = 0; i < 40; i++) fb.free(m, { date: "2026-11-02", start: 19 * 60, minutes: 90 });
  assert.equal(fb.free(m, { date: "2026-11-02", start: "19:00", minutes: 90 }), true);
  assert.equal(fb.free(m, { date: "2026-11-02", start: "21:00", minutes: 90 }), false);
  assert.equal(fb.probes().asked, 0);
});

test("the play search with private calendars: nobody's calendar read but by its agent; the partners' rows show only the time agreed", () => {
  fb.resetProbes();
  const club = { ...club0, members: club0.members.map(sealed) };
  const intent = { sport: "badminton", days: [], from: null, to: null, minutes: 90, format: "singles", with: [], challenge: false, focus: null };
  const s = play.search({ intent, you: { level: "B" }, club, venues, now: MON, priv: true });
  assert.ok(s.options.length, "options found from the agents' yes and no");
  const best = s.options[0], cal = s.calendar;
  assert.equal(cal.private, true);
  for (const [i, p] of cal.people.entries()) {
    if (p.id === "you") continue;
    const rows = cal.days.map((d) => d.rows[i]);
    assert.deepEqual(rows.flat(), [[play.helpers.toMin(best.start), play.helpers.toMin(best.end)]], `${p.id}: only the agreed time`);
  }
  assert.ok(fb.probes().asked > 0 && fb.probes().refused === 0);
  // the same search with the calendars shared reads them, and finds the same best time
  const open = play.search({ intent, you: { level: "B" }, club: club0, venues, now: MON });
  assert.equal(open.options[0].start, best.start);
  assert.throws(() => play.search({ intent, you: { level: "B" }, club, venues, now: MON }), /read outside its agent/, "shared mode reads the calendars directly");
});

test("the Match helper's daily ask with private calendars: the same time and partners, asked one time at a time", async () => {
  const ask = await import("../src/agents/ask.js");
  fb.resetProbes();
  const shared = ask.opening({ now: MON }), priv = ask.opening({ now: MON, priv: true });
  assert.ok(!shared.none, shared.none);
  assert.deepEqual([priv.date, priv.start, priv.partners.map((p) => p.id)], [shared.date, shared.start, shared.partners.map((p) => p.id)]);
  assert.ok(fb.probes().asked > 0 && fb.probes().refused === 0);
});
