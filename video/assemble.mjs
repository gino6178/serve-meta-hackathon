// Assemble the Meta demo video: the recorded scenes (build/*.webm and build/marks.json), cut to the Kokoro narration
// (build/kokoro/k*.wav and timings.json). The model's waits are sped up, and the video says so on screen.
//   node assemble.mjs        -> Serve_Meta_demo.mp4 and Serve_Meta_demo_no_voice.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const B = path.join(HERE, "build"), K = path.join(B, "kokoro");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
const FONT = "C\\:/Windows/Fonts/segoeuib.ttf";
const NARR = JSON.parse(fs.readFileSync(path.join(HERE, "narration.json"), "utf8"));
const TIMES = JSON.parse(fs.readFileSync(path.join(K, "timings.json"), "utf8"));
const MARKS = JSON.parse(fs.readFileSync(path.join(B, "marks.json"), "utf8"));
const NLEN = TIMES.map((rows) => rows.at(-1).end);
const LEAD = 0.5; // a breath before each scene's narration
const enc = ["-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast"];
const esc = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

// The screencasts write every frame at least once at 30 fps, so their timeline runs slow (about 1.27x). Make
// constant-rate copies at real speed, so the wall-clock marks from record.mjs line up.
const SRC = {};
for (const name of Object.keys(MARKS)) {
  const webm = path.join(B, name + ".webm"), raw = path.join(B, name + "_raw.mp4"), mp4 = path.join(B, name + ".mp4");
  if (!fs.existsSync(mp4) || fs.statSync(mp4).mtimeMs < fs.statSync(webm).mtimeMs) {
    ff(["-i", webm, "-vf", "fps=30,scale=1920:1080,format=yuv420p", ...enc, raw]);
    const k = dur(raw) / MARKS[name].end;
    ff(["-i", raw, "-vf", `setpts=PTS/${k.toFixed(5)},fps=30,format=yuv420p`, ...enc, mp4]);
    console.log(`${name}: ${dur(raw).toFixed(1)} s recorded for ${MARKS[name].end} s, played at ${k.toFixed(3)}x`);
  }
  SRC[name] = { file: mp4, d: dur(mp4), m: MARKS[name] };
}
const m = (name, k) => SRC[name].m[k];
// when sentence s of scene i is spoken, from the start of the scene
const say = (i, s) => LEAD + TIMES[i][s].start;

// a piece: source [a, b] played into d seconds; faster when it has to be (with an on-screen note), held when short.
// label names the Meta models at work, top left
let n = 0;
const out = () => path.join(B, `p${String(n++).padStart(3, "0")}.mp4`);
function piece(name, a, b, d, note, label) {
  const o = out(), span = Math.max(0.1, b - a), f = span / d;
  const vf = [];
  if (f > 1.05) vf.push(`setpts=PTS/${f.toFixed(4)}`);
  vf.push("tpad=stop_mode=clone:stop_duration=30");
  if (f > 1.6 && note) vf.push(`drawtext=fontfile='${FONT}':text='${esc(`${note} · ${f.toFixed(0)}× speed`)}':x=w-text_w-48:y=40:fontsize=30:fontcolor=0x0a7f44:box=1:boxcolor=0xffffff@0.92:boxborderw=16`);
  if (label) vf.push(`drawtext=fontfile='${FONT}':text='${esc(label)}':x=48:y=40:fontsize=30:fontcolor=0xffffff:box=1:boxcolor=0x0a0a0b@0.86:boxborderw=16`);
  vf.push("format=yuv420p");
  ff(["-ss", a.toFixed(3), "-t", (span + 0.2).toFixed(3), "-i", SRC[name].file, "-t", d.toFixed(3), "-vf", vf.join(","), ...enc, o]);
  return o;
}

