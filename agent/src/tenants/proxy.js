// One public address for invited players, each with their own agent. The club (sign-in, members, the feed, the
// agent channel, A2A) is one gateway that everyone shares; everything else a player does (their week, body log,
// memory, voice, courts, highlights, posters) goes to a gateway of their own: a separate process with its own data
// folder, started the first time they need it and stopped when idle. The built web app is served from the same
// address, so the browser holds only the member's session, never the gateway's token.
//   node src/tenants/proxy.js        (ops/tenants.sh starts it with the gateway's environment)
// Environment: TENANT_PORT (8796, on this machine only: a tunnel publishes it), TENANT_MAIN (http://127.0.0.1:8790),
// TENANT_ROOT (the tenants' folders), TENANT_WEB (web/dist), TENANT_BASE_PORT (8800), TENANT_MAX (12 running at
// once), TENANT_IDLE_MIN (20), and AGENT_TOKEN (sent to the gateways from here only).
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const AGENT = path.resolve(HERE, "../..");
// the gateway's own .env (its token, the Meta Model API key), read as server.js reads it; what is set already wins
for (const l of (fs.existsSync(path.join(AGENT, ".env")) ? fs.readFileSync(path.join(AGENT, ".env"), "utf8") : "").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const PORT = +(process.env.TENANT_PORT || 8796), MAIN = new URL(process.env.TENANT_MAIN || "http://127.0.0.1:8790");
const ROOT = path.resolve(process.env.TENANT_ROOT || path.join(AGENT, "..", "tenants"));
const WEB = path.resolve(process.env.TENANT_WEB || path.join(AGENT, "..", "web", "dist"));
const BASE = +(process.env.TENANT_BASE_PORT || 8800), MAX = +(process.env.TENANT_MAX || 12), IDLE = +(process.env.TENANT_IDLE_MIN || 20) * 60000;
const TOKEN = String(process.env.AGENT_TOKEN || "").trim();
// the origin the gateways are told requests come from: this proxy checks the browser's own origin first
const INTERNAL = "http://serve.internal";
if (!TOKEN) { console.error("tenants: AGENT_TOKEN is not set"); process.exit(1); }
fs.mkdirSync(ROOT, { recursive: true });

// the club's routes, on the shared gateway (getting a game together is between members, so it is there too)
const shared = (p) => p.startsWith("/.well-known/") || p === "/llms.txt" || p === "/privacy.txt" || p === "/openapi.json" || p === "/api/status" || p === "/api/me" || p.startsWith("/api/members/") || p === "/api/feed" || p.startsWith("/api/feed/")
  || p === "/api/clubs" || p.startsWith("/api/clubs/") || p.startsWith("/api/huddle/") || p.startsWith("/api/trust/") || p === "/api/openapi.json" || p === "/api/invite" || p.startsWith("/api/auth/") || p.startsWith("/api/agent-channel/") || p.startsWith("/a2a/");

// who a session belongs to, asked of the shared gateway (kept a minute)
const seen = new Map();
async function memberOf(sess) {
  if (!sess || sess.length > 600) return null;
  const hit = seen.get(sess);
  if (hit && hit.until > Date.now()) return hit.id;
  const r = await fetch(new URL("/api/me", MAIN), { headers: { "x-serve-session": sess, origin: INTERNAL } }).catch(() => null);
  const me = r?.ok ? await r.json().catch(() => null) : null;
  const id = me?.member?.id || me?.id || null;
  seen.set(sess, { id, until: Date.now() + 60000 });
  return id;
}

// the players' own gateways: one process each, its folder named by a hash of the member id
const running = new Map(); // id -> { port, proc, last, ready }
const folderOf = (id) => path.join(ROOT, crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 16));
const freePort = () => { const used = new Set([...running.values()].map((t) => t.port)); for (let p = BASE; ; p++) if (!used.has(p)) return p; };
function stop(id) { const t = running.get(id); if (!t) return; running.delete(id); try { process.kill(-t.proc.pid); } catch { try { t.proc.kill(); } catch { /* gone */ } } }
async function tenant(id) {
  let t = running.get(id);
  if (t) { t.last = Date.now(); return t.ready; }
  if (running.size >= MAX) stop([...running.entries()].sort((a, b) => a[1].last - b[1].last)[0][0]); // the least recent goes
  const dir = folderOf(id), port = freePort();
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  const env = { ...process.env, PORT: String(port), AGENT_TOKEN: TOKEN, ALLOW_ORIGINS: INTERNAL, MEMBERS_APP_URL: INTERNAL,
    EMBED_PYTHON: process.env.EMBED_PYTHON || path.join(AGENT, "..", "asr", "env", "bin", "python"), GUARD_PYTHON: process.env.GUARD_PYTHON || path.join(AGENT, "..", "asr", "env", "bin", "python"),
    TENANT_OF: String(id), WEBHOOK_PORT: "0" };
  // no Messenger page, no federation, no fallback to the cloud model for a player's own gateway
  for (const k of ["MESSENGER_PAGE_TOKEN", "MESSENGER_APP_SECRET", "MESSENGER_VERIFY_TOKEN", "A2A_FEDERATION_FILE", "TENANT_PORT"]) delete env[k];
  const proc = spawn(process.execPath, ["--unhandled-rejections=warn", path.join(AGENT, "src", "server.js")], { cwd: dir, env, detached: true, stdio: ["ignore", fs.openSync(path.join(dir, "gateway.log"), "a"), fs.openSync(path.join(dir, "gateway.log"), "a")] });
  proc.on("exit", () => { if (running.get(id)?.proc === proc) running.delete(id); });
  t = { port, proc, last: Date.now() };
  t.ready = (async () => {
    for (let i = 0; i < 120; i++) {
      const ok = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
      if (ok) return t;
      await new Promise((r) => setTimeout(r, 500));
    }
    stop(id); throw new Error("your agent did not start");
  })();
  running.set(id, t);
  console.log(`${new Date().toISOString()} started a gateway on :${port} for ${dir}`);
  return t.ready;
}
// players' gateways outlive a restart of this proxy: the ones already running are taken up again, by the member id and
// the port each was started with (Linux /proc)
function adopt() {
  if (!fs.existsSync("/proc")) return;
  for (const pid of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
    let env; try { env = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0"); } catch { continue; }
    const of = env.find((x) => x.startsWith("TENANT_OF="))?.slice(10), port = +(env.find((x) => x.startsWith("PORT="))?.slice(5) || 0);
    if (!of || !port || running.has(of)) continue;
    const proc = { pid: +pid, kill: () => process.kill(+pid) }, t = { port, proc, last: Date.now() };
    t.ready = Promise.resolve(t);
    running.set(of, t);
    console.log(`${new Date().toISOString()} took up the gateway on :${port} again`);
  }
}
adopt();
setInterval(() => { for (const [id, t] of running) if (Date.now() - t.last > IDLE) { stop(id); console.log(`${new Date().toISOString()} stopped an idle gateway`); } }, 60000).unref();
// (a restart of the proxy leaves the players' gateways running: adopt() takes them up again)
process.on("SIGTERM", () => process.exit(0));

// the browser's own origin must be this address's (a page elsewhere is refused), then the gateways hear INTERNAL
const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };
const DROP = new Set(["host", "origin", "authorization", "connection", "x-forwarded-for", "x-forwarded-proto", "x-forwarded-host", "forwarded", "x-real-ip", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cdn-loop", "true-client-ip"]);
function headersFor(req, { token }) {
  const h = {};
  for (const [k, v] of Object.entries(req.headers)) if (!DROP.has(k)) h[k] = v;
  if (req.headers.origin) h.origin = INTERNAL;
  if (token) h.authorization = `Bearer ${TOKEN}`;
  return h;
}
function pass(req, res, target, { token, after = null }) {
  const up = http.request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: headersFor(req, { token }) }, (r) => {
    if (after) r.on("end", () => after(r.statusCode));
    const h = { ...r.headers };
    delete h["access-control-allow-origin"]; delete h.vary;
    res.writeHead(r.statusCode, h); r.pipe(res);
  });
  up.on("error", () => { if (!res.headersSent) { res.writeHead(502, { "content-type": "application/json" }); res.end('{"error":"the gateway did not answer"}'); } });
  req.pipe(up);
}
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };

