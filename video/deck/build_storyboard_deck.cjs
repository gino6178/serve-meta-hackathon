// The video storyboard (video/storyboard_zh_v3.md) as a slide deck for review: node build_storyboard_deck.cjs [out.pptx]
// One shot per slide: the expected picture on the left (a frame of the v2 video, a still the shot reuses, or a mockup
// drawn in HTML for a shot not filmed yet), and on the right the time, what is on screen and the narration, read from
// the Markdown so the two never drift apart.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const MD = path.join(ROOT, "video/storyboard_zh_v3.md");
const OUT = process.argv[2] || path.join(ROOT, "video/storyboard_v3.pptx");
const FR = process.env.SB_FRAMES || path.join(__dirname, "storyboard_frames");
const HEX = { ink: "0A0A0B", green: "0A7F44", greenBg: "E9F3EC", muted: "55555C", soft: "8A8A92", card: "F3F6F4", dark: "14241B", amber: "B26A00" };
const ZH = "Microsoft JhengHei";

// each shot: its id as in the Markdown, the picture, and whether it is reused (♻️) or new (🆕)
const SHOTS = [
  ["0-1", "v2_1.png", "♻️ 沿用 v2"], ["0-2", "island.png", "🆕 Q 版插畫 + 鎖頭，做成動態"], ["0-3", "pain_before_after.png", "🆕 轉場，接網站實錄"],
  ["1-1", "flow_four.png", "🆕 新錄（示意：現有截圖）"], ["1-2", "v2_52.png", "♻️ v2 分割畫面 + 🆕 JSON 疊圖"], ["1-3", "v2_22.png", "♻️ 沿用 v2"],
  ["1-4", "byoa.png", "🆕 示意圖（HTML 繪製）"], ["2-1", "v2_87.png", "♻️ 沿用 v2"], ["3-1", "tiers.png", "🆕 示意圖（HTML 繪製）"],
  ["3-2", "guard.png", "🆕 示意圖（HTML 繪製）"], ["3-3", "swarm_v3.png", "♻️ swarm 影片，數字更新"], ["3-4", "v2_150.png", "♻️ 沿用 v2（Rule of Two 圖拿掉揭露預算）"], ["4", "endcard.png", "♻️ v2 版型，文字照腳本換（示意）"],
];

