// Unit tests for the public address's shield (safety/shield.js): the client behind the tunnel, the rate classes, a
// limit that refuses and then refills, a session's own bucket for model work, a body too big, too many open at once,
// and the page's Content Security Policy.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";

process.env.SHIELD_SIGNIN = "3";
const S = await import("../src/safety/shield.js");
const req = (o = {}) => ({ method: o.method || "GET", headers: { ...(o.ip ? { "cf-connecting-ip": o.ip } : {}), ...(o.headers || {}) }, socket: { remoteAddress: o.peer || "127.0.0.1" } });

test("the client: cf-connecting-ip only from the tunnel on this machine, an IPv6 address by its /64", () => {
  assert.equal(S.clientOf(req({ ip: "203.0.113.9" })), "203.0.113.9");
  assert.equal(S.clientOf(req({ ip: "203.0.113.9", peer: "198.51.100.4" })), "198.51.100.4", "a header from anywhere else is ignored");
  assert.equal(S.clientOf(req({ ip: "2001:db8:1:2:aaaa::1" })), S.clientOf(req({ ip: "2001:db8:1:2:bbbb::7" })));
});

test("the classes: a new account, another agent, model work", () => {
  assert.deepEqual(S.classesOf("POST", "/api/auth/demo"), ["all", "signin"]);
  assert.deepEqual(S.classesOf("POST", "/a2a/members/x"), ["all", "a2a"]);
  assert.deepEqual(S.classesOf("POST", "/api/huddle/start"), ["all", "heavy"]);
  assert.deepEqual(S.classesOf("GET", "/api/huddle/venue"), ["all", "heavy"]);
  assert.deepEqual(S.classesOf("GET", "/api/huddle/today"), ["all"]);
});

test("a limit refuses with a wait, then refills", () => {
  const ip = "192.0.2.10", now = Date.now();
  for (let i = 0; i < 3; i++) assert.equal(S.take([["signin", ip]], now).ok, true);
  const no = S.take([["signin", ip]], now);
  assert.equal(no.ok, false);
  assert.ok(no.retry > 0 && no.retry <= 1200);
  assert.equal(S.take([["signin", ip]], now + 3600e3).ok, true, "an hour later it has refilled");
  assert.equal(S.take([["signin", "192.0.2.11"]], now).ok, true, "another client has its own bucket");
});

test("check: 429 with Retry-After past the limit, 413 for a JSON body over 1 MB", () => {
  const r = () => req({ method: "POST", ip: "192.0.2.20" });
  let last;
  for (let i = 0; i < 4; i++) last = S.check(r(), "/api/auth/demo");
  assert.equal(last[0], 429);
  assert.ok(+last[2]["retry-after"] > 0);
  const big = S.check(req({ method: "POST", ip: "192.0.2.21", headers: { "content-type": "application/json", "content-length": String(2 << 20) } }), "/api/feed/post");
  assert.equal(big[0], 413);
});

test("model work also counts per session, so a session can't spread over many addresses", () => {
  const sess = "s-" + crypto.randomUUID();
  let refused = null;
  for (let i = 0; i < 80 && !refused; i++) refused = S.check(req({ method: "POST", ip: `198.18.${i}.1`, headers: { "x-serve-session": sess } }), "/api/huddle/start");
  assert.ok(refused && refused[0] === 429, "the session's own bucket ran out");
});

test("too many open at once from one client", () => {
  const ip = "192.0.2.30", resps = [];
  for (let i = 0; i < S.OPEN_MAX; i++) { const res = new EventEmitter(); resps.push(res); S.opened(req({ ip }), res); }
  assert.equal(S.check(req({ ip }), "/api/huddle/today")[0], 429);
  resps[0].emit("finish");
  assert.equal(S.check(req({ ip }), "/api/huddle/today"), null);
});

test("the page's CSP allows its own inline script by hash and the map tiles, and no framing", () => {
  const js = 'try { var t = 1; } catch (e) {}', html = `<html><script>${js}</script></html>`;
  const csp = S.cspFor(html, "play.example");
  assert.ok(csp.includes(`'sha256-${crypto.createHash("sha256").update(js).digest("base64")}'`));
  assert.ok(csp.includes("https://tile.openstreetmap.org") && csp.includes("frame-ancestors 'none'") && csp.includes("wss://play.example"));
  assert.ok(!csp.includes("'unsafe-eval'") && !/script-src[^;]*unsafe-inline/.test(csp));
});
