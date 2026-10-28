// The submission's screenshots (submission/shots/*.png), taken from the running site (npm run dev on :5191, the
// gateway on the GPU server): desktop at 1440x900 and phone at 390x844, both at twice the pixels, in the light theme
// unless the name ends in _dark. The agent runs in them are real (the Match helper's ask and its yes, the Autopilot,
// the challenge, the best match, courts near you), so a full run takes several minutes.
//   PUPPETEER_FROM=<a folder with puppeteer-core in node_modules> node shots.mjs [shot ...]
//   shots: home home_dark phone_home talk autopilot play body courts club reel phone_club (default: all)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(process.env.PUPPETEER_FROM ? path.join(process.env.PUPPETEER_FROM, "package.json") : import.meta.url);
const puppeteer = require("puppeteer-core");

const B = "http://127.0.0.1:5191";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = path.join(HERE, "..", "submission", "shots");
const BODY_SEED = JSON.parse(fs.readFileSync(path.join(HERE, "body_seed.json"), "utf8"));
const ALL = ["home", "home_dark", "phone_home", "talk", "autopilot", "play", "body", "courts", "club", "reel", "phone_club"];
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", protocolTimeout: 900000, args: ["--lang=en-US", "--window-size=1440,900"] });
const page = await browser.newPage();
const DESK = { width: 1440, height: 900, deviceScaleFactor: 2 }, PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function view(v, scheme = "light") { await page.setViewport(v); await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]); }
async function go(hash, settle = 1500) { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await wait(settle); }
const until = (fn, timeout, arg) => page.waitForFunction(fn, { timeout, polling: 300 }, arg);
// scroll so the element's top sits `gap` px below the top (under the phone's top bar too)
async function top(sel, gap = 24) { await page.evaluate((s, g) => { const e = document.querySelector(s); if (e) scrollTo(0, scrollY + e.getBoundingClientRect().top - g - (document.querySelector(".side")?.getBoundingClientRect().height < 120 ? 64 : 0)); }, sel, gap); await wait(700); }
async function shot(name) { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log("  saved", name); }
async function click(sel, text) {
  const ok = await page.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find((x) => !t || x.innerText.includes(t)); e?.click(); return !!e; }, sel, text ?? null);
  if (!ok) throw new Error(`not found: ${sel} ${text ?? ""}`);
}
// a clean start: no earlier jobs, game state, stories seen or question asked; the body log from the demo's own seed
async function fresh(body = BODY_SEED) {
  await go("", 600);
  await page.evaluate((b) => { ["serve.tasks.v1", "serve.game.v1", "serve.stories.v1", "serve.ask.v1", "serve.body"].forEach((k) => localStorage.removeItem(k)); if (b) localStorage.setItem("serve.body", JSON.stringify(b)); }, body);
  // a hash change keeps the app's state in memory: reload so it reads what was just stored
  await page.reload({ waitUntil: "networkidle2" }); await wait(800);
}
const askShown = () => until(() => document.querySelector(".ask-card"), 180000);

const SHOTS = {
  // the agent home: the helpers, and the Match helper's question under Needs you
  async home() { await view(DESK); await fresh(); await go("", 1500); await askShown(); await top(".helpers", 20); await shot("agent_home"); },
  async home_dark() { await view(DESK, "dark"); await go("", 1500); await askShown(); await top(".helpers", 20); await shot("agent_home_dark"); },
  async phone_home() { await view(PHONE); await go("", 1500); await askShown(); await top(".task-sec", 12); await shot("phone_home"); },
  // yes: the Talk helper agrees it with the other players' agents; the card shows what they said
  // (nothing sore, so it is a singles game with one other agent; a no from their agent is tried again, twice at most)
  async talk() {
    for (let i = 0; i < 3; i++) {
      await view(DESK); await fresh({ ...BODY_SEED, log: [] }); await go("", 1500); await askShown();
      await click(".ask-card .btn.primary", "Yes");
      await until(() => [...document.querySelectorAll(".task")].some((t) => /Match · Talk/.test(t.innerText) && !t.classList.contains("running") && t.querySelector(".task-talk")), 300000);
      const ok = await page.evaluate(() => { const t = [...document.querySelectorAll(".task")].find((x) => /Match · Talk/.test(x.innerText)); t?.classList.add("__shot"); return !/No deal/.test(t?.innerText || ""); });
      if (!ok && i < 2) { console.log("  their agent said no; again"); continue; }
      await top(".task.__shot", 90); await shot("game_talk"); return;
    }
  },
  // the Autopilot: one run of the week, every tool step, the agents' threads, the approval
  async autopilot() {
    await view(DESK); await fresh(); await go("autopilot", 1500);
    await click(".report-head .btn.primary", "Run my week now");
    await until(() => document.querySelector(".ap-approve"), 600000);
    await top(".ap-run", 20); await shot("autopilot_week");
  },
  // a challenge: asked on the agent home, then the Play map with everyone's trip and the options
  async play() {
    await view(DESK); await fresh(); await go("", 1500);
    await page.type("#agent-q", "Challenge Kenji to a singles match this week"); await page.keyboard.press("Enter");
    await until(() => location.hash.includes("play?task="), 20000);
    await until(() => document.querySelector(".options"), 300000);
    const hash = await page.evaluate(() => location.hash.slice(2));
    await top(".play-job", 20); await shot("play_challenge_map");
    await view(PHONE); await go(hash, 2500); await top(".play-job", 12); await shot("phone_play_map");
  },
  async body() { await view(DESK); await fresh(); await go("body", 4500); await shot("body_log"); },
  async courts() { await view(DESK); await go("courts?sport=basketball", 2500); await click(".ct-ask .btn.primary", "Find courts"); await until(() => document.querySelector(".ct-list"), 600000); await wait(1500); await top(".ct-head", 20); await shot("courts_near_you"); },
  async club() {
    await view(DESK); await go("club", 2500); await shot("club_feed");
    await go("club?tab=ranks", 2000); await shot("club_leaderboard");
    await go("club?tab=challenges&spin=1", 4000); await shot("club_random_match");
    await go("club?tab=challenges", 1500); await click(".best .btn.primary", "Find my best match");
    await until(() => document.querySelector(".best-list"), 240000); await wait(1500); await top(".best", 20); await shot("club_best_match");
  },
  // the highlight reel of your own clip (HIGHLIGHT_CLIP), at the moment it replays your shot
  async reel() {
    if (!process.env.HIGHLIGHT_CLIP) throw new Error("set HIGHLIGHT_CLIP to a video of your own game");
    await view(DESK); await go("highlights", 1500);
    await (await page.$(".own-pick input[type=file]")).uploadFile(process.env.HIGHLIGHT_CLIP);
    await until(() => document.querySelector(".own-card.ready"), 600000);
    await click(".hl-actions .btn.ghost", "Preview reel");
    await until(() => ["replay", "impact"].includes(document.querySelector("canvas.hl-canvas")?.dataset.phase), 120000);
    await top(".hl-grid", 20); await shot("highlight_reel");
  },
  async phone_club() { await view(PHONE); await go("club", 2500); await shot("phone_club"); await go("club?tab=ranks", 2000); await shot("phone_club_leaderboard"); },
};

const failed = [];
for (const k of want) {
  const t0 = Date.now();
  console.log(k);
  try { await SHOTS[k](); } catch (e) { failed.push(k); console.log(`  FAILED ${k}: ${e.message}`); }
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
console.log(failed.length ? `failed: ${failed.join(", ")}` : "all shots saved");