// narration lengths plus a breath; each scene is [narration index or null, pieces]
const LEN = NLEN.map((x, i) => +(LEAD + x + (i === NLEN.length - 1 ? 1.6 : 0.9)).toFixed(2));
LEN[1] += 1.0; // the booking stays a moment
LEN[10] += 2.5; // the end card stays
const COVER = 6.8;
const S = [];
// cover: the hackathon, then Serve
S.push([null, [["cover", 0.2, 0.2 + COVER, COVER]]]);
// 0 · the pain: a group chat that never books
S.push([0, [["pain", 0.3, 0.3 + LEN[0], LEN[0]]]]);
// 1 · Serve: one yes in Messenger, booked
S.push([1, [["msgbook", 0.2, 9, LEN[1], null, "Facebook Messenger · real replies from the end-to-end test"]]]);
// 2 · Monday: the knee in Messenger, then filed on the body and turned into a rule
{
  const b = (k) => m("body", k), c3 = say(2, 3), L = LEN[2], LG = "Llama Guard 3 1B · Muse Glimmer · on my server";
  S.push([2, [
    ["msgknee", 0.2, 7.4, c3, null, LG],
    ["body", b("sent"), b("filed") + 0.5, 2.0, "Muse Glimmer reading it", LG],
    ["body", b("filed") + 0.5, b("acts") + 3.0, L - c3 - 2.0, null, LG],
  ]]);
}
// 3 · the Autopilot: Muse Glimmer's tools, then the agents over A2A, then the yes
{
  const a = (k) => m("autopilot", k), c1 = say(3, 1), c2 = say(3, 2), c5 = say(3, 5), L = LEN[3];
  S.push([3, [
    ["autopilot", 0.3, a("run") + 0.6, c1],
    ["autopilot", a("run") + 0.6, a("partners") + 1.0, c2 - c1, "Muse Glimmer planning the week", "Muse Glimmer · open weights · my RTX 3090"],
    ["autopilot", a("partners") + 1.0, a("ask"), c5 - c2, "The agents negotiating on Muse Glimmer", "A2A · agents mark times, code picks"],
    ["autopilot", a("ask"), a("end"), L - c5],
  ]]);
}
// 4 · courts near you
{
  const c = (k) => m("courts", k), c1 = say(4, 1), L = LEN[4], LB = "Prompt Guard 2 86M · Muse Glimmer";
  S.push([4, [
    ["courts", 0.3, c("find") + 0.5, c1],
    ["courts", c("find") + 0.5, c("found") + 0.3, (L - c1) * 0.4, "Searching and judging on Muse Glimmer", LB],
    ["courts", c("found") + 0.3, c("end"), (L - c1) * 0.6, null, LB],
  ]]);
}
// 5 · the highlight: read on the server (sped up), the effect at real speed, the caption and the share
{
  const h = (k) => m("highlight", k), c2 = say(5, 2), c3 = say(5, 3), c4 = say(5, 4), L = LEN[5];
  S.push([5, [
    ["highlight", 0.3, 2.0, c2],
    ["highlight", 2.0, h("replay"), c3 - c2, "Reading your video on your server", "DETR · Sapiens2 · SAM 2.1 · on my GPU"],
    ["highlight", h("replay"), h("ready") - 0.4, c4 - c3, null, "MapAnything · SAM 2.1 · camera effect"],
    ["highlight", h("ready") - 0.4, h("end"), L - c4, null, "Muse Glimmer · caption"],
  ]]);
}
// 6 · the scoreboard photo, checked, and the ranking
{
  const L = LEN[6], h = (k) => m("club", k);
  S.push([6, [
    ["msgscore", 0.2, 6.6, L * 0.6, null, "Muse Glimmer vision · checked by code"],
    ["club", h("ranks"), h("challenges"), L * 0.4],
  ]]);
}
// 7 · what running Glimmer taught me; 8 · Rule of Two and the disclosure budget; 9 · the community loop; 10 · end
S.push([7, [["glimmer", 0.2, 9.5, say(7, 3)], ["glimmer", 9.7, 26, LEN[7] - say(7, 3)]]]);
S.push([8, [["rules", 0.2, 14, LEN[8]]]]);
S.push([9, [["loop", 0.2, 13, LEN[9]]]]);
S.push([10, [["end", 0.2, 9, LEN[10]]]]);

