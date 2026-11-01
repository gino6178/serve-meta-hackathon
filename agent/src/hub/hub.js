// The agent hub: the layer that holds every connected agent at once and moves their messages, built for 100,000
// agents online together (docs/scale_100k_research.md, phase 2 on one machine). It is the substrate, not the brains:
// what an agent decides still comes from the router's tiers (code, the classifier, the 1B, Glimmer), and that compute
// is what runs out first.
//   Connections: one WebSocket per agent (ws://127.0.0.1:HUB_PORT/hub?agent=<id>&sig=<hmac>), the signature an HMAC
//   of the agent id under HUB_SECRET, so only agents the gateway admitted can connect. Node's cluster runs HUB_WORKERS
//   processes (default: half the cores, at most 16) on one port; the kernel spreads the connections over them.
//   Actors: each connected agent is an actor in the worker that holds its socket: a mailbox processed in order, its
//   presence, counters. A message for an agent in another worker goes over the bus.
//   The bus: the primary keeps the directory (agent -> worker) and forwards between workers over IPC, in batches.
//   Messages are facts-only payloads, as in A2A talks ({kind, data}), never another agent's free text to a model.
//   Admission: model work ({t:"work", tier}) waits in a queue per tier with a fixed number of slots (HUB_SLOTS_1B,
//   HUB_SLOTS_GLIMMER) and a cap on the queue (HUB_QUEUE_MAX); past the cap the agent is told "busy, retry in n s"
//   at once (backpressure), so a surge slows answers down instead of piling up memory. The work itself is a stand-in
//   here (HUB_WORK_MS per tier), so the hub can be loaded without a GPU; the gateway's router does the real calls.
//   Stats: GET /hub/stats (connections, messages a second, queues, refusals, memory per worker).
// Protocol (JSON text frames): {t:"send", id, to, kind, data} -> the target gets {t:"msg", id, from, kind, data, at}
// and the sender {t:"ack", id, ok, why}; {t:"work", id, tier} -> {t:"done", id, tier, waitedMs} or {t:"busy", id,
// retry}; {t:"ping"} -> {t:"pong"}.
import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import {WebSocketServer} from 'ws';
import {sigOf} from './sig.js';

const PORT = +(process.env.HUB_PORT || 8797),
  HOST = process.env.HUB_HOST || '127.0.0.1';
const WORKERS = +(
  process.env.HUB_WORKERS ||
  Math.min(16, Math.max(1, Math.floor(os.cpus().length / 2)))
);
const SECRET = process.env.HUB_SECRET || '';
const ok = (agent, sig) =>
  !!agent &&
  agent.length <= 120 &&
  !!SECRET &&
  !!sig &&
  sig.length === 22 &&
  crypto.timingSafeEqual(Buffer.from(sigOf(agent, SECRET)), Buffer.from(sig));

