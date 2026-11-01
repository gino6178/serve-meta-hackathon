// Unit tests for a place's report before booking (venues/report.js): a model's review points kept only when they quote
// their review word for word, the rules that stand in for the model, the prices and what groups paid, and the headline.
// No network: no Google key, so no review is read, and the reviews below are made up here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vreport-'));
delete process.env.GOOGLE_MAPS_API_KEY;
process.env.PLACES_FILE = path.join(tmp, 'places.json');
process.env.DP = 'off'; // exact counts here; dp_unit checks the noisy ones
const R = await import('../src/venues/report.js');
const hall = {
  id: 'osm:way/7',
  name: 'Riverside Hall',
  kind: 'venue',
  sport: 'badminton',
  list: 300,
  lat: 25.0,
  lon: 121.5,
  sample: true,
};
const reviews = [
  {
    n: 1,
    stars: 5,
    when: 'a month ago',
    text: 'Courts are clean and the lighting is bright. Staff were friendly.',
  },
  {
    n: 2,
    stars: 2,
    when: '2 weeks ago',
    text: 'Always crowded after 7pm. Parking is difficult on weekdays.',
  },
];
const facts = [
  'Place: Riverside Hall.',
  ...reviews.map(r => `Review ${r.n} (${r.stars} stars, ${r.when}): ${r.text}`),
].join('\n');

test('a point is kept only when its quote is in the review it cites, word for word', () => {
  const kept = R.checkPoints(
    [
      {
        text: 'The courts are kept clean.',
        cite: 'review 1',
        quote: 'Courts are clean',
      },
      {
        text: 'Cheap for students.',
        cite: 'review 1',
        quote: 'student price is low',
      }, // not in review 1
      {text: 'Busy in the evening.', cite: 'review 3', quote: 'crowded'}, // no review 3
      {
        text: 'Book at example.com first.',
        cite: 'review 2',
        quote: 'Always crowded',
      }, // a link
      {
        text: 'It costs 500 a night.',
        cite: 'review 2',
        quote: 'Always crowded after 7pm',
      }, // a number not in the facts
      {
        text: 'She said parking is hard.',
        cite: 'review 2',
        quote: 'Parking is difficult',
      }, // a pronoun
    ],
    reviews,
    facts,
  );
  assert.deepEqual(
    kept.map(x => x.text),
    ['The courts are kept clean.'],
  );
  assert.equal(kept[0].review, 1);
});

test('with the model down, words found in the reviews stand in, each quoting its sentence', () => {
  const n = R.rulesNotes(reviews);
  assert.equal(n.by, 'rules');
  assert.ok(n.good.length && n.bad.length);
  for (const x of [...n.good, ...n.bad])
    assert.ok(reviews.find(r => r.n === x.review).text.includes(x.quote));
  assert.ok(n.bad.some(x => /crowded/.test(x.text)));
});

test("prices: the list for 90 minutes and the floor's range over the week; a public court is free", () => {
  const p = R.pricesOf(hall, {now: new Date('2026-11-02T08:00:00')});
  assert.equal(p.list, 450);
  assert.ok(p.low <= p.high && p.high <= p.list && p.low > 0);
  assert.equal(R.pricesOf({...hall, kind: 'public'}).free, true);
});

test('what groups paid: the range and the usual price, leaving out games called off; who played is never there', () => {
  const past = R.pastOf([
    {
      date: '2026-10-30',
      price: 290,
      each: 73,
      list: 450,
      off: 36,
      players: 4,
      signed: true,
      state: 'played',
    },
    {
      date: '2026-10-28',
      price: 270,
      each: 68,
      list: 450,
      off: 40,
      players: 4,
      signed: true,
      state: 'played',
    },
    {
      date: '2026-10-25',
      price: 100,
      each: 25,
      list: 450,
      off: 78,
      players: 4,
      signed: true,
      state: 'called off',
    },
  ]);
  assert.deepEqual(
    [
      past.low,
      past.high,
      past.median,
      past.agreed,
      past.played,
      past.calledOff,
    ],
    [270, 290, 280, 3, 2, 1],
  );
  assert.ok(
    past.games.every(g => !('players' in g) || typeof g.players === 'number'),
  );
});

test('the headline and lines come from the facts', () => {
  const prices = R.pricesOf(hall),
    past = R.pastOf([]);
  const good = R.summaryOf({
    rating: {stars: 4.5, count: 120},
    notes: {good: [{text: 'Clean courts.'}], bad: []},
    prices,
    past,
  });
  assert.equal(good.headline, 'Well reviewed');
  assert.ok(
    good.lines[0] === 'Rated 4.5 on Google from 120 reviews.' &&
      good.lines.some(l => /sample prices/.test(l)),
  );
  assert.equal(
    R.summaryOf({
      rating: {stars: 3.2, count: 9},
      notes: {good: [], bad: []},
      prices,
      past,
    }).headline,
    'Check before you book',
  );
  assert.equal(
    R.summaryOf({rating: null, notes: {good: [], bad: []}, prices, past})
      .headline,
    'No reviews read yet',
  );
});

test('the whole report without a Google key: no reviews, and it says why', async () => {
  const r = await R.report(hall, {games: []});
  assert.equal(r.reviews.read, 0);
  assert.match(r.reviews.note, /No Google Maps key/);
  assert.equal(r.headline, 'No reviews read yet');
  assert.ok(r.lines.some(l => /List price NT\$450/.test(l)));
});
