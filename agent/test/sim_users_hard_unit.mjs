// The difficult simulated people (test/sim_users/hard.mjs) and the pass^k scoring (test/sim_users/passk.mjs): offline,
// no gateway, no model.
//   node --test test/sim_users_hard_unit.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "./sim_users/personas.mjs";
import * as I from "./sim_users/inertia.mjs";
import * as H from "./sim_users/hard.mjs";
import { passHat, passK, beliefOf, outcome, summarize } from "./sim_users/passk.mjs";
import { isPlayRequest } from "../src/match/flow.js";

const personas = generate(), byId = Object.fromEntries(personas.map((p) => [p.id, p]));
const HARD = H.assign(personas, 5);
const one = (kind) => byId[Object.keys(HARD).find((k) => HARD[k] === kind)];
// a game at one of the person's usual times, and one at a time they are not free
const slotOf = (p, date0 = "2026-11-09") => { for (let i = 1; i < 8; i++) { const d = new Date(`${date0}T12:00`); d.setDate(d.getDate() + i); const date = I.ymd(d), w = I.windows(p.free).find((x) => x.day === I.dayOf(date)); if (w) return { date, start: I.hm(w.from) }; } return null; };
const ctx = (p, trial, extra = {}) => ({ scen: "s1", trial, step: "confirm:x:1", kind: "confirm", minutes: 90, asked: null, seen: { questions: 1, messages: 1 }, ...slotOf(p), ...extra });
const trials = (f, n = 400) => Array.from({ length: n }, (_, t) => f(t));

test("difficult people: a quarter of the club, every kind once, the same from the same seed", () => {
  assert.equal(Object.keys(HARD).length, 5);
  assert.deepEqual(new Set(Object.values(HARD)), new Set(H.TYPES));
  assert.deepEqual(H.assign(personas, 5), HARD);
  assert.notDeepEqual(H.assign(personas, 6), HARD);
  assert.equal(Object.keys(H.assign(personas, 5, 0.3)).length, 6);
  assert.ok(Object.keys(HARD).every((id) => byId[id]));
});

test("every answer is reproducible: the same seed, scenario, trial and step give the same answer", () => {
  for (const id of Object.keys(byId)) { const p = byId[id], c = ctx(p, 3); assert.deepEqual(H.answer(9, p, HARD[id] || null, c), H.answer(9, p, HARD[id] || null, c)); }
  const p = one("vague"), a = trials((t) => H.answer(9, p, "vague", ctx(p, t)).act);
  assert.ok(new Set(a).size > 1, "different trials draw differently");
});

test("a cooperative person answers as the inertia model does, and keeps their own request", () => {
  const p = personas.find((x) => !HARD[x.id]);
  for (let t = 0; t < 50; t++) {
    const c = ctx(p, t), a = H.answer(9, p, null, c), g = I.answerGame(9, p, { date: c.date, start: c.start, minutes: 90, need: 1, key: ["s1", t, "confirm", c.step].join(":") });
    assert.equal(a.coop, g);
    assert.equal(a.act, { yes: "yes", other: "other", ignore: "silent" }[g] || "no");
    assert.equal(a.delay, "now");
    assert.equal(H.answer(9, p, null, { ...c, asked: { date: c.date, start: c.start } }).act, "yes");
  }
  assert.equal(trials((t) => H.backsOut(9, p, null, { scen: "s1", trial: t })).filter(Boolean).length, 0, "nobody cooperative backs out");
});

test("the flipper says yes when free, then backs out in about 70% of trials", () => {
  const p = one("flipper"), ys = trials((t) => H.answer(9, p, "flipper", ctx(p, t)));
  const free = ys.filter((a, t) => I.freeThen(9, p, ctx(p, t).date, ctx(p, t).start));
  assert.ok(free.every((a) => a.act === "yes"));
  const out = trials((t) => H.backsOut(9, p, "flipper", { scen: "s1", trial: t })).filter(Boolean).length / 400;
  assert.ok(out > 0.6 && out < 0.8, `backs out ${out}`);
  assert.match(H.bailText(p, "Tue", "19:00"), /19:00/);
});

