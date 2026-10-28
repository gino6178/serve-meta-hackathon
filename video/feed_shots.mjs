// The club feed's screenshots (submission/shots/feed/*.png), from the running site and a test gateway with the demo
// club's seed and real paper posts from the reading agent: phone (390x844), tablet (820x1180) and desktop (1440x900),
// at twice the pixels, light and dark. The empty, loading and error states are the same page with the gateway's
// answer replaced in the browser (an empty feed, a slow answer, no answer).
//   PUPPETEER_FROM=<a folder with puppeteer-core in node_modules> SITE=http://127.0.0.1:5197 node video/feed_shots.mjs [shot ...]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(process.env.PUPPETEER_FROM ? path.join(process.env.PUPPETEER_FROM, "package.json") : import.meta.url);
const puppeteer = require("puppeteer-core");

const B = process.env.SITE || "http://127.0.0.1:5191";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = process.env.OUT || path.join(HERE, "..", "submission", "shots", "feed");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1440, height: 900, deviceScaleFactor: 2 } };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", protocolTimeout: 1200000, args: ["--lang=en-US", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
let fake = null; // a replaced answer for /api/feed (empty, slow, offline)
await page.setRequestInterception(true);
page.on("request", async (req) => {
  const u = new URL(req.url());
  if (fake && u.pathname === "/api/feed" && req.method() === "GET") {
    if (fake === "offline") return req.abort("connectionrefused");
    if (fake === "slow") return; // never answered: the loading state stays
    if (fake === "empty") return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ posts: [], drafts: [], notices: [], more: false, club: { name: "Riverside Sports Club" }, papers: { perWeek: 3, club: 3 }, simulated: false }) });
  }
  req.continue();
});
async function open(view, scheme = "light", hash = "club") {
  await page.setViewport(VIEW[view]);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${B}/#/${hash}`, { waitUntil: fake === "slow" ? "domcontentloaded" : "networkidle2" });
  await wait(1500);
}
// the same page in another size or scheme, without loading it again
async function view0(view, scheme) { await page.setViewport(VIEW[view]); await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]); await wait(800); }
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log("  saved", name); };
// scroll so the element's top sits `gap` px below the top bar
async function top(sel, gap = 12, nth = 0) {
  await page.evaluate((s, g, k) => { const e = document.querySelectorAll(s)[k]; if (!e) return; const bar = document.querySelector(".topbar, .side")?.getBoundingClientRect(); scrollTo(0, scrollY + e.getBoundingClientRect().top - g - (bar && bar.height < 120 ? bar.height : 0)); }, sel, gap, nth);
  await wait(700);
}
const until = (fn, timeout = 60000, arg) => page.waitForFunction(fn, { timeout, polling: 300 }, arg);
const feedShown = () => until(() => document.querySelector(".fd-list .fd-card"));

