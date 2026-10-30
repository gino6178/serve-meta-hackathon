// Private calendars through the planning code (src/agents/freebusy.js), no model: with private calendars a member's
// free times are read only by its own agent, which answers yes or no for one time asked about, under the rolling
// disclosure budget per (member, asker) shared with the talks (safety/disclosure.js); without them the shared calendar
// is read as before.   node --test test/freebusy_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-fb-"));
Object.assign(process.env, { BOOKINGS_FILE: path.join(tmp, "bookings.json") });
const fb = await import("../src/agents/freebusy.js");
const disclosure = await import("../src/safety/disclosure.js");
const play = await import("../src/club/play.js");
const WEB = path.join(import.meta.dirname, "..", "..", "web", "public", "data");
const club0 = JSON.parse(fs.readFileSync(path.join(WEB, "club.json"), "utf8")), venues = JSON.parse(fs.readFileSync(path.join(WEB, "venues.json"), "utf8"));
const MON = new Date(2026, 10, 2, 9, 0); // Monday 2 Nov 2026, 09:00

// a member whose calendar throws when anything but its own agent (freebusy.js answering) reads it
const sealed = (m) => { const free = m.free; const o = { ...m }; delete o.free; Object.defineProperty(o, "free", { enumerable: true, get() { if (!fb.reading()) throw new Error(`${m.id}'s calendar read outside its agent`); return free; } }); return o; };

const sure0 = (fn) => { const v = process.env.A2A_BUDGET_SURE; process.env.A2A_BUDGET_SURE = "0"; try { return fn(); } finally { if (v == null) delete process.env.A2A_BUDGET_SURE; else process.env.A2A_BUDGET_SURE = v; } };

test("one member, one asker: 24 hours of the week, then no; an hour asked again costs nothing, on any date", () => sure0(() => {
  fb.resetProbes();
  const hana = { id: "hana", free: ["Mon 00-24"] };
  for (let h = 0; h < 24; h++) assert.equal(fb.free(hana, { date: "2026-11-02", start: h * 60, minutes: 30, priv: true }), true);
  assert.equal(fb.free(hana, { date: "2026-11-03", start: "20:00", minutes: 30, priv: true }), false, "past the budget: no (a new hour)");
  assert.equal(fb.free(hana, { date: "2026-11-02", start: "06:30", minutes: 30, priv: true }), true, "the same hour: answered again");
  assert.equal(fb.free(hana, { date: "2026-11-09", start: "20:00", minutes: 30, priv: true }), true, "the same hour a week on costs nothing");
  assert.equal(fb.free(hana, { date: "2026-11-03", start: "20:00", minutes: 30, priv: true, asker: "kenji" }), false, "another asker has its own budget (and she is not free Tuesday)");
  assert.deepEqual(fb.probes(), { asked: 27, refused: 1, budget: 24 });
}));

test("an attacker walking new dates is refused once the rolling budget is spent", () => sure0(() => {
  fb.resetProbes();
  const hana = { id: "hana", free: ["Mon 07-23", "Wed 18-22", "Sat 09-13"] }, t0 = new Date(2026, 10, 2, 9).getTime();
  // four weeks of dates (one window), every hour 07-22: the old per-date cap (24 a day) let all 448 through
  const learned = new Set();
  for (let d = 0; d < 28; d++) for (let h = 7; h < 23; h++) {
    const dt = new Date(t0 + d * 864e5), date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const before = fb.probes().asked;
    fb.free(hana, { date, start: h * 60, minutes: 60, priv: true, asker: "mallory", now: t0 + d * 864e5 });
    if (fb.probes().asked > before) learned.add(disclosure.cellOf(date, h * 60));
  }
  assert.equal(learned.size, 24, "24 hours of her week, of 112");
  assert.equal(fb.probes().refused, 28 * 16 - fb.probes().asked);
  assert.ok(fb.probes().refused >= 448 - 4 * 24, `refused ${fb.probes().refused}`);
  // one budget: the hours spent on probes are spent for the talks too (limitAnswer withholds a new hour)
  const L = disclosure.ledger(), u = L.used("hana", "mallory", t0 + 27 * 864e5);
  assert.equal(u.pair, 24);
  const g = L.grant("hana", "mallory", [{ id: "x", cell: "Fri 19" }], t0 + 27 * 864e5);
  assert.deepEqual(g.withheld, ["x"]);
  // and the window rolls: four weeks after the walk began, the oldest hours are free again
  assert.ok(fb.free(hana, { date: "2026-12-28", start: "08:00", minutes: 60, priv: true, asker: "mallory", now: t0 + 85 * 864e5 }));
  // many asker ids buy no more than the member's own cap (72)
  fb.resetProbes();
  // (each id walks the week from where the one before stopped)
  const week = Array.from({ length: 7 * 16 }, (_, i) => [`2026-11-0${2 + Math.floor(i / 16)}`, 7 + (i % 16)]), cells = new Set();
  ["s1", "s2", "s3", "s4", "s5"].forEach((a, k) => week.forEach((_, i) => {
    const [date, h] = week[(i + k * 24) % week.length], before = fb.probes().asked;
    fb.free(hana, { date, start: h * 60, minutes: 60, priv: true, asker: a, now: t0 });
    if (fb.probes().asked > before) cells.add(disclosure.cellOf(date, h * 60));
  }));
  assert.equal(cells.size, 72);
}));

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
  // (the ledger's inference check, A2A_BUDGET_SURE, may withhold a few hours that would pin a day; the best time stands)
  assert.ok(fb.probes().asked > 0 && fb.probes().refused < fb.probes().asked / 20, JSON.stringify(fb.probes()));
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
