// Serve as MCP servers (Model Context Protocol, Streamable HTTP, protocol 2025-06-18), so any agent that speaks MCP
// (Claude, ChatGPT, Cursor, a Muse Spark agent, ...) connects with one address instead of reading /llms.txt and writing
// HTTP calls. Three servers, one per kind of agent:
//   POST /mcp          a person's own agent: sign in, set the area, sport and limits, see what's waiting, start a
//                      game, follow the agents' talk, say yes, check a place, rate it after the game
//   POST /mcp/venues   an agent dealing with venues: the venue agents and their signed cards, a quote, a report
//   POST /mcp/a2a      the protocol underneath: Serve's Agent Card, the public trust chain and its check
// Each tool calls Serve's own HTTP API on this machine, with the person's session, so every limit, guard, rate and
// consent rule applies exactly as it does for the app; a yes is still the person's own. The session comes from the
// sign_in_demo tool (kept for this MCP session, Mcp-Session-Id, for 24 hours, in memory only) or from an
// x-serve-session header the client sends. JSON-RPC 2.0: initialize, tools/list, tools/call, ping; notifications get
// 202. No server-to-client stream (GET answers 405), which the protocol allows.
import crypto from 'node:crypto';

export const VERSION = '2025-06-18',
  KNOWN = ['2025-06-18', '2025-03-26', '2024-11-05'];
const S = (description, extra = {}) => ({
    type: 'string',
    description,
    ...extra,
  }),
  N = (description, extra = {}) => ({type: 'number', description, ...extra}),
  B = description => ({type: 'boolean', description});
const obj = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const RO = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const ACT = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

