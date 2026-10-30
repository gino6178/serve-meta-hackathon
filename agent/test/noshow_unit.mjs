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
  AGENT_KEYS_DIR: `${tmp}/agent_keys`, CLUBS_FILE: `${tmp}/clubs.json`, PLACES_FILE: `${tmp}/places.json`, OVERPASS_URLS: "http://127.0.0.1:9/x", GOOGLE_MAPS_API_KEY: "", CONSENT_LOG: `${tmp}/consent.jsonl`, LOOP_DIR: `${tmp}/loop`, STORE_FILE: `${tmp}/players.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off" });
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

test("other members see show-up words only: no game counts, no rates; the member's own record keeps them", async () => {
  Tr.seed("eight", { person: { games: 8, came: 8 }, agent: { said: 6, kept: 6 } });
  Tr.seed("thin", { person: { games: 3, came: 1 } });
  for (const id of ["eight", "thin", "nobody-yet"]) {
    const w = Tr.words(Tr.badge(id));
    assert.match(w.show, /^(new|shows up likely \d+-\d+%)$/, w.show); assert.doesNotMatch(w.agent, /\d/, w.agent);
    assert.ok(!("rate" in w) && !("kept" in w) && !("games" in w), JSON.stringify(w));
  }
  assert.match(Tr.words(Tr.badge("eight")).show, /^shows up likely \d+-\d+%$/);
  assert.equal(Tr.words(Tr.badge("nobody-yet")).show, "new");
  assert.equal(Tr.words(Tr.badge("thin")).level, "low");
  assert.doesNotMatch(Tr.check("thin", { minShow: 0.9 }).why, /games|33%/, "a gate's reason, shown in a huddle's talk, is words too");
  // a huddle's players, a game card's host, the feed's host line: the same words; the own record has the counts
  const H = await import("../src/members/huddle.js");
  assert.deepEqual(H.trustOf("eight"), Tr.words(Tr.badge("eight")));
  const own = H.trustOf("eight", true);
  assert.match(own.show, /8 games/); assert.equal(own.rate, 1);
  const ana = M.demo("Ana Lee").member, ben = M.demo("Ben Wu").member;
  Tr.seed(ana.id, { person: { games: 8, came: 8 } });
  const id = (await P.post(ana.id, { invite: { sport: "badminton", day: localDay(Date.now() + 2 * DAY), start: "19:00", where: "Riverside", spots: 2 } })).post.id;
  const host = P.view(P.find(id), ben.id).invite.host;
  assert.doesNotMatch(JSON.stringify(host), /games|"rate"|100%/, JSON.stringify(host));
  assert.match(host.show, /^shows up likely/);
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
  // an offered spot is open until the yes: not in the names, not counted as going, not full, the same on the link page
  const dv = P.view(P.find(id), dee.id).invite;
  assert.equal(dv.offered, 1, "how many spots are offered, never who");
  assert.deepEqual(dv.names, [], "Cy isn't in yet"); assert.equal(dv.going, 0);
  assert.deepEqual([P.publicInvite(id).going, P.publicInvite(id).full, P.publicInvite(id).offered], [0, false, 1], "the link page agrees with the feed");
  const said = P.find(id).comments.at(-1).text;
  assert.match(said, /^Cy is offered a spot from the waitlist, until .+\. 1 of 1 spot left \(1 offered from the waitlist\)/, said);
  assert.doesNotMatch(said, /Full|moves up/);
  assert.match(notices(cy.id, "moved-up")[0].text, /say yes by/);
  clock = v.confirmBy - 60e3; P.promoteDue(clock);
  assert.ok(P.find(id).invite.going.includes(cy.id), "still Cy's before the deadline");
  clock = v.confirmBy + 1; P.promoteDue(clock);
  const after = P.find(id).invite;
  assert.ok(!after.going.includes(cy.id) && after.going.includes(dee.id) && after.offered[dee.id], "the spot goes to Dee");
  assert.equal(notices(cy.id, "lapsed").length, 1);
  const r = P.join(dee.id, id, true);
  assert.ok(r.confirmed && r.post.invite.full && !r.post.invite.confirmBy, "Dee's yes takes it, and the game is on");
  assert.ok(P.find(id).comments.some((c) => /^Dee is in\. Full for/.test(c.text)), "then: Dee is in");
  assert.deepEqual([P.publicInvite(id).going, P.publicInvite(id).full], [1, true]);
  assert.deepEqual(P.view(P.find(id), ana.id).invite.names, ["Dee"]);
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

test("whoever is promoted can act on the notice: the offer is confirmable by the feed or the agent's game answer, and the host's count shows it", async () => {
  const H = await import("../src/members/huddle.js");
  const amy = M.demo("Amy Wu").member, ken = M.demo("Ken Hsu").member, cat = M.demo("Cat Ho").member, bob = M.demo("Bob Li").member;
  const id = (await P.post(amy.id, { invite: { sport: "badminton", day: localDay(Date.now() + 3 * DAY), start: "15:00", where: "Amy court", spots: 2 } })).post.id;
  P.join(ken.id, id); P.join(cat.id, id);
  assert.ok(P.join(bob.id, id).waitlisted);
  P.join(ken.id, id, false);
  assert.match(notices(bob.id, "moved-up")[0].text, /say yes by/);
  assert.match(notices(amy.id, "left").at(-1).text, /1 of 2 spots left \(1 offered from the waitlist\)/, "the host hears the spot is offered, not taken or free");
  assert.equal(P.gamesOf(bob.id).find((g) => g.post === id).confirmBy, P.find(id).invite.offered[bob.id], "the own card says it's an offer");
  const r = H.answerGame(bob.id, id, true);
  assert.ok(r.confirmed && !r.error, JSON.stringify(r));
  assert.ok(P.view(P.find(id), bob.id).invite.full);
  assert.ok(P.find(id).comments.some((c) => c.text.startsWith("Game on: all 2 spots are taken")));
  // a player leaving Serve frees their spot the same way: an offer, with a notice that can be answered
  const solo = (await P.post(amy.id, { invite: { sport: "badminton", day: localDay(Date.now() + 5 * DAY), start: "10:00", where: "Amy court", spots: 1 } })).post.id;
  P.join(ken.id, solo); assert.ok(P.join(cat.id, solo).waitlisted);
  assert.ok(P.find(solo).comments.some((c) => c.text.startsWith("Game on: the spot is taken")), "one spot reads naturally");
  P.forget(ken.id);
  assert.ok(P.find(solo).invite.offered[cat.id], "Cat is offered Ken's spot");
  assert.ok(notices(cat.id, "moved-up").some((n) => n.post === solo));
  assert.ok(P.join(cat.id, solo, true).confirmed);
  // a no to the offer through the agent's answer passes it on
  const third = (await P.post(amy.id, { invite: { sport: "badminton", day: localDay(Date.now() + 6 * DAY), start: "10:00", where: "Amy court", spots: 1 } })).post.id;
  P.join(cat.id, third); assert.ok(P.join(bob.id, third).waitlisted); P.join(cat.id, third, false);
  assert.ok(!H.answerGame(bob.id, third, false).error);
  assert.ok(!P.find(third).invite.going.includes(bob.id));
});

test("a huddle's spare is kept and moved in when a spot opens, even if another huddle is asking them at that hour", async () => {
  const H = await import("../src/members/huddle.js");
  const alice = M.demo("Alice Tan").member, henry = M.demo("Henry Ko").member, iris = M.demo("Iris Lu").member, jack = M.demo("Jack Pan").member, kay = M.demo("Kay Su").member, zoe = M.demo("Zoe Ma").member;
  const date = localDay(Date.now() + 2 * DAY), pick = { date, start: "20:30", where: "Hall", place: { name: "Hall" }, km: {}, at: null, each: 0 };
  const hud = (id, host, players, extra = {}) => ({ id, host, sport: "badminton", need: players.length, status: "asking", pick: { ...pick, km: {} }, players, answers: { [host]: "yes" }, invited: players.filter((x) => x !== host), out: [], talk: [], askedOf: {}, askedAt: Date.now(), tries: 0, direct: [], alternates: [], created: Date.now(), ...extra });
  const file = path.join(tmp, "huddles-spare.json");
  fs.writeFileSync(file, JSON.stringify({ nudged: {}, huddles: [
    hud("h-spare", alice.id, [alice.id, henry.id, iris.id], { alternates: [jack.id, kay.id] }),
    hud("h-other", zoe.id, [zoe.id, jack.id]), // Jack is only being asked here: not a booking
    hud("h-yes", zoe.id, [zoe.id, kay.id], { answers: { [zoe.id]: "yes", [kay.id]: "yes" } }), // Kay said yes here: she is
  ] }));
  process.env.HUDDLE_FILE = file;
  const r = await H.reply(henry.id, "h-spare", false, "busy");
  assert.equal(r.replaced, "Jack", JSON.stringify(r));
  const h = H.find("h-spare");
  assert.ok(h.players.includes(jack.id) && !h.alternates.includes(jack.id));
  assert.ok(notices(jack.id, "huddle").some((n) => /One yes from you/.test(n.text)), "Jack is asked");
  assert.doesNotMatch(h.talk.map((l) => l.text).join(" "), /Nobody was waiting/);
  // the next no: Kay, the other spare, is in another game at that hour: said so, never "nobody was waiting"
  const r2 = await H.reply(iris.id, "h-spare", false, "busy");
  assert.equal(r2.open, 1);
  assert.match(h.talk.at(-1).text, /The spare for that time is in another game at that hour now/);
  assert.deepEqual(h.alternates, []);
});

// ---- what the host and the waitlist are told ----
test("the host hears once when a player's account leaves Serve, and once when the waitlist moves up the day before", async () => {
  const amy = M.demo("Amy Wu").member, ken = M.demo("Ken Hsu").member, cat = M.demo("Cat Ho").member, bob = M.demo("Bob Li").member, dee = M.demo("Dee Fox").member;
  const id = (await P.post(amy.id, { invite: { sport: "badminton", day: localDay(Date.now() + 4 * DAY), start: "10:00", where: "Amy court", spots: 1 } })).post.id;
  P.join(ken.id, id); assert.ok(P.join(cat.id, id).waitlisted);
  P.forget(ken.id, { name: "Ken Hsu" });
  const left = notices(amy.id, "left");
  assert.equal(left.length, 1, "once");
  assert.match(left[0].text, /^Ken left Serve, so they can't make your badminton .+ 10:00\. 1 of 1 spot left \(1 offered from the waitlist\)/, left[0].text);
  P.forget(bob.id); // never in it: nothing for the host
  assert.equal(notices(amy.id, "left").length, 1);
  // the day before: two new players waited behind a 90% gate, and two spots are still open
  const day = localDay(Date.now() + 2 * DAY), g = (await P.post(amy.id, { invite: { sport: "badminton", day, start: "21:00", where: "Amy court", spots: 2, gate: { minShow: 0.9 } } })).post.id;
  assert.ok(P.join(cat.id, g).waitlisted && P.join(dee.id, g).waitlisted);
  clock = P.startOf(P.find(g).invite) - 20 * HOUR; P.promoteDue(clock); P.promoteDue(clock + 60e3);
  const up = notices(amy.id, "moved-up");
  assert.equal(up.length, 1, "one notice for the move-up, however often the pass runs");
  assert.match(up[0].text, /^The waitlist moved up the day before your badminton .+ 21:00: Cat and Dee are offered a spot\. 2 of 2 spots left \(2 offered from the waitlist\)/, up[0].text);
});

test("a waitlisted player who clashes with another game is told once that the spot passed them by", async () => {
  const amy = M.demo("Amy Wu").member, ken = M.demo("Ken Hsu").member, cat = M.demo("Cat Ho").member, dan = M.demo("Dan Go").member, eve = M.demo("Eve Ng").member, fay = M.demo("Fay Li").member;
  const day = localDay(Date.now() + 3 * DAY);
  const g1 = (await P.post(dan.id, { invite: { sport: "badminton", day, start: "19:00", where: "Dan hall", spots: 1 } })).post.id;
  P.join(cat.id, g1); assert.ok(P.join(ken.id, g1).waitlisted); assert.ok(P.join(eve.id, g1).waitlisted);
  const g2 = (await P.post(amy.id, { invite: { sport: "badminton", day, start: "19:30", where: "Amy hall", spots: 2 } })).post.id;
  assert.ok(!P.join(ken.id, g2).error, "a waitlist place is not a booking");
  P.join(cat.id, g1, false);
  assert.ok(P.find(g1).invite.offered[eve.id], "the spot goes to Eve, next in line");
  const told = notices(ken.id, "skipped");
  assert.equal(told.length, 1);
  assert.match(told[0].text, /you're in another game at that time, so it went to the next in line\. You stay on the waitlist\./);
  assert.ok(P.find(g1).invite.waitlist.includes(ken.id));
  // the next opening: no second notice
  P.join(eve.id, g1, true); P.join(fay.id, g1); P.join(fay.id, g1, false); P.join(eve.id, g1, false);
  assert.equal(notices(ken.id, "skipped").length, 1, "once");
});

test("huddle/game yes:false from a player already in a game leaves it, as feed/join on:false does; the leaver gets no notice", async () => {
  const H = await import("../src/members/huddle.js");
  const amy = M.demo("Amy Wu").member, ken = M.demo("Ken Hsu").member, cat = M.demo("Cat Ho").member, bob = M.demo("Bob Li").member;
  const id = (await P.post(amy.id, { invite: { sport: "badminton", day: localDay(Date.now() + 3 * DAY), start: "18:00", where: "Amy court", spots: 2 } })).post.id;
  P.join(ken.id, id); P.join(cat.id, id); assert.ok(P.join(bob.id, id).waitlisted);
  // a full, confirmed game: the card has what it needs to offer Leave (joined, not the host's)
  const kv = P.view(P.find(id), ken.id);
  assert.deepEqual([kv.mine, kv.invite.joined, kv.invite.full], [false, true, true]);
  assert.deepEqual([P.view(P.find(id), amy.id).mine, P.view(P.find(id), amy.id).invite.joined], [true, false]);
  assert.match(H.answerGame(ken.id, id, true).line, /already in/);
  S.change((d) => { d.notices = []; });
  const r = H.answerGame(ken.id, id, false, "busy");
  assert.ok(!r.error, JSON.stringify(r)); assert.equal(r.left, "game"); assert.match(r.line, /^You've left that game/);
  assert.ok(!P.find(id).invite.going.includes(ken.id), "out of it");
  assert.equal(notices(amy.id, "left").length, 1, "the host, once");
  assert.equal((S.data().notices || []).filter((x) => x.player === ken.id).length, 0, "nothing for the leaver: the app says it once");
  assert.ok(P.find(id).invite.offered[bob.id], "the waitlist moves up");
  // on a waitlist: a no takes them off it
  const dee = M.demo("Dee Fox").member; assert.ok(P.join(dee.id, id).waitlisted);
  assert.equal(H.answerGame(dee.id, id, false).left, "waitlist");
  assert.ok(!P.find(id).invite.waitlist.includes(dee.id));
});

test("whoever starts a huddle is in it and never asked to answer it; a huddle their agent started still asks them", async () => {
  const H = await import("../src/members/huddle.js"), T = await import("../src/members/taste.js"), Cl = await import("../src/members/clubs.js");
  const run = async (byAgent) => {
    const host = M.demo("Hana Lin").member, a = M.demo("Ivy Ko").member, b = M.demo("Joe Wu").member, at = { lat: 25.03, lon: 121.56 };
    const club = (await Cl.start(host, { name: `Hana club ${byAgent ? "b" : "a"}`, sport: "badminton", at }, async () => ({ ok: true }))).club;
    for (const x of [a, b]) Cl.join(x, club.id);
    for (const x of [host, a, b]) { T.setHome(x.id, at); T.setSports(x.id, ["badminton"]); }
    const date = localDay(Date.now() + 3 * DAY), id = (await P.post(host.id, { invite: { sport: "badminton", day: date, start: "19:00", where: "Hana hall", spots: 2, at }, room: club.id })).post.id;
    // a time that isn't one of the host's usual ones: an agent would ask
    for (let i = 0; i < 6; i++) T.reply(host.id, { date, start: "19:00", km: 1, each: 0, busy: 0.3 }, false);
    const r = await H.start(host.id, { fill: id }, { wait: true, byAgent });
    if (!r.huddle) throw new Error(JSON.stringify(r));
    return { host, h: H.find(r.huddle.id), today: await H.today(host.id) };
  };
  const own = await run(false);
  assert.equal(own.h.status, "asking", JSON.stringify(own.h.talk.map((l) => l.text)));
  assert.equal(own.h.answers[own.host.id], "yes", "the host's start is their yes");
  assert.equal(H.view(own.h, own.host.id).ask, false);
  assert.ok(!own.today.cards.some((c) => c.kind === "huddle" && c.huddle.id === own.h.id), "no yes-question for the host");
  assert.doesNotMatch(own.h.talk.map((l) => l.text).join(" "), /is asked (for a yes )?too/);
  const agent = await run(true);
  assert.equal(agent.h.status, "asking");
  assert.equal(agent.h.answers[agent.host.id], undefined, "a huddle the agent started waits for the person's yes");
  assert.ok(H.view(agent.h, agent.host.id).ask);
});
