// Stills of the app for the deck and the README (submission/shots/v3/), from the running site (npm run dev on :5191,
// the gateway on the GPU server), a phone (390x844 at 3x), light theme. A demo member joins for the social shots and leaves at
// the end, with everything it did.   node shots_v3.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(process.env.PUPPETEER_FROM ? path.join(process.env.PUPPETEER_FROM, "package.json") : import.meta.url);
const puppeteer = require("puppeteer-core");

const B = "http://127.0.0.1:5191";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = path.join(HERE, "..", "submission", "shots", "v3");
fs.mkdirSync(OUT, { recursive: true });
const BODY_SEED = JSON.parse(fs.readFileSync(path.join(HERE, "body_seed.json"), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--lang=en-US", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot", name); };
const go = async (hash, ms = 2500) => { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await wait(ms); };
const clickText = async (sel, text) => { const ok = await page.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find((x) => x.innerText.includes(t)); if (e) e.click(); return !!e; }, sel, text); if (!ok) throw new Error(`no ${sel} with "${text}"`); };
const until = (fn, ms = 240000) => page.waitForFunction(fn, { timeout: ms, polling: 300 });

await go("", 800);
await page.evaluate((b) => { ["serve.tasks.v1", "serve.game.v1", "serve.stories.v1", "serve.session", "serve.agentKey.v1"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("serve.body", JSON.stringify(b)); }, BODY_SEED);

// joining, and the social app
await go("join"); await shot("join");
await page.type(".join-demo input", "Mia"); await clickText(".join-demo .btn", "Try a demo account");
await until(() => document.querySelector(".so-stories")); await wait(2500);
await shot("social_feed");
await clickText(".so-agent .btn", "Add my agent"); await until(() => [...document.querySelectorAll(".so-agent .btn")].some((b) => b.innerText.includes("Join a game for me")));
await clickText(".so-agent .btn", "Join a game for me"); await until(() => document.querySelector(".so-said")?.innerText.includes("joined"), 60000); await wait(2500);
await page.evaluate(() => { document.querySelector(".so-me")?.scrollIntoView({ block: "start" }); scrollBy(0, -72); }); await wait(800); await shot("social_agent");
await page.evaluate(() => [...document.querySelectorAll(".fd-card")].find((c) => c.querySelector(".fd-invite"))?.scrollIntoView({ block: "start" })); await page.evaluate(() => scrollBy(0, -90)); await wait(800);
await shot("social_invite");
await page.evaluate(() => scrollTo(0, 0)); await wait(500);
await page.click(".so-ring"); await wait(2500); await shot("social_story");
await page.keyboard.press("Escape"); await wait(500);

// the body: what the agent knows, found by meaning, and the rules with their sources
await go("body", 2000); await until(() => document.querySelector(".bd-notes") && document.querySelector(".bd-cite"), 120000); await wait(1000); await shot("body_top");
await page.evaluate(() => document.querySelector(".bd-ctx").scrollIntoView({ block: "start" })); await page.evaluate(() => scrollBy(0, -70)); await wait(800); await shot("body_context");
await page.evaluate(() => document.querySelector(".bd-rules").scrollIntoView({ block: "start" })); await page.evaluate(() => scrollBy(0, -70)); await wait(800); await shot("body_rules");

// the home page: the week strip and the helpers
await go("", 3000); await shot("home_week");

// courts near you, judged
await go("courts?sport=basketball", 2000);
await clickText(".ct-ask .btn.primary", "Find courts");
await until(() => document.querySelector(".ct-list"), 600000); await wait(1000);
await page.evaluate(() => document.querySelector(".ct-head")?.scrollIntoView({ block: "start" })); await wait(800);
await shot("courts_badges");

// a matchup poster (its art is kept on the server after the first time), and the live voice line, listening
if (!process.argv.includes("--no-extra")) {
  await go("club?tab=challenges", 2500);
  await clickText(".challenge .btn", "Poster");
  await until(() => document.querySelector(".poster-sheet canvas.ready"), 240000); await wait(800); await shot("poster");
  await page.keyboard.press("Escape"); await go("", 2500);
  await page.evaluate(() => document.querySelector(".talk-live")?.click());
  await until(() => /Listening/.test(document.querySelector(".lt-state")?.innerText || ""), 60000).catch(() => {}); await wait(1500);
  await page.evaluate(() => { const s = document.querySelector(".lt-scrim"); if (s) { s.style.bottom = "auto"; s.style.height = `${visualViewport.height}px`; s.style.width = `${visualViewport.width}px`; s.style.left = `${visualViewport.offsetLeft}px`; s.style.top = `${visualViewport.offsetTop}px`; } }); await wait(300); await shot("live_talk"); // (mobile emulation: the layout viewport is taller than the screen)
  await page.evaluate(() => document.querySelector(".lt-end")?.click()); await wait(800);
}

// the planner, then what the agents said to each other (Agent chats): needs Muse Glimmer, about two minutes
if (!process.argv.includes("--no-plan")) {
  await go("autopilot?run=1", 2000);
  await until(() => document.querySelector(".ap-approve"), 600000); await wait(1500);
  await page.evaluate(() => document.querySelector(".ap-approve").scrollIntoView({ block: "center" })); await wait(800); await shot("plan_approve");
  await go("chats", 2000);
  await page.evaluate(() => { document.querySelector(".ch-head")?.scrollIntoView({ block: "start" }); scrollBy(0, -64); }); await wait(800); await shot("agent_chats");
}

// leave: the demo member, its agent and what they did
await go("social", 2000);
await page.evaluate(async () => { const s = localStorage.getItem("serve.session"); const u = (await import("/src/agent.js")).AGENT_URL; await fetch(u + "/api/members/leave", { method: "POST", headers: { "x-serve-session": s } }); });
await browser.close();
