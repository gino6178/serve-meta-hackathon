// A partner's "Are you in?" and what follows (src/match/confirm.js): the six rules the pass^k harness asked for, on
// fake deps (no gateway, no model, a clock the test moves).
//   node --test test/confirm_unit.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "confirm-unit-"));
process.env.PREF_RECORDS_FILE = path.join(dir, "prefs.json");
const C = await import("../src/match/confirm.js");
const prefs = await import("../src/memory/prefs.js");

const option = (partners, extra = {}) => ({ date: "2026-11-12", day: "Thu", start: "19:00", end: "20:30", minutes: 90, format: partners.length > 1 ? "doubles" : "singles", sport: "badminton", court: 2, venue: { id: "v1", name: "Midtown Gym" }, partners: partners.map((id) => ({ id, name: `${id.toUpperCase()} Person` })), ...extra });
let n = 0;
function world({ bookings = [], lease = 60000 } = {}) {
  const t = { now: 1_800_000_000_000 }, sent = [], research = [], booked = [], called = [], records = [];
  const c = C.createConfirm({
    file: path.join(dir, `p${++n}.json`), chainsFile: path.join(dir, `c${n}.json`), leaseMs: () => lease, now: () => t.now,
    send: async (id, text, opts = {}) => { sent.push({ id, text, buttons: (opts.buttons || []).map((b) => b.payload) }); },
    describe: (o, id) => `${o.format} ${o.day} ${o.start} (for ${id})`, releaseHolds: async () => {},
    book: async (by, o) => { booked.push({ by, o }); return {}; }, research: async (by, o, leaveOut) => { research.push({ by, leaveOut: [...leaveOut] }); },
    bookingsOf: (id) => bookings.filter((b) => !b.cancelled && [b.option.by, ...b.option.partners.map((p) => p.id)].includes(id)),
    callOff: async (b) => { b.cancelled = true; called.push(b.id); }, recheck: async () => ({ ok: true }),
    record: (id, r, meta) => { records.push({ id, r }); return prefs.record(id, r, meta); }, nameOf: (id) => `${id.toUpperCase()} Person`,
  });
  return { c, t, sent, research, booked, called, records, to: (id) => sent.filter((m) => m.id === id) };
}
const idOf = (w, who) => /pc:([\w-]+):/.exec(w.to(who).at(-1).buttons[0])[1];

test("words: a back-out, an answer in words, vagueness, a standing change", () => {
  assert.ok(C.backOut("sorry, something came up, I can't make Thursday 19:00 after all"));
  assert.ok(C.backOut("抱歉，星期四 19:00那場我臨時不能去了。"));
  assert.ok(C.backOut("have to cancel, sorry"));
  assert.ok(!C.backOut("heads up: I can't play on Saturdays any more, starting this week."), "a standing change is not a back-out");
  assert.ok(!C.backOut("see you thursday!"));
  for (const [t, a] of [["yes", "yes"], ["I'm in", "yes"], ["好啊", "yes"], ["no sorry", "no"], ["can't make it", "no"], ["another time?", "other"], ["hmm maybe, depends on work", "vague"], ["could be ok I guess?", "vague"], ["也許，到時候再說", "vague"], ["what's the weather like", null]]) assert.equal(C.answerWords(t), a, t);
  assert.deepEqual(C.whenOf("can't make Thursday 19:00"), { day: "Thu", start: "19:00" });
  assert.deepEqual(C.whenOf("星期四那場不行"), { day: "Thu", start: null });
  assert.deepEqual(C.standing("heads up: I can't play on Saturdays any more, starting this week."), [{ kind: "time", key: "sat", value: "no" }]);
  assert.deepEqual(C.standing("跟你說一下，從這週開始星期六我都不能打了。"), [{ kind: "time", key: "sat", value: "no" }]);
  assert.deepEqual(C.standing("I can't make Thursday 20:00 after all"), [], "one game is not a standing change");
});

