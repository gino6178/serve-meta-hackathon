// Unit test for Llama Guard's S1 on a post (feed/posts.js moderate): flagged alone, with no word of harm in the text
// ("Serve test round 27" was refused as a threat of violence), the club's standard decides; with a word of harm, or
// with the standard saying no, the post is refused as before. Models stood in. No network.
//   node --test test/feed_s1_unit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-feed-s1-"));
Object.assign(process.env, { MEMBERS_FILE: `${tmp}/members.json`, MEMBERS_KEY_FILE: `${tmp}/members.key`, FEED_FILE: `${tmp}/feed.json`, TRUST_FILE: `${tmp}/trust.json`, NEEDS_FILE: `${tmp}/needs.json`, TASTE_FILE: `${tmp}/taste.json`, HUDDLE_FILE: `${tmp}/huddles.json`, FEED_MEDIA_DIR: `${tmp}/media`, FEED_DEMO: "off",
  CLUBS_FILE: `${tmp}/clubs.json`, LOOP_DIR: `${tmp}/loop`, GUARD: "off", LLM_URL: "http://127.0.0.1:9/v1", LOOP_WATCH: "off", FEED_TINY: "0" });
const { use } = await import("../src/feed/deps.js");
const P = await import("../src/feed/posts.js");
const M = await import("../src/members/members.js");

test("S1 alone with no word of harm goes to the club's standard; a word of harm, or the standard's no, is refused", async () => {
  let standard = "ok";
  use({ screen: async () => ({ safe: false, categories: ["S1"] }), standard: async () => ({ verdict: standard }), injected: async (ts) => ts.map(() => ({ injected: false })) });
  const who = M.demo("Tom Test").member.id;
  assert.equal((await P.moderate("Serve test round 27 (please ignore)", who)).ok, true, "a name with 'round' in it");
  const k = await P.moderate("I will kill you after the game", who);
  assert.ok(k.refused && k.check === "llama-guard", JSON.stringify(k));
  standard = "harassment";
  const s = await P.moderate("Serve test round 27 (please ignore)", who);
  assert.ok(s.refused && s.check === "standard", JSON.stringify(s));
  use({ screen: async () => ({ safe: false, categories: ["S1", "S10"] }), standard: async () => ({ verdict: "ok" }) });
  assert.ok((await P.moderate("Serve test round 27", who)).refused, "S1 with another category is refused here");
});
