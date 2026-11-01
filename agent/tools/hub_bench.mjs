// Load test for the agent hub (src/hub/hub.js): opens AGENTS real WebSocket connections, one per agent, from PROCS
// processes (each from its own loopback addresses, 127.0.0.2 and up, so the client side has enough ports), holds them
// all open, then has every process send RATE messages a second to random agents for SECONDS, and finally asks for model
// work faster than the slots can do it, to show the hub turning the surplus away instead of piling it up.
//   HUB_SECRET=... node agent/tools/hub_bench.mjs            (AGENTS=100000 PROCS=20 RATE=500 SECONDS=30 HUB=ws://127.0.0.1:8797)
// It prints one JSON line: connections held, connect time, messages delivered, one-way delivery latency p50/p95/p99
// (sender and receiver on one machine, one clock), acks, offline, the work the queues took and turned away, and the
// hub's own stats (memory per worker) at the end. Needs `ulimit -n` above AGENTS/PROCS plus some room.
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sigOf } from "../src/hub/sig.js";
import WebSocket from "ws";

const AGENTS = +(process.env.AGENTS || 100000), PROCS = +(process.env.PROCS || 20), RATE = +(process.env.RATE || 500), SECONDS = +(process.env.SECONDS || 30);
const HUB = process.env.HUB || "ws://127.0.0.1:8797", STATS = process.env.HUB_STATS || "http://127.0.0.1:8798/hub/stats", SECRET = process.env.HUB_SECRET || "";
const sig = (agent) => sigOf(agent, SECRET);
const pct = (xs, p) => { if (!xs.length) return null; const s = Float64Array.from(xs).sort(); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

if (process.argv[2] === "child") {
  const k = +process.argv[3], from = Math.floor((AGENTS * k) / PROCS), to = Math.floor((AGENTS * (k + 1)) / PROCS);
  const socks = [], lat = [], st = { opened: 0, failed: 0, sent: 0, got: 0, acks: 0, offline: 0, done: 0, busy: 0, waited: [] };
  const tell = (m) => process.send(m);
  const open = (i) => new Promise((ok) => {
    const id = `agent-${i}`, ws = new WebSocket(`${HUB}/hub?agent=${id}&sig=${sig(id)}`, { perMessageDeflate: false, localAddress: `127.0.0.${2 + ((i >> 4) % 200)}`, handshakeTimeout: 30000 });
    ws.on("open", () => { st.opened++; socks.push(ws); ok(); });
    ws.on("error", () => { st.failed++; ok(); });
    ws.on("message", (b) => { const m = JSON.parse(b); if (m.t === "msg") { st.got++; lat.push(Date.now() - m.at); } else if (m.t === "ack") { if (m.ok) st.acks++; else st.offline++; } else if (m.t === "done") { st.done++; st.waited.push(m.waitedMs); } else if (m.t === "busy") st.busy++; });
  });
  process.on("message", async (m) => {
    if (m.go === "connect") {
      const t0 = Date.now(); let i = from;
      const lanes = Array.from({ length: 200 }, async () => { while (i < to) await open(i++); });
      await Promise.all(lanes);
      tell({ connected: st.opened, failed: st.failed, ms: Date.now() - t0 });
    }
    if (m.go === "send") {
      const per = Math.max(1, Math.round(RATE / 100)), end = Date.now() + SECONDS * 1000;
      const tick = setInterval(() => {
        if (Date.now() >= end) { clearInterval(tick); setTimeout(() => tell({ sent: st.sent, got: st.got, acks: st.acks, offline: st.offline, lat: lat.splice(0) }), 3000); return; }
        for (let j = 0; j < per && socks.length; j++) { const s = socks[(Math.random() * socks.length) | 0]; s.send(JSON.stringify({ t: "send", id: ++st.sent, to: `agent-${(Math.random() * AGENTS) | 0}`, kind: "serve.proposal", data: { sport: "badminton", date: "2026-11-05", start: "19:00", minutes: 90 }, at: Date.now() })); }
      }, 10);
    }
    if (m.go === "work") {
      // each process asks for model work in one burst: 1B and Glimmer, more than the slots and queues hold
      for (let j = 0; j < m.n; j++) socks[j % socks.length].send(JSON.stringify({ t: "work", id: `w${j}`, tier: j % 4 ? "1b" : "glimmer" }));
      setTimeout(() => tell({ done: st.done, busy: st.busy, waited: st.waited }), m.wait);
    }
    if (m.go === "close") { for (const s of socks) s.terminate(); process.exit(0); }
  });
  tell({ ready: true });
} else {
  if (!SECRET) { console.error("Set HUB_SECRET (the hub's)."); process.exit(1); }
  const kids = Array.from({ length: PROCS }, (_, k) => fork(fileURLToPath(import.meta.url), ["child", String(k)], { stdio: ["ignore", "inherit", "inherit", "ipc"] }));
  const all = (go, extra = {}) => Promise.all(kids.map((c) => new Promise((ok) => { const on = (m) => { if (!m.ready) { c.off("message", on); ok(m); } }; c.on("message", on); c.send({ go, ...extra }); })));
  await Promise.all(kids.map((c) => new Promise((ok) => c.once("message", ok))));
  const t0 = Date.now();
  const con = await all("connect");
  const connected = con.reduce((s, x) => s + x.connected, 0), connectSec = (Date.now() - t0) / 1000;
  const held = await fetch(STATS).then((r) => r.json()).catch(() => null);
  const snd = await all("send");
  const lat = snd.flatMap((x) => x.lat), sent = snd.reduce((s, x) => s + x.sent, 0);
  const during = await fetch(STATS).then((r) => r.json()).catch(() => null);
  const wk = await all("work", { n: +(process.env.WORK || 100), wait: +(process.env.WORK_WAIT_MS || 8000) });
  const after = await fetch(STATS).then((r) => r.json()).catch(() => null);
  console.log(JSON.stringify({
    agents: AGENTS, procs: PROCS, connected, failed: con.reduce((s, x) => s + x.failed, 0), connectSec: +connectSec.toFixed(1), hubAgentsHeld: held?.agents ?? null,
    messages: { seconds: SECONDS, sent, perSec: Math.round(sent / SECONDS), delivered: snd.reduce((s, x) => s + x.got, 0), acked: snd.reduce((s, x) => s + x.acks, 0), offline: snd.reduce((s, x) => s + x.offline, 0), latencyMs: { p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: pct(lat, 100) } },
    work: { asked: (+(process.env.WORK || 100)) * PROCS, done: wk.reduce((s, x) => s + x.done, 0), turnedAway: wk.reduce((s, x) => s + x.busy, 0), waitedMsP50: pct(wk.flatMap((x) => x.waited), 50) },
    hub: { workers: after?.workers, rssMB: after?.rssMB, queuesAfter: after?.queues, runningAfter: after?.running, msgsPerSecSeen: during?.msgsPerSec },
  }));
  await Promise.all(kids.map((c) => new Promise((ok) => { c.on("exit", ok); c.send({ go: "close" }); })));
  process.exit(0);
}
