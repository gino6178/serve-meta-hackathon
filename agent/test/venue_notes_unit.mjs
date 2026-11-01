// Unit tests for what players say about a place after a game (venues/notes.js): once per game, marks on the trust
// chain, a note with a link left out, a note no guard could check kept back, and the counts in the venue's report.
// No network: the guards are off here, so every note is unchecked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vnotes-"));
Object.assign(process.env, { VENUE_NOTES_FILE: path.join(tmp, "notes.json"), TRUST_FILE: path.join(tmp, "trust.json"), PLACES_FILE: path.join(tmp, "places.json"), GUARD: "off" });
delete process.env.GOOGLE_MAPS_API_KEY;
const VN = await import("../src/venues/notes.js");
const Tr = await import("../src/members/trust.js");
const R = await import("../src/venues/report.js");
const game = (id) => ({ id, place: "osm:way/7", where: "Riverside Hall", kind: "venue", sport: "badminton", when: "Thu, 14:00" });

test("one answer per player per game; the marks go on the trust chain, the note does not", async () => {
  const before = JSON.parse(fs.existsSync(process.env.TRUST_FILE) ? fs.readFileSync(process.env.TRUST_FILE, "utf8") : "{}").chain?.length || 0;
  const r = await VN.add("ana", game("h1"), { marks: { courts: "good", air: "bad", nonsense: "good", light: "great" }, note: "Bring a towel, the air is warm." });
  assert.ok(r.ok && r.chain);
  assert.equal((await VN.add("ana", game("h1"), { marks: { courts: "bad" } })).code, 409);
  const chain = JSON.parse(fs.readFileSync(process.env.TRUST_FILE, "utf8")).chain;
  const e = chain.at(-1);
  assert.equal(chain.length, before + 1);
  assert.deepEqual([e.kind, e.d.place, e.d.marks], ["venue", "osm:way/7", { courts: "good", air: "bad" }]);
  assert.ok(!JSON.stringify(e).includes("towel") && e.who !== "ana");
  assert.ok(Tr.verify().ok, "the chain still checks out");
});

test("a note with a link is left out; with no guard to check it, a note is kept back from others", async () => {
  assert.equal((await VN.checkNote("great courts, book at cheapcourts.example.com")).note, null);
  assert.equal((await VN.checkNote("ask @hallowner for a discount")).note, null);
  assert.equal((await VN.checkNote("Floor was a bit slippery")).held, true);
  assert.deepEqual(VN.of("osm:way/7").notes, [], "ana's unchecked note isn't shown");
});

test("nothing to say is refused; a skip is kept so the agent doesn't ask again", async () => {
  assert.equal((await VN.add("leo", game("h1"), {})).code, 400);
  assert.ok((await VN.add("leo", game("h1"), { skip: true })).skipped);
  assert.ok(VN.answered("leo", "h1"));
});

test("the report counts the players' marks and its headline reads them", async () => {
  await VN.add("sam", game("h2"), { marks: { courts: "good", air: "bad", price: "good" } });
  await VN.add("mia", game("h2"), { marks: { courts: "good", air: "bad" } });
  const p = VN.of("osm:way/7");
  assert.equal(p.n, 3);
  assert.deepEqual(p.marks.air, { good: 0, ok: 0, bad: 3 });
  const hall = { id: "osm:way/7", name: "Riverside Hall", kind: "venue", sport: "badminton", list: 300, lat: 25, lon: 121.5, sample: true };
  const r = await R.report(hall, { games: [] });
  assert.ok(r.lines.some((l) => /^3 Serve players rated it after a game: the courts good \(3\), the air bad \(3\)/.test(l)), r.lines.join(" | "));
  assert.equal(r.headline, "Mixed reviews", "a mark most players found bad keeps it from 'Well reviewed'");
});
