// Skill ratings with uncertainty (src/club/skill.js), the cold-start prior of the value of information (match/voi.js),
// and an existing calendar read into free times (members/calendar.js, POST /api/members/calendar/ics). No model.
//   node --test test/skill_calendar_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-skill-"));
Object.assign(process.env, { MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, NEEDS_FILE: `${tmp}/needs.json`, TASTE_FILE: `${tmp}/taste.json`, HUDDLE_FILE: `${tmp}/huddles.json`, CLUBS_FILE: `${tmp}/clubs.json`, SKILL_FILE: `${tmp}/skill.json`,
  FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off", LOOP_DIR: `${tmp}/loop`, STORE_FILE: `${tmp}/players.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off" });
const Sk = await import("../src/club/skill.js");
const voi = await import("../src/match/voi.js");
const K = await import("../src/members/calendar.js");

// ---- skill ----
test("skill: a win moves mu up and the loser's down, every sigma shrinks; an upset moves more", () => {
  const s = Sk.createSkill();
  const r = s.rate({ sport: "badminton", teams: [["ann"], ["bo"]], winner: 0, mode: "competitive" });
  assert.equal(r.rated, true);
  const ann = s.get("ann"), bo = s.get("bo");
  assert.ok(ann.mu > Sk.MU && bo.mu < Sk.MU, "the winner goes up, the loser down");
  assert.ok(Math.abs(ann.mu - Sk.MU - (Sk.MU - bo.mu)) < 1e-3, "two new players: symmetric");
  assert.ok(ann.sigma < Sk.SIGMA && bo.sigma < Sk.SIGMA, "one game makes both surer");
  assert.equal(ann.games, 1);
  // the reference numbers of Weng-Lin Bradley-Terry (full pairing) for two new players, tau 0
  const [[a], [b]] = Sk.update([[{ mu: 25, sigma: 25 / 3 }], [{ mu: 25, sigma: 25 / 3 }]], [0, 1], { tau: 0 });
  assert.ok(Math.abs(a.mu - 27.635) < 0.01 && Math.abs(b.mu - 22.365) < 0.01, `mu ${a.mu} ${b.mu}`);
  assert.ok(Math.abs(a.sigma - 8.0655) < 0.01, `sigma ${a.sigma}`);
  // the favourite beating the underdog moves less than the underdog winning
  const fav = { mu: 30, sigma: 4 }, dog = { mu: 20, sigma: 4 };
  const [[f1]] = Sk.update([[fav], [dog]], [0, 1]), [[f2]] = Sk.update([[fav], [dog]], [1, 0]);
  assert.ok(f1.mu - 30 < 30 - f2.mu, "an upset costs the favourite more than a win earns");
  assert.ok(Sk.winChance([fav], [dog]) > 0.75);
});

test("skill: a sport is a plain name: an object's own keys and odd strings are refused", () => {
  const s = Sk.createSkill();
  for (const sport of ["__proto__", "constructor", "prototype", "<b>", "x".repeat(40)]) assert.equal(s.rate({ sport, teams: [["ann"], ["bo"]], winner: 0, mode: "competitive" }).rated, false, sport);
  assert.equal({}.mu, undefined, "nothing reached Object.prototype");
  assert.equal(s.rate({ sport: "table tennis", teams: [["ann"], ["bo"]], winner: 0, mode: "competitive" }).rated, true);
});
test("skill: doubles rate the team; the partner with the wider sigma moves more", () => {
  const s = Sk.createSkill();
  s.rate({ teams: [["ann"], ["cy"]], winner: 0, mode: "competitive" }); // ann surer than bo now
  const before = { ann: s.get("ann"), bo: s.get("bo") };
  const r = s.rate({ sport: "badminton", teams: [["ann", "bo"], ["cy", "dee"]], winner: 0, mode: "competitive" });
  assert.equal(r.rated, true);
  const dAnn = s.get("ann").mu - before.ann.mu, dBo = s.get("bo").mu - before.bo.mu;
  assert.ok(dAnn > 0 && dBo > 0, "both winners go up");
  assert.ok(dBo > dAnn, "the less-known partner moves more");
  assert.ok(s.get("dee").mu < Sk.MU && s.get("cy").games === 2);
  assert.equal(s.rate({ teams: [["ann"], ["ann"]], winner: 0, mode: "competitive" }).rated, false, "a player on both sides is refused");
  assert.equal(s.get("ann", "tennis").games, 0, "per sport");
});