fs.readdirSync(B).filter((f) => /^p\d+\.mp4$|^scene\d/.test(f)).forEach((f) => fs.rmSync(path.join(B, f)));
const scenes = [], starts = [];
let t = 0;
S.forEach(([, pieces], k) => {
  const made = pieces.map(([name, a, b, d, note, label]) => piece(name, a, b, d, note, label));
  const list = path.join(B, `scene${k + 1}.txt`), raw = path.join(B, `scene${k + 1}_raw.mp4`), sc = path.join(B, `scene${k + 1}.mp4`);
  fs.writeFileSync(list, made.map((x) => `file '${x.replace(/\\/g, "/")}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", raw]);
  const d = dur(raw);
  ff(["-i", raw, "-vf", `fade=t=in:st=0:d=${k ? 0.3 : 0.6}:color=${k ? "white" : "black"},fade=t=out:st=${(d - 0.3).toFixed(2)}:d=0.3:color=white`, ...enc, sc]);
  starts.push(t); t += d; scenes.push(sc);
  console.log(`scene ${k + 1}: ${d.toFixed(1)} s (starts ${starts[k].toFixed(1)})`);
});
const at = NARR.map((_, i) => starts[S.findIndex(([nar]) => nar === i)]);
const all = path.join(B, "scenes.txt"), silent = path.join(B, "video.mp4");
fs.writeFileSync(all, scenes.map((x) => `file '${x.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", all, "-c", "copy", silent]);

// audio: the narration, each scene's line placed at its scene
const ins = [], mix = [];
NARR.forEach((_, i) => { ins.push("-i", path.join(K, `k${i + 1}.wav`)); const ms = Math.round((at[i] + LEAD) * 1000); mix.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`); });
const voice = path.join(B, "audio.wav");
ff([...ins, "-filter_complex", `${mix.join(";")};${NARR.map((_, i) => `[a${i}]`).join("")}amix=inputs=${NARR.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[vo];[vo]apad=whole_dur=${t.toFixed(2)}[a]`,
  "-ar", "48000", "-map", "[a]", voice]);

// subtitles: one line at a time, timed from each spoken sentence
const MAXC = 60;
const lines = (s) => {
  const o = [];
  for (const w of s.split(/(?<=,)\s+/)) { const last = o.at(-1); if (last && (last + " " + w).length <= MAXC) o[o.length - 1] = last + " " + w; else o.push(w); }
  return o.flatMap((x) => { if (x.length <= MAXC + 10) return [x]; const ws = x.split(" "), h = Math.ceil(ws.length / 2); return [ws.slice(0, h).join(" "), ws.slice(h).join(" ")]; });
};
const ts = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Segoe UI Semibold,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H330B0B0C,0,0,0,0,100,100,0,0,3,14,0,2,200,200,44,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
TIMES.forEach((rows, i) => rows.forEach((r, j) => {
  const t0 = at[i] + LEAD + r.start, t1 = at[i] + LEAD + (rows[j + 1] ? Math.min(r.end + 0.25, rows[j + 1].start) : r.end + 0.4);
  const ls = lines(r.text), chars = ls.reduce((s, l) => s + l.length, 0);
  let x = t0;
  ls.forEach((l, q) => { const e = q === ls.length - 1 ? t1 : x + (r.end - r.start) * l.length / chars; ass += `Dialogue: 0,${ts(x)},${ts(e)},Sub,,0,0,0,,${l}\n`; x = e; });
}));
fs.writeFileSync(path.join(B, "subs.ass"), ass);
fs.writeFileSync(path.join(B, "timeline.json"), JSON.stringify({ starts, lens: LEN, pieces: S }, null, 1));

const OUT = path.join(HERE, "Serve_Meta_demo.mp4"), OUT2 = path.join(HERE, "Serve_Meta_demo_no_voice.mp4");
process.chdir(B);
ff(["-i", silent, "-i", voice, "-vf", "subtitles=subs.ass", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT]);
ff(["-i", silent, "-c:v", "copy", "-movflags", "+faststart", OUT2]);
console.log("wrote", OUT, dur(OUT).toFixed(1), "s");
