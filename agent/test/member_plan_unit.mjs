// Unit tests for the planner a signed-in member gets (src/members/plan.js): courts near their own area, the people in
// their clubs whose limits fit, and the body for POST /api/huddle/start. Stand-in data only: temp files, the map's
// answer seeded in its cache (no network), no model (the request is read by rules).
//   node --test test/member_plan_unit.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-mplan-'));
Object.assign(process.env, {
  CLUBS_FILE: `${tmp}/clubs.json`,
  TASTE_FILE: `${tmp}/taste.json`,
  HUDDLE_FILE: `${tmp}/huddles.json`,
  PLACES_FILE: `${tmp}/places.json`,
  FEED_FILE: `${tmp}/feed.json`,
  FEED_MEDIA_DIR: `${tmp}/media`,
  FEED_DEMO: 'off',
  STORE_FILE: `${tmp}/players.json`,
  TRUST_FILE: `${tmp}/trust.json`,
  NEEDS_FILE: `${tmp}/needs.json`,
  LEDGER_FILE: `${tmp}/ledger.jsonl`,
  TRACE_FILE: `${tmp}/traces.jsonl`,
  LOOP_DIR: `${tmp}/loop`,
  GUARD: 'off',
  LLM_URL: 'http://127.0.0.1:9/v1',
  LOOP_WATCH: 'off',
});
const HOME = {lat: 25.03, lon: 121.56};
// the map's answer for the area, as places.js caches it: a hall and a public court close to home
fs.writeFileSync(
  process.env.PLACES_FILE,
  JSON.stringify({
    'near:25.03,121.56,4000,badminton': {
      at: Date.now(),
      places: [
        {
          id: 'osm:way/1',
          name: 'Zhongshan Sports Centre',
          lat: 25.034,
          lon: 121.562,
          kind: 'sports_centre',
          m: 500,
        },
        {
          id: 'osm:way/2',
          name: 'Riverside Park Courts',
          lat: 25.036,
          lon: 121.558,
          kind: 'pitch',
          m: 700,
        },
      ],
    },
  }),
);
const T = await import('../src/members/taste.js');
const C = await import('../src/members/clubs.js');
const {plan} = await import('../src/members/plan.js');

const now = new Date(2026, 10, 2, 10, 0); // Monday 2 November 2026, 10:00
const club = async (owner, name) =>
  (await C.start(owner, {name, sport: 'badminton', at: HOME}, async () => null))
    .club;
const join = (id, who) => C.join({id: who.id, name: who.name}, id, true);

test('no rough area: asks to share it, and offers nothing', async () => {
  const r = await plan('nohome', {text: 'badminton', now});
  assert.deepEqual(r.options, []);
  assert.match(r.message, /share your rough area/i);
});

test('with an area: real courts from the map become options, never the demo town', async () => {
  T.setHome('me', HOME);
  T.setSports('me', ['badminton']);
  const r = await plan('me', {text: 'badminton', now});
  assert.ok(r.options.length >= 1, JSON.stringify(r));
  const names = r.options.map(o => o.venue.name);
  assert.ok(
    names.every(n => /Zhongshan Sports Centre|Riverside Park/.test(n)),
    names.join(),
  );
  assert.ok(!/midtown/i.test(JSON.stringify(r.options)));
  for (const o of r.options) {
    assert.ok(o.day && o.start && o.venue.id && typeof o.venue.km === 'number');
    assert.equal(o.huddle.pin.place, o.venue.id);
  }
});

test('a club member whose limits rule a time out is not a partner there', async () => {
  const me = {id: 'me', name: 'Mia Chen'};
  const bob = {id: 'bob', name: 'Bob Lin'},
    cat = {id: 'cat', name: 'Cat Wu'};
  T.setHome('bob', HOME);
  T.setHome('cat', HOME);
  T.setSports('bob', ['badminton']);
  T.setSports('cat', ['badminton']);
  T.setLimits('bob', {windows: [{days: ['Sat'], from: '07:00', to: '22:00'}]}); // Saturdays only
  const c = await club(me, 'Plan Test Club');
  join(c.id, bob);
  join(c.id, cat);
  // tomorrow (Tuesday): Bob only plays Saturdays, Cat has no limits
  const tue = await plan('me', {text: 'badminton tomorrow', now});
  assert.ok(tue.options.length, JSON.stringify(tue.intent));
  for (const o of tue.options) {
    assert.equal(o.date, '2026-11-03');
    const ids = o.partners.map(p => p.id);
    assert.ok(!ids.includes('bob'), `Bob on a Tuesday: ${JSON.stringify(o)}`);
    assert.ok(ids.includes('cat'));
  }
  // Saturday: Bob's window fits
  const sat = await plan('me', {text: 'badminton on Saturday', now});
  assert.ok(sat.options.length, JSON.stringify(sat.intent));
  assert.ok(
    sat.options.some(o => o.partners.some(p => p.id === 'bob')),
    JSON.stringify(sat.options.map(o => o.partners)),
  );
});

test('the huddle body pins date, start and place, and invites only club members', async () => {
  const r = await plan('me', {text: 'badminton tomorrow', now});
  const o = r.options[0];
  assert.deepEqual(Object.keys(o.huddle.pin).sort(), [
    'date',
    'place',
    'start',
  ]);
  assert.equal(o.huddle.pin.date, o.date);
  assert.equal(o.huddle.pin.start, o.start);
  assert.equal(o.huddle.sport, 'badminton');
  assert.ok(o.huddle.invite.every(id => ['bob', 'cat'].includes(id)));
});

test('people nearby outside the clubs are never counted or named', async () => {
  T.setHome('stranger', HOME);
  T.setSports('stranger', ['badminton']);
  T.setOpen('stranger', true);
  const r = await plan('me', {text: 'badminton tomorrow', now});
  assert.ok(!JSON.stringify(r).includes('stranger'));
  assert.ok(r.options.every(o => !o.huddle.invite?.includes('stranger')));
});