test("skill: casual games, gentle games, children's sessions and charity programmes never change ratings", () => {
  const s = Sk.createSkill(), base = () => JSON.stringify([s.get("ann"), s.get("bo")]), start = base();
  for (const g of [{}, { mode: "casual" }, { mode: "competitive", kind: "seniors" }, { mode: "competitive", kind: "youth" }, { mode: "competitive", kind: "charity" }, { mode: "competitive", gentle: true }, { mode: "competitive", children: true }, { mode: "competitive", program: "charity" }]) {
    const r = s.rate({ sport: "badminton", teams: [["ann"], ["bo"]], winner: 0, ...g });
    assert.equal(r.rated, false, JSON.stringify(g)); assert.ok(r.why);
    assert.equal(s.report("ann", { teams: [["ann"], ["bo"]], winner: 0, ...g }).rated, false, "not even held to confirm");
  }
  assert.equal(base(), start);
  assert.equal(s.known("ann"), false);
});

test("skill: a reported result waits for the other side; the reporter can't confirm it alone", () => {
  const s = Sk.createSkill();
  assert.equal(s.report("eve", { teams: [["ann"], ["bo"]], winner: 0, mode: "competitive" }).code, 403, "only a player reports");
  const { pending } = s.report("ann", { teams: [["ann"], ["bo"]], winner: 0, mode: "competitive" });
  assert.ok(pending);
  assert.equal(s.confirm("ann", pending).code, 403, "not by the reporter's side");
  assert.equal(s.get("ann").games, 0);
  assert.equal(s.confirm("bo", pending).rated, true);
  assert.ok(s.get("ann").mu > Sk.MU);
  assert.equal(s.confirm("bo", pending).code, 404, "once");
});

test("skill: pairing prefers close mu, and a close game when a level is uncertain", async () => {
  const unsure = { mu: 25, sigma: 8 }, sure = { mu: 25, sigma: 1.5 };
  assert.ok(Sk.learn(unsure, unsure) > Sk.learn(sure, sure) * 5, "high sigma: a game teaches more");
  assert.ok(Sk.learn(unsure, { mu: 25, sigma: 8 }) > Sk.learn(unsure, { mu: 45, sigma: 8 }), "a close game teaches more than a lopsided one");
  const { best } = await import("../src/club/pairing.js");
  const { readClub } = await import("../src/club/club.js");
  const ids = readClub().members.map((m) => m.id);
  // you at mu 25; one member at your level, everyone else far above: the close one ranks higher than without skills
  const skills = { you: { mu: 25, sigma: 7 }, ...Object.fromEntries(ids.map((id) => [id, { mu: 45, sigma: 2 }])) };
  const plain = await best({ skills: {} }), withSk = await best({ skills: { ...skills, [ids[ids.length - 1]]: { mu: 25.5, sigma: 7 } } });
  const pos = (r, id) => { const i = r.top.findIndex((x) => x.id === id); return i < 0 ? 99 : i; };
  if (withSk.top.length) {
    const id = ids[ids.length - 1];
    assert.ok(pos(withSk, id) <= pos(plain, id), "the close-mu member is not ranked lower");
    const row = withSk.top.find((x) => x.id === id);
    if (row) { assert.equal(row.mu, 25.5); assert.ok(row.parts.some((p) => p.k === "learn"), "the uncertain level is said"); }
  }
});