if (cluster.isPrimary) {
  if (!SECRET) {
    console.error('hub: HUB_SECRET is not set');
    process.exit(1);
  }
  const dir = new Map(),
    stats = new Map(); // agent -> worker id; worker id -> its last stats
  let forwarded = 0;
  const fork = () => {
    const w = cluster.fork();
    w.on('message', m => {
      if (m.t === 'up') dir.set(m.agent, w.id);
      else if (m.t === 'down') {
        if (dir.get(m.agent) === w.id) dir.delete(m.agent);
      } else if (m.t === 'fwd') {
        // a batch of messages for agents elsewhere: each to the worker that holds its target, or back as offline
        const by = new Map(),
          back = [];
        for (const x of m.batch) {
          const to = dir.get(x.to);
          if (to == null || !cluster.workers[to]) back.push(x);
          else (by.get(to) || by.set(to, []).get(to)).push(x);
        }
        for (const [id, list] of by) {
          cluster.workers[id]?.send({t: 'in', batch: list});
          forwarded += list.length;
        }
        if (back.length) w.send({t: 'offline', batch: back});
      } else if (m.t === 'stats') stats.set(w.id, m.s);
    });
  };
  for (let i = 0; i < WORKERS; i++) fork();
  cluster.on('exit', w => {
    for (const [a, id] of dir) if (id === w.id) dir.delete(a);
    stats.delete(w.id);
    fork();
  });
  // the stats from every worker, summed, on a port of the primary's own (HUB_STATS_PORT, default HUB_PORT + 1)
  http
    .createServer((req, res) => {
      const all = [...stats.values()],
        sum = k => all.reduce((s, x) => s + (x[k] || 0), 0);
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(
        JSON.stringify({
          workers: all.length,
          agents: dir.size,
          connections: sum('connections'),
          msgsPerSec: sum('msgsPerSec'),
          forwardedTotal: forwarded,
          delivered: sum('delivered'),
          offline: sum('offline'),
          queues: {'1b': sum('q1b'), glimmer: sum('qglimmer')},
          running: {'1b': sum('r1b'), glimmer: sum('rglimmer')},
          done: sum('done'),
          busy: sum('busy'),
          rssMB: Math.round(
            all.reduce((s, x) => s + (x.rssMB || 0), 0) +
              process.memoryUsage().rss / 1e6,
          ),
          perWorker: all,
        }),
      );
    })
    .listen(+(process.env.HUB_STATS_PORT || PORT + 1), HOST, () =>
      console.log(
        `hub: ${WORKERS} workers on ws://${HOST}:${PORT}/hub, stats on http://${HOST}:${+(process.env.HUB_STATS_PORT || PORT + 1)}/hub/stats`,
      ),
    );
} else {
  const actors = new Map(); // agent -> { ws, inbox: [], busy, sent, got }
  const c = {delivered: 0, offline: 0, done: 0, busy: 0, msgs: 0};
  let out = [];
  const flush = () => {
    if (out.length) {
      process.send({t: 'fwd', batch: out});
      out = [];
    }
  };
  setInterval(flush, 2).unref();
  const say = (a, o) => {
    if (a.ws.readyState === 1) a.ws.send(JSON.stringify(o));
  };
  // an actor's mailbox, in order
  const deliver = x => {
    const a = actors.get(x.to);
    if (!a) {
      out.push(x);
      return;
    } // not here (anymore): the primary knows where
    a.inbox.push(x);
    if (a.busy) return;
    a.busy = true;
    while (a.inbox.length) {
      const m = a.inbox.shift();
      a.got++;
      c.delivered++;
      say(a, {
        t: 'msg',
        id: m.id,
        from: m.from,
        kind: m.kind,
        data: m.data,
        at: m.at,
      });
      if (m.ackTo) ack(m.ackTo, m.id, true);
    }
    a.busy = false;
  };
  const ack = (agent, id, okk, why) => {
    const s = actors.get(agent);
    if (s) say(s, {t: 'ack', id, ok: okk, ...(why ? {why} : {})});
    else out.push({to: agent, ackOnly: true, id, ok: okk, why});
  };
  process.on('message', m => {
    if (m.t === 'in')
      for (const x of m.batch) {
        if (x.ackOnly) {
          const s = actors.get(x.to);
          if (s)
            say(s, {
              t: 'ack',
              id: x.id,
              ok: x.ok,
              ...(x.why ? {why: x.why} : {}),
            });
        } else deliver(x);
      }
    if (m.t === 'offline')
      for (const x of m.batch) {
        c.offline++;
        if (!x.ackOnly && x.ackTo) {
          const s = actors.get(x.ackTo);
          if (s) say(s, {t: 'ack', id: x.id, ok: false, why: 'offline'});
        }
      }
  });

  // admission: a queue per tier, a fixed number of slots, a cap; the work is a stand-in for the router's real call
  const TIERS = {
    '1b': {
      slots: +(process.env.HUB_SLOTS_1B || 8),
      ms: +(process.env.HUB_WORK_MS_1B || 900),
    },
    glimmer: {
      slots: +(process.env.HUB_SLOTS_GLIMMER || 4),
      ms: +(process.env.HUB_WORK_MS_GLIMMER || 25000),
    },
  };
  const QMAX = +(process.env.HUB_QUEUE_MAX || 200),
    q = {'1b': [], glimmer: []},
    run = {'1b': 0, glimmer: 0};
  const next = tier => {
    while (run[tier] < TIERS[tier].slots && q[tier].length) {
      const j = q[tier].shift();
      run[tier]++;
      setTimeout(() => {
        run[tier]--;
        c.done++;
        const a = actors.get(j.agent);
        if (a) say(a, {t: 'done', id: j.id, tier, waitedMs: j.started - j.at});
        next(tier);
      }, TIERS[tier].ms);
      j.started = Date.now();
    }
  };
  const work = (agent, id, tier) => {
    if (!TIERS[tier])
      return say(actors.get(agent), {
        t: 'error',
        id,
        why: 'tier is 1b or glimmer',
      });
    if (q[tier].length >= QMAX) {
      c.busy++;
      return say(actors.get(agent), {
        t: 'busy',
        id,
        tier,
        retry: Math.ceil(
          ((q[tier].length / TIERS[tier].slots) * TIERS[tier].ms) / 1000,
        ),
      });
    }
    q[tier].push({agent, id, at: Date.now()});
    next(tier);
  };

  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 16 * 1024,
  });
  const server = http.createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, 'http://x'),
      agent = u.searchParams.get('agent') || '',
      sig = u.searchParams.get('sig') || '';
    if (u.pathname !== '/hub' || !ok(agent, sig)) {
      socket.end('HTTP/1.1 401 No\r\nconnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const old = actors.get(agent);
      if (old) old.ws.terminate(); // one connection per agent: the newest wins
      const a = {ws, inbox: [], busy: false, sent: 0, got: 0};
      actors.set(agent, a);
      process.send({t: 'up', agent});
      ws.on('message', buf => {
        let m;
        try {
          m = JSON.parse(buf);
        } catch {
          return;
        }
        c.msgs++;
        if (m.t === 'send' && typeof m.to === 'string' && m.to.length <= 120) {
          a.sent++;
          deliver({
            to: m.to,
            from: agent,
            id: m.id,
            kind: String(m.kind || '').slice(0, 40),
            data: m.data,
            at: m.at || Date.now(),
            ackTo: agent,
          });
        } else if (m.t === 'work') work(agent, m.id, m.tier);
        else if (m.t === 'ping') say(a, {t: 'pong'});
      });
      ws.on('close', () => {
        if (actors.get(agent) === a) {
          actors.delete(agent);
          process.send({t: 'down', agent});
        }
      });
      ws.on('error', () => {});
    });
  });
  server.listen(PORT, HOST);
  let last = 0;
  setInterval(() => {
    const s = {
      connections: actors.size,
      msgsPerSec: c.msgs - last,
      delivered: c.delivered,
      offline: c.offline,
      done: c.done,
      busy: c.busy,
      q1b: q['1b'].length,
      qglimmer: q.glimmer.length,
      r1b: run['1b'],
      rglimmer: run.glimmer,
      rssMB: Math.round(process.memoryUsage().rss / 1e6),
    };
    last = c.msgs;
    process.send({t: 'stats', s});
  }, 1000).unref();
}
