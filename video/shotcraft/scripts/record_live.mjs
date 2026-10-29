// Record the live app for the shotcraft film: the web app on this machine (vite on :5190, no token, members sign in)
// against a local gateway on :8899 that reaches Muse Glimmer and Llama Guard on the GPU server through an SSH tunnel.
// Test accounts only, made here on localhost. Each scene goes to public/clips/<name>.webm at 1560x864 (the window the
// brand frame holds), with its moments in public/clips/marks.json (seconds from the start of that scene).
//   node scripts/record_live.mjs [scene ...]    scenes: ask link gameon club (default: all, in that order)
//   APP=http://127.0.0.1:5191 NOSIGN=1 node scripts/record_live.mjs plan    the demo club's own player (a token build): Plan my week
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const B = process.env.APP || "http://127.0.0.1:5190", API = process.env.API || "http://127.0.0.1:8899";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = path.join(HERE, "..", "public", "clips"), MARKS = path.join(OUT, "marks.json");
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2), run = (n) => (!want.length && n !== "plan") || want.includes(n) || (want.includes("relink") && ["link", "gameon"].includes(n));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = fs.existsSync(MARKS) ? JSON.parse(fs.readFileSync(MARKS, "utf8")) : {};
const W = 1560, H = 864;

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", protocolTimeout: 900000,
  args: ["--lang=en-US", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", `--window-size=${W},${H}`],
});

// a visible cursor with a click ring (headless screencasts show no pointer), and one pixel that changes every frame so
// a page that sits still still sends frames
const CURSOR = () => addEventListener("DOMContentLoaded", () => {
  const c = document.createElement("div");
  c.style.cssText = "position:fixed;left:-50px;top:-50px;width:26px;height:26px;z-index:2147483647;pointer-events:none";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.6-8.1L21 10z" fill="#fff" stroke="#0a0a0b" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(c);
  const tick = document.createElement("i");
  tick.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:2147483647;pointer-events:none;background:#fefefe";
  document.documentElement.appendChild(tick);
  let on = false; const flip = () => { on = !on; tick.style.background = on ? "#fdfdfd" : "#fefefe"; requestAnimationFrame(flip); }; requestAnimationFrame(flip);
  addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
  addEventListener("mousedown", (e) => {
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #0a7f44;z-index:2147483646;pointer-events:none;transition:transform .5s,opacity .5s`;
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
    setTimeout(() => r.remove(), 600);
  }, true);
});

async function tab(ctx) {
  const page = await ctx.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.evaluateOnNewDocument(CURSOR);
  const p = { page, mx: W / 2, my: H / 2 };
  p.move = async (x, y, ms = 700) => {
    const t0 = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await page.mouse.move(p.mx + (x - p.mx) * e, p.my + (y - p.my) * e);
      if (t >= 1) break;
      await wait(16);
    }
    p.mx = x; p.my = y;
  };
  p.at = async (sel, text) => {
    const h = await page.waitForFunction((s, t) => [...document.querySelectorAll(s)].find((e) => !t || e.innerText.includes(t) || e.getAttribute("aria-label") === t) || null, { timeout: 120000 }, sel, text ?? null);
    const el = h.asElement();
    await el.evaluate((e) => { const r = e.getBoundingClientRect(); if (r.top < 40 || r.bottom > innerHeight - 40) e.scrollIntoView({ block: "center" }); });
    await wait(300);
    const b = await el.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, el };
  };
  p.click = async (sel, text, ms = 700) => { const q = await p.at(sel, text); await p.move(q.x, q.y, ms); await wait(160); await page.mouse.click(q.x, q.y); return q; };
  p.type = async (sel, text, delay = 55) => { await p.click(sel); await page.keyboard.type(text, { delay }); };
  p.go = async (hash, settle = 1500) => { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await page.mouse.move(p.mx, p.my); await wait(settle); };
  p.signIn = async (name) => { await p.go("join"); await p.type('input[placeholder="Your first name"]', name, 40); await p.click("button", "Try a demo account"); await page.waitForFunction(() => !location.hash.includes("join"), { timeout: 30000 }); await wait(1200); };
  return p;
}
async function rec(p, name, fn) {
  const file = path.join(OUT, name + ".webm");
  const r = await p.page.screencast({ path: file });
  const t0 = Date.now(), m = {};
  const mark = (k) => { m[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`  ${name}.${k} ${m[k]} s`); };
  await wait(400);
  await fn(mark);
  m.end = +((Date.now() - t0) / 1000).toFixed(2);
  await r.stop();
  marks[name] = m;
  fs.writeFileSync(MARKS, JSON.stringify(marks, null, 1));
  console.log(name, m.end, "s");
}
// the newest invite this member posted, through the member's own session
const lastInvite = (p) => p.page.evaluate(async (api) => {
  const s = localStorage.getItem("serve.session");
  const j = await (await fetch(`${api}/api/feed?n=10`, { headers: { "x-serve-session": s } })).json();
  return j.posts.find((x) => x.kind === "invite" && x.mine)?.id || null;
}, API);