// ---- the value of information's cold start ----
test("VoI prior: the club's share free at that weekday-hour and sport, with a pseudo-count; flat without data", () => {
  const THU = { date: "2026-11-05", start: "19:00" }, SUN = { date: "2026-11-08", start: "07:00" };
  const members = [{ free: ["Thu 18-22"], sports: ["badminton"] }, { free: ["Thu 19-21"], sports: ["badminton"] }, { free: ["Sat 09-12"], sports: ["badminton"] }, { free: ["Sun 06-09"], sports: ["tennis"] }];
  const prior = voi.populationPrior({ members, sport: "badminton" });
  const thu = prior("Thu 19:00"), sun = prior("Sun 07:00");
  assert.ok(Math.abs(thu.a + thu.b - voi.PSEUDO) < 1e-9, "the pseudo-count is the prior's weight");
  assert.ok(Math.abs(thu.a / (thu.a + thu.b) - 3 / 5) < 1e-9, "2 of 3 badminton players free: (2+1)/(3+2)");
  assert.ok(Math.abs(sun.a / (sun.a + sun.b) - 1 / 5) < 1e-9, "the tennis player doesn't count for badminton");
  assert.ok(voi.posterior(null, THU, prior).p > voi.posterior(null, SUN, prior).p, "a cold member at a busy club hour is likelier free");
  assert.equal(voi.posterior(null, THU).p, 0.5, "no prior given: Beta(1, 1)");
  const none = voi.populationPrior({ members: [], sport: "badminton" });
  assert.deepEqual(none("Thu 19:00"), { a: 1, b: 1 }, "no data: Beta(1, 1)");
  // what the member's own agent saw soon outweighs the prior
  const seen = voi.posterior({ no: { "Thu 19:00": 3 } }, THU, prior);
  assert.ok(seen.p < 0.3);
  // private calendars: the pooled answers the player's agent has seen
  const pooled = voi.populationPrior({ members: [], mems: [{ yes: { "Thu 19:00": 3 } }, { no: { "Thu 19:00": 1 } }] });
  assert.ok(Math.abs(pooled("Thu 19:00").a / 2 - 4 / 6) < 1e-9);
  assert.deepEqual(pooled("Mon 09:00"), { a: 1, b: 1 });
  // the question reads the prior: a cold member is tried at the likelier hour, and asked about the uncertain one
  const q = voi.bestQuestion({ members: [{ id: "a", chance: 0.8, mem: null }], slots: [THU, SUN], prior });
  assert.equal(q.slot.start, "07:00"); assert.ok(Math.abs(q.p - 0.2) < 1e-9 && Math.abs(q.before - 0.48) < 1e-9, "P0 = 0.8 x 3/5 at Thursday 19:00");
});

// ---- calendars ----
const FROM = Date.UTC(2026, 9, 31, 4); // Sat 31 Oct 2026, noon in Taipei: the weeks start Sun 1 Nov
const cal = (...evs) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${evs.map((e) => `BEGIN:VEVENT\r\n${e.trim().split("\n").map((l) => l.trim()).join("\r\n")}\r\nEND:VEVENT\r\n`).join("")}END:VCALENDAR\r\n`;
const TZ = "Asia/Taipei";

test("ics: weekly work hours with a TZID leave the evenings free; a UTC event lands in the member's zone", () => {
  const r = K.freeFrom(cal(`
    SUMMARY:Office
    DTSTART;TZID=Asia/Taipei:20261102T090000
    DTEND;TZID=Asia/Taipei:20261102T180000
    RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`, `
    DTSTART:20261105T120000Z
    DTEND:20261105T140000Z
    RRULE:FREQ=WEEKLY;COUNT=10`), { tz: TZ, from: FROM });
  assert.ok(!r.error, r.error);
  assert.ok(r.free.includes("Mon 18-22") && r.free.includes("Mon 07-09"), r.free.join(", "));
  assert.ok(r.free.includes("Thu 18-20"), "12:00Z is 20:00 in Taipei: Thursday is busy from 20:00");
  assert.ok(r.free.includes("Sat 07-22") && r.free.includes("Sun 07-22"));
  assert.ok(!r.free.some((f) => /^Mon (09|1[0-7])-/.test(f)));
  assert.deepEqual(r.windows.find((w) => w.from === "18:00" && w.to === "22:00").days, ["Mon", "Tue", "Wed", "Fri"]);
  // the same file read in another zone: the UTC event moves, the TZID one stays Taipei's
  const ny = K.freeFrom(cal(`
    DTSTART:20261105T230000Z
    DTEND:20261106T010000Z
    RRULE:FREQ=WEEKLY`), { tz: "America/New_York", from: FROM });
  assert.ok(ny.free.includes("Thu 07-18") && ny.free.includes("Thu 20-22"), `18:00-20:00 New York: ${ny.free.join(", ")}`);
});

test("ics: a rule that can't be right (INTERVAL 0, a BYDAY with no real day) adds no busy time", () => {
  const ics = (rule) => ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20261102T100000Z", "DTEND:20261102T110000Z", `RRULE:${rule}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  for (const rule of ["FREQ=DAILY;INTERVAL=0", "FREQ=WEEKLY;BYDAY=XX"]) assert.equal(K.freeFrom(ics(rule), { tz: "UTC", from: Date.parse("2026-11-01T00:00:00Z") }).busyBlocks, 0, rule);
});
test("ics: daylight saving: a 19:00 New York game stays 19:00 across the change; UNTIL, INTERVAL and EXDATE", () => {
  const r = K.freeFrom(cal(`
    DTSTART;TZID=America/New_York:20261028T190000
    DTEND;TZID=America/New_York:20261028T210000
    RRULE:FREQ=WEEKLY`), { tz: "America/New_York", from: Date.UTC(2026, 9, 25, 16) }); // DST ends 1 Nov
  assert.ok(r.free.includes("Wed 07-19"), r.free.join(", "));
  assert.ok(!r.free.some((f) => /^Wed (19|20)/.test(f)));
  // every other week: busy in 2 of 4 weeks, more than a quarter, so busy; a single EXDATE leaves 1 of 4: free
  const two = K.freeFrom(cal(`
    DTSTART;TZID=Asia/Taipei:20261103T190000
    DTEND;TZID=Asia/Taipei:20261103T210000
    RRULE:FREQ=WEEKLY;INTERVAL=2`), { tz: TZ, from: FROM });
  assert.ok(two.free.includes("Tue 07-19"));
  const ex = K.freeFrom(cal(`
    DTSTART;TZID=Asia/Taipei:20261103T190000
    DTEND;TZID=Asia/Taipei:20261103T210000
    RRULE:FREQ=WEEKLY;UNTIL=20261124T235959Z
    EXDATE;TZID=Asia/Taipei:20261110T190000,20261117T190000
    EXDATE:20261124T110000Z`), { tz: TZ, from: FROM });
  assert.ok(ex.free.includes("Tue 07-22"), `three of four excluded (one by its UTC time): ${ex.free.join(", ")}`);
  const until = K.freeFrom(cal(`
    DTSTART;TZID=Asia/Taipei:20261103T190000
    DTEND;TZID=Asia/Taipei:20261103T210000
    RRULE:FREQ=WEEKLY;UNTIL=20261103T235959Z`), { tz: TZ, from: FROM });
  assert.ok(until.free.includes("Tue 07-22"), "one time only: a one-off leaves the weekly time free");
});

