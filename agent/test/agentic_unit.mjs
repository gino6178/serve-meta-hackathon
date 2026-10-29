// The four agentic pieces, no model: the value of information (match/voi.js), the critic in the loop
// (a2a/critic.js), beliefs from notes (memory/beliefs.js) and proof of consent (a2a/consent.js).
//   node --test test/agentic_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-agentic-"));
Object.assign(process.env, { FAIRNESS_FILE: path.join(tmp, "fair.json"), BELIEFS_FILE: path.join(tmp, "beliefs.json"), AGENT_KEYS_DIR: path.join(tmp, "keys"), MEMORY_FILE: path.join(tmp, "memory.json"), MEMORY_EMBED: "bm25", CONSENT: "" });
const voi = await import("../src/match/voi.js");
const critic = await import("../src/a2a/critic.js");
const beliefs = await import("../src/memory/beliefs.js");
const consent = await import("../src/a2a/consent.js");

const THU = { date: "2026-11-05", start: "19:00" }, SAT = { date: "2026-11-07", start: "09:00" };

test("VoI: the posterior follows what was seen; the question asked is the uncertain one with the most to gain", () => {
  const none = voi.posterior(null, THU), saidYes = voi.posterior({ yes: { "Thu 19:00": 3 } }, THU), saidNo = voi.posterior({ no: { "Thu 19:00": 3 } }, THU);
  assert.equal(none.p, 0.5); assert.ok(saidYes.p > 0.75 && saidNo.p < 0.25); assert.ok(saidYes.sd < none.sd, "three answers make it surer");
  // Leo: likely to say yes, never asked about these times; Ravi: a so-so chance, known free on Saturday mornings
  const members = [{ id: "leo", chance: 0.85, mem: null }, { id: "ravi", chance: 0.4, mem: { yes: { "Sat 09:00": 4 } } }];
  const q = voi.bestQuestion({ members, slots: [THU, SAT] });
  assert.equal(q.id, "leo", "asking about the likely-but-unknown member is worth more");
  assert.ok(q.after > q.before && q.value >= voi.MIN);
  // once Leo has been talked to at every time, the question moves on, and none is asked when nothing is uncertain
  const q2 = voi.bestQuestion({ members, slots: [THU, SAT], tried: new Set(["leo|2026-11-05|19:00", "leo|2026-11-07|09:00"]) });
  assert.equal(q2?.id ?? null, null, "Ravi alone: nothing better to learn than trying him");
});

test("critic: a member's agent probing many times is stopped; a player who always travels furthest is not made to again", () => {
  critic.reset();
  const leo = { id: "leo", name: "Leo Park" }, off = (date, start, you, them) => ({ slot: { date }, start, travel: [{ id: "you", min: you }, { id: "leo", min: them }] });
  assert.equal(critic.review({ talk: "t1", member: leo, counter: off("2026-11-05", 1140, 10, 10) }).ok, true);
  assert.equal(critic.review({ talk: "t1", member: leo, counter: off("2026-11-06", 1140, 10, 10) }).ok, true);
  const third = critic.review({ talk: "t1", member: leo, counter: off("2026-11-07", 540, 10, 10) });
  assert.equal(third.ok, false); assert.equal(third.check, "probing");
  assert.equal(critic.review({ talk: "t2", member: leo, counter: off("2026-11-07", 540, 10, 10) }).ok, true, "a new talk starts afresh");
  // three games where the player had the longest trip in two
  for (const [you, them] of [[30, 10], [25, 12], [8, 20]]) critic.record({ travel: [{ id: "you", min: you }, { id: "leo", min: them }] });
  const unfair = critic.review({ talk: "t3", member: leo, counter: off("2026-11-08", 600, 35, 8) });
  assert.equal(unfair.ok, false); assert.equal(unfair.check, "fairness");
  assert.equal(critic.review({ talk: "t3", member: leo, counter: off("2026-11-08", 660, 15, 12) }).ok, true, "a trip within the margin is fine");
  process.env.CRITIC = "off"; assert.equal(critic.review({ talk: "t3", member: leo, counter: off("2026-11-09", 600, 35, 8) }).ok, true); delete process.env.CRITIC;
});

test("beliefs: only what cites live notes, two notes to generalize, and no number the notes do not say", () => {
  const notes = [{ id: "n1", text: "I can only play after 19:00 on weekdays" }, { id: "n2", text: "Weeknights before 19:00 don't work, I'm at work" }, { id: "n3", text: "Leave Tomás out for now" }];
  const raw = [
    { text: "Usually plays weekdays after 19:00", cites: ["n1", "n2"] },
    { text: "Prefers Saturday mornings", cites: ["n1"] }, // generalizes from one note
    { text: "Keeps Tomás out of games for now", cites: ["n3"] },
    { text: "Plays after 20:00", cites: ["n1"] }, // a number no note says
    { text: "Likes doubles", cites: ["n9"] }, // cites nothing that exists
  ];
  assert.deepEqual(beliefs.checked(raw, notes).map((b) => b.text), ["Usually plays weekdays after 19:00", "Keeps Tomás out of games for now"]);
});

test("beliefs: made from a player's notes with a stand-in model, kept, and forgotten with them", async () => {
  const memory = await import("../src/memory/memory.js");
  await memory.remember("p1", [{ text: "I can only play after 19:00 on weekdays", kind: "said" }, { text: "Weeknights before 19:00 don't work for me", kind: "said" }, { text: "Leave Tomás out for now", kind: "said" }]);
  const ids = memory.list("p1").map((n) => n.id);
  const ask = async () => ({ text: JSON.stringify({ beliefs: [{ text: "Usually plays weekdays after 19:00", cites: ids.slice(1) }, { text: "Usually plays twice a week", cites: [ids[0]] }] }) });
  const r = await beliefs.consolidate("p1", { ask });
  assert.equal(r.beliefs.length, 1); assert.equal(r.dropped, 1);
  assert.equal(beliefs.of("p1").beliefs[0].n, 2);
  beliefs.forget("p1"); assert.equal(beliefs.of("p1"), null);
});

test("consent: every player's agent signs the same game; a changed game or another key is refused", () => {
  const game = { date: "2026-11-07", start: "09:00", minutes: 90, venue: { id: "riverside" }, court: 2, sport: "badminton", partners: [{ id: "leo" }, { id: "hana" }, { id: "kenji" }] };
  const sigs = ["leo", "hana", "kenji", "you"].map((id) => consent.sign(id, game));
  assert.deepEqual(consent.verify(game, sigs), { ok: true, signed: 4, of: 4, missing: [], bad: [] });
  assert.equal(consent.verify({ ...game, court: 3 }, sigs).ok, true, "another court at the same venue is the same game");
  const later = consent.verify({ ...game, start: "10:00" }, sigs);
  assert.equal(later.ok, false); assert.equal(later.bad.length, 4, "another time: every signature fails");
  const plusOne = consent.verify({ ...game, partners: [...game.partners, { id: "ravi" }] }, sigs);
  assert.equal(plusOne.ok, false); assert.ok(plusOne.missing.includes("ravi")); assert.equal(plusOne.bad.length, 4, "a player added: it is another game");
  const forged = { ...consent.sign("ravi", game), by: "hana" }; // Ravi's key, claiming to be Hana's agent
  assert.deepEqual(consent.verify(game, [...sigs.filter((s) => s.by !== "hana"), forged]).bad, ["hana"]);
  assert.equal(consent.verify(game, sigs.slice(0, 3)).missing[0], "you", "the player's own yes is needed too");
});