test("1. a back-out in words is confirmed with one quick reply, then the game is called off, everyone told, a replacement sought", async () => {
  const b = { id: "B1", option: option(["u2"], { by: "u1" }) }, w = world({ bookings: [b] });
  assert.equal(await w.c.text("u2", "sorry, something came up, I can't make Thursday 19:00 after all"), true);
  const q = w.to("u2").at(-1);
  assert.match(q.text, /^Drop out of Thursday 19:00/);
  assert.deepEqual(q.buttons, ["pd:b~B1:yes", "pd:b~B1:no"]);
  assert.equal(w.called.length, 0, "nothing changes before the yes");
  await w.c.dropTap("u2", "b~B1", false);
  assert.match(w.to("u2").at(-1).text, /still in/); assert.equal(w.called.length, 0);
  await w.c.dropTap("u2", "b~B1", true);
  assert.deepEqual(w.called, ["B1"]);
  assert.match(w.to("u2").at(-1).text, /you're out of Thursday 19:00/);
  assert.match(w.to("u1").at(-1).text, /U2 dropped out .* nothing is booked\. Looking for someone else/);
  assert.deepEqual(w.research, [{ by: "u1", leaveOut: ["u2"] }]);
  // a back-out from someone with no game: the chat answers it
  assert.equal(await w.c.text("u9", "sorry I can't make it after all"), false);
});

test("1. a doubles partner who drops out: the other players are told too; the host who calls it off tells everyone", async () => {
  const b = { id: "B2", option: option(["u2", "u3", "u4"], { by: "u1" }) }, w = world({ bookings: [b] });
  await w.c.text("u3", "can't make it after all");
  await w.c.dropTap("u3", "b~B2", true);
  for (const id of ["u2", "u4"]) assert.match(w.to(id).at(-1).text, /U3 dropped out .* called off and nothing is booked/);
  const h = { id: "B3", option: option(["u2"], { by: "u1" }) }, w2 = world({ bookings: [h] });
  await w2.c.text("u1", "have to cancel thursday");
  await w2.c.dropTap("u1", "b~B3", true);
  assert.match(w2.to("u2").at(-1).text, /U1 called off .* nothing is booked/);
  assert.equal(w2.research.length, 0, "the host called it off: nobody looks for a replacement");
});

test("2. the ask lapses with the hold: one nudge at half time, then the asker is told and the search moves on", async () => {
  const w = world();
  await w.c.ask("u1", "U1 Person", option(["u2"]), [{ id: "u2", name: "U2 Person" }]);
  w.t.now += 20000; await w.c.tick();
  assert.equal(w.to("u2").length, 1, "no nudge before half time");
  w.t.now += 15000; await w.c.tick(); await w.c.tick();
  assert.equal(w.to("u2").length, 2, "one nudge");
  assert.match(w.to("u2")[1].text, /^Still holding/);
  w.t.now += 30000; await w.c.tick();
  assert.match(w.to("u2").at(-1).text, /didn't hear back in time.*Nothing is booked/);
  assert.match(w.to("u1").at(-1).text, /U2 didn't answer in time, so nothing is booked\. Looking for someone else/);
  assert.deepEqual(w.research, [{ by: "u1", leaveOut: ["u2"] }]);
  assert.equal(w.booked.length, 0);
});

test("2. a yes after the ask lapsed is checked and put to the asker again; never booked on its own", async () => {
  const w = world();
  await w.c.ask("u1", "U1 Person", option(["u2"]), [{ id: "u2", name: "U2 Person" }]);
  const id = idOf(w, "u2");
  w.t.now += 61000; await w.c.tick();
  await w.c.tap("u2", id, "yes");
  assert.equal(w.booked.length, 0);
  const q = w.to("u1").at(-1);
  assert.match(q.text, /U2 said yes after the time I held lapsed.*Book it now\?/);
  assert.deepEqual(q.buttons, [`pl:${id}:yes`, `pl:${id}:no`]);
  await w.c.lateTap("u1", id, true);
  assert.equal(w.booked.length, 1);
  assert.match(w.to("u1").at(-1).text, /^Booked:/);
  // when the asker's search has moved on (a newer ask), the late yes books nothing and the asker is not asked
  const w2 = world();
  await w2.c.ask("u1", "U1 Person", option(["u2"]), [{ id: "u2", name: "U2 Person" }]);
  const id2 = idOf(w2, "u2");
  w2.t.now += 61000; await w2.c.tick();
  w2.t.now += 1000; await w2.c.ask("u1", "U1 Person", option(["u3"]), [{ id: "u3", name: "U3 Person" }]);
  const before = w2.to("u1").length;
  await w2.c.tap("u2", id2, "yes");
  assert.match(w2.to("u2").at(-1).text, /moved on since, so nothing is booked/);
  assert.equal(w2.to("u1").length, before); assert.equal(w2.booked.length, 0);
});

test("3. vague words: the question once more with three buttons, no promise; a second vague answer is no answer", async () => {
  const w = world();
  await w.c.ask("u1", "U1 Person", option(["u2"]), [{ id: "u2", name: "U2 Person" }]);
  const id = idOf(w, "u2");
  assert.equal(await w.c.text("u2", "hmm maybe, depends on work"), true, "not handed to the chat");
  const re = w.to("u2").at(-1);
  assert.match(re.text, /^Just checking: are you in/);
  assert.doesNotMatch(re.text, /check in|later|closer to/i);
  assert.deepEqual(re.buttons, [`pc:${id}:yes`, `pc:${id}:no`, `pc:${id}:other`]);
  assert.equal(await w.c.text("u2", "could be ok I guess?"), true);
  assert.match(w.to("u1").at(-1).text, /didn't answer in time, so nothing is booked/);
  assert.deepEqual(w.research, [{ by: "u1", leaveOut: ["u2"] }]);
  // a clear answer in words is a tap
  const w2 = world();
  await w2.c.ask("u1", "U1 Person", option(["u2"]), [{ id: "u2", name: "U2 Person" }]);
  await w2.c.text("u2", "yes I'm in");
  assert.equal(w2.booked.length, 1);
});

test("4. a stated change of usual days becomes a record the member's agent keeps (talk.js breaks)", async () => {
  const w = world();
  assert.equal(await w.c.text("u7", "heads up: I can't play on Saturdays any more, starting this week."), false, "the chat still answers");
  assert.deepEqual(w.records.map((x) => [x.id, x.r.key, x.r.value]), [["u7", "sat", "no"]]);
  const { breaks } = await import("../src/a2a/talk.js");
  const m = { id: "u7", name: "U7 Person", free: ["Sat 09-12", "Wed 19-22"], rules: {} };
  assert.ok(breaks(m, { slot: { day: "Sat", date: "2026-11-14" }, start: 9 * 60 }, 90), "a Saturday game breaks it");
  assert.ok(!breaks(m, { slot: { day: "Wed", date: "2026-11-11" }, start: 19 * 60 }, 90), "Wednesday still works");
});

test("5. a new search leaves out everyone who said no or let the ask lapse, and stops after a bounded number", async () => {
  const w = world();
  const ids = ["u2", "u3", "u4", "u5", "u6"];
  for (let k = 0; k < ids.length && w.research.length === k; k++) {
    await w.c.ask("u1", "U1 Person", option([ids[k]]), [{ id: ids[k], name: "x" }]);
    if (k === 1) { w.t.now += 61000; await w.c.tick(); } else await w.c.tap(ids[k], idOf(w, ids[k]), "no");
  }
  assert.deepEqual(w.research.map((r) => [...r.leaveOut].sort()), [["u2"], ["u2", "u3"], ["u2", "u3", "u4"]]);
  assert.equal(w.research.length, C.MAX_ROUNDS);
  assert.match(w.to("u1").at(-1).text, /I've now asked 4 people .* none could make it, so I've stopped looking/);
});

test("6. a game called off by one person's no is told to everyone who was asked", async () => {
  const w = world();
  await w.c.ask("u1", "U1 Person", option(["u2", "u3", "u4"]), ["u2", "u3", "u4"].map((id) => ({ id, name: id })));
  const id = idOf(w, "u2");
  await w.c.tap("u2", id, "yes");
  await w.c.tap("u3", id, "no");
  assert.match(w.to("u2").at(-1).text, /is off: U3 can't make it, so nothing is booked/);
  assert.match(w.to("u4").at(-1).text, /is off: U3 can't make it, so nothing is booked/);
  await w.c.tap("u4", id, "yes");
  assert.match(w.to("u4").at(-1).text, /That game is off \(U3\)/);
  assert.equal(w.booked.length, 0);
});