test("ics: all-day events are busy days; transparent, cancelled and alarms are not events; DURATION and floating times", () => {
  const r = K.freeFrom(cal(`
    DTSTART;VALUE=DATE:20261107
    DTEND;VALUE=DATE:20261108
    RRULE:FREQ=WEEKLY`, `
    DTSTART;VALUE=DATE:20261108
    RRULE:FREQ=WEEKLY
    TRANSP:TRANSPARENT`, `
    DTSTART:20261104T180000
    DURATION:PT2H
    RRULE:FREQ=DAILY;BYDAY=WE
    BEGIN:VALARM
    TRIGGER:-PT15M
    DTSTART:20261101T000000Z
    END:VALARM`, `
    DTSTART:20261105T070000
    DTEND:20261105T220000
    RRULE:FREQ=WEEKLY
    STATUS:CANCELLED`), { tz: TZ, from: FROM });
  assert.ok(!r.free.some((f) => f.startsWith("Sat")), "Saturdays are all-day busy");
  assert.ok(r.free.includes("Sun 07-22"), "a transparent all-day event leaves the day free");
  assert.ok(r.free.includes("Thu 07-22"), "a cancelled event is no event");
  assert.ok(r.events === 2);
  assert.ok(r.free.includes("Wed 07-18") && r.free.includes("Wed 20-22"), `floating 18:00 for 2 hours, daily: ${r.free.join(", ")}`);
  assert.match(K.freeFrom("hello", { tz: TZ }).error, /iCalendar/);
  assert.match(K.freeFrom(cal(), { tz: "Mars/Olympus" }).error, /time zone/);
});

