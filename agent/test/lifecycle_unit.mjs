// Unit tests for the data's lifecycle (core/lifecycle.js): the registry's status without opening a record, log lines
// past their retention cut, a sealed backup that leaves the keys out, rotation, and a restore into a folder of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'life-')),
  data = path.join(tmp, 'data');
fs.mkdirSync(path.join(data, 'keys'), {recursive: true});
fs.mkdirSync(path.join(data, 'agent_keys'), {recursive: true});
Object.assign(process.env, {
  DATA_DIR: data,
  DATA_ENCRYPT: 'on',
  DATA_KEY_FILE: path.join(data, 'keys/master.key'),
  DATA_KEYRING_FILE: path.join(data, 'keys/subjects.json'),
  MEMBERS_FILE: path.join(data, 'members.json'),
  LEDGER_FILE: path.join(data, 'ledger.jsonl'),
  TRACE_FILE: path.join(data, 'traces.jsonl'),
  CONV_DIR: path.join(data, 'conversations'),
  FEED_FILE: path.join(data, 'feed.json'),
  BACKUP_DIR: path.join(tmp, 'backups'),
  BACKUP_KEEP: '2',
});
const J = await import('../src/core/jsonfile.js');
const L = await import('../src/core/lifecycle.js');
const now = Date.parse('2026-11-01T00:00:00Z'),
  DAY = 864e5;

test('status lists every store with its class and retention, and says what is sealed, opening nothing', () => {
  J.writeJSON(process.env.MEMBERS_FILE, {members: {m1: {name: 'Ana'}}});
  const s = L.status(),
    m = s.stores.find(x => x.store === 'members');
  assert.equal(m.class, 'personal');
  assert.equal(m.sealed, true);
  assert.equal(m.keepDays, 'while a member');
  assert.ok(!JSON.stringify(s).includes('Ana'));
  assert.equal(s.encryption.on, true);
  assert.match(s.personalSealed, /^1 of 1$/);
  assert.ok(
    s.stores.every(x =>
      ['personal', 'activity', 'public', 'operational', 'cache'].includes(
        x.class,
      ),
    ),
  );
});

test('purge cuts log lines past their retention and keeps the rest', async () => {
  fs.writeFileSync(
    process.env.LEDGER_FILE,
    [
      {at: now - 40 * DAY, site: 'old'},
      {at: now - DAY, site: 'new'},
      'not json',
    ]
      .map(x => (typeof x === 'string' ? x : JSON.stringify(x)))
      .join('\n') + '\n',
  );
  fs.writeFileSync(
    process.env.TRACE_FILE,
    JSON.stringify({start: now - 20 * DAY}) +
      '\n' +
      JSON.stringify({start: now}) +
      '\n',
  );
  const r = await L.purge({now});
  assert.deepEqual(r.logLinesCut, {ledger: 1, traces: 1});
  assert.equal(
    fs.readFileSync(process.env.LEDGER_FILE, 'utf8').trim().split('\n').length,
    2,
  );
});

test('a backup is sealed, leaves every key out, rotates, and restores only into a folder of its own', () => {
  fs.writeFileSync(path.join(data, 'agent_keys', 'a.json'), '{"private":1}');
  fs.writeFileSync(path.join(data, 'members.key'), 'secret');
  const b1 = L.backup({now}),
    b2 = L.backup({now: now + 1000}),
    b3 = L.backup({now: now + 2000});
  assert.ok(b1.file && b3.rotatedOut === 1);
  assert.equal(L.backups().kept.length, 2);
  const raw = fs.readFileSync(
    path.join(process.env.BACKUP_DIR, b3.file),
    'utf8',
  );
  assert.ok(JSON.parse(raw).$enc === 'serve/v1' && !raw.includes('ledger'));
  const to = path.join(tmp, 'restored'),
    r = L.restore(path.join(process.env.BACKUP_DIR, b2.file), to);
  assert.ok(r.files >= 3);
  assert.ok(
    fs.existsSync(path.join(to, 'members.json')) &&
      fs.existsSync(path.join(to, 'ledger.jsonl')),
  );
  assert.ok(
    !fs.existsSync(path.join(to, 'keys')) &&
      !fs.existsSync(path.join(to, 'agent_keys')) &&
      !fs.existsSync(path.join(to, 'members.key')),
    'no key is ever in a backup',
  );
});

test('without a data key, no backup is written in the clear', () => {
  const was = process.env.DATA_ENCRYPT,
    f = process.env.DATA_KEY_FILE;
  delete process.env.DATA_ENCRYPT;
  process.env.DATA_KEY_FILE = path.join(tmp, 'none.key');
  assert.match(L.backup({now}).error, /no data key/);
  process.env.DATA_ENCRYPT = was;
  process.env.DATA_KEY_FILE = f;
});
