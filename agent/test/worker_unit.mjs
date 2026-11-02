// Unit tests for the JSON-lines worker client (core/worker.js): answers in order and by id, a timed-out request that
// keeps its place, a worker that can't start or dies, and a restart that never fails the new worker's requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pyWorker} from '../src/core/worker.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-'));
const FAKE = path.join(tmp, 'fake.mjs');
fs.writeFileSync(
  FAKE,
  `import readline from 'node:readline';
if (process.env.READY) console.log(JSON.stringify({ready: true}));
// one at a time, as the real workers answer (PARALLEL: each as soon as it is done, so out of order)
let chain = Promise.resolve();
readline.createInterface({input: process.stdin}).on('line', l => {
  const r = JSON.parse(l);
  if (r.die) process.exit(2);
  const go = () => new Promise(ok => setTimeout(() => { console.log(JSON.stringify({id: r.id, echo: r.x})); ok(); }, r.wait || 0));
  if (process.env.PARALLEL) go();
  else chain = chain.then(go);
});
`,
);
const spec = env => () => ({python: process.execPath, args: [FAKE], env});

test('in order: a request that timed out keeps its place, so the late answer never goes to the next one', async () => {
  const w = pyWorker({name: 'fake', spec: spec()});
  await assert.rejects(
    w.call({x: 'slow', wait: 300}, {timeoutMs: 50}),
    /did not answer in time/,
  );
  const j = await w.call({x: 'next'});
  assert.equal(j.echo, 'next');
  w.stop();
});

test('by id, after a ready line: answers out of order each reach their own request', async () => {
  const w = pyWorker({
    name: 'fake',
    spec: spec({READY: '1', PARALLEL: '1'}),
    byId: true,
    readyLine: true,
  });
  const [a, b] = await Promise.all([
    w.call({x: 'a', wait: 120}),
    w.call({x: 'b'}),
  ]);
  assert.deepEqual([a.echo, b.echo], ['a', 'b']);
  w.stop();
});

test("a worker that can't start or dies fails its own requests, and a restarted one answers", async () => {
  const none = pyWorker({
    name: 'fake',
    spec: () => ({python: path.join(tmp, 'no-such-python')}),
  });
  const r = await none.call({x: 1}).catch(e => ({error: e.message}));
  assert.match(r.error, /did not start|stopped/);
  const w = pyWorker({name: 'fake', spec: spec(), byId: true});
  const j = await w.call({die: true});
  assert.match(j.error, /stopped/);
  w.stop();
  const pending = w.call({x: 'fresh', wait: 100});
  assert.equal(
    (await pending).echo,
    'fresh',
    "the old process's exit never fails the new one's request",
  );
  w.stop();
});