test("ics privacy: titles, descriptions, places and attendees never leave the parser, the route or the saved limits", async () => {
  const secret = cal(`
    UID:abc-123@example.com
    SUMMARY:Oncology appointment
    DESCRIPTION:Bring the scan
    LOCATION:General Hospital
    ATTENDEE;CN=Dr Wu:mailto:wu@hospital.example
    ORGANIZER:mailto:me@example.com
    DTSTART;TZID=Asia/Taipei:20261102T090000
    DTEND;TZID=Asia/Taipei:20261102T180000
    RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`);
  const words = /Oncology|scan|Hospital|Wu|example\.com|abc-123/i;
  const p = K.parse(secret);
  assert.doesNotMatch(JSON.stringify(p), words, "the parsed events hold times only");
  assert.deepEqual(Object.keys(p.events[0]).sort(), ["end", "exdates", "rrule", "start"]);
  // through the route, with a member's session
  const M = await import("../src/members/members.js"), api = await import("../src/members/api.js"), T = await import("../src/members/taste.js");
  const { member } = M.demo("Ana Lee"), session = M.sessionFor(member.id);
  const call = async (pathName, body) => {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: "POST", url: pathName, headers: { "x-serve-session": session } });
    let out = null; await api.route(req, {}, new URL(`http://x${pathName}`), { json: (_res, code, b) => { out = { code, body: b }; }, o: {} });
    return out;
  };
  const preview = await call("/api/members/calendar/ics", { ics: secret, tz: TZ });
  assert.equal(preview.code, 200);
  assert.doesNotMatch(JSON.stringify(preview.body), words);
  assert.equal(T.get(member.id).windows.length, 0, "a preview saves nothing");
  const saved = await call("/api/members/calendar/ics", { ics: secret, tz: TZ, save: true });
  assert.equal(saved.code, 200);
  assert.ok(T.get(member.id).windows.some((w) => w.from === "18:00" && w.days.includes("Mon")));
  assert.doesNotMatch(JSON.stringify(saved.body), words);
  assert.doesNotMatch(fs.readFileSync(process.env.TASTE_FILE, "utf8"), words, "the stored limits hold only times");
  assert.equal((await call("/api/members/calendar/ics", { ics: 5 })).code, 400);
  // and a result: casual is never held; a competitive one waits for the other side
  const { member: bo } = M.demo("Bo Lin");
  const casual = await call("/api/members/result", { teams: [[member.id], [bo.id]], winner: 0 });
  assert.equal(casual.body.rated, false);
  const comp = await call("/api/members/result", { teams: [[member.id], [bo.id]], winner: 0, mode: "competitive" });
  assert.ok(comp.body.pending);
});

test("skill: every named player but the reporter confirms their own part; a stranger named in it is never rated", () => {
  const s = Sk.createSkill(), comp = (teams, winner = 0, sport = "padel") => ({ sport, teams, winner, mode: "competitive" });
  // ravi names leo as his partner; zed, the accomplice, confirms: not enough, leo never said yes
  const { pending, waiting } = s.report("ravi", comp([["ravi", "leo"], ["zed"]]));
  assert.equal(waiting, 2);
  const z = s.confirm("zed", pending);
  assert.deepEqual([z.confirmed, z.rated, z.waiting], [true, false, 1]);
  assert.equal(s.known("leo", "padel"), false, "leo isn't rated for a game he didn't confirm");
  assert.equal(s.confirm("ravi", pending).code, 403, "the reporter doesn't confirm");
  assert.equal(s.confirm("maya", pending).code, 404, "nor someone not in it, who isn't told it exists");
  assert.equal(s.pendingFor("leo")[0].id, pending, "leo sees it waiting for him");
  assert.equal(s.pendingFor("leo")[0].confirmed, false);
  assert.deepEqual(s.decline("leo", pending), { declined: true }, "and turns it down");
  assert.equal(s.confirm("leo", pending).code, 404);
  assert.equal(s.known("zed", "padel") || s.known("ravi", "padel"), false, "nobody rated");
  // a real one: once the last player confirms, the answer holds only their own rating
  const g = s.report("ann", comp([["ann", "bo"], ["cy", "dee"]], 0, "tennis")).pending;
  s.confirm("cy", g); s.confirm("bo", g);
  const last = s.confirm("dee", g);
  assert.equal(last.rated, true);
  assert.deepEqual(Object.keys(last), ["rated", "sport", "rating"]);
  assert.deepEqual(last.rating, s.get("dee", "tennis"));
  assert.ok(s.get("ann", "tennis").games === 1 && s.get("bo", "tennis").mu > Sk.MU);
});

