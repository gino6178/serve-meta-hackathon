// Unit tests for the evolving side on Muse Wonder (src/core/llm.js WONDER): the builder's turns go to Muse Wonder on
// the Meta Model API, with LLM_ONLY=small too; any other site does not; and a Wonder that fails leaves the turn to
// Glimmer. A stand-in for both servers: no model, no network.
//   node --test test/llm_wonder_unit.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const seen = [];
let wonderUp = true;
const srv = http.createServer((req, res) => {
  let b = '';
  req.on('data', c => (b += c));
  req.on('end', () => {
    const j = JSON.parse(b || '{}');
    seen.push({path: req.url, model: j.model});
    if (req.url.startsWith('/wonder') && !wonderUp) {
      res.writeHead(500);
      return res.end('down');
    }
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(
      JSON.stringify({
        choices: [{message: {role: 'assistant', content: `from ${j.model}`}}],
        message: {role: 'assistant', content: `from ${j.model}`},
        usage: {prompt_tokens: 1, completion_tokens: 1},
      }),
    );
  });
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const port = srv.address().port;
Object.assign(process.env, {
  META_API_KEY: 'test-key',
  LLM_WONDER_URL: `http://127.0.0.1:${port}/wonder`,
  LLM_URL: `http://127.0.0.1:${port}/glimmer/v1`,
  LLM_API: 'openai',
  LLM_ONLY: 'small',
  LLM_FALLBACK: 'off',
  LLM_LONG_API: 'off',
});
const L = await import('../src/core/llm.js');
const tools = [{type: 'function', function: {name: 'done', parameters: {type: 'object', properties: {}}}}];
const msgs = [{role: 'user', content: 'build it'}];

test("the builder's turns go to Muse Wonder, with LLM_ONLY=small too", async () => {
  seen.length = 0;
  const r = await L.chatTools(msgs, tools, {site: 'builder.step'});
  assert.equal(seen[0].path, '/wonder/chat/completions');
  assert.equal(seen[0].model, 'muse-wonder-1.0');
  assert.equal(r.text, 'from muse-wonder-1.0');
  assert.equal(L.writerOf('builder.step'), 'Muse Wonder');
});

test('another site does not go to Wonder', async () => {
  seen.length = 0;
  await L.chatTools(msgs, tools, {site: 'planner.step'});
  assert.ok(seen.every(s => !s.path.startsWith('/wonder')));
  assert.equal(L.writerOf('planner.step'), 'Muse Glimmer');
});

test('a Wonder that fails leaves the turn to Glimmer', async () => {
  seen.length = 0;
  wonderUp = false;
  await L.chatTools(msgs, tools, {site: 'builder.step'});
  wonderUp = true;
  assert.equal(seen[0].path, '/wonder/chat/completions');
  assert.ok(seen.some(s => s.path.startsWith('/glimmer')));
  srv.close();
});
