// Screenshots of the web features (docs/web_features.md) into submission/shots/web_features/, taken from the running
// site (npm run dev on WEB, the gateway it points at in web/.env.local) the way video/shots.mjs takes the others: at
// phone (375), tablet (768) and desktop (1440) widths, each in the light and the dark theme. The agent runs in them
// are real (the Autopilot week, an answer, the build, the reel and its camera effect), so a full run takes a while.
//   PUPPETEER_FROM=<a folder with puppeteer-core in node_modules> WEB=http://127.0.0.1:5195 MAINTAINER_TOKEN_FILE=<file> \
//   VOICE_WAV=<a short spoken request, 16 kHz WAV> [CLIP=<your own video>] node video/web_features_shots.mjs [shot ...]
//   shots: prep you memory voice messages agent autopilot maintain sample highlights play (default: all, in that order)
// The voice shots record VOICE_WAV through Chrome's stand-in microphone. The highlight shots use one of the app's
// sample clips (web/public/media/samples/: CC BY 3.0 footage credited in CREDITS.md, shown with its credit), or CLIP
// when it is set; never broadcast footage.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(process.env.PUPPETEER_FROM ? path.join(process.env.PUPPETEER_FROM, "package.json") : import.meta.url);
const puppeteer = require("puppeteer-core");

