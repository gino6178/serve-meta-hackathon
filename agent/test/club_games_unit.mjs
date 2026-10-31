// Unit test for the games a member's agent puts in front of them (members/huddle.js gamesFor): a game in one of their
// own clubs shows whatever sports they listed (round 28: a badminton player who joined a friend's basketball club never
// saw its game), and a game in a club they are not in, of a sport they don't play, still does not. No model, no network.
//   node --test test/club_games_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-club-games-"));
Object.assign(process.env, { MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, NEEDS_FILE: `${tmp}/needs.json`, TASTE_FILE: `${tmp}/taste.json`, HUDDLE_FILE: `${tmp}/huddles.json`, FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off",
  AGENT_KEYS_DIR: `${tmp}/agent_keys`, CLUBS_FILE: `${tmp}/clubs.json`, PLACES_FILE: `${tmp}/places.json`, OVERPASS_URLS: "http://127.0.0.1:9/x", GOOGLE_MAPS_API_KEY: "", CONSENT_LOG: `${tmp}/consent.jsonl`, LOOP_DIR: `${tmp}/loop`, STORE_FILE: `${tmp}/players.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off" });
const M = await import("../src/members/members.js");
const T = await import("../src/members/taste.js");
const C = await import("../src/members/clubs.js");
const { use } = await import("../src/feed/deps.js");
const P = await import("../src/feed/posts.js");
const H = await import("../src/members/huddle.js");
use({ screen: async () => ({ safe: true, categories: [] }), standard: async () => ({ verdict: "ok" }), injected: async (ts) => ts.map(() => ({ injected: false })), chatJSON: async () => ({ value: null }) });

test("a game in your own club shows whatever sports you listed; another club's game of another sport does not", async () => {
  const at = { lat: 25.033, lon: 121.565 }, mk = (n) => M.demo(n).member.id;
  const tom = mk("Tom Test"), olivia = mk("Olivia Test"), ray = mk("Ray Test");
  for (const x of [tom, olivia, ray]) T.setHome(x, at);
  T.setSports(olivia, ["badminton"]);
  const hoops = (await C.start(M.get(tom), { name: "Thursday hoops", sport: "basketball", about: "x", where: "Riverside courts", at, privacy: "private" }, async () => ({ ok: true }))).club.id;
  C.join(M.get(olivia), hoops, true); C.answer(M.get(tom), hoops, olivia, true);
  const other = (await C.start(M.get(ray), { name: "Other hoops", sport: "basketball", about: "x", where: "Other courts", at }, async () => ({ ok: true }))).club.id;
  const d = new Date(); d.setDate(d.getDate() + 3); const day = T.ymd(d);
  const mine = await P.post(tom, { text: "Thursday 3 on 3, who's in?", invite: { sport: "basketball", day, start: "19:00", where: "Riverside courts", spots: 5, at, each: 0 }, room: hoops });
  await P.post(ray, { text: "Pickup", invite: { sport: "basketball", day, start: "20:00", where: "Other courts", spots: 5, at, each: 0 }, room: other });
  const seen = H.gamesFor(olivia, { n: 10 });
  assert.ok(seen.some((g) => g.post === mine.post.id && g.room === hoops), "her own club's basketball game shows");
  assert.ok(!seen.some((g) => g.club === "Other hoops"), "another club's basketball game does not");
});

test("someone who leaves Serve drops out of a game being worked out: the talk says so and its host is told", async () => {
  const S = await import("../src/feed/store.js");
  const at = { lat: 25.03, lon: 121.56 }, mk = (n) => M.demo(n).member.id;
  const mia = mk("Mia Lee"), joe = mk("Joe Lin");
  for (const x of [mia, joe]) { T.setHome(x, at); T.setSports(x, ["badminton"]); }
  const club = (await C.start(M.get(mia), { name: "Lunch smash", sport: "badminton", about: "x", where: "Gym", at }, async () => ({ ok: true }))).club.id;
  C.join(M.get(joe), club, true);
  const r = H.start(mia, { sport: "badminton", club, need: 2 }, { wait: false });
  assert.ok(r.huddle?.id, JSON.stringify(r).slice(0, 200));
  M.leave(joe); H.forget(joe, "Joe Lin");
  const notes = (S.data().notices || []).filter((x) => x.player === mia && x.kind === "huddle");
  assert.ok(notes.some((x) => /Joe left Serve/.test(x.text)), "the host is told");
});

test("a host who leaves Serve: everyone in their game, or waiting for a spot, is told it is off, once", async () => {
  const S = await import("../src/feed/store.js");
  const at = { lat: 25.04, lon: 121.55 }, mk = (n) => M.demo(n).member.id;
  const lily = mk("Lily Wang"), ben = mk("Ben Ho"), liv = mk("Liv Chen"), mia = mk("Mia Su");
  const d = new Date(); d.setDate(d.getDate() + 4);
  const r = await P.post(lily, { text: "Doubles, 2 spots", invite: { sport: "badminton", day: T.ymd(d), start: "19:00", where: "Daan Sports Center", spots: 2, at, each: 100 } });
  for (const x of [ben, liv, mia]) P.join(x, r.post.id);
  P.forget(lily, { name: "Lily Wang" });
  for (const x of [ben, liv, mia]) {
    const n = (S.data().notices || []).filter((y) => y.player === x && y.post === r.post.id);
    assert.equal(n.length, 1, `${x}: ${JSON.stringify(n)}`); assert.equal(n[0].kind, "called-off");
    assert.match(n[0].text, /^Lily left Serve, so their badminton game .+ 19:00 at Daan Sports Center is off\.$/);
  }
});

test("the member's agent reading the feed sees the notices and leaves them for the member; the member's own read takes them", () => {
  const who = M.demo("Nia Test").member.id;
  P.notify(who, "gameon", "Game on: test.");
  assert.deepEqual(P.feed(who, { keep: true }).notices, ["Game on: test."]);
  assert.deepEqual(P.feed(who, { keep: true }).notices, ["Game on: test."], "still there for the member");
  assert.deepEqual(P.feed(who).notices, ["Game on: test."]);
  assert.deepEqual(P.feed(who).notices, [], "taken once by the member");
});

test("a private club's game carries no share link (strangers could not open it); a public one does", async () => {
  const at = { lat: 25.04, lon: 121.55 }, host = M.demo("Ivy Test").member.id;
  const d = new Date(); d.setDate(d.getDate() + 5); const day = T.ymd(d);
  const priv = (await C.start(M.get(host), { name: "Closed doubles", sport: "badminton", about: "x", where: "Hall", at, privacy: "private" }, async () => ({ ok: true }))).club.id;
  const open = (await C.start(M.get(host), { name: "Open doubles", sport: "badminton", about: "x", where: "Hall", at }, async () => ({ ok: true }))).club.id;
  const a = await P.post(host, { text: "Doubles", invite: { sport: "badminton", day, start: "18:00", where: "Hall", spots: 2, at, each: 0 }, room: priv });
  const b = await P.post(host, { text: "Doubles", invite: { sport: "badminton", day, start: "21:30", where: "Hall", spots: 2, at, each: 0 }, room: open });
  assert.equal(a.post.invite.shareUrl, null);
  assert.equal(b.post.invite.shareUrl, `/#/invite?id=${b.post.id}`);
});