test("the ghost never answers in about half the trials and answers late in the rest", () => {
  const p = one("ghost"), as = trials((t) => H.answer(9, p, "ghost", ctx(p, t)));
  const silent = as.filter((a) => a.act === "silent").length / as.length, late = as.filter((a) => a.delay === "late");
  assert.ok(silent > 0.4 && silent < 0.6, `silent ${silent}`);
  assert.ok(late.length > 0 && late.every((a) => a.act !== "silent"));
  // the same trial: the same mode for every question in it
  assert.equal(H.ghostMode(9, p, { scen: "s1", trial: 7 }), H.ghostMode(9, p, { scen: "s1", trial: 7 }));
});

test("the budget person answers within a hidden tolerance and goes quiet past it", () => {
  const p = one("budget");
  for (let t = 0; t < 60; t++) {
    const b = H.budgetOf(9, p, { scen: "s1", trial: t });
    assert.ok(b.questions >= 1 && b.questions <= 2 && b.messages >= 3 && b.messages <= 5);
    const within = H.answer(9, p, "budget", ctx(p, t, { seen: { questions: b.questions, messages: b.messages } }));
    assert.notEqual(within.act, "silent");
    const past = H.answer(9, p, "budget", ctx(p, t, { seen: { questions: b.questions + 1, messages: 1 } }));
    assert.equal(past.act, "silent"); assert.equal(past.gaveUp, true);
    assert.equal(H.answer(9, p, "budget", ctx(p, t, { seen: { questions: 1, messages: b.messages + 1 } })).act, "silent");
  }
});

test("the drifter turns down the day they dropped, says so in words, and still plays the others", () => {
  const p = one("drifter"), day = H.dropDay(5, p);
  assert.ok(I.windows(p.free).some((w) => w.day === day), "a day they used to play");
  assert.equal(H.dropDay(5, p), day);
  const txt = H.driftText(5, p);
  assert.ok(txt.length > 10);
  for (let i = 1; i < 8; i++) {
    const d = new Date("2026-11-09T12:00"); d.setDate(d.getDate() + i); const date = I.ymd(d), w = I.windows(p.free).find((x) => x.day === I.dayOf(date));
    if (!w) continue;
    // (the trial's dice come from the run seed, the dropped day from the club seed)
    const a = H.answer(99, p, "drifter", { scen: "s1", trial: 0, step: "x", kind: "confirm", date, start: I.hm(w.from), seen: { questions: 1, messages: 1 }, club: 5 });
    if (w.day === day) assert.equal(a.act, "no"); else assert.notEqual(a.why, `no longer plays on ${day}`);
  }
});

test("the vague person answers in words, not a tap, about three times in four", () => {
  const p = one("vague"), as = trials((t) => H.answer(9, p, "vague", ctx(p, t)));
  const words = as.filter((a) => a.act === "text");
  assert.ok(words.length / as.length > 0.65 && words.length / as.length < 0.85);
  assert.ok(words.every((a) => typeof a.text === "string" && a.text.length > 3 && !/\b(yes|no)\b/i.test(a.text)));
});