// a tool: its schema, and the API call it makes ([method, path, body] from its arguments)
const SPORT = S(
  'badminton, tennis, pickleball, table tennis, basketball, volleyball, soccer or squash',
);
const PLAYER = {
  sign_in_demo: {
    d: 'Sign your person in with a demo account (no Facebook needed). Do this first; the session is kept for this connection.',
    s: obj({name: S("your person's first name")}),
    a: ACT,
    call: x => ['POST', '/api/auth/demo', {name: x.name || ''}],
    signIn: true,
  },
  whoami: {
    d: 'Who your person is on Serve, and their agents.',
    s: obj(),
    a: RO,
    call: () => ['GET', '/api/me'],
  },
  set_area: {
    d: "Your person's rough area: lat and lon (rounded to about 1 km), or a place name. Never an address.",
    s: obj({
      lat: N('latitude'),
      lon: N('longitude'),
      place: S('a place name, e.g. Daan District, Taipei'),
    }),
    a: ACT,
    call: x => [
      'POST',
      '/api/huddle/home',
      x.place ? {place: x.place} : {lat: x.lat, lon: x.lon},
    ],
  },
  set_sports: {
    d: 'The sports your person plays.',
    s: obj({sports: {type: 'array', items: SPORT, minItems: 1}}, ['sports']),
    a: ACT,
    call: x => ['POST', '/api/huddle/sports', {sports: x.sports}],
  },
  set_limits: {
    d: "Your person's hard limits: time windows, how far, the most they pay each (NT$), and whether they'll cover more than an equal share so a friend can play.",
    s: obj({
      windows: {
        type: 'array',
        description:
          'e.g. [{"days":["Mon","Tue"],"from":"18:00","to":"22:00"}]',
        items: {type: 'object'},
      },
      maxKm: N('most km to travel'),
      maxEach: N('most NT$ each for a 90-minute game'),
      cover: B('happy to pay more than an equal share, up to maxEach'),
    }),
    a: ACT,
    call: x => ['POST', '/api/huddle/limits', x],
  },
  today: {
    d: 'What is waiting for your person now: games to say yes to, games near them, a question from their agent, a cheaper quiet hour, a place to rate after a game.',
    s: obj(),
    a: RO,
    call: () => ['GET', '/api/huddle/today'],
  },
  start_game: {
    d: "Ask the agents to work out a game: they agree a time and a place with the other players' agents and the venue's agent. Follow it with get_game.",
    s: obj(
      {
        sport: SPORT,
        need: N('players in all, 2 to 12', {minimum: 2, maximum: 12}),
        nearby: B('also ask people nearby who opened up to it'),
        club: S('a club id, to ask its members'),
      },
      ['sport'],
    ),
    a: ACT,
    call: x => ['POST', '/api/huddle/start', {need: 4, nearby: true, ...x}],
  },
  get_game: {
    d: "One game being worked out: the agents' talk, the agreed time and place, the price and what your person pays, who said yes.",
    s: obj({id: S('the game id from start_game or today')}, ['id']),
    a: RO,
    call: x => ['GET', `/api/huddle/one?id=${encodeURIComponent(x.id)}`],
  },
  answer_game: {
    d: "Your person's one yes (or no, with the kind of reason). Only say yes when your person said so.",
    s: obj(
      {
        id: S('the game id'),
        yes: B('true for yes'),
        why: S('for a no: busy, time, place or price', {
          enum: ['busy', 'time', 'place', 'price'],
        }),
      },
      ['id', 'yes'],
    ),
    a: ACT,
    call: x => ['POST', '/api/huddle/reply', x],
  },
  courts_near: {
    d: "Courts near your person, how full each usually is, and for sports centres what the venue's agent would take at a quiet hour.",
    s: obj({sport: SPORT}),
    a: RO,
    call: x => [
      'GET',
      `/api/huddle/places${x.sport ? `?sport=${encodeURIComponent(x.sport)}` : ''}`,
    ],
  },
  venue_report: {
    d: 'A short report on a place before booking: its rating, review points quoted word for word, its prices and what groups paid there, and what Serve players said after playing there.',
    s: obj({place: S('a court id from courts_near or a game'), sport: SPORT}, [
      'place',
    ]),
    a: RO,
    call: x => [
      'GET',
      `/api/huddle/venue?place=${encodeURIComponent(x.place)}${x.sport ? `&sport=${encodeURIComponent(x.sport)}` : ''}`,
    ],
  },
  rate_venue: {
    d: 'After a game: how the place was (courts, light, air, price: good, ok or bad). Only a player of that game can, once.',
    s: obj(
      {
        game: S('the game id on the venue-note card in today'),
        marks: {type: 'object', description: '{"courts":"good","air":"bad"}'},
        note: S('a short note from your person, no links'),
        skip: B('do not ask again'),
      },
      ['game'],
    ),
    a: ACT,
    call: x => ['POST', '/api/huddle/venue-note', x],
  },
};
const VENUES = {
  list_venue_agents: {
    d: "The venue agents Serve knows: each sports centre's own A2A agent and its signed Agent Card.",
    s: obj(),
    a: RO,
    call: () => ['GET', '/a2a/venues'],
  },
  venue_agent_card: {
    d: "One venue agent's signed Agent Card, with its Ed25519 quote key.",
    s: obj({slug: S('e.g. way-123456, from list_venue_agents')}, ['slug']),
    a: RO,
    call: x => [
      'GET',
      `/a2a/venues/${encodeURIComponent(x.slug)}/.well-known/agent-card.json`,
    ],
  },
  ask_quote: {
    d: "Ask a venue's agent for a price for a court (a quote only: nobody is committed). Needs your person's session and area.",
    s: obj(
      {
        place: S('a venue id from courts_near'),
        date: S('YYYY-MM-DD'),
        start: S('HH:MM'),
        players: N('2 to 12'),
        sport: SPORT,
      },
      ['place', 'date', 'start'],
    ),
    a: RO,
    call: x => ['POST', '/api/huddle/deal', x],
  },
  venue_report: PLAYER.venue_report,
};
const A2A = {
  serve_agent_card: {
    d: "Serve's own signed A2A Agent Card: its skills, extensions and keys.",
    s: obj(),
    a: RO,
    call: () => ['GET', '/.well-known/agent-card.json'],
  },
  trust_chain: {
    d: 'The public trust chain: pseudonymous entries, each with the hash of the one before, and the daily heads signed by the server.',
    s: obj({after: N('last entry seen'), n: N('how many, up to 500')}),
    a: RO,
    call: x => [
      'GET',
      `/api/trust/chain?${new URLSearchParams(Object.entries(x).map(([k, v]) => [k, String(v)]))}`,
    ],
  },
  verify_trust_chain: {
    d: 'Replay the whole trust chain and check every hash and signed head.',
    s: obj(),
    a: RO,
    call: () => ['GET', '/api/trust/verify'],
  },
};
export const SERVERS = {
  '/mcp': {
    name: 'serve-player',
    title: "Serve: a person's agent",
    tools: PLAYER,
    about:
      "Tools for a person's own agent on Serve, where people's agents arrange sports games. Start with sign_in_demo, then set_area, set_sports and set_limits, then today or start_game. A yes is your person's: never answer_game yes without them.",
  },
  '/mcp/venues': {
    name: 'serve-venues',
    title: 'Serve: venues and their agents',
    tools: VENUES,
    about:
      'Tools for working with venues on Serve: each sports centre has its own A2A agent that signs every quote. Prices are samples until a venue joins; nothing is paid in Serve.',
  },
  '/mcp/a2a': {
    name: 'serve-a2a',
    title: 'Serve: A2A and the trust chain',
    tools: A2A,
    about:
      "Serve's A2A layer: its signed Agent Card and the public, hash-chained trust record anyone can verify.",
  },
};

// MCP sessions: the person's Serve session for each, 24 hours, in memory only
const sessions = new Map(),
  DAY = 864e5;