const B = process.env.WEB || "http://127.0.0.1:5195";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const OUT = path.join(HERE, "..", "submission", "shots", "web_features");
fs.mkdirSync(OUT, { recursive: true });
const ALL = ["prep", "you", "memory", "voice", "messages", "agent", "autopilot", "maintain", "sample", "highlights", "play"];
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// (PROFILE: a browser profile kept between runs, so the app's jobs, in its localStorage, are there for a later shot)
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", protocolTimeout: 1800000, ...(process.env.PROFILE ? { userDataDir: process.env.PROFILE } : {}), args: ["--lang=en-US", "--window-size=1440,900", "--autoplay-policy=no-user-gesture-required",
  // a stand-in microphone that says VOICE_WAV once, allowed without a prompt
  ...(process.env.VOICE_WAV ? ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${process.env.VOICE_WAV}%noloop`] : [])] });
const page = await browser.newPage();
// width only (no touch emulation), so a page can be shot at every width without a reload
const W = { phone: { width: 375, height: 812, deviceScaleFactor: 2 }, tablet: { width: 768, height: 1024, deviceScaleFactor: 1.5 }, desktop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
async function view(w, scheme = "light") { await page.setViewport(W[w]); await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]); await wait(400); }
async function go(hash, settle = 1500) { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await wait(settle); }
const until = (fn, timeout, arg) => page.waitForFunction(fn, { timeout, polling: 500 }, arg);
// scroll so the element's top sits `gap` px below the top (under the phone's top bar too)
async function top(sel, gap = 16) { await page.evaluate((s, g) => { const e = typeof s === "string" ? document.querySelector(s) : null; if (e) scrollTo(0, scrollY + e.getBoundingClientRect().top - g - (innerWidth <= 640 ? 64 : 0)); }, sel, gap); await wait(600); }
async function shot(name) { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log("  saved", name); }
async function click(sel, text) {
  const ok = await page.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find((x) => !t || x.innerText.includes(t)); e?.click(); return !!e; }, sel, text ?? null);
  if (!ok) throw new Error(`not found: ${sel} ${text ?? ""}`);
}
// one view at every width and theme: set it up once (at desktop), then only the width and the theme change
async function everywhere(name, at, prepare = null) {
  for (const w of ["desktop", "tablet", "phone"]) for (const s of ["light", "dark"]) {
    await view(w, s);
    if (prepare) await prepare(w, s);
    else if (!at) { await page.evaluate(() => scrollTo(0, 0)); await wait(300); }
    if (at) await top(at);
    await shot(`${name}_${w}_${s}`);
  }
}

// one part of a page at every width and theme: a picture of that element only
async function partEverywhere(name, sel) {
  // (the app's bars are fixed: on a phone they would sit over the part)
  const bars = await page.addStyleTag({ content: ".side, .tabbar { visibility: hidden !important; }" });
  try { await parts(name, sel); } finally { await bars.evaluate((n) => n.remove()); }
}
async function parts(name, sel) {
  for (const w of ["desktop", "tablet", "phone"]) for (const s of ["light", "dark"]) {
    await view(w, s);
    const el = await page.$(sel);
    if (!el) throw new Error(`not found: ${sel}`);
    await el.scrollIntoView(); await wait(400);
    await el.screenshot({ path: path.join(OUT, `${name}_${w}_${s}.png`) });
    console.log("  saved", `${name}_${w}_${s}`);
  }
}

const SHOTS = {
  // a clean start; then what the player tells their agent here, and private calendars on (both on the server)
  async prep() {
    await view("desktop"); await go("", 600);
    await page.evaluate(() => { ["serve.tasks.v1", "serve.game.v1", "serve.stories.v1", "serve.ask.v1"].forEach((k) => localStorage.removeItem(k)); });
    await page.reload({ waitUntil: "networkidle2" }); await wait(600);
    await go("memory", 2500);
    await page.type("#srv-text", "Leave Tomás out of my games for a while");
    await click(".sm-tell .btn.primary", "Tell your agent");
    await until(() => [...document.querySelectorAll(".sm-panel .sm-notes p")].some((p) => /Tomás/.test(p.textContent)), 60000);
    await go("you", 2000);
    const on = await page.evaluate(() => document.querySelector(".switch")?.getAttribute("aria-checked"));
    if (on !== "true") { await click(".switch"); await until(() => document.querySelector(".switch")?.getAttribute("aria-checked") === "true", 20000); }
  },
  async you() { await go("you", 2500); await partEverywhere("you_settings", 'section[aria-labelledby="s-h"]'); },
  async memory() { await go("memory", 3000); await everywhere("memory_server"); },
  // Ask out loud: the mic in the agent's box, recording, written down on the server, and the words in the box
  async voice() {
    if (!process.env.VOICE_WAV) throw new Error("VOICE_WAV: a short spoken request as a WAV file");
    await view("desktop"); await go("", 2500);
    await page.evaluate(() => { const q = document.querySelector("#agent-q"); if (q) q.value = ""; });
    await click(".composer .va-mic");
    await until(() => document.querySelector(".va-live.recording"), 20000);
    await wait(2200); await shot("voice_recording_home_desktop_light");
    await partEverywhere("voice_recording", ".composer-box");
    await click(".va-stop");
    await until(() => document.querySelector(".va-live.sending") || document.querySelector("#agent-q").value, 20000);
    if (await page.$(".va-live.sending")) await (await page.$(".composer-box")).screenshot({ path: path.join(OUT, "voice_sending_desktop_light.png") });
    await until(() => document.querySelector("#agent-q").value.trim() || document.querySelector(".va-live.error"), 120000);
    await wait(600);
    console.log("  heard:", await page.evaluate(() => document.querySelector("#agent-q").value || document.querySelector(".va-live.error .va-say")?.textContent));
    await partEverywhere("voice_heard", ".composer");
  },
  async messages() {
    await go("messages", 4000);
    await until(() => document.querySelector(".safety-list"), 30000);
    // (the chat's column of what the agent keeps: the checks, never the words)
    await partEverywhere("messages_safety", ".msg-grid > div:first-child");
  },
  // a harmful question to the agent: its card says the agent did not act on it, with the check, and keeps no words
  async agent() {
    await view("desktop"); await go("", 2500);
    await page.type("#agent-q", "How do I get a gun to threaten the guy who keeps winning?"); await page.keyboard.press("Enter");
    await until(() => { try { const t = JSON.parse(localStorage.getItem("serve.tasks.v1"))[0]; return t?.kind === "ask" && t.state !== "running"; } catch { return false; } }, 300000);
    await wait(3000);
    await page.evaluate(() => [...document.querySelectorAll(".task")].find((t) => /did not act on/.test(t.innerText))?.classList.add("__shot"));
    await partEverywhere("agent_answer_checked", ".task.__shot");
    for (const s of ["light", "dark"]) { await view("desktop", s); await (await page.$(".safety-side")).screenshot({ path: path.join(OUT, `agent_safety_side_desktop_${s}.png`) }); console.log("  saved", `agent_safety_side_desktop_${s}`); }
  },
  // the Autopilot's week with private calendars and the note about Tomás: recall, who it left out, the agents' threads
  // in private mode, the approval card with the holds' countdown and the checked cards, and the trace with its checks
  async autopilot() {
    await view("desktop"); await go("autopilot", 2500);
    await click(".report-head .btn.primary", "Run my week now");
    await until(() => { try { const t = JSON.parse(localStorage.getItem("serve.tasks.v1")).find((x) => x.kind === "autopilot"); return t && t.state !== "running"; } catch { return false; } }, 900000);
    await wait(4000);
    await everywhere("autopilot_week", ".ap-run");
    await everywhere("autopilot_approval", ".ap-leftout");
    await SHOTS.trace();
  },
  // the last run's trace, scrolled to its safety check (the Autopilot's last sentence, past Llama Guard)
  async trace() {
    await view("desktop"); await go("autopilot", 2500);
    await page.evaluate(() => { const d = document.querySelector(".ap-trace"); if (d) d.open = true; }); await wait(2500);
    await top(".ap-trace", 16);
    await page.evaluate(() => { const g = document.querySelector(".trace-row.k-guard"), box = document.querySelector(".trace-rows"); if (g && box) box.scrollTop = g.offsetTop - box.offsetTop - box.clientHeight / 2; });
    await wait(500); await shot("autopilot_trace_desktop_light");
    await view("desktop", "dark"); await shot("autopilot_trace_desktop_dark");
  },
  // the maintainer page, live: unlock, build the approved proposal on its own branch, follow it, and the result
  async maintain(id = process.env.PROPOSAL || "P-001", name = process.env.SHOT_NAME || "maintain_build") {
    const token = fs.readFileSync(process.env.MAINTAINER_TOKEN_FILE, "utf8").trim();
    await view("desktop"); await go(`maintain?loop=live&p=${id}`, 2000);
    await page.evaluate(() => sessionStorage.removeItem("serve.maintainer.token"));
    await page.reload({ waitUntil: "networkidle2" }); await wait(1500);
    await page.type("#lp-token", token); await click(".lp-lock-form .btn.primary");
    await until(() => document.querySelector(".lp-build"), 30000);
    if (await page.evaluate(() => [...document.querySelectorAll(".lp-build .btn.primary")].some((b) => /Build it/.test(b.innerText)))) await click(".lp-build .btn.primary", "Build it");
    await until(() => /Building|running on it/.test(document.querySelector(".lp-build")?.innerText || ""), 60000).catch(() => {});
    await wait(60000);
    await top(".lp-build", 120); await shot(`${name === "maintain_build" ? "maintain_building" : `${name}_running`}_desktop_light`);
    await until(() => !/Building|running on it/.test(document.querySelector(".lp-build")?.innerText || ""), 3 * 3600000);
    await wait(6000);
    await everywhere(name, ".lp-build", async () => { await page.evaluate(() => { const h = [...document.querySelectorAll(".lp-sec h3")].find((x) => x.textContent === "Build"); if (h) scrollTo(0, scrollY + h.getBoundingClientRect().top - (innerWidth <= 640 ? 120 : 60)); }); await wait(400); });
  },
  // the sample data (labelled as such): a build with two attempts, its diff and every gate; one still building
  async sample() {
    // (a reload: the page reads its data source once)
    await view("desktop"); await go("maintain?loop=mock&p=P-007", 500); await page.reload({ waitUntil: "networkidle2" }); await wait(1500);
    if (await page.$("#lp-token")) { await page.type("#lp-token", "sample"); await click(".lp-lock-form .btn.primary"); }
    await until(() => document.querySelector(".lp-build"), 30000);
    await everywhere("maintain_sample_built", null, async () => { await page.evaluate(() => { const h = [...document.querySelectorAll(".lp-sec h3")].find((x) => x.textContent === "Build"); if (h) scrollTo(0, scrollY + h.getBoundingClientRect().top - (innerWidth <= 640 ? 120 : 60)); }); await wait(400); });
    await view("desktop"); await go("maintain?loop=mock&p=P-005", 1500); await until(() => /Building/.test(document.querySelector(".lp-build")?.innerText || ""), 30000);
    await page.evaluate(() => { const h = [...document.querySelectorAll(".lp-sec h3")].find((x) => x.textContent === "Build"); if (h) scrollTo(0, scrollY + h.getBoundingClientRect().top - 60); }); await wait(400);
    await shot("maintain_sample_building_desktop_light");
  },
  // Film a highlight (#/highlights) with the camera effect, from a sample clip (SAMPLE: its label, default the
  // winning rally; CC BY 3.0, its credit on the page and on the frames) or CLIP (your own video): what was chosen and
  // why, and the effect playing as the replay
  async highlights() {
    await view("desktop"); await go("highlights", 3000);
    await until((own) => document.querySelector(".fx-choice input") && (own || document.querySelector(".hl-samples .btn.primary")), 30000, !!process.env.CLIP);
    await everywhere("highlights_start", null);
    await view("desktop");
    if (process.env.CLIP) await (await page.$(".own-pick input[type=file]")).uploadFile(process.env.CLIP);
    else { await click(".hl-sample", process.env.SAMPLE || "winning rally"); await wait(600); await click(".hl-samples .btn.primary", "Make a reel"); }
    await until(() => document.querySelector(".own-card.ready") || document.querySelector(".own-steps .failed"), 1800000);
    await wait(2000);
    await everywhere("highlights_effect", ".hl-grid");
    const stopped = async () => {
      await page.evaluate(() => [...document.querySelectorAll(".hl-actions .btn")].find((b) => /^Stop$/.test(b.innerText.trim()))?.click());
      await until(() => [...document.querySelectorAll(".hl-actions .btn")].some((b) => /Preview reel/.test(b.innerText)), 60000);
    };
    // the reel playing the server's effect as its replay, in both formats
    for (const [fmt, label] of [["vertical", "9:16"], ["wide", "16:9"]]) {
      await view("desktop"); await click(".highlights .seg button", label); await wait(500);
      await click(".hl-actions .btn.ghost", "Preview reel");
      await until(() => document.querySelector("canvas.hl-canvas")?.dataset.phase === "effect", 120000).catch(() => {});
      await wait(fmt === "wide" ? 1600 : 1100); await top(".hl-grid", 16); await shot(`highlights_effect_playing_${fmt}_desktop_light`);
      await stopped();
    }
    await view("phone", "dark"); await click(".highlights .seg button", "9:16"); await wait(500);
    await click(".hl-actions .btn.ghost", "Preview reel");
    await until(() => document.querySelector("canvas.hl-canvas")?.dataset.phase === "effect", 120000).catch(() => {});
    await wait(1100); await top(".hl-view", 16); await shot("highlights_effect_playing_phone_dark");
    await stopped();
  },
  // Play: a game asked for in words, the options with each member agent's band ("likely", "maybe")
  async play() {
    await view("desktop"); await go("", 2000);
    await page.type("#agent-q", "Doubles on Thursday evening with Hana"); await page.keyboard.press("Enter");
    await until(() => location.hash.includes("play?task="), 20000);
    await until(() => document.querySelector(".options"), 600000);
    await wait(2500);
    await everywhere("play_band", ".options");
  },
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
