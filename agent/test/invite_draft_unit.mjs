// The invite drafted from a sentence: code reads the day, the time of day, the format and the players, so a request
// that names its day is drafted with no model call; only a request code cannot date goes to the model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteDraft} from '../src/club/play.js';

const now = new Date(2026, 9, 31, 10, 0); // Saturday 31 October 2026, 10:00
const draft = async t => {
  const r = await inviteDraft(t, {now});
  return {by: r.by, ...r.draft};
};

test('a named day is drafted by code alone', async () => {
  const d = await draft('Badminton Thursday evening, need 1');
  assert.equal(d.by, 'rules');
  assert.deepEqual(
    [d.sport, d.day, d.start, d.spots],
    ['badminton', '2026-11-05', '18:00', 1],
  );
});
test('the time of day, the format and the length come from the words', async () => {
  assert.deepEqual(
    await draft('table tennis Wednesday lunchtime, 60 minutes').then(d => [
      d.by,
      d.day,
      d.start,
      d.minutes,
    ]),
    ['rules', '2026-11-04', '12:00', 60],
  );
  assert.deepEqual(
    await draft('doubles next Tuesday after work').then(d => [
      d.day,
      d.start,
      d.format,
    ]),
    ['2026-11-03', '18:00', 'doubles'],
  );
  assert.deepEqual(
    await draft('badminton Friday afternoon').then(d => [d.day, d.start]),
    ['2026-11-06', '13:00'],
  );
  assert.deepEqual(
    await draft('tennis tomorrow 7pm singles').then(d => [
      d.sport,
      d.day,
      d.start,
      d.format,
      d.spots,
    ]),
    ['tennis', '2026-11-01', '19:00', 'singles', 1],
  );
});
test('Chinese days and parts of the day are read too', async () => {
  assert.deepEqual(
    await draft('週日下午打羽球缺兩人').then(d => [
      d.by,
      d.day,
      d.start,
      d.spots,
    ]),
    ['rules', '2026-11-01', '13:00', 2],
  );
});