const SHOTS = {
  async feed() {
    for (const [view, scheme] of [["phone", "light"], ["phone", "dark"], ["tablet", "light"], ["desktop", "light"], ["desktop", "dark"]]) {
      await open(view, scheme); await feedShown();
      await top(view === "phone" ? ".fd-compose" : ".club-tabs", 12); await shot(`feed_${view}_${scheme}`);
    }
  },
  async paper() {
    for (const [view, scheme] of [["phone", "light"], ["phone", "dark"], ["desktop", "light"]]) {
      await open(view, scheme); await feedShown();
      await top(".fd-paper", view === "phone" ? 70 : 90); await shot(`paper_${view}_${scheme}`);
    }
  },
  async highlight() {
    for (const [view, scheme] of [["phone", "light"], ["phone", "dark"], ["desktop", "dark"]]) {
      await open(view, scheme); await feedShown();
      await top(".fd-k-highlight", 8); await wait(800); await shot(`highlight_${view}_${scheme}`);
    }
  },
  async draft() {
    for (const [view, scheme] of [["phone", "light"], ["desktop", "light"], ["phone", "dark"]]) {
      await open(view, scheme); await until(() => document.querySelector(".fd-draft"));
      await top(".fd-draft", 8); await shot(`draft_${view}_${scheme}`);
    }
  },
  // a question on a paper, answered by the member's own agent from the abstract
  async answer() {
    await open("phone", "light"); await until(() => [...document.querySelectorAll(".fd-comment.by-agent")].length);
    await top(".fd-comment.by-agent", 330); await shot("answer_phone_light");
    await open("desktop", "dark"); await until(() => document.querySelector(".fd-comment.by-agent"));
    await top(".fd-comment.by-agent", 420); await shot("answer_desktop_dark");
  },
  // a post Llama Guard flagged: not posted, and why in plain words
  async refused() {
    for (const [view, scheme] of [["phone", "light"], ["desktop", "dark"]]) {
      await open(view, scheme); await feedShown();
      await page.click("#fd-post"); await page.type("#fd-post", "Next club night I'll wait for him outside and beat him until he can't walk.");
      await page.click(".fd-compose .btn.primary");
      await until(() => document.querySelector(".fd-compose .fd-refused"), 60000);
      await top(".fd-compose", 12); await shot(`refused_${view}_${scheme}`);
    }
  },
  async sheets() {
    await open("phone", "light"); await feedShown();
    await top(".fd-paper", 70);
    await page.evaluate(() => document.querySelector(".fd-paper")?.closest(".fd-card")?.querySelector('[aria-label="Share outside the club"]')?.click());
    await wait(600); await shot("share_phone_light");
    await page.keyboard.press("Escape"); await wait(300);
    await page.evaluate(() => { const c = document.querySelector(".fd-k-highlight"); c?.querySelector('[aria-label="More"]')?.click(); });
    await wait(300);
    await page.evaluate(() => [...document.querySelectorAll(".fd-menu button")].find((b) => /Report/.test(b.textContent))?.click());
    await wait(600); await shot("report_phone_light");
    await open("desktop", "dark"); await feedShown(); await top(".fd-paper", 90);
    await page.evaluate(() => document.querySelector(".fd-paper")?.closest(".fd-card")?.querySelector('[aria-label="Share outside the club"]')?.click());
    await wait(600); await shot("share_desktop_dark");
  },
  // a recap of a booked game, waiting for everyone's yes
  async recap() {
    for (const [view, scheme] of [["phone", "light"], ["desktop", "dark"]]) {
      await open(view, scheme); await until(() => document.querySelector(".fd-recap-draft"));
      await top(".fd-recap-draft", 8); await shot(`recap_${view}_${scheme}`);
    }
  },
  // a photo the model's look refused
  async photo() {
    await open("phone", "light"); await feedShown();
    const input = await page.$('.fd-compose input[accept="image/*"]');
    await input.uploadFile(path.join(HERE, "..", "agent", "test", "sim", "photos", "u07_gun_threat.jpg"));
    await page.type("#fd-post", "Look what I brought to club night");
    await page.click(".fd-compose .btn.primary");
    await until(() => document.querySelector(".fd-compose .fd-refused"), 180000);
    await top(".fd-compose", 12); await shot("photo_refused_phone_light");
  },
  // a video of your own game from the composer: the reel's steps as they come, then the agent's draft
  async video() {
    await open("desktop", "light"); await feedShown();
    const input = await page.$('.fd-compose input[accept="video/*"]');
    await input.uploadFile(path.join(HERE, "..", "web", "public", "media", "samples", process.env.VIDEO || "singles_point_01.mp4"));
    await until(() => document.querySelectorAll(".fd-job .fd-steps li.done").length >= 2, 600000);
    await top(".fd-compose", 12); await shot("video_working_desktop_light");
    await until(() => /drafted the post|No highlight/.test(document.querySelector(".fd-job header")?.innerText || ""), 900000);
    await wait(1500); await top(".fd-compose", 12); await shot("video_done_desktop_light");
    await view0("phone", "dark"); await top(".fd-draft", 8); await shot("video_draft_phone_dark");
  },
  // the maintainer's reports: unlocked with the maintainer's token (MAINTAINER_TOKEN, from the environment)
  async reports() {
    for (const [view, scheme] of [["desktop", "light"], ["desktop", "dark"], ["phone", "light"]]) {
      await open(view, scheme, "maintain?tab=reports");
      if (await page.$("#lp-token")) { await page.type("#lp-token", process.env.MAINTAINER_TOKEN || ""); await page.keyboard.press("Enter"); }
      await until(() => document.querySelector(".rp-item, .rp .lp-state"), 60000); await wait(800);
      await top(".lp-tabs", 12); await shot(`reports_${view}_${scheme}`);
    }
    await top(".rp-log", 12); await shot("reports_log_phone_light");
  },
  async states() {
    fake = "empty"; await open("phone", "light"); await until(() => document.querySelector(".fd-state.is-empty")); await top(".fd-compose", 12); await shot("empty_phone_light");
    await open("desktop", "dark"); await until(() => document.querySelector(".fd-state.is-empty")); await top(".club-tabs", 12); await shot("empty_desktop_dark");
    fake = "slow"; await open("phone", "light"); await until(() => document.querySelector(".fd-skel")); await top(".fd-compose", 12); await shot("loading_phone_light");
    await open("desktop", "dark"); await until(() => document.querySelector(".fd-skel")); await top(".club-tabs", 12); await shot("loading_desktop_dark");
    fake = "offline"; await open("phone", "dark"); await until(() => document.querySelector(".fd-state.is-err")); await top(".fd-compose", 12); await shot("error_phone_dark");
    await open("desktop", "light"); await until(() => document.querySelector(".fd-state.is-err")); await top(".club-tabs", 12); await shot("error_desktop_light");
    fake = null;
  },
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
for (const k of want) { console.log(k); try { await SHOTS[k](); } catch (e) { console.log("  FAILED", k, e.message); } }
await browser.close();