// a Chinese name for the shots the Markdown names by their file
const HEADS = { "0-1": "開場封面", "2-1": "打完球的附加樂趣：精華影片", "4": "片尾" };
// the Markdown: each shot's header, screen lines, Chinese and English narration, corner label
function parse() {
  const md = fs.readFileSync(MD, "utf8").replace(/\r/g, ""), out = {};
  const blocks = md.split(/\n(?=\*\*[0-4]-\d（|## 段落 4)/);
  for (const b of blocks) {
    const h = b.match(/^\*\*([0-4]-\d)（([^）]+)）\s*(.+?)\*\*/) || b.match(/^## 段落 (4)：片尾（([^）]+)）\s*(.+)/);
    if (!h) continue;
    const pick = (k) => (b.match(new RegExp(`^- ${k}：(.*)$`, "m")) || [])[1] || "";
    const screen = [];
    const sm = b.match(/^- 畫面：(.*)\n((?:\s+.*\n?)*)/m);
    if (sm) { if (sm[1].trim()) screen.push(sm[1].replace(/`/g, "").trim()); for (const l of sm[2].split("\n")) { const t = l.replace(/^\s*(?:-|\d+\.)\s*/, "").replace(/`/g, "").trim(); if (t) screen.push(t); } }
    out[h[1]] = { time: h[2], head: HEADS[h[1]] || h[3].replace(/[♻️🆕]/gu, "").replace(/＋/g, "·").replace(/`[^`]*`/g, "").replace(/\s+/g, " ").replace(/^[·\s]+/, "").trim(), screen, zh: pick("中文"), en: pick("英文"), label: pick("角落標籤").replace(/`/g, "") };
  }
  return out;
}

async function img(file, width = 1800) {
  const buf = await sharp(file).resize({ width, withoutEnlargement: true }).flatten({ background: "#ffffff" }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { data: "image/png;base64," + buf.toString("base64"), ratio: m.height / m.width };
}
const seg = (id) => ({ 0: ["開場與痛點", "Impact"], 1: ["怎麼運作", "Demo + Tooling"], 2: ["附加樂趣", "Demo + Tooling"], 3: ["技術深度", "Depth + Tooling"], 4: ["片尾", ""] })[id[0]];

(async () => {
  const S = parse();
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Serve video storyboard v3.1";
  pres.theme = { headFontFace: ZH, bodyFontFace: ZH };
  const W = 13.333, H = 7.5, M = 0.5;
  pres.defineSlideMaster({ title: "SHOT", background: { color: "FFFFFF" }, slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.3, fontSize: 10, color: HEX.soft, align: "right" },
    objects: [{ text: { text: "Serve · 影片分鏡稿 v3.1（審核用）", options: { x: M, y: H - 0.42, w: 5, h: 0.3, fontSize: 10, color: HEX.soft, margin: 0, fontFace: ZH } } }] });
  const T = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontFace: ZH, color: HEX.ink, ...o });

  // cover
  let s = pres.addSlide();
  s.background = { color: HEX.dark };
  T(s, "Serve 影片分鏡稿 v3.1", { x: M + 0.3, y: 2.2, w: 11, h: 1.0, fontSize: 44, bold: true, color: "FFFFFF" });
  T(s, `2:45 · 13 個鏡頭 · 英文旁白 ${Object.values(S).reduce((n, x) => n + (x.en ? x.en.split(/\s+/).length : 0), 0)} 字 · 主軸：個人 agent 之間的協商平台`, { x: M + 0.3, y: 3.3, w: 11, h: 0.6, fontSize: 22, color: "C9D6CE" });
  T(s, "預期畫面：v2 影片的實際畫格、會沿用的素材，或為還沒錄的鏡頭用 HTML 畫的示意圖。所有數字對照 submission/technical_report.md", { x: M + 0.3, y: 4.2, w: 11.5, h: 0.9, fontSize: 15, color: "9FB3A7" });

  // the timeline
  s = pres.addSlide({ masterName: "SHOT" });
  T(s, "時間軸", { x: M, y: 0.35, w: 8, h: 0.6, fontSize: 28, bold: true });
  const toS = (t) => { const [a, b] = t.split("–"); const f = (x) => { const [m, ss] = x.split(":").map(Number); return m * 60 + ss; }; return [f(a), f(b)]; };
  const total = 165, x0 = M, w0 = W - 2 * M, colors = { 0: "D1352B", 1: "0A7F44", 2: "0064E0", 3: "B26A00", 4: "55555C" };
  SHOTS.forEach(([id]) => {
    const [a, b] = toS(S[id].time), x = x0 + (a / total) * w0, w = ((b - a) / total) * w0;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.4, w: w - 0.03, h: 0.7, fill: { color: colors[id[0]] }, line: { color: "FFFFFF", width: 1 } });
    T(s, id, { x, y: 1.4, w, h: 0.7, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
  });
  [[0, "0:00"], [60, "1:00"], [120, "2:00"], [165, "2:45"]].forEach(([t, l]) => T(s, l, { x: x0 + (t / total) * w0 - 0.4, y: 2.15, w: 0.8, h: 0.3, fontSize: 11, color: HEX.muted, align: "center" }));
  const rows = SHOTS.map(([id, , kind]) => [{ text: id }, { text: S[id].time }, { text: seg(id)[0] }, { text: S[id].head }, { text: kind }]);
  s.addTable([[{ text: "鏡頭", options: { bold: true } }, { text: "時間", options: { bold: true } }, { text: "段落", options: { bold: true } }, { text: "內容", options: { bold: true } }, { text: "素材", options: { bold: true } }], ...rows],
    { x: M, y: 2.65, w: W - 2 * M, colW: [0.8, 1.4, 1.6, 5.4, 3.13], fontSize: 11, fontFace: ZH, color: HEX.ink, border: { type: "solid", color: "DCDCE0", pt: 0.5 }, rowH: 0.3, fill: { color: "FFFFFF" } });

  // one slide per shot
  for (const [id, file, kind] of SHOTS) {
    const x = S[id]; if (!x) throw new Error(`no shot ${id} in the Markdown`);
    s = pres.addSlide({ masterName: "SHOT" });
    const [name, crit] = seg(id);
    T(s, [{ text: `${id}  `, options: { color: HEX.green } }, { text: x.head }], { x: M, y: 0.3, w: 9.5, h: 0.6, fontSize: 26, bold: true });
    T(s, `${x.time} · ${name}${crit ? ` · ${crit}` : ""}`, { x: M, y: 0.88, w: 9, h: 0.35, fontSize: 13, color: HEX.muted });
    T(s, kind, { x: W - M - 3.6, y: 0.4, w: 3.6, h: 0.4, fontSize: 12, bold: true, color: kind.startsWith("🆕") ? HEX.amber : HEX.green, align: "right" });
    // the expected picture, 16:9 frame
    const fw = 6.8, fh = fw * 9 / 16, fx = M, fy = 1.4;
    s.addShape(pres.shapes.RECTANGLE, { x: fx, y: fy, w: fw, h: fh, fill: { color: "F3F6F4" }, line: { color: "DCDCE0", width: 0.75 } });
    const im = await img(path.join(FR, file), 1600);
    let iw = fw, ih = fw * im.ratio; if (ih > fh) { ih = fh; iw = fh / im.ratio; }
    s.addImage({ data: im.data, x: fx + (fw - iw) / 2, y: fy + (fh - ih) / 2, w: iw, h: ih });
    T(s, "預期畫面", { x: fx, y: fy + fh + 0.05, w: 3, h: 0.3, fontSize: 10, color: HEX.soft, italic: true });
    if (x.label) T(s, `角落標籤：${x.label}`, { x: fx + 2, y: fy + fh + 0.05, w: fw - 2, h: 0.3, fontSize: 10, color: HEX.soft, align: "right" });
    // on screen, under the picture
    T(s, x.screen.slice(0, 6).map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: fx, y: fy + fh + 0.42, w: fw, h: H - (fy + fh + 0.42) - 0.5, fontSize: x.screen.length > 4 ? 9.5 : 10.5, color: HEX.ink, valign: "top", paraSpaceAfter: 2, fit: "shrink" });
    // narration on the right
    const rx = fx + fw + 0.35, rw = W - M - rx;
    s.addShape(pres.shapes.RECTANGLE, { x: rx, y: fy, w: rw, h: 2.75, fill: { color: HEX.greenBg }, line: { color: HEX.greenBg } });
    T(s, "英文旁白（錄音用）", { x: rx + 0.2, y: fy + 0.12, w: rw - 0.4, h: 0.3, fontSize: 11, bold: true, color: HEX.green });
    T(s, x.en || "（沒有旁白：音樂淡入）", { x: rx + 0.2, y: fy + 0.45, w: rw - 0.4, h: 2.2, fontSize: 14, fontFace: "Segoe UI", valign: "top", fit: "shrink" });
    s.addShape(pres.shapes.RECTANGLE, { x: rx, y: fy + 2.9, w: rw, h: 2.3, fill: { color: HEX.card }, line: { color: HEX.card } });
    T(s, "中文（審稿用）", { x: rx + 0.2, y: fy + 3.02, w: rw - 0.4, h: 0.3, fontSize: 11, bold: true, color: HEX.muted });
    T(s, x.zh || "—", { x: rx + 0.2, y: fy + 3.35, w: rw - 0.4, h: 1.75, fontSize: 12.5, valign: "top", fit: "shrink" });
    if (x.en) { const n = x.en.split(/\s+/).length; T(s, `${n} 字 · 約 ${Math.round(n / 150 * 60)} 秒（每分鐘 150 字）`, { x: rx, y: fy + 5.3, w: rw, h: 0.3, fontSize: 10, color: HEX.soft, align: "right" }); }
  }

  // decisions left to the author, from the Markdown
  const md = fs.readFileSync(MD, "utf8").replace(/\r/g, "");
  const dec = (md.split("## 要你決定的")[1] || "").trim().split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.replace(/\*\*/g, "").replace(/`/g, ""));
  s = pres.addSlide({ masterName: "SHOT" });
  T(s, "要你決定的", { x: M, y: 0.35, w: 8, h: 0.6, fontSize: 28, bold: true });
  T(s, dec.map((t, i) => ({ text: t, options: { breakLine: i < dec.length - 1 } })), { x: M, y: 1.3, w: W - 2 * M, h: 5.4, fontSize: 15, valign: "top", paraSpaceAfter: 12 });

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
