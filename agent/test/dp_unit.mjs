// Unit tests for encryption at rest (core/crypt.js, core/jsonfile.js) and differential privacy (core/dp.js, and its use
// in venues/notes.js and venues/report.js). No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-'));
Object.assign(process.env, {
  DATA_ENCRYPT: 'on',
  DATA_KEY_FILE: path.join(tmp, 'keys/master.key'),
  DATA_KEYRING_FILE: path.join(tmp, 'keys/subjects.json'),
  DP_KEY_FILE: path.join(tmp, 'keys/dp.key'),
  VENUE_NOTES_FILE: path.join(tmp, 'venue_notes.json'),
  TRUST_FILE: path.join(tmp, 'trust.json'),
  PLACES_FILE: path.join(tmp, 'places.json'),
  GUARD: 'off',
});
delete process.env.DP;
delete process.env.DATA_KEY;
const crypt = await import('../src/core/crypt.js');
const J = await import('../src/core/jsonfile.js');
const dp = await import('../src/core/dp.js');

test('a store is written sealed, opens only under its own name, and a plain file still reads', () => {
  const f = path.join(tmp, 'members.json');
  J.writeJSON(f, {members: [{id: 'm1', name: 'Ana'}]});
  const raw = fs.readFileSync(f, 'utf8');
  assert.ok(
    !raw.includes('Ana') && JSON.parse(raw).$enc === 'serve/v1',
    'nothing readable on disk',
  );
  assert.equal(J.readJSON(f, {}).members[0].name, 'Ana');
  const moved = path.join(tmp, 'bookings.json');
  fs.copyFileSync(f, moved);
  assert.throws(
    () => J.readSealed(moved),
    "a sealed file moved under another store's name does not open",
  );
  const plain = path.join(tmp, 'club.json');
  fs.writeFileSync(plain, JSON.stringify({name: 'Plain'}));
  assert.equal(J.readJSON(plain, {}).name, 'Plain');
  const cache = path.join(tmp, 'places_cache.json');
  J.writeJSON(cache, {a: 1});
  assert.equal(
    JSON.parse(fs.readFileSync(cache, 'utf8')).a,
    1,
    'caches with nothing personal stay plain',
  );
});

test("a person's key shreds: what was sealed with it can't be opened again", () => {
  const k = crypt.subjectKey('m1'),
    env = crypt.sealWith(k, {said: 'hello'}, 'memory:m1');
  assert.equal(
    crypt.openWith(crypt.subjectKey('m1'), env, 'memory:m1').said,
    'hello',
  );
  assert.equal(crypt.shred('m1'), true);
  assert.equal(crypt.subjectKey('m1', {create: false}), null);
  assert.throws(
    () => crypt.openWith(crypt.subjectKey('m1'), env, 'memory:m1'),
    'a new key opens nothing old',
  );
});

test('randomized response keeps a mark e^ε/(e^ε+k-1) of the time, and debiasing gets the counts back', () => {
  const V = ['good', 'ok', 'bad'],
    eps = 2,
    n = 30000;
  assert.ok(Math.abs(dp.keepP(eps, 3) - 0.787) < 0.001);
  let s = 1;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const truth = {good: 18000, ok: 9000, bad: 3000},
    seen = {good: 0, ok: 0, bad: 0};
  for (const v of V)
    for (let i = 0; i < truth[v]; i++) seen[dp.randomize(v, V, eps, rnd)]++;
  assert.notDeepEqual(seen, truth);
  const est = dp.debias(seen, V, eps);
  for (const v of V)
    assert.ok(
      Math.abs(est[v] - truth[v]) < n * 0.02,
      `${v}: ${est[v]} vs ${truth[v]}`,
    );
});

test('Laplace noise is the same for the same release, and a count over few people is not shown', () => {
  assert.equal(
    dp.noisyCount(12, 'x'),
    dp.noisyCount(12, 'x'),
    "asking again can't average the noise away",
  );
  const draws = Array.from({length: 4000}, (_, i) => dp.laplace(1, `s${i}`)),
    mean = draws.reduce((a, b) => a + b, 0) / draws.length,
    mad = draws.reduce((a, b) => a + Math.abs(b), 0) / draws.length;
  assert.ok(
    Math.abs(mean) < 0.1 && Math.abs(mad - 1) < 0.1,
    `Lap(1): mean ${mean.toFixed(3)}, E|x| ${mad.toFixed(3)}`,
  );
  assert.equal(dp.enough(4), false);
  assert.equal(dp.enough(5), true);
});

test("a venue's marks are randomized before they are kept, and its record waits for enough players", async () => {
  const VN = await import('../src/venues/notes.js');
  for (let i = 0; i < 3; i++)
    await VN.add(
      `p${i}`,
      {id: `g${i}`, place: 'hall', where: 'Hall'},
      {marks: {courts: 'good'}},
    );
  const kept = J.readJSON(process.env.VENUE_NOTES_FILE, {}).notes;
  assert.ok(
    kept.every(x => x.rr === 2),
    'each note says the ε it was randomized with',
  );
  assert.equal(VN.of('hall').few, true, '3 players: no counts shown');
  for (let i = 3; i < 8; i++)
    await VN.add(
      `p${i}`,
      {id: `g${i}`, place: 'hall', where: 'Hall'},
      {marks: {courts: 'good'}},
    );
  const r = VN.of('hall');
  assert.ok(!r.few && r.marks.courts && r.dp.eps === 2);
  const R = await import('../src/venues/report.js');
  const few = R.pastOf(
    [
      {
        date: '2026-10-30',
        price: 290,
        each: 73,
        off: 36,
        players: 4,
        state: 'played',
      },
    ],
    'hall',
  );
  assert.deepEqual(
    [few.games.length, few.low],
    [0, undefined],
    'one game: no prices or dates shown',
  );
});
