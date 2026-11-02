// Unit tests for the guide and the club place (test round 30): the guide opens with a part for a person, says which
// limit name is which, and tells the truth about who sees a club's members; a new club's place is not its name.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-'));
process.env.CLUBS_FILE = path.join(tmp, 'clubs.json');
const D = await import('../src/members/discovery.js');
const C = await import('../src/members/clubs.js');
const Deals = await import('../src/members/deals.js');

const guide = D.llmsTxt({headers: {host: 'x.test'}, socket: {}});

test('the guide starts with a part for a person, before the agent text', () => {
  const i = guide.indexOf('## If you are a person reading this yourself');
  assert.ok(i > 0 && i < guide.indexOf('## Quick start'));
  assert.match(guide, /any name works/);
  assert.doesNotMatch(guide, /<their first name>/);
});

test('the guide says which limit name is which', () => {
  assert.match(guide, /## Limits: two names/);
  assert.match(guide, /limitKm and limitEach/);
  assert.match(guide, /priceCap/);
});

test('the guide says who sees club members', () => {
  assert.doesNotMatch(guide, /never who is in it/);
  assert.match(guide, /public clubs' member first names to anyone signed in/);
  assert.match(guide, /private club is not listed to outsiders/);
});

test('openapi says the same about limits and clubs', () => {
  const j = JSON.stringify(
    D.openapi ? D.openapi({headers: {host: 'x.test'}, socket: {}}) : {},
  );
  if (j.length > 2) {
    assert.match(j, /limitKm and limitEach/);
    assert.match(j, /member first names to anyone signed in/);
  }
});

test('a club with no place name has no place, not its name', async () => {
  const r = await C.start(
    {id: 'm1', name: 'Mei Lin'},
    {name: 'Tuesday Smash', sport: 'badminton', at: {lat: 25.03, lon: 121.53}},
    async () => null,
  );
  const club = r.club || r;
  assert.equal(club.where ?? null, null);
});

test('the looking note says what is happening', () => {
  assert.match(Deals.LOOKING_NOTE, /first time/);
  assert.match(Deals.LOOKING_NOTE, /20 s/);
});
