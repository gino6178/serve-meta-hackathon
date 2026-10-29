// Stills of the live public site (ops/tenants.sh) for the deck: the clubs on the map, and the agent drafting an
// invite from a sentence. A demo member joins for them, at the given place (Hsinchu by default), and leaves at the end
// with everything it did.   node shots_live.mjs <public address>
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(process.env.PUPPETEER_FROM ? path.join(process.env.PUPPETEER_FROM, "package.json") : import.meta.url);
const puppeteer = require("puppeteer-core");

const B = (process.argv[2] || "").replace(/\/$/, "");
if (!B) { console.error("usage: node shots_live.mjs <public address>"); process.exit(2); }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = path.join(HERE, "..", "submission", "shots", "v3");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const AT = { latitude: +(process.env.LAT || 24.7893), longitude: +(process.env.LON || 120.9952), accuracy: 30 };

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--lang=en-US"] });
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(B, ["geolocation"]);
const page = await browser.newPage();
await page.setGeolocation(AT);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot", name); };
const go = async (hash, ms = 2500) => { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await wait(ms); };

await go("join", 1500);
await page.evaluate(async () => {
  const r = await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Alex" }) });
  localStorage.setItem("serve.session", (await r.json()).session);
});
try {
  await go("club", 9000); await shot("live_clubs");
  await go(`messages?say=${encodeURIComponent("Saturday morning doubles, need 3")}`, 2000);
  await page.waitForFunction(() => document.querySelector(".mc-draft"), { timeout: 120000 }); await wait(1000); await shot("live_draft");
} finally {
  await page.evaluate(async () => { await fetch("/api/members/leave", { method: "POST", headers: { "content-type": "application/json", "x-serve-session": localStorage.getItem("serve.session") }, body: "{}" }); localStorage.clear(); });
  await browser.close();
}