// the web app: the built files, and index.html for anything else (the app routes by the hash)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain", ".wasm": "application/wasm" };
function file(req, res, p) {
  let f = path.join(WEB, decodeURIComponent(p));
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, "index.html");
  const type = TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", size = fs.statSync(f).size;
  const head = { "content-type": type, "accept-ranges": "bytes", "cache-control": f.endsWith("index.html") ? "no-cache" : "public, max-age=3600" };
  // a byte range (Safari asks for one before it plays any video, and will not play without it)
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m && (m[1] || m[2])) {
    let from = m[1] ? +m[1] : Math.max(0, size - +m[2]), to = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (from >= size || from > to) { res.writeHead(416, { "content-range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, "content-range": `bytes ${from}-${to}/${size}`, "content-length": to - from + 1 });
    return req.method === "HEAD" ? res.end() : fs.createReadStream(f, { start: from, end: to }).pipe(res);
  }
  res.writeHead(200, { ...head, "content-length": size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(f).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname;
  try {
    // the way in for agents (the Agent Card, the guide, the privacy page) is the shared gateway's, read-only
    if (req.method === "GET" && (p.startsWith("/.well-known/") || p === "/llms.txt" || p === "/privacy.txt" || p === "/openapi.json")) return pass(req, res, MAIN, { token: false });
    if (!p.startsWith("/api/") && !p.startsWith("/a2a/")) return file(req, res, p);
    if (!sameOrigin(req)) return json(res, 403, { error: "requests from another site are not allowed" });
    // a member who leaves the club: their own gateway and its folder go with them
    if (p === "/api/members/leave" && req.method === "POST") {
      const id = await memberOf(req.headers["x-serve-session"]);
      return pass(req, res, MAIN, { token: false, after: (code) => { if (code === 200 && id) { stop(id); fs.rmSync(folderOf(id), { recursive: true, force: true }); seen.clear(); } } });
    }
    if (shared(p)) return pass(req, res, MAIN, { token: false });
    const id = await memberOf(req.headers["x-serve-session"]);
    if (!id) return json(res, 401, { error: "Sign in to use your agent", signIn: true });
    const t = await tenant(id);
    return pass(req, res, new URL(`http://127.0.0.1:${t.port}`), { token: true });
  } catch (e) { return json(res, 503, { error: String(e.message || e).slice(0, 200) }); }
});

// the live voice line: a WebSocket, its session in the address; the player's own gateway hears the token instead
server.on("upgrade", async (req, socket, head) => {
  const u = new URL(req.url, "http://x");
  const no = (code) => { socket.end(`HTTP/1.1 ${code} No\r\nconnection: close\r\n\r\n`); };
  if (u.pathname !== "/api/voice/live" || !sameOrigin(req)) return no(403);
  const id = await memberOf(u.searchParams.get("session"));
  if (!id) return no(401);
  let t;
  try { t = await tenant(id); } catch { return no(503); }
  u.searchParams.delete("session"); u.searchParams.set("auth", TOKEN);
  const up = net.connect(t.port, "127.0.0.1", () => {
    const h = headersFor(req, { token: false });
    h.origin = INTERNAL; h.connection = "Upgrade"; h.host = `127.0.0.1:${t.port}`;
    up.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  const end = () => { up.destroy(); socket.destroy(); };
  up.on("error", end); socket.on("error", end);
});

server.listen(PORT, "127.0.0.1", () => console.log(`tenants: http://127.0.0.1:${PORT} -> the club on ${MAIN.origin}, each player's own gateway from :${BASE}; web from ${WEB}`));
