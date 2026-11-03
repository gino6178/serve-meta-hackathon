// Render the v4.3 video's scenes from stage/index.html, frame by frame (each frame drawn at its exact time).
//   node render.mjs preview [scenes...]   -> preview/s<k>_<i>.jpg at a few moments
//   node render.mjs full [scenes...]      -> build/s<k>.mp4 at 30 fps
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const require = createRequire("D:/COmp2/shuttle-analyst/deck/package.json");
const puppeteer = require("puppeteer-core");
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const [mode = "preview", ...want] = process.argv.slice(2);
const scenes = want.length ? want.map(Number) : [...Array(17).keys()];
fs.mkdirSync(path.join(HERE, "preview"), { recursive: true });
fs.mkdirSync(path.join(HERE, "build"), { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new",
  args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "--window-size=1920,1080", "--force-color-profile=srgb"], protocolTimeout: 0 });
const FPS = 30;
for (const k of scenes) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error(`scene ${k}:`, e.message));
  await page.bringToFront();
  await page.goto("file:///" + path.join(HERE, "stage", "index.html").split(path.sep).join("/") + `?scene=${k}${process.env.CLEAN ? "&clean=1" : ""}`, { waitUntil: "load" });
  await page.evaluate(() => window.ready());
  const dur = await page.evaluate(() => window.DUR);
  if (mode === "preview") {
    for (const [i, f] of [0.12, 0.45, 0.8, 0.99].entries()) {
      const t = f * dur;
      await page.evaluate((t) => window.draw(t), t);
      await page.evaluate((t) => window.seek(t), t);
      await page.screenshot({ path: path.join(HERE, "preview", `s${k}_${i}.jpg`), type: "jpeg", quality: 80 });
    }
  } else {
    const n = Math.round(dur * FPS), out = path.join(HERE, "build", `s${k}${process.env.CLEAN ? "_clean" : ""}.mp4`);
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", String(FPS), out], { stdio: ["pipe", "inherit", "inherit"] });
    for (let f = 0; f < n; f++) {
      const t = f / FPS;
      await page.evaluate((t) => window.draw(t), t);
      await page.evaluate((t) => window.seek(t), t);
      const buf = await page.screenshot({ type: "jpeg", quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log(`scene ${k}: ${n} frames, ${dur.toFixed(2)} s`);
  }
  await page.close();
}
await browser.close();
