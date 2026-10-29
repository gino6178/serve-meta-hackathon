// Clubs for groups with no one to organise them (src/members/programs.js, clubs.js): children's sessions, gentle games
// for older adults, a charity tournament. All code, no model.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-programs-"));
process.env.CLUBS_FILE = path.join(tmp, "clubs.json");
const G = await import("../src/members/programs.js");
const C = await import("../src/members/clubs.js");
const ok = async () => ({});
const at = { lat: 24.8, lon: 120.99 };
const ann = { id: "ann", name: "Ann Wu" }, bo = { id: "bo", name: "Bo Lin" };

test("gentle games: 08:00 to 16:00, eight players at most, doubles for racket sports; children's games are the organiser's", () => {
  const sen = { kind: "seniors", owner: "ann" }, kids = { kind: "youth", owner: "ann" };
  const inv = { sport: "badminton", day: "Tue", start: "10:00", where: "Hall", spots: 4, going: [] };
  assert.deepEqual(G.holdInvite(sen, "bo", inv).invite.gentle, { minutes: 60, format: "doubles" });
  assert.match(G.holdInvite(sen, "bo", { ...inv, start: "19:00" }).error, /between 08:00 and 16:00/);
  assert.match(G.holdInvite(sen, "bo", { ...inv, start: "07:30" }).error, /between 08:00 and 16:00/);
  assert.match(G.holdInvite(sen, "bo", { ...inv, spots: 10 }).error, /8 players at most/);
  assert.equal(G.holdInvite(sen, "bo", { ...inv, sport: "running" }).invite.gentle.format, undefined);
  assert.match(G.holdInvite(kids, "bo", inv).error, /Only the organiser/);
  assert.ok(G.holdInvite(kids, "ann", inv).invite);
  assert.equal(G.holdInvite({ kind: "club" }, "bo", { ...inv, start: "22:00" }).invite.gentle, undefined);
});

test("children's sessions: first names only; every child plays the same time, give or take one rotation; a note for parents", () => {
  assert.match(G.rosterOf(["Mia", "mia@x.com"]).error, /First names only/);
  assert.match(G.rosterOf(["Mia 0912345678"]).error, /First names only/);
  assert.deepEqual(G.rosterOf("Mia, Leo，小明\nMia").roster, ["Mia", "Leo", "小明"]);
  const kids = Array.from({ length: 11 }, (_, i) => `K${i + 1}`);
  const { plan } = G.youthPlan({ present: kids, courts: 2, perCourt: 4, start: "09:00", end: "11:00", minutes: 15, day: "Sat", where: "School gym" });
  assert.equal(plan.rotations.length, 8);
  assert.ok(plan.rotations.every((r) => r.courts.flat().length === 8 && r.courts.flat().length + r.resting.length === 11));
  const t = Object.values(plan.played);
  assert.ok(Math.max(...t) - Math.min(...t) <= 15, JSON.stringify(plan.played));
  assert.equal(plan.note, "Badminton for the children Sat, 09:00 to 11:00 at School gym. Please pick up at 11:00.");
  assert.match(G.youthPlan({ present: [], start: "09:00", end: "10:00" }).error, /Mark who came/);
  assert.match(G.youthPlan({ present: ["A"], start: "09:00", end: "09:10", minutes: 15 }).error, /shorter than one rotation/);
});

test("the charity draw: balanced doubles, an odd one waiting, a round robin with no team twice in a slot", () => {
  const ps = [5, 4, 4, 3, 2, 1, 3].map((level, i) => ({ name: `P${i + 1}`, level }));
  const { draw } = G.draw(ps, { courts: 2, start: "09:00", minutes: 20 });
  assert.equal(draw.teams.length, 3); assert.equal(draw.waiting.length, 1);
  const lv = draw.teams.map((t) => t.level); assert.ok(Math.max(...lv) - Math.min(...lv) <= 1, JSON.stringify(draw.teams));
  assert.equal(draw.matches.length, 3, "three teams: each plays each once");
  const pairs = new Set(draw.matches.map((m) => [m.a, m.b].sort().join("-"))); assert.equal(pairs.size, 3);
  for (const slot of new Set(draw.matches.map((m) => m.at))) {
    const teams = draw.matches.filter((m) => m.at === slot).flatMap((m) => [m.a, m.b]);
    assert.equal(new Set(teams).size, teams.length, `no team twice at ${slot}`);
  }
  const big = G.draw(Array.from({ length: 16 }, (_, i) => ({ name: `Q${i}`, level: (i % 5) + 1 })), { courts: 3 }).draw;
  assert.equal(big.matches.length, 28); assert.ok(big.matches.every((m) => m.court <= 3));
  assert.match(G.draw(ps.slice(0, 3)).error, /Four players/);
  assert.match(G.entryOf({ level: 9 }).error, /level/); assert.match(G.entryOf({ pledge: -5 }).error, /pledge/);
});

test("clubs of each kind: a children's club is private with its roster for the organiser only; a charity takes entries until the draw", async () => {
  const kids = (await C.start(ann, { name: "Saturday Kids", sport: "badminton", where: "School gym", at, kind: "youth", privacy: "public" }, ok)).club;
  assert.equal(kids.privacy, "private"); assert.equal(kids.kind, "youth");
  await C.setRoster(ann, kids.id, ["Mia", "Leo", "Kai", "Noa", "Eli"], ok);
  assert.equal((await C.setRoster(bo, kids.id, ["X"], ok)).code, 403);
  C.join(bo, kids.id, true); C.answer(ann, kids.id, "bo", true);
  assert.equal(C.view(C.find(kids.id), "bo").roster, undefined, "only the organiser sees the children's names");
  const s = C.planSession(ann, kids.id, { present: ["Mia", "Leo", "Kai", "Ghost"], courts: 1, start: "09:00", end: "10:00", minutes: 20 });
  assert.deepEqual(Object.keys(s.plan.played).sort(), ["Kai", "Leo", "Mia"], "only children on the roster");
  assert.ok(C.view(C.find(kids.id), "bo").plan, "a parent in the club sees the plan");

  assert.match((await C.start(ann, { name: "Food Bank Cup", sport: "badminton", at, kind: "charity" }, ok)).error, /who the tournament is for/);
  const cup = (await C.start(ann, { name: "Food Bank Cup", sport: "badminton", at, kind: "charity", cause: "Hsinchu food bank" }, ok)).club;
  for (const [i, lv] of [5, 3, 2, 4].entries()) C.enter({ id: `p${i}`, name: `Player ${i}` }, cup.id, { level: lv, pledge: 100 * (i + 1) });
  const v = C.view(C.find(cup.id), "p1");
  assert.equal(v.entrants, 4); assert.equal(v.pledged, 1000); assert.deepEqual(v.entry, { level: 3, pledge: 200 });
  assert.equal(C.makeDraw(bo, cup.id, {}).code, 403);
  const d = C.makeDraw(ann, cup.id, { courts: 1, start: "10:00" });
  assert.equal(d.draw.teams.length, 2);
  assert.equal(C.enter({ id: "late", name: "Late" }, cup.id, { level: 3 }).code, 409);
  const sen = (await C.start(bo, { name: "Morning Doubles", sport: "badminton", at, kind: "seniors" }, ok)).club;
  assert.equal(sen.gentle.last, "16:00");
});
