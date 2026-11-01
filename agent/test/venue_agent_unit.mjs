// Unit tests for a venue's own agent (venues/agent.js: signed quotes, the group's side of the talk, its budget) and for
// who pays what (members/split.js). No network: the venue is made up here and answers in this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'venue-'));
process.env.AGENT_KEYS_DIR = path.join(tmp, 'keys');
process.env.VENUE_AGENTS_FILE = path.join(tmp, 'venue_agents.json');
const S = await import('../src/members/split.js');
const V = await import('../src/venues/agent.js');
const D = await import('../src/members/deals.js');
const hall = {
  id: 'osm:way/1',
  name: 'Riverside Hall',
  kind: 'venue',
  sport: 'badminton',
  list: 300,
  lat: 0,
  lon: 0,
  sample: true,
};

test('an equal split when no one has a limit, in whole dollars that add up', () => {
  const r = S.split(301, [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'd'}]);
  assert.equal(
    Object.values(r.shares).reduce((s, x) => s + x, 0),
    301,
  );
  assert.ok(Object.values(r.shares).every(x => x === 75 || x === 76));
  assert.deepEqual(r.covered, []);
});
test('a tight limit is covered only by those who offered, never past their own limit', () => {
  const people = [
    {id: 'ana', cap: 50},
    {id: 'leo', cap: 150, cover: true},
    {id: 'sam', cap: 100},
    {id: 'mia', cap: 120, cover: true},
  ];
  const r = S.split(320, people);
  assert.equal(r.shares.ana, 50);
  assert.equal(r.shares.sam, 80);
  assert.equal(
    Object.values(r.shares).reduce((s, x) => s + x, 0),
    320,
  );
  for (const p of people)
    assert.ok(r.shares[p.id] <= p.cap, `${p.id} over their limit`);
  assert.deepEqual(r.covered.map(c => c.by).sort(), ['leo', 'mia']);
  // without anyone offering to cover, the same price doesn't split
  assert.equal(
    S.split(
      320,
      people.map(p => ({...p, cover: false})),
    ),
    null,
  );
});
test('the budget is the most the limits can split; an unfilled spot pays an equal share', () => {
  const people = [
    {id: 'a', cap: 60},
    {id: 'b', cap: 100, cover: true},
  ];
  const most = S.most(people, 2);
  assert.ok(S.split(most, people, 2) && !S.split(most + 10, people, 2));
  assert.equal(S.most([{id: 'a'}, {id: 'b'}]), Infinity);
  const r = S.split(400, [{id: 'a', cap: 200}], 4);
  assert.equal(r.open, 100);
});

test("a venue's quote is signed by its own key: a changed price or another key doesn't check out", () => {
  const q = V.answer(hall, {
    date: '2026-11-05',
    start: '14:00',
    players: 4,
    offer: null,
  });
  const key = V.quoteKey(hall);
  assert.ok(V.verifyQuote(q, key));
  assert.equal(V.verifyQuote({...q, price: q.price - 50}, key), false);
  assert.equal(V.verifyQuote(q, V.quoteKey({...hall, id: 'osm:way/2'})), false);
});
test('the venue checks its own last quote: a made-up lower one is ignored', () => {
  const ask = {date: '2026-11-05', start: '14:00', players: 4};
  const first = V.answer(hall, {...ask, offer: null});
  const fake = {...first, price: 100};
  const fromFake = V.answer(hall, {...ask, offer: 120, last: fake, round: 1});
  const fromReal = V.answer(hall, {...ask, offer: 120, last: first, round: 1});
  assert.equal(fromFake.price, fromReal.price);
  assert.ok(fromReal.price >= D.terms(hall, ask.date, ask.start).floor);
});
test("the talk: every quote checked, never under the venue's floor, and never past the group's budget", async () => {
  const t = D.terms(hall, '2026-11-05', '14:00');
  const deal = await V.negotiate(hall, {
    date: '2026-11-05',
    start: '14:00',
    players: 4,
    push: 1,
  });
  assert.ok(
    deal.signed && deal.price >= t.floor && deal.price <= t.list,
    JSON.stringify(deal),
  );
  assert.ok(V.verifyQuote(deal.quote, V.quoteKey(hall)));
  const poor = await V.negotiate(hall, {
    date: '2026-11-05',
    start: '14:00',
    players: 4,
    push: 1,
    budget: t.floor - 30,
  });
  assert.equal(poor.over, true);
  assert.ok(
    poor.lines.some(l =>
      /most our players can cover|past what our players' limits cover/.test(
        l.text,
      ),
    ),
  );
});
test('an outside venue agent is registered only for a real place id, on https', () => {
  assert.equal(V.register('not-a-place', 'https://x.example/a2a').code, 400);
  assert.equal(V.register('osm:way/1', 'http://x.example/a2a').code, 400);
  assert.ok(V.register('osm:way/1', 'https://hall.example/a2a/agent').ok);
  assert.equal(V.remoteOf('osm:way/1').url, 'https://hall.example/a2a/agent');
  V.unregister('osm:way/1');
  assert.equal(V.remoteOf('osm:way/1'), null);
});