const hostCtx = await browser.createBrowserContext();
await hostCtx.overridePermissions(B, ["geolocation"]);
const host = await tab(hostCtx);
await host.page.setGeolocation({ latitude: 25.0199, longitude: 121.5362 }); // at NTU Gymnasium, Taipei: the invite takes the nearest court
if (!process.env.NOSIGN) await host.signIn("Mia");
let inviteId = null;

if (run("ask")) await rec(host, "ask", async (mark) => {
  await host.go("messages", 1800);
  mark("start");
  await host.type('input[placeholder="e.g. Saturday morning doubles, need 3"]', "Saturday morning singles, need 1", 70);
  mark("typed");
  await host.click('button[aria-label="Send"]');
  await host.at("button", "Post it");
  mark("draft");
  await wait(2600);
  await host.click("button", "Post it", 900);
  await host.at(".mc-joined");
  mark("posted");
  await wait(3000);
});
if (!process.env.NOSIGN) inviteId = await lastInvite(host);
// relink: a fresh invite posted as Mia through the API (not filmed), so link and gameon can be filmed again on their own
if (want.includes("relink")) {
  inviteId = await host.page.evaluate(async (api) => {
    const s = localStorage.getItem("serve.session");
    const r = await fetch(`${api}/api/feed/post`, { method: "POST", headers: { "content-type": "application/json", "x-serve-session": s },
      body: JSON.stringify({ text: "", invite: { sport: "badminton", day: "2026-10-31", start: "08:00", where: "NTU Gymnasium", spots: 1, at: { lat: 25.0197, lon: 121.5365 } } }) });
    return (await r.json()).post?.id || null;
  }, API);
  console.log("fresh invite", inviteId);
  await host.go("messages", 1500);
}
console.log("invite", inviteId);

if (run("link") && inviteId) {
  const friend = await tab(await browser.createBrowserContext());
  await rec(friend, "link", async (mark) => {
    await friend.page.goto(`${B}/#/invite?id=${inviteId}`, { waitUntil: "networkidle2" });
    await friend.page.mouse.move(friend.mx, friend.my);
    mark("open");
    await wait(3200);
    await friend.type('input[placeholder="Your first name"]', "Leo", 90);
    await friend.click("button", "Try a demo account", 800);
    await friend.at(".il-in");
    mark("in");
    await wait(3200);
  });
}

if (run("gameon")) await rec(host, "gameon", async (mark) => {
  await host.go("messages", 600);
  await host.at(".gameon");
  mark("toast");
  await wait(4500);
  await host.click('.gameon button[aria-label="Dismiss"]', null, 600);
  await wait(600);
});

if (run("club")) {
  await rec(host, "club", async (mark) => {
    await host.go("club", 3500);
    mark("map");
    await host.click("button", "Start a club");
    await host.type('input[placeholder="Club name"]', "NTU Morning Smash", 70);
    await wait(500);
    const m = await host.at(".cl-start .rm-map");
    await host.move(m.x + 40, m.y + 10, 900); await wait(300); await host.page.mouse.click(m.x + 40, m.y + 10);
    await wait(900);
    await host.type('input[placeholder="Name the place"]', "NTU Gymnasium", 60);
    await host.click("button", "Start the club");
    await host.at(".cl-room-head");
    mark("started");
    await wait(3500);
  });
}
if (run("plan")) await rec(host, "plan", async (mark) => {
  await host.go("autopilot", 2500);
  mark("start");
  await host.click("button", "Plan my week", 900);
  mark("planning");
  await host.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Book (both|it)$/.test(b.innerText.trim())), { timeout: 400000, polling: 1000 });
  mark("agreed");
  await wait(3500);
  const book = await host.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Book (both|it)$/.test(b.innerText.trim())).innerText.trim());
  await host.click("button", book, 900);
  await wait(3000);
  mark("booked");
  await host.click("a", "See what the agents said", 900);
  await wait(2500);
  mark("chats");
  await host.page.evaluate(() => { const c = document.querySelector('[aria-label="Conversation"]'); if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" }); });
  await wait(5000);
});
await browser.close();
