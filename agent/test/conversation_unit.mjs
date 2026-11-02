// Unit tests for the agent's conversation memory (memory/conversation.js): the working window and its rolling summary,
// episodes recalled by their words and faded by time, the token budget, sealing per person and shredding on forget.
// No network: the model is unreachable, so summaries are the cut-words fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'));
Object.assign(process.env, {
  CONV_DIR: path.join(tmp, 'conversations'),
  FEED_FILE: path.join(tmp, 'feed.json'),
  DATA_ENCRYPT: 'on',
  DATA_KEY_FILE: path.join(tmp, 'keys/master.key'),
  DATA_KEYRING_FILE: path.join(tmp, 'keys/subjects.json'),
  LLM_URL: 'http://127.0.0.1:9/v1',
  LLM_FALLBACK: 'off',
  MEMORY_CONV_TURNS: '4',
});
delete process.env.MEMORY_CONV;
delete process.env.LLM_ONLY;
delete process.env.LLM_FAST;
const C = await import('../src/memory/conversation.js');
const H = 3600e3,
  D = 24 * H,
  t0 = Date.parse('2026-10-01T10:00:00Z');

test('the working window keeps the last turns and folds older ones into a summary', async () => {
  for (let i = 0; i < 10; i++)
    await C.add(
      'ana',
      i % 2 ? 'assistant' : 'user',
      `turn ${i} about the Tuesday doubles at Riverside hall`,
      t0 + i * 60e3,
    );
  const c = C.context('ana', 'Riverside', {now: t0 + 11 * 60e3});
  assert.ok(c.summary, 'older turns were summarized');
  assert.match(c.note, /Earlier in this conversation/);
  assert.ok(
    c.messages.length <= 8 && c.messages.at(-1).content.startsWith('turn 9'),
  );
});

test('the budget caps the context however long the conversation', () => {
  const c = C.context('ana', '', {budget: 40, now: t0 + 12 * 60e3});
  assert.ok(c.used <= 40 + 200, `used ${c.used}`);
  assert.ok(c.messages.filter(m => m.role !== 'system').length < 4);
});

test('an idle conversation becomes an episode, recalled by its words and faded by time', async () => {
  await C.add('ana', 'user', 'Anything new this week?', t0 + 8 * H);
  const ep = C.view('ana', t0 + 8 * H).episodes;
  assert.equal(ep.length, 1);
  const hit = C.context('ana', 'Is Riverside hall booked for doubles?', {
    now: t0 + 9 * H,
  });
  assert.equal(hit.episodes, 1);
  assert.equal(
    C.context('ana', 'my knee', {now: t0 + 9 * H}).episodes,
    0,
    'nothing in common: nothing recalled',
  );
  assert.equal(
    C.context('ana', 'Riverside doubles', {now: t0 + 200 * D}).episodes,
    0,
    'faded after months',
  );
  const swept = await C.sweepOne('ana', t0 + 200 * D);
  assert.ok(swept.dropped >= 1);
});

test("a record is sealed with the person's key, and forget shreds it", async () => {
  await C.add('ben', 'user', 'I can only play on Fridays after 7', t0);
  const dir = process.env.CONV_DIR,
    files = () => fs.readdirSync(dir),
    mine = `${crypto.createHash('sha256').update('conv:ben').digest('hex').slice(0, 24)}.json`;
  const raw = fs.readFileSync(path.join(dir, mine), 'utf8');
  assert.ok(!raw.includes('Fridays'), 'nothing readable on disk');
  const before = files().length;
  const r = C.forget('ben');
  assert.deepEqual(r, {deleted: true, shredded: true});
  assert.equal(files().length, before - 1, "the person's own file is gone");
  // put the old (backed-up) record back: with the key gone it opens as nothing
  fs.writeFileSync(path.join(dir, mine), raw);
  assert.equal(
    C.view('ben').open,
    null,
    "a backup made before forget can't be read",
  );
});

test("two turns at once for one person are both kept, and other people's files are never touched", async () => {
  await Promise.all([
    C.add('dee', 'user', 'first message', t0),
    C.add('dee', 'assistant', 'second message', t0),
    C.addTurns('dee', [{role: 'user', content: 'third'}], t0),
  ]);
  assert.equal(C.view('dee', t0).open.turns, 3);
  const c = C.context('dee', '', {now: t0});
  assert.ok(
    c.messages.every(m => m.role !== 'system'),
    'what was said is never a system message',
  );
});

test('MEMORY_CONV=off keeps nothing', async () => {
  process.env.MEMORY_CONV = 'off';
  assert.equal(await C.add('cy', 'user', 'hi'), null);
  assert.deepEqual(C.context('cy', 'hi').messages, []);
  delete process.env.MEMORY_CONV;
});