const sweep = () => {
  const now = Date.now();
  for (const [k, v] of sessions) if (now - v.at > DAY) sessions.delete(k);
};

const rpc = (id, result) => ({jsonrpc: '2.0', id, result});
const fail = (id, code, message) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: {code, message},
});
export const toolList = srv =>
  Object.entries(srv.tools).map(([name, t]) => ({
    name,
    title: name.replace(/_/g, ' '),
    description: t.d,
    inputSchema: t.s,
    annotations: t.a,
  }));

// one JSON-RPC message for one of SERVERS; api(method, path, body, session) makes the HTTP call
export async function handle(srv, msg, ctx, api) {
  const {id, method, params = {}} = msg || {};
  if (!msg || msg.jsonrpc !== '2.0' || typeof method !== 'string')
    return fail(id, -32600, 'not a JSON-RPC 2.0 request');
  if (id === undefined) return null; // a notification
  if (method === 'initialize') {
    const v = KNOWN.includes(params.protocolVersion)
      ? params.protocolVersion
      : VERSION;
    return rpc(id, {
      protocolVersion: v,
      capabilities: {tools: {listChanged: false}},
      serverInfo: {name: srv.name, title: srv.title, version: '1.0.0'},
      instructions: srv.about,
    });
  }
  if (method === 'ping') return rpc(id, {});
  if (method === 'tools/list') return rpc(id, {tools: toolList(srv)});
  if (method === 'tools/call') {
    const t = srv.tools[params.name];
    if (!t) return fail(id, -32602, `no tool called ${params.name}`);
    const args =
      params.arguments && typeof params.arguments === 'object'
        ? params.arguments
        : {};
    const [m, path, body] = t.call(args);
    const r = await api(m, path, body, ctx.session).catch(e => ({
      status: 502,
      body: {error: String(e.message || e).slice(0, 200)},
    }));
    if (t.signIn && r.status === 200 && r.body?.session) {
      ctx.setSession(r.body.session);
      r.body = {...r.body, session: '(kept for this connection)'};
    }
    const isError = r.status >= 400;
    return rpc(id, {
      content: [{type: 'text', text: JSON.stringify(r.body).slice(0, 60000)}],
      structuredContent:
        r.body && typeof r.body === 'object' && !Array.isArray(r.body)
          ? r.body
          : {value: r.body},
      isError,
    });
  }
  return fail(id, -32601, `no method ${method}`);
}

// the HTTP side: POST a message, DELETE to end a session; GET has no stream here
export async function route(req, res, u, {bodyOf, port}) {
  const srv = SERVERS[u.pathname.replace(/\/$/, '')];
  if (!srv) return false;
  const send = (code, body, h = {}) => {
    res.writeHead(code, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...h,
    });
    res.end(body == null ? '' : JSON.stringify(body));
    return true;
  };
  if (req.method === 'GET')
    return send(
      405,
      {
        error:
          'This MCP server has no server-to-client stream: POST JSON-RPC messages to this address.',
      },
      {allow: 'POST, DELETE'},
    );
  const sid = String(req.headers['mcp-session-id'] || '');
  if (req.method === 'DELETE') {
    sessions.delete(sid);
    return send(204, null);
  }
  if (req.method !== 'POST')
    return send(
      405,
      {error: 'POST JSON-RPC messages here.'},
      {allow: 'POST, DELETE'},
    );
  let msg;
  try {
    msg = await bodyOf(req);
  } catch {
    return send(400, fail(null, -32700, 'not JSON'));
  }
  if (Array.isArray(msg))
    return send(
      400,
      fail(null, -32600, 'one message per request (protocol 2025-06-18)'),
    );
  sweep();
  let id = sid && sessions.has(sid) ? sid : null;
  const isInit = msg?.method === 'initialize';
  if (isInit) {
    id = crypto.randomUUID();
    sessions.set(id, {at: Date.now(), session: null});
  }
  const s = id ? sessions.get(id) : null;
  const ctx = {
    session: String(req.headers['x-serve-session'] || '') || s?.session || null,
    setSession: v => {
      if (s) {
        s.session = v;
        s.at = Date.now();
      }
    },
  };
  const api = async (m, path, body, session) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: m,
      headers: {
        ...(body ? {'content-type': 'application/json'} : {}),
        ...(session ? {'x-serve-session': session} : {}),
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(120000),
    });
    const text = await r.text();
    let b;
    try {
      b = JSON.parse(text);
    } catch {
      b = text.slice(0, 20000);
    }
    return {status: r.status, body: b};
  };
  const out = await handle(srv, msg, ctx, api);
  if (out == null) return send(202, null, id ? {'mcp-session-id': id} : {});
  return send(200, out, id ? {'mcp-session-id': id} : {});
}
