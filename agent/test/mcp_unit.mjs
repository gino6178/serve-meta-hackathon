// Unit tests for Serve's MCP servers (mcp/server.js): initialize and the protocol version, the three servers' tools,
// a tool call that becomes the right API call, the session sign_in_demo keeps (and never hands back), a notification,
// and errors. The API is a stand-in here: no gateway, no network.
import test from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../src/mcp/server.js');
const calls = [];
const api = async (method, path, body, session) => {
  calls.push({method, path, body, session});
  if (path === '/api/auth/demo')
    return {
      status: 200,
      body: {member: {id: 'de-1', name: body.name}, session: 'secret-session'},
    };
  if (path.startsWith('/api/huddle/one'))
    return {status: 404, body: {error: 'No such game.'}};
  return {status: 200, body: {ok: true}};
};
const ctxOf = () => {
  const c = {session: null};
  c.setSession = v => {
    c.session = v;
  };
  return c;
};

test("initialize: our version, or the client's when we know it; the server says what it is for", async () => {
  const r = await M.handle(
    M.SERVERS['/mcp'],
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {protocolVersion: '2025-03-26'},
    },
    ctxOf(),
    api,
  );
  assert.equal(r.result.protocolVersion, '2025-03-26');
  assert.equal(r.result.serverInfo.name, 'serve-player');
  assert.ok(
    r.result.capabilities.tools && /sign_in_demo/.test(r.result.instructions),
  );
  const r2 = await M.handle(
    M.SERVERS['/mcp'],
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: {protocolVersion: '1999-01-01'},
    },
    ctxOf(),
    api,
  );
  assert.equal(r2.result.protocolVersion, M.VERSION);
});

test('three servers, one per kind of agent, each tool with a schema and hints', () => {
  const names = k => M.toolList(M.SERVERS[k]).map(t => t.name);
  assert.ok(
    [
      'sign_in_demo',
      'start_game',
      'answer_game',
      'venue_report',
      'rate_venue',
    ].every(n => names('/mcp').includes(n)),
  );
  assert.ok(
    ['list_venue_agents', 'venue_agent_card', 'ask_quote'].every(n =>
      names('/mcp/venues').includes(n),
    ),
  );
  assert.ok(
    ['serve_agent_card', 'verify_trust_chain'].every(n =>
      names('/mcp/a2a').includes(n),
    ),
  );
  for (const k of Object.keys(M.SERVERS))
    for (const t of M.toolList(M.SERVERS[k]))
      assert.ok(
        t.inputSchema.type === 'object' && t.description && t.annotations,
        `${k} ${t.name}`,
      );
});

test('sign_in_demo keeps the session for the connection and never hands it back; later calls carry it', async () => {
  const ctx = ctxOf();
  calls.length = 0;
  const r = await M.handle(
    M.SERVERS['/mcp'],
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {name: 'sign_in_demo', arguments: {name: 'Kai'}},
    },
    ctx,
    api,
  );
  assert.equal(r.result.isError, false);
  assert.ok(!JSON.stringify(r.result).includes('secret-session'));
  assert.equal(ctx.session, 'secret-session');
  await M.handle(
    M.SERVERS['/mcp'],
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {name: 'start_game', arguments: {sport: 'badminton', need: 4}},
    },
    ctx,
    api,
  );
  assert.deepEqual(calls.at(-1), {
    method: 'POST',
    path: '/api/huddle/start',
    body: {need: 4, nearby: true, sport: 'badminton'},
    session: 'secret-session',
  });
});

test('an API error comes back as a tool error; an unknown tool or method as a JSON-RPC error; a notification gets nothing', async () => {
  const e = await M.handle(
    M.SERVERS['/mcp'],
    {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {name: 'get_game', arguments: {id: 'nope'}},
    },
    ctxOf(),
    api,
  );
  assert.equal(e.result.isError, true);
  assert.equal(calls.at(-1).path, '/api/huddle/one?id=nope');
  assert.equal(
    (
      await M.handle(
        M.SERVERS['/mcp'],
        {
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {name: 'drop_tables'},
        },
        ctxOf(),
        api,
      )
    ).error.code,
    -32602,
  );
  assert.equal(
    (
      await M.handle(
        M.SERVERS['/mcp'],
        {jsonrpc: '2.0', id: 7, method: 'resources/list'},
        ctxOf(),
        api,
      )
    ).error.code,
    -32601,
  );
  assert.equal(
    await M.handle(
      M.SERVERS['/mcp'],
      {jsonrpc: '2.0', method: 'notifications/initialized'},
      ctxOf(),
      api,
    ),
    null,
  );
});
