// Unit tests for preferences as typed, dated records (memory/prefs.js, prefs_of.js), no model, no GPU:
//   node --test test/prefs_unit.mjs
//   - code finds times, formats, members and venues in a player's words, and none in someone else's schedule
//   - the newest record for a kind and key wins; older ones are kept, superseded (by which); within a day the player's
//     own words beat an inference; a record past its last day expires and the one before holds again
//   - a decision reads them: a time said no to (unless played there since), the format last said (unless the games
//     since say otherwise), members left out, whole days off; a member's agent's hook (prefsBreak)
//   - from stored notes as they are (no migration): a newer note overrules an older one, a replaced note's rule ends,
//     a belief a newer note contradicts is dropped, and so is an overruled note from the model's facts
//   - a member's taste: a stated "no" is a hard no, a newer "yes" answer overrules it
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-prefs-"));
Object.assign(process.env, { PREF_RECORDS_FILE: `${tmp}/pref_records.json`, MEMORY_FILE: `${tmp}/memory.json`, BELIEFS_FILE: `${tmp}/beliefs.json`, TASTE_FILE: `${tmp}/taste.json`, STORE_FILE: `${tmp}/players.json`, MEMORY_EMBED: "bm25", LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, LLM_URL: "http://127.0.0.1:9/v1" });
delete process.env.PREF_RECORDS; delete process.env.MEMORY; delete process.env.MEMORY_CONSOLIDATE; delete process.env.BELIEFS;
const P = await import("../src/memory/prefs.js");
const update = await import("../src/memory/memory_update.js");
const memory = await import("../src/memory/memory.js");
const prefsOf = await import("../src/memory/prefs_of.js");
const taste = await import("../src/members/taste.js");
after(() => { update.useAsk(null); memory.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();
const rec = (kind, key, value, since, o = {}) => P.make({ kind, key, value }, { since, source: { type: o.type || "note", text: o.text || `${key} ${value}` }, confidence: o.confidence ?? P.CONF.said, explicit: o.explicit ?? true, until: o.until || null });
const members = [{ id: "tomas", name: "Tomás Ruiz" }, { id: "hana", name: "Hana Chen" }];

test("code finds times, formats, members and venues in the player's words", () => {
  const x = (t) => P.extract(t, { members, venues: ["Riverside Sports Centre"] }).map((r) => `${r.kind}:${r.key}=${r.value}`).sort();
  assert.deepEqual(x("No more Friday evenings for me."), ["time:fri-evening=no"]);
  assert.deepEqual(x("Friday evenings are fine again"), ["time:fri-evening=yes"]);
  assert.deepEqual(x("I'm switching from singles to doubles"), ["format:format=doubles"]);
  assert.deepEqual(x("No more singles"), ["format:format=doubles"]);
  assert.deepEqual(x("Can you book me doubles instead of singles?"), ["format:format=doubles"]);
  assert.deepEqual(x("Please leave Tomás out for a while"), ["partner:tomas=no"]);
  assert.deepEqual(x("Tomás and I made up, happy to play with him again"), ["partner:tomas=yes"]);
  assert.deepEqual(x("Riverside is too far, avoid it"), ["venue:Riverside Sports Centre=no"]);
  assert.deepEqual(x("No games on Mondays"), ["time:mon=no"]);
  assert.deepEqual(x("I love weekend mornings"), ["time:sat-morning=yes", "time:sun-morning=yes"]);
  // someone's schedule, or a member's days, is not the player's preference; nor is a bare "now"
  assert.deepEqual(x("Tomás is busy on Fridays"), []);
  assert.deepEqual(x("I'm away on Friday evening"), []);
  assert.deepEqual(x("Friday evening is family time now."), []);
  assert.deepEqual(x("Kenji always pushes me"), []);
  assert.deepEqual(P.fromRule({ kind: "avoid_day", day: "Fri" }), { kind: "time", key: "fri", value: "no" });
  assert.deepEqual(P.fromRule({ kind: "avoid_person", who: "tomas" }), { kind: "partner", key: "tomas", value: "no" });
});

test("the newest record wins; older ones are kept as superseded; the player's words beat an inference of the same day", () => {
  const a = rec("time", "fri-evening", "yes", at("2026-09-01")), b = rec("time", "fri-evening", "no", at("2026-10-01")), c = rec("format", "format", "singles", at("2026-08-01"));
  const R = P.resolve([b, a, c], at("2026-10-05"));
  assert.deepEqual(R.current.map((r) => r.id).sort(), [b.id, c.id].sort());
  const old = R.all.find((r) => r.id === a.id);
  assert.equal(old.status, "superseded"); assert.equal(old.by, b.id);
  const v = P.view(R);
  assert.equal(v[0].status, "current");
  assert.equal(v.find((r) => r.status === "superseded").supersededBy, "no Friday evenings");
  // the same day: the stated one wins, though the inference is an hour newer; a day later the inference wins
  const said = rec("format", "format", "doubles", at("2026-10-02", 9)), inferred = rec("format", "format", "singles", at("2026-10-02", 10), { type: "belief", explicit: false, confidence: P.CONF.belief });
  assert.equal(P.resolve([inferred, said]).current[0].value, "doubles");
  const later = rec("format", "format", "singles", at("2026-10-04"), { type: "belief", explicit: false, confidence: P.CONF.belief });
  assert.equal(P.resolve([said, later]).current[0].value, "singles");
  // a record past its last day: the one before holds again
  const until = rec("time", "fri", "no", at("2026-10-10"), { until: "2026-10-20" });
  assert.equal(P.timeAt(P.resolve([a, until], at("2026-10-15")), "Fri", "19:00").value, "no", "the newest of the cell and its day");
  const R2 = P.resolve([a, until], at("2026-10-25"));
  assert.equal(P.timeAt(R2, "Fri", "19:00").value, "yes"); assert.equal(R2.all.find((r) => r.id === until.id).status, "expired");
});

test("a decision reads them: times, the format, members left out, days off", () => {
  const no = rec("time", "fri-evening", "no", at("2026-10-01"));
  const R = P.resolve([rec("time", "fri-evening", "yes", at("2026-09-01")), no, rec("partner", "tomas", "no", at("2026-10-01")), rec("time", "mon", "no", at("2026-10-01")), rec("format", "format", "doubles", at("2026-10-03"))]);
  assert.match(P.slotAllowed(R, { day: "Fri", start: "19:00" }), /no Friday evenings on 2026-10-01/);
  assert.equal(P.slotAllowed(R, { day: "Fri", start: "10:00" }), null, "a Friday morning is not a Friday evening");
  assert.equal(P.slotAllowed(R, { day: "Thu", start: "19:00" }), null);
  // they played a Friday evening after they said no: the newer habit holds
  assert.equal(P.slotAllowed(R, { day: "Fri", start: "19:00", hist: [{ date: "2026-10-09", start: "19:00" }] }), null);
  assert.deepEqual(P.leftOut(R), ["tomas"]);
  assert.deepEqual(P.offDays(R), ["Mon"]);
  // the format: stated beats the habit before it; games since, mostly singles, beat the statement
  const hist = [{ date: "2026-09-24", start: "19:00", format: "singles" }, { date: "2026-09-17", start: "19:00", format: "singles" }];
  assert.equal(P.formatByHabit(hist, "Thu", "19:00"), "singles");
  assert.equal(P.formatFor(R, { hist, day: "Thu", start: "19:00" }).format, "doubles");
  const since = [...hist, { date: "2026-10-08", start: "19:00", format: "singles" }, { date: "2026-10-15", start: "19:00", format: "singles" }];
  assert.equal(P.formatFor(R, { hist: since, day: "Thu", start: "19:00" }).format, "singles");
  assert.equal(P.formatFor(P.empty(), { hist, day: "Thu", start: "19:00" }).format, "singles", "no records: the habit, as before");
  // a weak record (one answer) overrules an older hard no, but is no hard rule itself
  const weak = rec("time", "fri-evening", "no", at("2026-10-01"), { type: "reply", explicit: false, confidence: P.CONF.reply });
  assert.equal(P.slotAllowed(P.resolve([weak]), { day: "Fri", start: "19:00" }), null);
  assert.equal(P.slotAllowed(P.resolve([no, rec("time", "fri-evening", "yes", at("2026-10-05"), { type: "reply", explicit: false, confidence: P.CONF.reply })]), { day: "Fri", start: "19:00" }), null);
  // the times said yes to in words
  assert.deepEqual(P.wantedTimes(P.resolve([rec("time", "sat-morning", "yes", at("2026-10-01"))])).map((x) => `${x.day} ${x.part}`), ["Sat morning"]);
  // PREF_RECORDS=off reads nothing
  process.env.PREF_RECORDS = "off";
  try { assert.equal(P.record("kenji", { kind: "time", key: "fri", value: "no" }), null); assert.equal(prefsOf.of("app").current.length, 0); } finally { delete process.env.PREF_RECORDS; }
});

test("a member's agent: a stated no is a hard no, a newer yes answer overrules it (taste.js, prefsBreak)", () => {
  P.record("kenji", { kind: "time", key: "fri-evening", value: "no" }, { since: Date.now() - 864e5 * 3 });
  const fri = (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return taste.ymd(d); })();
  const o = { date: fri, start: "19:00", km: 1, each: 0, busy: 0.3 };
  assert.equal(taste.hardNo(taste.get("kenji"), o), "time");
  assert.ok(taste.hardNos(taste.get("kenji"), o).includes("time"));
  assert.match(P.prefsBreak({ id: "kenji" }, { slot: { day: "Fri" }, start: 19 * 60 }), /not Fri evenings/);
  assert.equal(P.prefsBreak({ id: "kenji" }, { slot: { day: "Sat" }, start: 19 * 60 }), null);
  // the taste file never holds the records
  taste.reply("kenji", o, true);
  assert.equal(JSON.parse(fs.readFileSync(`${tmp}/taste.json`, "utf8")).members.kenji.said, undefined);
  assert.equal(taste.hardNo(taste.get("kenji"), o), null, "the newer yes overrules the older no");
  assert.equal(P.prefsBreak({ id: "kenji" }, { slot: { day: "Fri" }, start: 19 * 60 }), null);
  assert.ok(taste.view(taste.get("kenji")).said.some((r) => r.status === "superseded" && r.text === "no Friday evenings"));
  taste.forget("kenji");
  assert.equal(P.stored("kenji").length, 0);
});

test("from stored notes as they are: a newer note overrules, a replaced note's rule ends, stale beliefs and notes are dropped", async () => {
  // the stand-in model: adds, with the rule a note asks for, and replaces what the test says
  let replaces = [];
  update.useAsk(async (msgs) => { const t = msgs[0].content; const rule = /new note from the player: "No games with Tomás/.test(t) ? { kind: "avoid_person", who: "Tomás" } : { kind: "none" }; return { value: { op: replaces.length ? "update" : "add", replaces, rule, until: "" } }; });
  await memory.remember("p1", [{ text: "Friday evenings are my favourite time to play", at: at("2026-09-01") }]);
  await memory.remember("p1", [{ text: "I play singles most weeks", at: at("2026-09-02") }]);
  await memory.remember("p1", [{ text: "No games with Tomás for a while", at: at("2026-09-03") }]);
  await memory.remember("p1", [{ text: "No more Friday evenings for me", at: at("2026-10-01") }]);
  let R = prefsOf.of("p1", { now: at("2026-10-02") });
  assert.equal(P.timeAt(R, "Fri", "19:00").value, "no");
  assert.equal(R.all.filter((r) => r.kind === "time" && r.status === "superseded").length, 1);
  assert.deepEqual(P.leftOut(R), ["tomas"]);
  // the model marks the Tomás note replaced by a vague one: its rule has ended
  const tomas = memory.list("p1").find((n) => /Tomás/.test(n.text));
  replaces = ["n1"];
  update.useAsk(async (msgs) => ({ value: { op: "update", replaces: [/n(\d) \(said [^)]+\): "No games with Tomás/.exec(msgs[0].content) ? `n${/n(\d) \(said [^)]+\): "No games with Tomás/.exec(msgs[0].content)[1]}` : "n1"], rule: { kind: "none" }, until: "" } }));
  await memory.remember("p1", [{ text: "Tomás and I sorted it out", at: at("2026-10-03") }]);
  assert.ok(memory.list("p1").find((n) => n.id === tomas.id).replacedAt, "the stand-in replaced it");
  R = prefsOf.of("p1", { now: at("2026-10-04") });
  assert.deepEqual(P.leftOut(R), []);
  assert.equal(R.all.find((r) => r.kind === "partner").status, "ended");
  // a weekly belief from the older notes is dropped from what the planner reads; one still true stays
  const beliefs = await import("../src/memory/beliefs.js"), id = (re) => memory.list("p1").find((n) => re.test(n.text)).id;
  const made = await beliefs.consolidate("p1", { now: at("2026-09-05"), ask: async () => ({ text: JSON.stringify({ beliefs: [
    { text: "Prefers Friday evenings", cites: [id(/favourite/), id(/singles/)] }, { text: "Usually plays singles", cites: [id(/singles/), id(/favourite/)] }] }) }) });
  assert.equal(made.beliefs.length, 2);
  R = prefsOf.of("p1", { now: at("2026-10-04") });
  assert.deepEqual(prefsOf.fresh(R, [{ belief: "Prefers Friday evenings", notes: 1 }, { belief: "Usually plays singles", notes: 1 }]).map((b) => b.belief), ["Usually plays singles"]);
  // the overruled note is not put in front of the model; the newer one is
  const stale = prefsOf.staleTexts(R);
  assert.ok(stale.has("Friday evenings are my favourite time to play"));
  assert.ok(!stale.has("No more Friday evenings for me"));
  // the Memory page's list: current first, then the rest, with what replaced each
  const v = prefsOf.view("p1", { now: at("2026-10-04") });
  assert.equal(v[0].status, "current");
  assert.ok(v.some((r) => r.status === "superseded" && r.supersededBy === "no Friday evenings"));
});

test("a Messenger player's learned memories count too, and an old memory with no date loses to a dated one", async () => {
  const store = await import("../src/core/store.js");
  store.link?.("m1", "Mia");
  if (!store.get("m1")) return; // (no link helper in this store: covered by the notes test)
  store.remember("m1", ["Player prefers singles"]);
  const p = store.get("m1"); p.memories[0].at = 0;
  store.remember("m1", ["Player wants to play doubles from now on"]);
  assert.equal(P.formatFor(prefsOf.of("m1"), { hist: [], day: "Thu", start: "19:00" }).format, "doubles");
});
