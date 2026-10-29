// Builds the presentation deck that the demo video follows: node build_deck.cjs [out.pptx]
// Slides go in judging order (Impact, Use of Meta AI, Technical depth), with a simple architecture up front and the
// full technical architecture at the end. Speaker notes carry what each slide says.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const SHOTS = path.join(ROOT, "submission/shots");
const SCENES = path.join(ROOT, "video/scenes");
const OUT = process.argv[2] || path.join(__dirname, "Serve_Meta_deck.pptx");

const INK = "0A0A0B", MUTED = "55555C", SOFT = "8A8A92", LINE = "DCDCE0", CARD = "F6F7F8", WHITE = "FFFFFF";
const GREEN = "0A7F44", GREENBG = "E9F3EC", BLUE = "0064E0", BLUEBG = "E8F1FD", RED = "D1352B", REDBG = "FBEAE9";
const AMBERBG = "FBF3E6", AMBER = "B26A00";
const FONT = "Segoe UI";

// Images: SVG logos to PNG, big screenshots down to JPEG.
async function png(svgFile, size = 256) {
  const buf = await sharp(fs.readFileSync(svgFile)).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function svgPng(svg, size = 256) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function jpg(file, width = 1600) {
  const buf = await sharp(file).resize({ width, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer();
  return "image/jpeg;base64," + buf.toString("base64");
}

// a chart from an SVG figure, on white, wide enough to stay sharp on a slide
async function chart(file) {
  const buf = await sharp(fs.readFileSync(file), { density: 220 }).flatten({ background: "#ffffff" }).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const IMG = {
    meta: await png(path.join(SCENES, "meta.svg")),
    messenger: await png(path.join(SCENES, "messenger.svg")),
    instagram: await png(path.join(SCENES, "instagram.svg")),
    facebook: await png(path.join(SCENES, "facebook.svg")),
    serve: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 48 C 22 8, 42 8, 54 30" fill="none" stroke="#0a0a0b" stroke-width="5.5" stroke-linecap="round"/><circle cx="54" cy="30" r="5" fill="#0a7f44"/></svg>'),
    cover: await jpg(path.join(ROOT, "submission/cover.png"), 1920),
    // the app on a phone (video/shots_v3.mjs), the venue map, and two of the report's charts
    v3: Object.fromEntries(await Promise.all(["join", "social_feed", "social_agent", "social_invite", "body_context", "body_rules", "courts_badges", "agent_chats", "plan_approve"].map(async (k) => [k, await jpg(path.join(SHOTS, "v3", k + ".png"), 780)]))),
    venue: await jpg(path.join(SHOTS, "venue_in_the_middle.png"), 1600),
    scale: await chart(path.join(ROOT, "docs/scale.svg")),
    tiers: await chart(path.join(ROOT, "docs/decision_tiers.svg")),
    dot: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#0a7f44"/><circle cx="32" cy="32" r="24" fill="none" stroke="#0a7f44" stroke-opacity=".25" stroke-width="6"/></svg>'),
    heart: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 54 C 8 38, 6 22, 18 14 C 25 10, 30 14, 32 19 C 34 14, 39 10, 46 14 C 58 22, 56 38, 32 54 Z" fill="#d1352b"/></svg>'),
    check: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#0a7f44"/><path d="M19 33 l9 9 l17 -19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    moment: await jpg(path.join(SHOTS, "orbit/moment.png")),
    depth: await jpg(path.join(SHOTS, "orbit/cutout_depth.png")),
  };

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
  pres.title = "Serve · Meta Global AI Developer Hackathon 2026";
  pres.author = "gino6178";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: WHITE },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.42, w: 12.1, h: 0.34, fontSize: 13, bold: true, color: GREEN, charSpacing: 1, margin: 0, valign: "top" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.78, w: 12.1, h: 0.75, fontSize: 32, bold: true, color: INK, margin: 0, valign: "top", align: "left" }, text: "" } },
      { text: { text: "Serve · Meta Global AI Developer Hackathon 2026", options: { x: 0.6, y: 7.05, w: 7, h: 0.25, fontSize: 10, color: SOFT, margin: 0 } } },
    ],
    slideNumber: { x: 12.3, y: 7.05, w: 0.45, h: 0.25, fontSize: 10, color: SOFT, align: "right" },
  });
  pres.defineSlideMaster({ title: "BLANK", background: { color: WHITE } });

  // Helpers. Every text box: no inner margin, so text lines up with the shapes it sits in.
  const T = (s, text, x, y, w, h, o = {}) => s.addText(text, { x, y, w, h, margin: 0, fontSize: 14, color: INK, valign: "top", isTextBox: true, ...o });
  const box = (s, x, y, w, h, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.fill || CARD }, line: { color: o.line || LINE, width: o.lw || 1, dashType: o.dash || "solid" } });
  const pill = (s, text, x, y, w, o = {}) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: o.h || 0.36, rectRadius: (o.h || 0.36) / 2, fill: { color: o.fill || WHITE }, line: { color: o.line || LINE, width: 1 } });
    T(s, text, x, y, w, o.h || 0.36, { fontSize: o.size || 12, bold: true, color: o.color || INK, align: "center", valign: "middle" });
  };
  const arrow = (s, x, y, w, h, o = {}) => s.addShape(pres.shapes.LINE, { x, y, w, h, flipH: !!o.flipH, flipV: !!o.flipV, line: { color: o.color || SOFT, width: o.width || 1.75, endArrowType: "triangle", beginArrowType: o.both ? "triangle" : undefined } });
  // a phone screenshot (390 x 844) in a dark bezel, with a caption under it; h is the screen's height
  const phone = (s, img, x, y, h, cap) => {
    const w = (h * 390) / 844, b = 0.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - b, y: y - b, w: w + 2 * b, h: h + 2 * b, rectRadius: 0.2, fill: { color: INK }, line: { color: INK, width: 1 } });
    s.addImage({ data: img, x, y, w, h });
    if (cap) T(s, cap, x - 0.3, y + h + 0.13, w + 0.6, 0.28, { fontSize: 10.5, color: MUTED, align: "center" });
    return w;
  };
  const content = (section, kicker, title, notes) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
    s.addText(kicker, { placeholder: "kicker" });
    s.addText(title, { placeholder: "title" });
    if (notes) s.addNotes(notes);
    return s;
  };

  // 1 · Cover: the hackathon, on white.
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: "Opening" });
    s.addImage({ data: IMG.meta, x: 0.8, y: 0.7, w: 0.6, h: 0.6 });
    T(s, "Meta", 1.5, 0.78, 2, 0.45, { fontSize: 22, bold: true, valign: "middle" });
    T(s, "Submitted to", 0.8, 2.35, 6, 0.4, { fontSize: 22, bold: true, color: BLUE });
    T(s, "Meta Global AI\nDeveloper Hackathon 2026", 0.8, 2.85, 12, 2.2, { fontSize: 58, bold: true, lineSpacingMultiple: 0.92 });
    pill(s, "Indie Developer", 0.8, 5.35, 2.3, { fill: BLUE, line: BLUE, color: WHITE, h: 0.5, size: 15 });
    pill(s, "Build for Your World", 3.25, 5.35, 2.8, { h: 0.5, size: 15 });
    pill(s, "Oct 27 – Nov 4, 2026", 6.2, 5.35, 2.7, { h: 0.5, size: 15 });
    s.addImage({ data: IMG.serve, x: 0.8, y: 6.45, w: 0.42, h: 0.42 });
    T(s, "serve  ·  Play more. Manage less.", 1.32, 6.45, 8, 0.42, { fontSize: 16, bold: true, valign: "middle" });
    s.addNotes("封面：先交代比賽（Meta Global AI Developer Hackathon 2026、Indie Developer、Build for Your World），停 3 秒再轉到 Serve。\n影片：cover.html，白底點陣，3.2 秒後淡入 Serve 封面。");
  }
  // 2 · Serve
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: "Opening" });
    s.addImage({ data: IMG.cover, x: 0, y: 0, w: 13.333, h: 7.5 });
    s.addNotes("Serve 的封面：Play more. Manage less.\n旁白：So for this hackathon, I built Serve. Not an AI coach. A club where your agent sorts things out with your friends' agents, and only asks you for one yes.");
  }

  // 3 · Impact
  pres.addSection({ title: "Impact" });
  {
    const s = content("Impact", "IMPACT · 30%", "People don't quit the game. They quit organizing it",
      "痛點：不是不愛打球，是約不成。\n旁白：Most people don't quit sports because they stopped loving the game. They quit because matching four calendars, finding a court and working around a sore knee takes too much group chat.\n影片：pain.html，群組約球失敗，蓋上 No game this week。");
    box(s, 0.6, 1.85, 3.6, 4.85, { fill: GREENBG, line: GREENBG });
    T(s, "31%", 0.9, 2.15, 3.1, 1.2, { fontSize: 72, bold: true, color: GREEN });
    T(s, "of adults worldwide did not get enough physical activity in 2022", 0.9, 3.45, 3.0, 1.1, { fontSize: 16, color: INK });
    T(s, "World Health Organization, 2024", 0.9, 4.6, 3.0, 0.3, { fontSize: 11, color: MUTED });
    T(s, "For anyone who plays a ball sport for fun: badminton, tennis, pickleball, table tennis, basketball, volleyball, soccer.", 0.9, 5.15, 3.0, 1.3, { fontSize: 13, color: MUTED });
    const rows = [
      ["Playing takes organizing", "A time that suits four people, a free court, somewhere everyone can reach. The group chat goes quiet.", "Autopilot lines up the week and agrees every game with the other players' agents. You approve once."],
      ["Nobody pushes you", "One missed week becomes a month. Apps count steps; none books your next game.", "When your usual time is open and your partner is free, it asks: \"Thursday 19:00: Leo is free. Want a game?\""],
      ["Life gets in the way", "A sore knee, a heavy week, rain on an outdoor court.", "It plans doubles or one game fewer, checks in two days later, and checks the map, reviews and forecast."],
    ];
    T(s, "THE PAIN", 4.6, 1.85, 3.6, 0.3, { fontSize: 11, bold: true, color: RED, charSpacing: 1 });
    T(s, "WHAT SERVE DOES", 8.75, 1.85, 3.9, 0.3, { fontSize: 11, bold: true, color: GREEN, charSpacing: 1 });
    rows.forEach(([h, pain, fix], i) => {
      const y = 2.25 + i * 1.5;
      box(s, 4.6, y, 3.9, 1.35, { fill: WHITE });
      T(s, h, 4.8, y + 0.15, 3.5, 0.35, { fontSize: 15, bold: true });
      T(s, pain, 4.8, y + 0.52, 3.55, 0.8, { fontSize: 12, color: MUTED });
      arrow(s, 8.52, y + 0.68, 0.2, 0);
      box(s, 8.75, y, 3.95, 1.35, { fill: GREENBG, line: GREENBG });
      T(s, fix, 8.95, y + 0.18, 3.6, 1.1, { fontSize: 13 });
    });
  }

  // 4 · Simple architecture, in three columns
  {
    const s = content("Impact", "HOW IT WORKS", "One yes from you. Agents do the rest",
      "一頁架構圖（三欄資料流）：\n左：你的脈絡——Messenger 的一句話、語音、健康 app，由 Meta DRAMA 依語意找出這週該注意的事。\n中：你的 Serve agent——Muse Glimmer（加上蒸餾出的 Llama 3.2 1B）一步一步規劃，透過 A2A 跟朋友的 agent 一輪談好時間。\n右：球場上下——你按一次 yes；賽後 Meta 的視覺模型剪出精華，在社群動態和限時動態分享。\n底：所有東西給人看之前都先由程式檢查。");
    const col = (x, w, k, h, fill, line) => { box(s, x, 1.85, w, 4.25, { fill, line, lw: line === GREEN ? 2 : 1 }); T(s, k, x + 0.25, 2.02, w - 0.5, 0.25, { fontSize: 10.5, bold: true, color: line === GREEN ? GREEN : MUTED, charSpacing: 1 }); T(s, h, x + 0.25, 2.3, w - 0.5, 0.45, { fontSize: 19, bold: true }); };
    const row = (x, y, w, ic, h, d) => { s.addImage({ data: ic, x, y: y + 0.02, w: 0.32, h: 0.32 }); T(s, h, x + 0.45, y, w - 0.45, 0.3, { fontSize: 13, bold: true }); T(s, d, x + 0.45, y + 0.3, w - 0.45, 0.5, { fontSize: 11, color: MUTED }); };
    col(0.6, 3.75, "YOUR CONTEXT", "Say it once", CARD, CARD);
    row(0.85, 2.95, 3.3, IMG.messenger, "Messenger and voice", "\"My right knee is sore\" · \"not Tomás this week\"");
    row(0.85, 3.85, 3.3, IMG.heart, "Your health app", "Apple Health, Google Fit, GPX: your load");
    row(0.85, 4.75, 3.3, IMG.dot, "Meta's DRAMA", "Finds what matters for this week, by meaning, recent first");
    arrow(s, 4.4, 3.97, 0.4, 0);
    col(4.85, 3.75, "YOUR SERVE AGENT", "Plans your week", GREENBG, GREEN);
    row(5.1, 2.95, 3.3, IMG.serve, "Muse Glimmer", "Picks one tool at a time on my RTX 3090; code runs it");
    row(5.1, 3.85, 3.3, IMG.dot, "Llama 3.2 1B", "Distilled from Glimmer: the easy calls, on the CPU");
    row(5.1, 4.75, 3.3, IMG.dot, "A2A with friends' agents", "One round: they mark times, code picks the overlap");
    arrow(s, 8.65, 3.97, 0.4, 0);
    col(9.1, 3.6, "ON AND OFF THE COURT", "You just play", BLUEBG, BLUEBG);
    row(9.35, 2.95, 3.15, IMG.check, "One yes", "In the app or with a tap in Messenger");
    row(9.35, 3.85, 3.15, IMG.dot, "Your highlight", "DETR · Sapiens2 · SAM 2.1 · MapAnything");
    row(9.35, 4.75, 3.15, IMG.instagram, "The club and your stories", "Invites, stories, one tap to Instagram");
    box(s, 0.6, 6.33, 12.1, 0.52, { fill: AMBERBG, line: AMBERBG });
    T(s, "Checked by code before anyone sees it  ·  nothing is booked without your yes  ·  video and health data stay on the server", 0.85, 6.33, 11.6, 0.52, { fontSize: 13, bold: true, color: AMBER, valign: "middle" });
  }

  // 5 · The social app
  pres.addSection({ title: "Demo" });
  {
    const s = content("Demo", "DEMO · 25%", "Your club, made by people and agents together",
      "社群 app（手機畫面）：\n1. 用 Facebook 或 Instagram 加入（OAuth 在伺服器上完成，只存帳號 id 的雜湊；目前 demo 用 demo 帳號，因為還沒設定 Meta app）。\n2. 動態最上面是限時動態：會員的 agent 從他自己的影片剪出的精華，經本人同意才發。\n3. 揪團：任何人都能加入；發文者的 agent 在留言裡用程式產生的句子回答「還剩幾個位子」。\n旁白建議：You join with Facebook or Instagram. Stories are highlights your agent cut from your own video, and anyone can join a game.");
    const H = 4.7, y = 1.85;
    phone(s, IMG.v3.join, 0.75, y, H, "Join with Facebook or Instagram");
    phone(s, IMG.v3.social_feed, 3.35, y, H, "Stories cut by members' agents");
    phone(s, IMG.v3.social_invite, 5.95, y, H, "An invite anyone can join");
    const x = 8.75;
    [["Join with Meta", "Facebook Login and Instagram Login, on the server. Serve keeps a name, a picture and a hash of the id; never a token."],
      ["Stories by agents", "A member's agent cuts the highlight from their own video and posts it only after their yes."],
      ["Games anyone can join", "Join with a tap. The poster's agent answers in the comments with facts made by code: who is in, spots left."],
      ["Every card says who wrote it", "A person, an agent and whose, and Simulated for the demo club's made-up members."]].forEach(([h, d], i) => {
      T(s, h, x, 1.9 + i * 1.2, 3.95, 0.32, { fontSize: 15, bold: true });
      T(s, d, x, 2.24 + i * 1.2, 3.95, 0.8, { fontSize: 12, color: MUTED });
    });
  }

  // 6 · Monday: say it once, the body context
  {
    const s = content("Demo", "MONDAY · BODY CONTEXT WITH META'S DRAMA", "Say it once. Every rule shows where it came from",
      "身體脈絡（RAG）：拿掉了 3D 肌肉圖。你在 Messenger、語音或這裡說一句話，agent 把你的原話、比賽和健康 app 的紀錄都變成筆記。\n規劃這週時，用 Meta 的 DRAMA 依語意檢索，越新的筆記權重越高（身體筆記 7 天減半）。畫面上的分數是真實的 DRAMA 相似度乘上時間衰減。\n規則仍由程式從紀錄決定（不讓模型發明規則），每條規則都附上來源筆記，程式檢查引用是同一個部位。\n旁白：Monday, I tell it my right knee is sore. Meta's DRAMA finds what matters this week, and every rule shows where it came from.");
    const H = 4.7, y = 1.85;
    phone(s, IMG.v3.body_context, 0.75, y, H, "What matters this week, by meaning");
    phone(s, IMG.v3.body_rules, 3.35, y, H, "Rules, each with its sources");
    const x = 6.2;
    const step = (i, h, d) => { s.addShape(pres.shapes.OVAL, { x, y: 1.95 + i * 1.18, w: 0.42, h: 0.42, fill: { color: GREEN }, line: { color: GREEN } }); T(s, String(i + 1), x, 1.95 + i * 1.18, 0.42, 0.42, { fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle" }); T(s, h, x + 0.6, 1.92 + i * 1.18, 5.9, 0.32, { fontSize: 15, bold: true }); T(s, d, x + 0.6, 2.25 + i * 1.18, 5.9, 0.8, { fontSize: 12, color: MUTED }); };
    step(0, "Notes from what you said and what was recorded", "Your words from Messenger, a voice note or the app; each week's load from your games and health app; what you told your agent before.");
    step(1, "Found by meaning with Meta's DRAMA", "The planner's question against every note, on the server's CPU. Recent notes count more: a body note keeps half its weight after a week.");
    step(2, "Rules decided by code, each citing its notes", "Doubles first, no jump sports, one game fewer in a heavy week. A citation must be a real note about the same body part, checked by code.");
    step(3, "The planner gets the same context", "check_body hands the top notes and the cited rules to Muse Glimmer when it plans your week. A record, never a diagnosis.");
  }

  // 7 · Tuesday to Wednesday: the planner, the venue in the middle, courts
  {
    const s = content("Demo", "TUESDAY · WEDNESDAY", "Your agent plans the week and finds the court",
      "規劃與球場：\n左：中心點球場地圖（技術報告第 4 頁那張）——每個人的通勤時間、共同空檔，agent 一輪談好。\n右：手機版找球場——Prompt Guard 2 先過濾 Google 評論，Muse Glimmer 同時判斷四個球場，每個理由都引用來源，程式檢查。\n旁白：Then it plans my week, and agrees it with three friends' agents at once, over A2A. Any ball sport works.");
    s.addImage({ data: IMG.venue, x: 0.6, y: 1.85, w: 6.55, h: 6.55 * 1670 / 2237 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.85, w: 6.55, h: 6.55 * 1670 / 2237, fill: { type: "none" }, line: { color: LINE, width: 1 } });
    T(s, "The venue in the middle: each player's trip on the club map, agreed by their agents in one round", 0.6, 6.83, 6.55, 0.25, { fontSize: 10.5, color: MUTED });
    phone(s, IMG.v3.courts_badges, 7.6, 1.85, 4.7, "Courts, judged with their sources");
    const x = 10.25;
    [["Muse Glimmer plans", "One tool at a time; a refused call comes back as a fact"], ["A2A, one round", "Agents mark the times that work; code picks"], ["Prompt Guard 2", "Screens Google reviews before the judge reads them"], ["Nothing booked", "until you say yes"]].forEach(([h, d], i) => {
      T(s, h, x, 1.95 + i * 1.18, 2.5, 0.3, { fontSize: 13.5, bold: true });
      T(s, d, x, 2.27 + i * 1.18, 2.5, 0.8, { fontSize: 11.5, color: MUTED });
    });
  }

  // 8 · Meta stack
  pres.addSection({ title: "Use of Meta AI" });
  {
    const s = content("Use of Meta AI", "USE OF META AI · 25%", "Ten Meta models and two Meta products, each with a job",
      "這頁讓評審一眼看到用了哪些 Meta 的東西：10 個 Meta 模型（全部開放權重、在我自己的伺服器上跑）＋ Messenger、Instagram/Facebook，再加上 Meta 的 Agents Rule of Two 框架。\n說法：Muse Glimmer 是大腦；1B 學生模型分擔簡單決策；兩個 guard 把關進出；DRAMA 是記憶；四個視覺模型做 highlight；Messenger 是入口。");
    const G = { Reasoning: [GREEN, GREENBG], Safety: [RED, REDBG], Memory: [MUTED, CARD], Voice: [MUTED, CARD], Vision: [BLUE, BLUEBG], "3D": [BLUE, BLUEBG], Product: [BLUE, WHITE] };
    const items = [
      ["Reasoning", "Muse Glimmer", "Every agent: the tool loop, members' decisions, photos, courts, captions", "RTX 3090 · Ollama · 4 in parallel"],
      ["Reasoning", "Llama 3.2 1B", "Distilled from Glimmer; answers 54–67% of members' decisions when sure", "CPU · simulated club"],
      ["Safety", "Llama Guard 3 1B", "What you write, what a model writes, every idea shared with the club", "CPU"],
      ["Safety", "Prompt Guard 2 86M", "Google reviews before the court judge reads them; shared ideas", "CPU"],
      ["Memory", "DRAMA", "Finds what matters for your week by meaning (RAG); groups the club's ideas", "CPU"],
      ["Voice", "Omnilingual ASR", "Voice notes in Messenger to text", "CPU · CTC 1B"],
      ["Vision", "DETR", "Finds the people in your video, so the reel follows you", "GPU"],
      ["Vision", "Sapiens2", "Every player's pose on every frame; finds the moment", "GPU · 0.4B"],
      ["Vision", "SAM 2.1", "Cuts each player out for the spotlight and the drawn view", "GPU · Hiera-L"],
      ["3D", "MapAnything", "Depth and the camera for the orbit camera effect", "GPU · optional effect"],
      ["Product", "Messenger Platform", "Your agent in your chats: plans, a tap to approve, check-ins", "Signed webhook · Send API"],
      ["Product", "Instagram · Facebook", "Join the club with your account; share your reel", "Facebook Login · Instagram Login"],
    ];
    items.forEach(([cat, name, job, where], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.06, y = 1.8 + row * 1.6, w = 2.92, h = 1.48;
      const [fg, bg] = G[cat];
      box(s, x, y, w, h, { fill: bg === WHITE ? WHITE : bg, line: bg === WHITE ? LINE : bg });
      T(s, cat.toUpperCase(), x + 0.18, y + 0.13, 1.6, 0.25, { fontSize: 10, bold: true, color: fg, charSpacing: 1 });
      if (cat === "Product") s.addImage({ data: name.startsWith("Messenger") ? IMG.messenger : IMG.instagram, x: x + w - 0.45, y: y + 0.12, w: 0.28, h: 0.28 });
      T(s, name, x + 0.18, y + 0.38, w - 0.3, 0.34, { fontSize: 15, bold: true });
      T(s, job, x + 0.18, y + 0.72, w - 0.32, 0.5, { fontSize: 10.5, color: INK });
      T(s, where, x + 0.18, y + 1.19, w - 0.3, 0.22, { fontSize: 10, color: MUTED });
    });
    s.addImage({ data: IMG.meta, x: 0.6, y: 6.66, w: 0.3, h: 0.3 });
    T(s, "All ten models are open weights, on hardware I own. Every agent follows Meta's Agents Rule of Two.", 1.0, 6.66, 11.5, 0.3, { fontSize: 12, bold: true, valign: "middle" });
  }

  // 9 · Agents
  {
    const s = content("Use of Meta AI", "AN AGENT, NOT A CHATBOT", "Glimmer plans, agents agree, code decides",
      "Autopilot：Muse Glimmer 用原生 tool calling 一步一步叫工具，被拒絕的呼叫會變成事實回來，它重新規劃。A2A：每個會員一個 agent、簽章的 Agent Card、一輪就談完、談好的時間先鎖 30 分鐘、每輪存檔可續跑。兩台機器（台北的 GPU 伺服器 + GCP A100）跨網路 22/22 項檢查通過。\n旁白：Autopilot takes over… Then it negotiates with three friends' agents at once, over A2A.");
    box(s, 0.6, 1.85, 5.85, 4.95, { fill: WHITE });
    T(s, "The planner agent · a tool loop", 0.85, 2.05, 5.3, 0.4, { fontSize: 18, bold: true });
    T(s, "Muse Glimmer picks the next tool; code runs it with checked arguments and hands back the facts.", 0.85, 2.5, 5.4, 0.6, { fontSize: 12.5, color: MUTED });
    ["get_week", "check_body", "find_partners", "find_places", "negotiate", "request_approval", "nudge", "finish"].forEach((t, i) => {
      const x = 0.85 + (i % 4) * 1.36, y = 3.25 + Math.floor(i / 4) * 0.5;
      pill(s, t, x, y, 1.28, { fill: GREENBG, line: GREENBG, color: GREEN, size: 10.5 });
    });
    T(s, [
      { text: "12 steps at most; rules finish the week if it stalls", options: { bullet: { indent: 14 }, breakLine: true } },
      { text: "A refused call (a day outside the week, a member who isn't free) comes back as a fact, and it re-plans", options: { bullet: { indent: 14 }, breakLine: true } },
      { text: "Replies in JSON Schemas, checked again in code; a reply that never fits is no answer, never a yes", options: { bullet: { indent: 14 } } },
    ], 0.85, 4.45, 5.4, 2.2, { fontSize: 12.5, paraSpaceAfter: 6 });

    box(s, 6.75, 1.85, 5.95, 4.95, { fill: BLUEBG, line: BLUEBG });
    T(s, "Agent to agent · A2A v1.0", 7.0, 2.05, 5.4, 0.4, { fontSize: 18, bold: true });
    T(s, "On the official SDK. One negotiation is one A2A context, and one trace.", 7.0, 2.5, 5.5, 0.6, { fontSize: 12.5, color: MUTED });
    const facts = [
      ["Signed Agent Cards", "Ed25519, checked before your agent talks to it"],
      ["One round", "Each agent marks the times that work; code picks from the overlap"],
      ["Held, all or nothing", "A 30-minute hold, so two talks never agree the same member twice"],
      ["Survives a crash", "Killed at each of five steps: booked exactly once every time"],
    ];
    facts.forEach(([h, d], i) => {
      const y = 3.2 + i * 0.62;
      T(s, h, 7.0, y, 2.1, 0.55, { fontSize: 12.5, bold: true });
      T(s, d, 9.1, y, 3.45, 0.55, { fontSize: 12 });
    });
    box(s, 7.0, 5.75, 5.45, 0.85, { fill: WHITE, line: WHITE });
    T(s, "22 / 22", 7.2, 5.75, 1.6, 0.85, { fontSize: 28, bold: true, color: BLUE, valign: "middle" });
    T(s, "checks across two machines: my GPU server in Taipei and a gateway on a cloud A100", 8.85, 5.75, 3.5, 0.85, { fontSize: 11.5, valign: "middle" });
  }

  // 10 · Your agent is a member too: the signed agent channel
  {
    const s = content("Use of Meta AI", "AGENTS AS MEMBERS", "Your agent joins the club with a key of its own",
      "Agent 會員通道（專屬簽章）：\n1. 會員在 app 裡按「Add my agent」，瀏覽器用 Web Crypto 產生 Ed25519 金鑰，只有公鑰送到伺服器註冊，私鑰不離開瀏覽器。\n2. Agent 之後每一個請求（發揪團、留言、代為加入）都簽章：方法、路徑、內容的 SHA-256、60 秒有效、一次性 nonce——跟兩台 gateway 之間用的同一套。\n3. 沒簽章、重放、被改過內容、用錯路徑、或金鑰已撤銷的請求都會被拒絕並記錄原因。\n4. Agent 發的東西標示「Agent · Signed」，以及是誰的 agent。");
    phone(s, IMG.v3.social_agent, 0.75, 1.85, 4.7, "Your agent in the club");
    const x = 3.75, flow = [
      ["1", "A key made in your browser", "Ed25519 with Web Crypto. Only the public half is registered; the private half never leaves the browser."],
      ["2", "Every request signed", "A compact JWS over the method, the path, the SHA-256 of the body, a 60-second life and a one-time nonce: the same token our two gateways use."],
      ["3", "Checked, or refused and logged", "Unsigned, replayed, changed, sent to another path, or signed by a revoked key: refused, with the reason."],
      ["4", "Labelled in the feed", "What it posts says Agent, whose agent, and Signed. Its member can revoke the key at once."],
    ];
    flow.forEach(([n, h, d], i) => {
      const y = 1.9 + i * 1.2;
      s.addShape(pres.shapes.OVAL, { x, y: y + 0.02, w: 0.42, h: 0.42, fill: { color: BLUE }, line: { color: BLUE } });
      T(s, n, x, y + 0.02, 0.42, 0.42, { fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, x + 0.6, y, 4.3, 0.32, { fontSize: 15, bold: true });
      T(s, d, x + 0.6, y + 0.34, 4.3, 0.8, { fontSize: 11.5, color: MUTED });
    });
    box(s, 9.0, 1.85, 3.7, 4.95, { fill: CARD, line: CARD });
    T(s, "What the agent can do", 9.25, 2.05, 3.3, 0.35, { fontSize: 15, bold: true });
    ["Post an invite for its member", "Join a game for its member", "Comment, as \"<member>'s agent\"", "Read the feed its member sees"].forEach((t, i) => {
      s.addImage({ data: IMG.check, x: 9.25, y: 2.6 + i * 0.5, w: 0.26, h: 0.26 });
      T(s, t, 9.62, 2.58 + i * 0.5, 3.0, 0.32, { fontSize: 12.5 });
    });
    T(s, "Tested: a replayed request, a changed body, another path, an unknown key and a revoked key are all refused (test/members_unit.mjs).", 9.25, 4.85, 3.25, 1.6, { fontSize: 11, color: MUTED });
  }

  // 11 · AI trust: every message between the agents, in the open
  {
    const s = content("Use of Meta AI", "AI TRUST", "See exactly what your agent said to theirs",
      "AI Trust：像 Messenger 一樣的「Agent 對話」頁。你的 agent 在右邊（綠色），其他會員的 agent 在左邊，一輪一輪，每則訊息下面標示意思（提案、同意、反提案、拒絕），以及程式是否已經用大家的行事曆檢查過（fits everyone）。標題列顯示對方的 Agent Card 已驗證。談成後出現「Agreed」，但要你按 yes 才訂。\n這些就是 agent 之間透過 A2A 真的送出的訊息，不是摘要。");
    phone(s, IMG.v3.agent_chats, 0.75, 1.85, 4.7, "Agent chats");
    phone(s, IMG.v3.plan_approve, 3.35, 1.85, 4.7, "Then it asks you");
    const x = 6.2;
    [["Every message, word for word", "The messages the agents sent each other over A2A, round by round. Not a summary."],
      ["What each one meant", "Proposes, agrees, a counter-offer or declines, under every bubble."],
      ["Checked by code", "\"Fits everyone\" means code checked it against every calendar before your agent moved on."],
      ["Whose agent, verified", "Each member's Agent Card is signed and checked before your agent talks to it."],
      ["You decide", "Agreed by every agent, then it waits for your yes."]].forEach(([h, d], i) => {
      s.addImage({ data: IMG.check, x, y: 1.95 + i * 0.97, w: 0.32, h: 0.32 });
      T(s, h, x + 0.5, 1.9 + i * 0.97, 6.0, 0.32, { fontSize: 15, bold: true });
      T(s, d, x + 0.5, 2.23 + i * 0.97, 6.0, 0.6, { fontSize: 12, color: MUTED });
    });
  }

  // 12 · Highlights
  {
    const s = content("Use of Meta AI", "HIGHLIGHTS · FOUR META VISION MODELS", "Your phone clip becomes your moment, on my GPU",
      "Highlight 管線：DETR 找人 → Sapiens2 讀姿勢、找最快的揮拍 → SAM 2.1 把你切出來 → MapAnything 算深度和相機，時間暫停、鏡頭繞 20° → Muse Glimmer 寫說明，程式核對 → 一鍵分享到 Instagram。影片不離開伺服器。\n旁白：Thursday, game done. I upload a phone clip… With MapAnything, time stops and the camera turns around the smash.");
    const flow = [["DETR", "finds the players"], ["Sapiens2", "reads the pose, finds the fastest swing"], ["SAM 2.1", "cuts you out"], ["MapAnything", "depth and camera: time stops, the camera turns 20°"], ["Muse Glimmer", "writes the caption, checked by code"]];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 2.45;
      box(s, x, 1.85, 2.2, 1.25, { fill: i === 4 ? GREENBG : BLUEBG, line: i === 4 ? GREENBG : BLUEBG });
      T(s, h, x + 0.18, 1.98, 1.9, 0.35, { fontSize: 15, bold: true, color: i === 4 ? GREEN : BLUE });
      T(s, d, x + 0.18, 2.35, 1.9, 0.7, { fontSize: 11.5 });
      if (i < 4) arrow(s, x + 2.22, 2.47, 0.21, 0);
    });
    s.addImage({ data: IMG.moment, x: 0.6, y: 3.4, w: 5.9, h: 3.32 });
    T(s, "A CC BY 3.0 clip from Wikimedia Commons, as filmed", 0.6, 6.76, 5.9, 0.25, { fontSize: 10, color: MUTED });
    s.addImage({ data: IMG.depth, x: 6.75, y: 3.4, w: 5.95, h: 1.67 });
    T(s, "SAM 2.1 cut-out and MapAnything depth", 6.75, 5.1, 5.95, 0.25, { fontSize: 10, color: MUTED });
    box(s, 6.75, 5.5, 5.95, 1.25, { fill: CARD, line: CARD });
    T(s, [
      { text: "Any ball sport; batched, bf16, about 0.3 s a frame", options: { bullet: { indent: 14 }, breakLine: true } },
      { text: "The orbit is an optional camera effect in the app", options: { bullet: { indent: 14 }, breakLine: true } },
      { text: "Your video is read on the server and nowhere else", options: { bullet: { indent: 14 } } },
    ], 6.95, 5.62, 5.6, 1.1, { fontSize: 12.5, paraSpaceAfter: 3 });
  }

  // 13 · Muse Glimmer in practice
  pres.addSection({ title: "Technical depth" });
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · 20%", "What running Muse Glimmer taught me",
      "Glimmer 的帳本：記錄 2,755 次呼叫，84% 的 token 是推理；就算關掉 thinking，它還是在隱藏通道推理，預算不夠時 9% 回空白。所以每次呼叫用 think:\"low\" 並留推理空間。再來是三層決策：能用程式就用程式 → 1B 學生模型有把握才答（54–67%）→ 真的需要才叫 Glimmer。\n旁白：Logging 2,755 calls, I found that 84% of Glimmer's tokens are reasoning…");
    [["2,755", "calls logged in the evaluations' ledgers", INK], ["84%", "of the tokens it wrote were reasoning", GREEN], ["9%", "came back empty: a small budget ran out mid-thought", RED]].forEach(([n, d, c], i) => {
      const y = 1.85 + i * 1.1;
      box(s, 0.6, y, 4.4, 0.98, { fill: WHITE });
      T(s, n, 0.8, y, 1.9, 0.98, { fontSize: 34, bold: true, color: c, valign: "middle" });
      T(s, d, 2.7, y, 2.2, 0.98, { fontSize: 12, valign: "middle" });
    });
    box(s, 0.6, 5.2, 4.4, 1.6, { fill: CARD, line: CARD });
    T(s, [
      { text: "Thinking switched off? It still reasoned in a hidden channel. ", options: {} },
      { text: "So every call asks for think: \"low\" and leaves room to think.", options: { bold: true } },
    ], 0.8, 5.35, 4.05, 1.35, { fontSize: 13 });

    T(s, "WHO DECIDES", 5.4, 1.85, 4, 0.3, { fontSize: 11, bold: true, color: GREEN, charSpacing: 1 });
    const tiers = [
      ["FIRST", "Code", "Every fact and every hard rule: free times, trips, limits. No model call when the facts decide.", WHITE, LINE, INK],
      ["THEN", "Llama 3.2 1B, distilled from Glimmer", "On the CPU. Answers only when sure, and only from times that keep every rule.", GREENBG, GREEN, GREEN],
      ["ONLY IF NEEDED", "Muse Glimmer", "The real choices: planning the week, judging courts, reading photos, writing.", WHITE, LINE, INK],
    ];
    tiers.forEach(([k, h, d, fill, line, c], i) => {
      const y = 2.25 + i * 1.5;
      box(s, 5.4, y, 7.3, 1.32, { fill, line, lw: i === 1 ? 2 : 1 });
      T(s, k, 5.62, y + 0.15, 2, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
      T(s, h, 5.62, y + 0.42, 4.6, 0.38, { fontSize: 16, bold: true, color: c === GREEN ? INK : INK });
      T(s, d, 5.62, y + 0.8, 4.9, 0.5, { fontSize: 11.5, color: MUTED });
      if (i === 1) {
        T(s, "54–67%", 10.45, y + 0.2, 2.1, 0.55, { fontSize: 28, bold: true, color: GREEN, align: "right" });
        T(s, "of members' answers, no rule broken (simulated club)", 10.3, y + 0.75, 2.25, 0.5, { fontSize: 10, color: MUTED, align: "right" });
      }
      if (i < 2) arrow(s, 9.05, y + 1.33, 0, 0.16);
    });
    T(s, "submission/results/glimmer_in_practice.json · technical report 3.12, 5.10", 5.4, 6.7, 7.3, 0.25, { fontSize: 10, color: SOFT });
  }

  // 14 · Measured: what each choice costs
  {
    const s = content("Technical depth", "MEASURED", "Two charts behind two design choices",
      "兩張實驗圖（技術報告裡的）：\n左：把整個社團塞進 prompt，token 隨人數線性成長；Serve 先用程式篩選候選人，每次呼叫的 token 幾乎不變。\n右：一個會員的決策，每一層的成本 vs. 和完整答案一致的比例：程式 → Llama 3.2 1B → Muse Glimmer（FrugalGPT 式分層）。\n這頁讓評審三秒看出工程上有量測。");
    s.addImage({ data: IMG.scale, x: 0.6, y: 1.85, w: 5.95, h: 5.95 * 400 / 760 });
    T(s, "Tokens per model call, by club size: the whole club in the prompt grows with it; Serve's calls stay about 1,500 tokens from 11 to 301 members", 0.6, 1.95 + 5.95 * 400 / 760, 5.95, 0.6, { fontSize: 11, color: MUTED });
    s.addImage({ data: IMG.tiers, x: 6.85, y: 1.85, w: 5.85, h: 5.85 * 500 / 780 });
    T(s, "One member's decision: what each tier costs, and how often it matches the full answer (code, then Llama 3.2 1B, then Muse Glimmer)", 6.85, 1.95 + 5.85 * 500 / 780, 5.85, 0.6, { fontSize: 11, color: MUTED });
  }

  // 15 · Safe by design
  {
    const s = content("Technical depth", "SAFE BY DESIGN", "No agent holds all three at once",
      "安全：每個 agent 都遵守 Meta 的 Agents Rule of Two（不可信輸入、私人資料、行動能力，最多同時兩個）。揭露預算：一直約球的 agent 能拼出你一週的行程，有預算時從 97.6% 降到 32.4%（模擬的探測者）。65 個攻擊全部擋下。\n旁白：Every agent follows Meta's Agents Rule of Two. And a disclosure budget cuts how much of your week a snooping agent can pin down, from 97.6% to 32.4%.");
    const circ = (x, y, label, line, fill) => {
      s.addShape(pres.shapes.OVAL, { x, y, w: 2.5, h: 2.5, fill: { color: fill, transparency: 35 }, line: { color: line, width: 2 } });
    };
    circ(0.9, 1.9, "", RED, REDBG); circ(2.85, 1.9, "", BLUE, BLUEBG); circ(1.88, 3.55, "", GREEN, GREENBG);
    T(s, "Untrusted\ninput", 1.15, 2.55, 1.4, 0.8, { fontSize: 15, bold: true, align: "center" });
    T(s, "Private\ndata", 3.85, 2.55, 1.4, 0.8, { fontSize: 15, bold: true, align: "center" });
    T(s, "The power\nto act", 2.43, 5.05, 1.4, 0.8, { fontSize: 15, bold: true, align: "center" });
    s.addShape(pres.shapes.OVAL, { x: 2.78, y: 3.25, w: 0.72, h: 0.72, fill: { color: WHITE }, line: { color: RED, width: 3 } });
    T(s, "×", 2.78, 3.25, 0.72, 0.72, { fontSize: 30, bold: true, color: RED, align: "center", valign: "middle" });
    T(s, "Meta's Agents Rule of Two, on every agent: the Autopilot, members' agents, the photo reader and the community loop.", 0.6, 6.25, 5.4, 0.6, { fontSize: 12, color: MUTED });

    T(s, "A disclosure budget", 6.75, 1.85, 6, 0.45, { fontSize: 20, bold: true });
    T(s, "An agent that keeps asking for games can map out your week. How many of your weekdays it pins down exactly:", 6.75, 2.3, 5.9, 0.6, { fontSize: 12.5, color: MUTED });
    s.addChart(pres.charts.BAR, [{ name: "Weekdays pinned down", labels: ["Without a budget", "With the budget"], values: [97.6, 32.4] }], {
      x: 6.65, y: 2.95, w: 6.1, h: 2.0, barDir: "bar", chartColors: [RED, GREEN], barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt", dataLabelColor: INK,
      catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: INK, catAxisOrientation: "maxMin",
      valAxisHidden: true, valAxisMaxVal: 115, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    });
    pill(s, "Simulated prober · technical report 3.13", 6.75, 4.98, 3.6, { size: 10.5, color: MUTED });
    box(s, 6.75, 5.55, 5.95, 1.25, { fill: CARD, line: CARD });
    T(s, "65 / 65", 6.95, 5.55, 1.9, 1.25, { fontSize: 30, bold: true, color: GREEN, valign: "middle" });
    T(s, "attacks stopped: injected instructions, poisoned reviews, forged Agent Cards, sock-puppet votes, diffs that book without a yes", 8.85, 5.55, 3.7, 1.25, { fontSize: 11.5, valign: "middle" });
  }

  // 16 · Community loop
  {
    const s = content("Technical depth", "SELF-EVOLVING", "The club makes itself better, safely",
      "自我演化的社團：會員在 Messenger 打 /idea 或按讚 → DRAMA 依語意分群，5 人提到才出現 → 二次方投票 → Muse Glimmer 寫規格、人工核准 → coding agent 在自己的分支上實作（從不讀社群文字）→ 九道關卡，第一個失敗就停 → 小規模上線，倒讚變多就自己關掉。永遠不能改的清單。這段是模擬社團（seed 7），但管線、關卡和回滾是真的。\n旁白：And the club evolves itself…");
    pill(s, "Simulated club (seed 7) · the pipeline, gates and rollback are real", 7.0, 0.42, 5.7, { size: 10.5, color: MUTED });
    const steps = [
      ["1 · ASK", "Members' ideas", "\"/idea\" in Messenger, or thumbs up and down"],
      ["2 · GROUP", "Meta's DRAMA", "Groups ideas by meaning; an idea shows at 5 members"],
      ["3 · VOTE", "Quadratic votes", "9 credits a month; n votes cost n²"],
      ["4 · SPEC", "Muse Glimmer drafts it", "A person approves the spec"],
      ["5 · BUILD", "A coding agent", "On its own branch; it never reads community text"],
    ];
    steps.forEach(([k, h, d], i) => {
      const x = 0.6 + i * 2.45;
      box(s, x, 1.85, 2.25, 1.75, { fill: WHITE });
      T(s, k, x + 0.18, 2.0, 1.9, 0.25, { fontSize: 10.5, bold: true, color: GREEN });
      T(s, h, x + 0.18, 2.28, 1.95, 0.62, { fontSize: 15, bold: true });
      T(s, d, x + 0.18, 2.9, 1.95, 0.65, { fontSize: 11, color: MUTED });
      if (i < 4) arrow(s, x + 2.27, 2.72, 0.16, 0);
    });
    box(s, 0.6, 3.9, 7.6, 1.95, { fill: GREENBG, line: GREENBG });
    T(s, "6 · NINE GATES", 0.82, 4.05, 3, 0.25, { fontSize: 10.5, bold: true, color: GREEN });
    T(s, "Stops at the first failure", 0.82, 4.32, 5, 0.38, { fontSize: 16, bold: true });
    ["policy", "code scan", "unit tests", "crash matrix", "red team", "Messenger end to end", "Autopilot pass^3", "oracle", "privacy canary"].forEach((g, i) => {
      const per = 5, x = 0.82 + (i % per) * 1.47, y = 4.85 + Math.floor(i / per) * 0.46;
      pill(s, g, x, y, 1.42, { size: 9.5, color: GREEN, line: WHITE, h: 0.34 });
    });
    arrow(s, 8.25, 4.87, 0.3, 0);
    box(s, 8.6, 3.9, 4.1, 1.95, { fill: WHITE, line: RED, lw: 2 });
    T(s, "7 · SHIP, OR ROLL BACK", 8.82, 4.05, 3.6, 0.25, { fontSize: 10.5, bold: true, color: RED });
    T(s, "A small canary", 8.82, 4.32, 3.6, 0.38, { fontSize: 16, bold: true });
    T(s, "Turns itself off if thumbs down rise. Anything beyond a safe setting waits for a person.", 8.82, 4.78, 3.7, 0.95, { fontSize: 12, color: MUTED });
    box(s, 0.6, 6.1, 12.1, 0.72, { fill: INK, line: INK });
    T(s, "NEVER-LIST", 0.85, 6.1, 1.6, 0.72, { fontSize: 12, bold: true, color: WHITE, valign: "middle" });
    T(s, "Booking without a yes · data off the server · a diagnosis or a dose · the guards · the tests · A2A · deployment", 2.45, 6.1, 10.1, 0.72, { fontSize: 13, color: WHITE, valign: "middle" });
  }

  // 17 · Proof
  {
    const s = content("Technical depth", "MEASURED", "Every claim has a log behind it",
      "證據頁：每個數字都有 log。e2e、攻擊測試在雲端 A100 上用同一個 Muse Glimmer（同一個 model digest）跑。可以快速帶過，或只在影片片尾字卡出現。");
    [["65/65", "attacks stopped"], ["52/52", "Messenger end-to-end checks"], ["22/22", "A2A checks across two machines"], ["20/20", "crash-matrix checks"]].forEach(([n, d], i) => {
      const x = 0.6 + i * 3.06;
      box(s, x, 1.85, 2.92, 1.35, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, x + 0.22, 1.95, 2.5, 0.72, { fontSize: 34, bold: true, color: i === 0 ? GREEN : INK });
      T(s, d, x + 0.22, 2.68, 2.5, 0.4, { fontSize: 12, color: MUTED });
    });
    const H = { bold: true, color: MUTED, fontSize: 11, fill: { color: WHITE } };
    const rows = [
      [{ text: "Suite", options: H }, { text: "Result", options: H }, { text: "Where it ran", options: H }],
      ["npm test, seventeen offline suites", "239 of 240, 1 skipped", "No model, no GPU"],
      ["Messenger end to end (test/e2e.mjs)", "52 of 52 checks", "Muse Glimmer on a cloud A100"],
      ["Attacks (test/redteam.mjs)", "65 of 65 stopped", "A cloud A100"],
      ["Community loop's attacks, within the 65", "29 of 29 stopped, 5 of 5 controls passed", "The server's CPU, with the real guards"],
      ["A2A between two gateways", "22 of 22 checks", "Taipei GPU server and a GCP A100"],
      ["Crash matrix", "20 of 20 checks", "A stand-in model"],
      ["\"I want to play\" in Messenger", "13 of 13 checks", "Muse Glimmer on a cloud A100"],
    ];
    s.addTable(rows, { x: 0.6, y: 3.45, w: 12.1, colW: [4.6, 3.9, 3.6], fontSize: 12, fontFace: FONT, color: INK, rowH: 0.38, border: { type: "solid", pt: 0.75, color: LINE }, margin: [0, 0.1, 0, 0.1], valign: "middle" });
  }

  // 18 · Full technical architecture
  pres.addSection({ title: "Architecture" });
  {
    const s = content("Architecture", "FULL TECHNICAL ARCHITECTURE", "Everything runs on one GPU server I own",
      "完整技術架構（放最後給想深入的評審）：左邊是使用者的入口；中間是 Node.js gateway 上的各個模組；右邊是 Meta 模型實際跑在哪（GPU 1 Muse Glimmer、GPU 0 視覺、CPU 上的小模型），以及外部開放資料。底下是「給人看之前先由程式檢查」與帳本/追蹤。");
    // Left: you
    T(s, "YOU", 0.45, 1.62, 2.2, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    const you = [["Serve app", "React · on your phone", false], ["Messenger", "your agent in your chats", true], ["Health export", "Apple Health, Google Fit, GPX", false], ["Your video", "any ball sport, from a phone", false], ["Facebook · Instagram", "sign in · share your reel", true]];
    you.forEach(([h, d, meta], i) => {
      const y = 1.92 + i * 1.0;
      box(s, 0.45, y, 2.25, 0.86, { fill: meta ? BLUEBG : WHITE, line: meta ? BLUEBG : LINE });
      T(s, h, 0.6, y + 0.1, 2.0, 0.3, { fontSize: 12, bold: true });
      T(s, d, 0.6, y + 0.42, 2.0, 0.4, { fontSize: 10, color: MUTED });
      if (i < 4) arrow(s, 2.72, y + 0.43, 0.3, 0);
      else arrow(s, 2.72, y + 0.43, 0.3, 0, { flipH: true });
    });
    // Middle: gateway
    box(s, 3.08, 1.6, 6.47, 5.35, { fill: WHITE, line: SOFT, dash: "dash" });
    T(s, "SERVE GATEWAY · NODE.JS · STREAMS EACH STEP TO THE APP", 3.28, 1.68, 6.1, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    const mods = [
      ["Planner agent", "tool loop · native tool calling · 12 steps max · rules finish if it stalls"],
      ["Agent to agent", "A2A v1.0 · signed Agent Cards · one round · held times · checkpoints"],
      ["Body context", "your words, games, health app · found by DRAMA · rules cite notes"],
      ["Courts near you", "map, reviews, forecast · 4 judged at once · reasons cited"],
      ["Social feed and members", "Facebook / Instagram login · invites · stories · signed agent channel"],
      ["Highlights", "find you, read your pose, cut you out · orbit effect · caption"],
      ["Community loop", "ideas · DRAMA · votes · spec · coding agent · 9 gates · canary"],
      ["Decision tiers", "code first · Llama 3.2 1B when sure · Muse Glimmer if needed"],
    ];
    mods.forEach(([h, d], i) => {
      const x = 3.28 + (i % 2) * 3.1, y = 2.0 + Math.floor(i / 2) * 0.9;
      box(s, x, y, 2.98, 0.8, { fill: CARD, line: CARD });
      T(s, h, x + 0.14, y + 0.07, 2.7, 0.27, { fontSize: 11.5, bold: true });
      T(s, d, x + 0.14, y + 0.35, 2.75, 0.42, { fontSize: 9.5, color: MUTED });
    });
    box(s, 3.28, 5.62, 6.08, 0.82, { fill: AMBERBG, line: AMBERBG });
    T(s, "Checked by code before anyone sees it", 3.42, 5.68, 5.8, 0.27, { fontSize: 11.5, bold: true, color: AMBER });
    T(s, "Llama Guard 3 in and out · Prompt Guard 2 on reviews and ideas · numbers must be in the facts · JSON Schemas · facts, not prose, between agents · nothing booked without a yes", 3.42, 5.96, 5.85, 0.46, { fontSize: 9.5 });
    T(s, "Token ledger per call site · OpenTelemetry GenAI traces across agents · disclosure budget · tokens on every API call", 3.28, 6.52, 6.1, 0.38, { fontSize: 9.5, color: MUTED });
    // Right: models and data
    arrow(s, 9.57, 2.7, 0.3, 0, { color: GREEN });
    arrow(s, 9.57, 4.15, 0.3, 0, { color: BLUE });
    T(s, "META MODELS ON MY SERVER", 9.92, 1.62, 3.0, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    const right = [
      ["Muse Glimmer", "GPU 1 · RTX 3090 · Ollama · 4 requests in parallel · tools, JSON Schemas, vision", GREENBG, GREEN, 1.0],
      ["Vision · GPU 0", "DETR · Sapiens2 · SAM 2.1 (batched, bf16) · MapAnything", BLUEBG, BLUE, 0.85],
      ["On the CPU", "Llama 3.2 1B student · Llama Guard 3 1B · Prompt Guard 2 86M · DRAMA · Omnilingual ASR", BLUEBG, BLUE, 1.0],
    ];
    let y = 1.92;
    right.forEach(([h, d, fill, c, hh]) => {
      box(s, 9.92, y, 2.95, hh, { fill, line: fill });
      T(s, h, 10.06, y + 0.08, 2.7, 0.27, { fontSize: 11.5, bold: true, color: c });
      T(s, d, 10.06, y + 0.36, 2.72, hh - 0.4, { fontSize: 9.5 });
      y += hh + 0.12;
    });
    T(s, "OPEN DATA", 9.92, y + 0.06, 3.0, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    y += 0.36;
    [["OpenStreetMap", "courts, maps"], ["Open-Meteo", "the forecast"], ["Google Places", "reviews, keyed"]].forEach(([h, d]) => {
      box(s, 9.92, y, 2.95, 0.42, { fill: WHITE });
      T(s, h, 10.06, y, 1.6, 0.42, { fontSize: 11, bold: true, valign: "middle" });
      T(s, d, 11.5, y, 1.25, 0.42, { fontSize: 9.5, color: MUTED, align: "right", valign: "middle" });
      y += 0.5;
    });
    arrow(s, 9.57, 5.95, 0.3, 0);
  }

  // 19 · End
  pres.addSection({ title: "Close" });
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: "Close" });
    s.addImage({ data: IMG.serve, x: 4.55, y: 1.25, w: 1.1, h: 1.1 });
    T(s, "serve", 5.75, 1.2, 3.5, 1.2, { fontSize: 72, bold: true, valign: "middle" });
    T(s, [{ text: "Play more. ", options: { color: INK } }, { text: "Manage less.", options: { color: GREEN } }], 1, 2.75, 11.333, 0.8, { fontSize: 40, bold: true, align: "center" });
    T(s, "The agent that gets you playing, in any ball sport.", 1, 3.6, 11.333, 0.5, { fontSize: 20, color: MUTED, align: "center" });
    pill(s, "Your week, agreed agent to agent", 1.45, 4.45, 3.3, { h: 0.5, size: 13 });
    pill(s, "Your agent in Messenger", 4.9, 4.45, 2.9, { h: 0.5, size: 13 });
    pill(s, "Highlights to Instagram and Facebook", 7.95, 4.45, 3.95, { h: 0.5, size: 13 });
    T(s, "Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026: everything except the TrackNetV5 library", 1, 5.4, 11.333, 0.35, { fontSize: 13, bold: true, align: "center" });
    T(s, "github.com/gino6178/serve-meta-hackathon", 1, 5.78, 11.333, 0.35, { fontSize: 13, color: BLUE, align: "center" });
    s.addImage({ data: IMG.meta, x: 3.2, y: 6.6, w: 0.36, h: 0.36 });
    T(s, "Built on Muse Glimmer, Meta's open-weights model, on hardware you own", 3.66, 6.6, 7, 0.36, { fontSize: 13, color: MUTED, valign: "middle" });
    s.addNotes("片尾：Play more, manage less. 黑客松期間開發聲明（TrackNetV5 除外）、repo 連結、Built on Muse Glimmer。\n旁白：That's Serve. Play more, manage less.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