test("the request is one Serve reads as a request; the vague asker names no day or time", () => {
  const p = personas[0], slot = { day: "Thu", start: "19:00", format: "singles" };
  assert.ok(isPlayRequest(H.requestText(p, null, slot)));
  assert.match(H.requestText(p, null, slot), /Thursday at 19:00/);
  const v = H.requestText(p, "vague", slot);
  assert.ok(isPlayRequest(v));
  assert.doesNotMatch(v, /\d|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
});

test("pass^k: C(c,k)/C(n,k), averaged over scenarios", () => {
  assert.equal(passHat(4, 4, 4), 1);
  assert.equal(passHat(3, 4, 4), 0);
  assert.equal(passHat(3, 4, 2), 0.5);
  assert.equal(passHat(2, 4, 1), 0.5);
  assert.equal(passHat(1, 2, 3), null);
  assert.equal(passK([{ c: 4, n: 4 }, { c: 2, n: 4 }], 1), 0.75);
  assert.equal(passK([{ c: 4, n: 4 }, { c: 3, n: 4 }], 4), 0.5);
});

test("what the gateway's sentences say about a game", () => {
  assert.equal(beliefOf("Booked: Singles Tuesday 19:00 at Midtown Community Gym with Tseng, court 2. Tseng said yes."), "booked");
  assert.equal(beliefOf("› Your agent: ...\n\nBooked: Singles Tuesday 19:00 at X, court 2. I'll remind you an hour before."), "booked");
  assert.equal(beliefOf("Your agent said yes for you: Singles Tuesday 19:00 at X with Hwang. It's in your calendar"), "booked");
  assert.equal(beliefOf("Singles Tuesday 19:00 at X with Tseng: their agent agreed, and I've asked Tseng to confirm. I'll book it as soon as they say yes."), "waiting");
  assert.equal(beliefOf("Thanks, you're in. I'll book it once everyone has said yes."), "waiting");
  assert.equal(beliefOf("Chiang can't make Doubles Thursday 20:00 at Y after all, so nothing is booked. Looking for someone else…"), "none");
  assert.equal(beliefOf("No deal: nobody who plays badminton doubles is free at your times this week."), "none");
  assert.equal(beliefOf("OK, you're out of it. I've let go of the time."), "none");
  assert.equal(beliefOf("On it: asking the agents of the people most likely to say yes"), null);
  assert.equal(beliefOf("Sounds good."), null);
});

test("an outcome: a game that stands, a back-out that leaves a false booked, waiting, and an honest no", () => {
  const g = "2026-11-10 19:00", b = { date: "2026-11-10", start: "19:00", players: ["a", "b"], cancelled: false };
  const ok = outcome({ asker: "a", bookings: [b], human: { a: { [g]: "in" }, b: { [g]: "in" } }, beliefs: { a: [{ kind: "booked", game: g }], b: [{ kind: "booked", game: g }] }, saidYes: [{ id: "a", game: g }, { id: "b", game: g }] });
  assert.equal(ok.pass, true); assert.equal(ok.honest, true); assert.deepEqual(ok.falseBooked, []);
  // the asker backs out after the booking, by message: the partner still holds "booked", the asker knows
  const fell = outcome({ asker: "a", bookings: [b], human: { a: { [g]: "out" }, b: { [g]: "in" } }, beliefs: { a: [{ kind: "booked", game: g }], b: [{ kind: "booked", game: g }] }, backedOut: [{ id: "a", game: g }] });
  assert.equal(fell.pass, false); assert.deepEqual(fell.falseBooked, ["b"]); assert.deepEqual(fell.bookedThenFell, [g]); assert.equal(fell.fellApartAfterYes, true);
  // a partner who never answers: nothing booked, the asker told they are waiting
  const wait = outcome({ asker: "a", bookings: [], human: { a: { [g]: "in" } }, beliefs: { a: [{ kind: "waiting", game: g }] }, saidYes: [{ id: "a", game: g }] });
  assert.equal(wait.pass, false); assert.equal(wait.leftWaiting, true); assert.equal(wait.honest, false); assert.deepEqual(wait.yesNeverBooked, [g]);
  const no = outcome({ asker: "a", bookings: [], beliefs: { a: [{ kind: "none", game: null }] } });
  assert.equal(no.pass, false); assert.equal(no.honest, true); assert.equal(no.fellApartAfterYes, false);
  // booked by the gateway, but someone in it was never asked and never decided: it does not stand
  assert.equal(outcome({ asker: "a", bookings: [b], human: { a: { [g]: "in" } }, beliefs: { a: [{ kind: "booked", game: g }] } }).pass, false);
});

test("a summary: pass^1..k, per kind, with intervals", () => {
  const rows = [];
  for (const scen of ["s1", "s2", "s3"]) for (let trial = 0; trial < 4; trial++) {
    const pass = scen === "s1" || (scen === "s2" && trial < 2);
    rows.push({ scen, trial, kinds: scen === "s3" ? [null, "ghost"] : [null], askerKind: null, outcome: { pass, honest: pass, falseBooked: [], leftWaiting: scen === "s3", noAnswer: false, fellApartAfterYes: false, bookedThenFell: [], yesNeverBooked: [] } });
  }
  const s = summarize(rows, { kMax: 8 });
  assert.equal(s.scenarios, 3); assert.equal(s.trials, 4);
  assert.equal(s.passk[1].value, 0.5);
  assert.equal(s.passk[4].value, 0.333);
  assert.ok(s.passk[4].value <= s.passk[2].value && s.passk[2].value <= s.passk[1].value);
  assert.equal(s.byKind.ghost.runs, 4); assert.equal(s.byKind.ghost.pass, 0);
  assert.equal(s.leftWaiting.k, 4);
  assert.equal(s.noDifficultInvolved.runs, 8);
  assert.ok(Array.isArray(s.passk[1].ci95));
});
