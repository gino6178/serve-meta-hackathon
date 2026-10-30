// Unit tests for turning up without money: the show-up record fades with time and is read as a Beta range
// (members/trust.js), a game short of its minimum players is called off at the cut-off, a spot offered from the waitlist
// waits for a yes and then goes to the next in line (feed/posts.js), and every yes is a signed, chained record that
// tampering breaks (a2a/consent.js). No model, no network.
//   node --test test/noshow_unit.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-noshow-"));
Object.assign(process.env, { MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, NEEDS_FILE: `${tmp}/needs.json`, TASTE_FILE: `${tmp}/taste.json`, HUDDLE_FILE: `${tmp}/huddles.json`, FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off",
  AGENT_KEYS_DIR: `${tmp}/agent_keys`, CONSENT_LOG: `${tmp}/consent.jsonl`, LOOP_DIR: `${tmp}/loop`, STORE_FILE: `${tmp}/players.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off" });
const Tr = await import("../src/members/trust.js");
const C = await import("../src/a2a/consent.js");
const M = await import("../src/members/members.js");
const { use } = await import("../src/feed/deps.js");
const S = await import("../src/feed/store.js");
const P = await import("../src/feed/posts.js");

const DAY = 864e5, HOUR = 36e5;
let clock = Date.now();
const CLUB = { name: "Test Club", sports: ["badminton"], members: [], feed: [] };
beforeEach(() => {
  M.reset(); S.reset(); clock = Date.now();
  use({ reset: true });
  use({ screen: async () => ({ safe: true, categories: [] }), standard: async () => ({ verdict: "ok" }), injected: async (ts) => ts.map(() => ({ injected: false })), chatJSON: async () => ({ value: null }), now: () => clock, club: () => CLUB });
});
const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const notices = (who, kind) => (S.data().notices || []).filter((x) => x.player === who && x.kind === kind);

// ---- the show-up record ----
test("an entry counts half after the half-life, and old misses weigh less than recent ones", () => {
  const now = Date.now();
  assert.equal(Tr.weight(now, now), 1);
  assert.ok(Math.abs(Tr.weight(now - Tr.HALF_LIFE_DAYS * DAY, now) - 0.5) < 1e-9);
  assert.ok(Math.abs(Tr.weight(now - 2 * Tr.HALF_LIFE_DAYS * DAY, now) - 0.25) < 1e-9);
  // two players, each with two misses and three games they came to: one missed long ago, the other last week
  const game = (who, key, start, came) => { Tr.expect(key, [who, "w1", "w2"], start); Tr.vote(who, key, {}, {}, start + 2 * HOUR); for (const v of ["w1", "w2"]) Tr.vote(v, key, { [who]: came ? "came" : "missed" }, {}, start + 2 * HOUR); };
  const old = now - 240 * DAY, recent = now - 7 * DAY;
  for (let i = 0; i < 2; i++) { game("oldmiss", `om${i}`, old + i * HOUR * 3, false); game("newmiss", `nm${i}`, recent + i * HOUR * 3, false); }
  for (let i = 0; i < 3; i++) { game("oldmiss", `oc${i}`, recent - (i + 1) * DAY, true); game("newmiss", `nc${i}`, old - (i + 1) * DAY, true); }
  const a = Tr.badge("oldmiss", now), b = Tr.badge("newmiss", now);
  assert.equal(a.show.rate, b.show.rate, "the same raw counts");
  assert.ok(a.show.mw < 0.15 && b.show.mw > 1.8, JSON.stringify([a.show, b.show]));
  assert.ok(Tr.gateRate(a) > 0.85 && Tr.gateRate(b) < 0.5, "a gate reads the recent record");
  assert.equal(Tr.check("oldmiss", { minShow: 0.75 }, now).verdict, "ok");
  assert.equal(Tr.check("newmiss", { minShow: 0.75 }, now).verdict, "waitlist");
  // a later look: the same misses have faded further
  assert.ok(Tr.badge("newmiss", now + 120 * DAY).show.mw < b.show.mw / 3);
});
test("the record as Beta(1 + came, 1 + missed): its mean and a 90% range that narrows as games add up", () => {
  assert.deepEqual(Tr.reliability(0, 0), { mean: 0.5, low: 0.05, high: 0.95 }); // Beta(1,1) is uniform
  for (const [q, a, b] of [[0.05, 10, 2], [0.95, 10, 2], [0.5, 3, 7], [0.05, 1.4, 1.1]]) assert.ok(Math.abs(Tr.betaCdf(Tr.betaQuantile(q, a, b), a, b) - q) < 1e-6);
  assert.ok(Math.abs(Tr.betaCdf(0.5, 4, 4) - 0.5) < 1e-9);
  const short = Tr.reliability(4, 1), long = Tr.reliability(40, 10);
  assert.equal(short.mean, 0.71); assert.equal(long.mean, 0.79);
  assert.ok(short.low < short.mean && short.mean < short.high);
  assert.ok(long.high - long.low < (short.high - short.low) / 2, "more games, a narrower range");
  // what others see: words, never counts
  Tr.seed("steady", { person: { games: 20, came: 19 } });
  const b = Tr.badge("steady");
  assert.ok(b.show.low > 0.75 && b.show.high <= 1 && b.show.mean > 0.85, JSON.stringify(b.show));
  assert.match(Tr.rangeText(b), /^likely \d+-\d+%$/);
  assert.equal(Tr.rangeText(Tr.badge("nobody-yet")), "too soon to tell");
});

// ---- minimum players ----
test("a game short of its minimum at the cut-off is called off, and everyone who said yes hears it once", async () => {
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member;
  const day = localDay(Date.now() + 2 * DAY);
  assert.match((await P.post(ana.id, { invite: { sport: "badminton", day, start: "19:00", where: "Riverside", spots: 3, minPlayers: 5 } })).error, /minPlayers/);
  const short = (await P.post(ana.id, { invite: { sport: "badminton", day, start: "19:00", where: "Riverside", spots: 3, minPlayers: 3 } })).post;
  const enough = (await P.post(cy.id, { invite: { sport: "badminton", day, start: "21:00", where: "Hall", spots: 2, minPlayers: 2 } })).post;
  assert.equal(short.invite.minPlayers, 3);
  P.join(ben.id, short.id); P.join(ben.id, enough.id);
  const start = P.startOf(P.find(short.id).invite);
  clock = start - P.CUTOFF_HOURS * HOUR - 10 * 60e3; P.promoteDue(clock);
  assert.ok(P.find(short.id), "not yet: before the cut-off");
  clock = start - P.CUTOFF_HOURS * HOUR + 60e3; P.promoteDue(clock); P.promoteDue(clock + 60e3);
  assert.ok(!P.find(short.id), "called off");
  assert.equal(notices(ana.id, "called-off").length, 1, "the host, once");
  assert.equal(notices(ben.id, "called-off").length, 1, "the player who said yes, once");
  assert.match(notices(ben.id, "called-off")[0].text, /called off: too few players/);
  clock = P.startOf(P.find(enough.id).invite) - HOUR; P.promoteDue(clock);
  assert.ok(P.find(enough.id), "a game at its minimum stands");
  assert.equal(notices(cy.id, "called-off").length, 0);
});

// ---- waitlist promotion with a deadline ----
test("a spot offered from the waitlist waits for a yes, then goes to the next in line", async () => {
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member, dee = M.demo("Dee Fox").member;
  const day = localDay(Date.now() + 3 * DAY), id = (await P.post(ana.id, { invite: { sport: "badminton", day, start: "19:00", where: "Riverside", spots: 1 } })).post.id;
  P.join(ben.id, id);
  assert.ok(P.join(cy.id, id).waitlisted); assert.ok(P.join(dee.id, id).waitlisted);
  P.join(ben.id, id, false); // Cy is offered the spot
  const v = P.view(P.find(id), cy.id).invite;
  assert.ok(v.joined && v.confirmBy > clock && v.confirmBy - clock <= P.CONFIRM_HOURS * HOUR, JSON.stringify(v));
  assert.equal(v.full, false, "not on until the offer is answered");
  assert.equal(P.view(P.find(id), dee.id).invite.confirmBy, null, "the deadline is Cy's alone");
  assert.equal(P.view(P.find(id), dee.id).invite.offered, undefined, "and who is offered isn't shown");
  assert.match(notices(cy.id, "moved-up")[0].text, /say yes by/);
  clock = v.confirmBy - 60e3; P.promoteDue(clock);
  assert.ok(P.find(id).invite.going.includes(cy.id), "still Cy's before the deadline");
  clock = v.confirmBy + 1; P.promoteDue(clock);
  const after = P.find(id).invite;
  assert.ok(!after.going.includes(cy.id) && after.going.includes(dee.id) && after.offered[dee.id], "the spot goes to Dee");
  assert.equal(notices(cy.id, "lapsed").length, 1);
  const r = P.join(dee.id, id, true);
  assert.ok(r.confirmed && r.post.invite.full && !r.post.invite.confirmBy, "Dee's yes takes it, and the game is on");
  assert.ok(C.yesesOf(dee.id).some((x) => x.via === "confirm" && x.ref === id), "the yes is signed");
});

// ---- signed yeses ----
test("each yes is signed and chained: a changed, re-signed-by-another or removed record breaks verification", async () => {
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member, cy = M.demo("Cy Ito").member;
  const id = (await P.post(ana.id, { invite: { sport: "badminton", day: localDay(Date.now() + 4 * DAY), start: "18:00", where: "Riverside", spots: 3 } })).post.id;
  const n0 = C.records().length;
  P.join(ben.id, id); P.join(cy.id, id, true, { via: "ask", agent: true });
  C.record("someone", { huddle: "h1", sport: "tennis", date: "2026-11-04", start: "10:30", players: ["someone", "x"] }, { via: "huddle", ref: "h1" });
  const all = C.records();
  assert.equal(all.length, n0 + 3);
  assert.deepEqual(all.slice(-3).map((r) => [r.by, r.via, r.agent]), [[ben.id, "feed", false], [cy.id, "ask", true], ["someone", "huddle", false]]);
  assert.equal(all.at(-3).game.where, "Riverside");
  assert.deepEqual(C.verifyLog(), { ok: true, n: all.length, head: all.at(-1).hash });
  const copy = () => JSON.parse(JSON.stringify(all)), k = all.length - 2;
  // the game changed after it was signed
  const t1 = copy(); t1[k].game.start = "20:00";
  assert.equal(C.verifyLog(t1).ok, false); assert.equal(C.verifyLog(t1).at, k);
  // the game changed and the chain rebuilt around it: the member's signature still gives it away
  const t2 = copy(); t2[k].game.start = "20:00"; for (let i = k; i < t2.length; i++) { if (i > k) t2[i].prev = t2[i - 1].hash; t2[i].hash = C.hashOf(t2[i]); }
  assert.match(C.verifyLog(t2).why, /signature/);
  // someone else's yes claimed as theirs
  const t3 = copy(); t3[k].by = ben.id; t3[k].hash = C.hashOf(t3[k]);
  assert.equal(C.verifyLog(t3).ok, false);
  // a record taken out
  const t4 = copy(); t4.splice(k, 1);
  assert.match(C.verifyLog(t4).why, /point/);
  // and the file itself, edited in place
  const f = process.env.CONSENT_LOG, text = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, text.replace('"start":"18:00"', '"start":"19:00"'));
  assert.equal(C.verifyLog().ok, false);
  fs.writeFileSync(f, text);
  assert.equal(C.verifyLog().ok, true);
});
