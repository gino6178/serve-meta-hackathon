// The public address's shield, in the tenants proxy (tenants/proxy.js), before any request reaches a gateway: who is
// asking, how often, how big, and the headers every answer carries. Cloudflare in front stops floods by volume; this
// stops one client from wearing the server down, or running up the Meta Model API, with requests that each look fine.
//   Who: behind the Cloudflare tunnel every request comes from 127.0.0.1, so the client is cf-connecting-ip there (and
//   only there: a header from anywhere else is ignored). IPv6 counts by its /64, so one machine can't rotate addresses.
//   How often: token buckets per client and class (SHIELD_* to change a rate):
//     all      every request                           240 a minute
//     signin   POST /api/auth/demo (a new account)     10 an hour
//     heavy    a request that starts model work        60 in 10 minutes, per client and per session
//     a2a      POST /a2a/... or /mcp (another agent)    120 a minute
//   and at most 40 requests open at once per client. Over a limit: 429 with Retry-After, and nothing is passed on.
//   How big: a JSON body over 1 MB is refused (413) before it is read; uploads keep their own limits at the gateway.
//   Headers: nosniff, no framing, a strict referrer, HSTS, a permissions policy, and on the app's page a Content
//   Security Policy that allows only this address, the OpenStreetMap tiles and the page's own inline script by hash.
import crypto from "node:crypto";

const env = (k, d) => +(process.env[k] || d);
export const RATES = {
  all: { n: env("SHIELD_ALL", 240), per: 60e3 },
  signin: { n: env("SHIELD_SIGNIN", 10), per: 3600e3 },
  heavy: { n: env("SHIELD_HEAVY", 60), per: 600e3 },
  a2a: { n: env("SHIELD_A2A", 120), per: 60e3 },
};
export const OPEN_MAX = env("SHIELD_OPEN", 40), JSON_MAX = env("SHIELD_JSON_MAX", 1 << 20);
export const stats = { limited: 0, tooBig: 0, tooMany: 0 };

const loopback = (a) => /^(127\.|::1$|::ffff:127\.)/.test(a || "");
export function clientOf(req) {
  const peer = req.socket?.remoteAddress || "";
  let ip = loopback(peer) && req.headers["cf-connecting-ip"] ? String(req.headers["cf-connecting-ip"]).trim() : peer;
  ip = ip.replace(/^::ffff:/, "");
  if (ip.includes(":")) ip = ip.split(":").slice(0, 4).join(":") + "::/64";
  return ip;
}

// the requests that start model work (a talk, the agent's answer, a court search, a report, a voice note, a post)
const HEAVY = [/^\/api\/huddle\/(start|deal|venue|venue-note|reply|game)$/, /^\/api\/agent(\/|$)/, /^\/api\/places$/, /^\/api\/asr/, /^\/api\/feed\/(post|comment)$/, /^\/api\/voice/, /^\/api\/plan/, /^\/api\/reel/];
export function classesOf(method, p) {
  const c = ["all"];
  if (method === "POST" && p === "/api/auth/demo") c.push("signin");
  if (method === "POST" && (p.startsWith("/a2a/") || p === "/mcp" || p.startsWith("/mcp/"))) c.push("a2a");
  if ((method === "POST" || p === "/api/huddle/venue") && HEAVY.some((r) => r.test(p))) c.push("heavy");
  return c;
}

const buckets = new Map(), open = new Map();
// takes one from each bucket the request falls in; false (and the wait) when one is empty
export function take(keys, now = Date.now()) {
  const got = keys.map(([cls, who]) => {
    const r = RATES[cls], k = `${cls}|${who}`, b = buckets.get(k) || { t: r.n, at: now };
    b.t = Math.min(r.n, b.t + ((now - b.at) * r.n) / r.per); b.at = now;
    return { k, b, r };
  });
  const empty = got.find((g) => g.b.t < 1);
  if (empty) return { ok: false, retry: Math.ceil(((1 - empty.b.t) * empty.r.per) / empty.r.n / 1000) };
  for (const g of got) { g.b.t -= 1; buckets.set(g.k, g.b); }
  return { ok: true };
}
// buckets full again and nothing open are forgotten, so the maps stay small
export function sweep(now = Date.now()) {
  for (const [k, b] of buckets) { const r = RATES[k.split("|")[0]]; if (b.t + ((now - b.at) * r.n) / r.per >= r.n) buckets.delete(k); }
  for (const [k, n] of open) if (n <= 0) open.delete(k);
}
setInterval(sweep, 60e3).unref();

// the check for one request: null to go on, or [status, body, headers] to answer with
export function check(req, p) {
  const who = clientOf(req), sess = String(req.headers["x-serve-session"] || "").slice(0, 80);
  const len = +(req.headers["content-length"] || 0);
  if (len > JSON_MAX && /json/i.test(req.headers["content-type"] || "")) { stats.tooBig++; return [413, { error: "That request is too big." }]; }
  if ((open.get(who) || 0) >= OPEN_MAX) { stats.tooMany++; return [429, { error: "Too many requests at once from here. Try again in a moment." }, { "retry-after": "5" }]; }
  const keys = classesOf(req.method, p).flatMap((c) => (c === "heavy" && sess ? [[c, who], [c, `s:${crypto.createHash("sha256").update(sess).digest("hex").slice(0, 16)}`]] : [[c, who]]));
  const t = take(keys);
  if (!t.ok) { stats.limited++; return [429, { error: `Slow down: too many requests. Try again in ${t.retry} s.`, retryAfter: t.retry }, { "retry-after": String(t.retry) }]; }
  return null;
}
// counts a request open until its answer ends
export function opened(req, res) {
  const who = clientOf(req);
  open.set(who, (open.get(who) || 0) + 1);
  let done = false; const end = () => { if (!done) { done = true; open.set(who, (open.get(who) || 1) - 1); } };
  res.on("finish", end); res.on("close", end);
}

// the headers every answer carries, and the page's Content Security Policy (its inline scripts allowed by hash)
export const HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy": "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};
export function cspFor(html, host = "") {
  const hashes = [...String(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  return ["default-src 'self'", `script-src 'self' ${hashes.join(" ")}`.trim(), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "media-src 'self' blob:", "font-src 'self' data:", `connect-src 'self'${host ? ` wss://${host}` : ""}`, "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
}