test("skill: the same game is rated once; a second report waits for the first; the same result twice in a day is refused", () => {
  const s = Sk.createSkill(), comp = (teams, winner) => ({ sport: "squash", teams, winner, mode: "competitive" });
  const day = new Date(2026, 9, 30, 10).getTime();
  const a = s.report("maya", comp([["maya"], ["ravi"]], 0), day).pending;
  assert.equal(s.report("maya", comp([["maya"], ["ravi"]], 0), day + 1).code, 409, "a retry while it waits");
  assert.equal(s.report("ravi", comp([["ravi"], ["maya"]], 0), day + 2).code, 409, "the opposite result while it waits");
  assert.equal(s.report("maya", { ...comp([["maya"], ["ravi"]], 0), sport: "tennis" }, day + 3).pending ? 1 : 0, 1, "another sport is another game");
  assert.equal(s.report("maya", comp([["maya"], ["ravi"]], 0), day).code, 409);
  assert.equal(s.report("ann", comp([["ann"], ["ann"]], 0), day).code, 400, "a player on both teams");
  assert.equal(s.confirm("ravi", a, day + 60e3).rated, true);
  assert.equal(s.get("maya", "squash").games, 1);
  assert.equal(s.report("ravi", comp([["ravi"], ["maya"]], 1), day + 3600e3).code, 409, "the same result again that day, sides swapped");
  assert.ok(s.report("ravi", comp([["ravi"], ["maya"]], 0), day + 3600e3).pending, "a rematch ravi won is another game");
  assert.ok(s.pendingFor("maya").some((x) => !x.mine && x.waiting === 1));
  assert.equal(s.pendingFor("eve").length, 0);
});

test("ics route: an event-less or broken file is never saved over the limits; save takes true or \"true\"", async () => {
  const M = await import("../src/members/members.js"), api = await import("../src/members/api.js"), T = await import("../src/members/taste.js");
  const { member } = M.demo("Calla Ng"), session = M.sessionFor(member.id);
  const call = async (method, pathName, body) => {
    const req = Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: pathName, headers: { "x-serve-session": session } });
    let out = null; await api.route(req, {}, new URL(`http://x${pathName}`), { json: (_res, code, b) => { out = { code, body: b }; }, o: {} });
    return out;
  };
  T.setLimits(member.id, { windows: [{ days: ["Sat"], from: "09:00", to: "12:00" }] });
  const before = JSON.stringify(T.get(member.id).windows);
  for (const ics of ["BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n", "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261102T090000Z\r\n"]) {
    const r = await call("POST", "/api/members/calendar/ics", { ics, tz: TZ, save: true });
    assert.equal(r.code, 400, JSON.stringify(r.body)); assert.match(r.body.error, /No events/);
    assert.equal(JSON.stringify(T.get(member.id).windows), before, "the limits stay");
  }
  const office = cal(`
    DTSTART;TZID=Asia/Taipei:20261102T090000
    DTEND;TZID=Asia/Taipei:20261102T180000
    RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`);
  assert.equal((await call("POST", "/api/members/calendar/ics", { ics: office, tz: TZ, save: "true" })).code, 200);
  assert.notEqual(JSON.stringify(T.get(member.id).windows), before, "the string \"true\" saves");
  // results through the routes: pending lists them; confirm answers with the confirmer's rating alone
  const { member: bo } = M.demo("Bo Lin"), { member: cy } = M.demo("Cy Ito");
  const id = (await call("POST", "/api/members/result", { sport: "tennis", teams: [[member.id], [bo.id, cy.id]], winner: 0, mode: "competitive" })).body.pending;
  assert.equal((await call("POST", "/api/members/result", { sport: "tennis", teams: [[cy.id, bo.id], [member.id]], winner: 0, mode: "competitive" })).code, 409);
  const mine = (await call("GET", "/api/members/result/pending")).body.pending;
  assert.equal(mine[0].id, id); assert.equal(mine[0].by, "You"); assert.equal(mine[0].teams[1][0].name, "Bo Lin");
  const Sk2 = Sk.store();
  assert.equal(Sk2.confirm(bo.id, id).rated, false);
  const last = Sk2.confirm(cy.id, id);
  assert.deepEqual(Object.keys(last), ["rated", "sport", "rating"]);
  assert.ok(!JSON.stringify(last).includes(member.id), "no other player's rating");
});
