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
// (the figures' "Autopilot" is the planner, as the app now calls it)
async function chart(file) {
  const svg = fs.readFileSync(file, "utf8").replace(/an Autopilot week/g, "a planned week").replace(/the Autopilot's/g, "the planner's").replace(/Autopilot/g, "planner");
  const buf = await sharp(Buffer.from(svg), { density: 220 }).flatten({ background: "#ffffff" }).png().toBuffer();
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
    v3: Object.fromEntries(await Promise.all(["join", "social_feed", "social_agent", "social_invite", "body_context", "body_rules", "courts_badges", "agent_chats", "plan_approve", "poster", "live_talk"].map(async (k) => [k, await jpg(path.join(SHOTS, "v3", k + ".png"), 780)]))),
    venue: "image/jpeg;base64," + (await sharp(path.join(SHOTS, "venue_in_the_middle.png")).extract({ left: 823, top: 168, width: 1406, height: 1120 }).jpeg({ quality: 86 }).toBuffer()).toString("base64"), // the map, without the step list
    scale: await chart(path.join(ROOT, "docs/scale.svg")),
    tiers: await chart(path.join(ROOT, "docs/decision_tiers.svg")),
    dot: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#0a7f44"/><circle cx="32" cy="32" r="24" fill="none" stroke="#0a7f44" stroke-opacity=".25" stroke-width="6"/></svg>'),
    heart: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 54 C 8 38, 6 22, 18 14 C 25 10, 30 14, 32 19 C 34 14, 39 10, 46 14 C 58 22, 56 38, 32 54 Z" fill="#d1352b"/></svg>'),
    check: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#0a7f44"/><path d="M19 33 l9 9 l17 -19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    smash: await jpg(path.join(__dirname, "smash_loop.jpg"), 1280),
    faces: await Promise.all(["you", "hana", "ravi", "tomas", "yuki", "aisha", "leo", "noor", "sam", "ines", "kenji", "priya"].map((k) => png(path.join(ROOT, "web/public/agents", k + ".png")))),
    smashDepth: await jpg(path.join(__dirname, "smash/cutout_depth.png"), 1280),
    orbit1: await jpg(path.join(__dirname, "smash/orbit_start.png"), 640),
    orbit2: await jpg(path.join(__dirname, "smash/orbit_mid.png"), 640),
    orbit3: await jpg(path.join(__dirname, "smash/orbit_end.png"), 640),
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
    s.addImage({ data: IMG.serve, x: 0.8, y: 0.75, w: 0.55, h: 0.55 });
    T(s, "serve", 1.45, 0.72, 3, 0.6, { fontSize: 30, bold: true, valign: "middle" });
    T(s, [{ text: "Play more.\n", options: { color: INK } }, { text: "Manage less.", options: { color: GREEN } }], 0.8, 2.0, 5.6, 2.0, { fontSize: 54, bold: true, lineSpacingMultiple: 0.95 });
    T(s, "Your agent sets up your games with your friends' agents, plans around your body, and cuts your highlights. You just say yes.", 0.8, 4.15, 5.2, 1.0, { fontSize: 17, color: MUTED });
    [["Agents agree your week", GREEN], ["Your agent in Messenger", BLUE], ["15 Meta models, 10 on hardware I own", INK]].forEach(([t, c], i) => {
      s.addShape(pres.shapes.OVAL, { x: 0.8, y: 5.45 + i * 0.45, w: 0.14, h: 0.14, fill: { color: c }, line: { color: c } });
      T(s, t, 1.08, 5.35 + i * 0.45, 5, 0.34, { fontSize: 14, bold: true, valign: "middle" });
    });
    T(s, "Not a coach, not a sports analyzer, not a medical tool: a club that organizes itself.", 0.8, 6.85, 5.6, 0.3, { fontSize: 11, color: MUTED });
    phone(s, IMG.v3.social_feed, 6.75, 0.85, 5.6);
    phone(s, IMG.v3.agent_chats, 9.75, 1.35, 5.6);
    s.addNotes("Serve 的封面頁：Play more. Manage less. 右邊是手機上的社群動態和 Agent 對話。\n旁白：So for this hackathon, I built Serve. Not an AI coach. A club where your agent sorts things out with your friends' agents, and only asks you for one yes.");
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
      ["Playing takes organizing", "A time that suits four people, a free court, somewhere everyone can reach. The group chat goes quiet.", "Your agent lines up the week and agrees every game with the other players' agents. You approve once."],
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
      "社群 app（手機畫面）：\n1. Facebook / Instagram 登入已經做好（OAuth 在伺服器上完成，只存帳號 id 的雜湊）；Meta app 還沒核准前，demo 用 demo 帳號，畫面上那行提示是實話，不要遮掉。\n2. 動態最上面是限時動態：會員的 agent 從他自己的影片剪出的精華，經本人同意才發。\n3. 揪團：任何人都能加入；發文者的 agent 在留言裡用程式產生的句子回答「還剩幾個位子」。\n旁白建議：You join with Facebook or Instagram. Stories are highlights your agent cut from your own video, and anyone can join a game.");
    const H = 4.7, y = 1.85;
    phone(s, IMG.v3.join, 0.75, y, H, "Join (a demo account here)");
    phone(s, IMG.v3.social_feed, 3.35, y, H, "Stories cut by members' agents");
    phone(s, IMG.v3.social_invite, 5.95, y, H, "An invite anyone can join");
    const x = 8.75;
    [["Join with Meta", "Facebook and Instagram Login, done on the server; Serve keeps a name, a picture and a hash of the id. Here, a demo account until the club's Meta app is approved."],
      ["Stories by agents", "A member's agent cuts the highlight from their own video and posts it only after their yes."],
      ["Games anyone can join", "Join with a tap. The poster's agent answers in the comments with facts made by code: who is in, spots left."],
      ["Every card says who wrote it", "A person, an agent and whose, and Simulated for the demo club's made-up members."]].forEach(([h, d], i) => {
      T(s, h, x, 1.85 + i * 1.25, 3.95, 0.32, { fontSize: 15, bold: true });
      T(s, d, x, 2.19 + i * 1.25, 3.95, 0.9, { fontSize: 11.5, color: MUTED });
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
    s.addImage({ data: IMG.venue, x: 0.6, y: 1.85, w: 6.1, h: 6.1 * 1120 / 1406 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.85, w: 6.1, h: 6.1 * 1120 / 1406, fill: { type: "none" }, line: { color: LINE, width: 1 } });
    T(s, "The venue in the middle: each player's trip, agreed in one round", 0.6, 6.83, 6.1, 0.25, { fontSize: 10.5, color: MUTED });
    phone(s, IMG.v3.courts_badges, 7.6, 1.85, 4.7, "Courts, judged with their sources");
    const x = 10.25;
    [["Muse Glimmer plans", "One tool at a time; a refused call comes back as a fact"], ["A2A, one round", "Agents mark the times that work; code picks"], ["Prompt Guard 2", "Screens Google reviews before the judge reads them"], ["Nothing booked", "until you say yes"]].forEach(([h, d], i) => {
      T(s, h, x, 1.95 + i * 1.18, 2.5, 0.3, { fontSize: 13.5, bold: true });
      T(s, d, x, 2.27 + i * 1.18, 2.5, 0.8, { fontSize: 11.5, color: MUTED });
    });
  }

  // 8 · AI trust: every message between the agents, in the open
  {
    const s = content("Demo", "AI TRUST", "See exactly what your agent said to theirs",
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

  // 9 · Highlights
  {
    const s = content("Demo", "THURSDAY · FIVE META VISION MODELS", "Your phone clip becomes your moment, on my GPU",
      "Highlight 管線（右邊都是同一記殺球：SAM 2.1 去背、MapAnything 深度、俯視環繞圖和沿弧線算繪出的三格）：DETR 找人 → Sapiens2 讀姿勢、找最快的揮拍 → SAM 2.1 把你切出來 → MapAnything 算深度和相機，時間暫停、鏡頭繞 20° → Muse Glimmer 寫說明，程式核對 → 一鍵分享到 Instagram。影片不離開伺服器。\n旁白：Thursday, game done. I upload a phone clip… With MapAnything, time stops and the camera turns around the smash.");
    const flow = [["DETR", "finds the players"], ["Sapiens2", "reads the pose, finds the fastest swing"], ["SAM 2.1", "cuts you out; SAM 3.1 checked it once"], ["MapAnything", "depth and camera: time stops, the camera turns 20°"], ["Muse Glimmer", "writes the caption, checked by code"]];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 2.45;
      box(s, x, 1.85, 2.2, 1.25, { fill: i === 4 ? GREENBG : BLUEBG, line: i === 4 ? GREENBG : BLUEBG });
      T(s, h, x + 0.18, 1.98, 1.9, 0.35, { fontSize: 15, bold: true, color: i === 4 ? GREEN : BLUE });
      T(s, d, x + 0.18, 2.35, 1.9, 0.7, { fontSize: 11.5 });
      if (i < 4) arrow(s, x + 2.22, 2.47, 0.21, 0);
    });
    // the smash, frozen, the camera swinging round it on a loop (plays in PowerPoint; the PDF shows its first frame)
    s.addMedia({ type: "video", path: path.join(__dirname, "smash_loop.mp4"), cover: IMG.smash, x: 0.6, y: 3.4, w: 5.9, h: 3.32 });
    T(s, "The smash on a loop: the camera swings round it · CC BY 3.0, Badminton klub Ljubljana", 0.6, 6.76, 5.9, 0.25, { fontSize: 10, color: MUTED });
    s.addImage({ data: IMG.smashDepth, x: 6.75, y: 3.4, w: 5.95, h: 1.67 });
    T(s, "SAM 2.1 cuts her out; MapAnything reads depth · SAM 3.1 agrees: box IoU 0.97", 6.75, 5.1, 5.95, 0.25, { fontSize: 10, color: MUTED });
    // the orbit seen from above: her at the centre, the phone where it filmed from, the arc the server chose (drawn at
    // four times its angle so 20 degrees reads), and the three frames rendered along it
    const D = { x: 6.75, y: 5.4, w: 1.75, h: 1.5 }, cx = D.x + 0.875, cy = D.y + 0.5, R = 0.55, K = 4;
    const pt = (deg, r = R) => { const t = (K * deg * Math.PI) / 180; return [cx + r * Math.sin(t), cy + r * Math.cos(t)]; };
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: D.x, y: D.y, w: D.w, h: D.h, rectRadius: 0.12, fill: { color: INK }, line: { color: INK } });
    for (let d = 8; d >= -12; d -= 1) { const [x, y] = pt(d); s.addShape(pres.shapes.OVAL, { x: x - 0.03, y: y - 0.03, w: 0.06, h: 0.06, fill: { color: "5FD39A" }, line: { color: "5FD39A", width: 0 } }); }
    { const [x, y] = pt(0, R + 0.02); s.addShape(pres.shapes.LINE, { x: cx, y: cy, w: 0.001, h: y - cy, line: { color: "8A8A92", width: 0.75, dashType: "dash" } }); }
    s.addShape(pres.shapes.OVAL, { x: cx - 0.07, y: cy - 0.07, w: 0.14, h: 0.14, fill: { color: "FF4FA3" }, line: { color: WHITE, width: 1.25 } });
    T(s, "her", cx + 0.1, cy - 0.09, 0.4, 0.18, { fontSize: 8, color: WHITE });
    [[8, "1"], [-2, "2"], [-12, "3"]].forEach(([d, n]) => { const [x, y] = pt(d); s.addShape(pres.shapes.OVAL, { x: x - 0.09, y: y - 0.09, w: 0.18, h: 0.18, fill: { color: WHITE }, line: { color: WHITE } }); T(s, n, x - 0.09, y - 0.09, 0.18, 0.18, { fontSize: 8, bold: true, align: "center", valign: "middle" }); });
    { const [x, y] = pt(8, R + 0.24); T(s, "+8°", x - 0.2, y - 0.08, 0.5, 0.16, { fontSize: 8, color: WHITE, align: "center" }); }
    { const [x, y] = pt(-12, R + 0.24); T(s, "−12°", x - 0.3, y - 0.08, 0.5, 0.16, { fontSize: 8, color: WHITE, align: "center" }); }
    T(s, "From above", D.x + 0.1, D.y + 0.07, 1.0, 0.18, { fontSize: 8, color: "B0B0B8" });
    [[IMG.orbit1, "1 · +8°"], [IMG.orbit2, "2 · −2°"], [IMG.orbit3, "3 · −12°"]].forEach(([img, l], i) => {
      const x = 8.67 + i * 1.36;
      s.addImage({ data: img, x, y: 5.4, w: 1.31, h: 0.737 });
      T(s, l, x, 6.18, 1.31, 0.22, { fontSize: 10, bold: true, align: "center" });
    });
    T(s, "Three frames rendered along the arc, time stopped", 8.67, 6.45, 4.03, 0.4, { fontSize: 10, color: MUTED });
  }

  // 10 · Saturday: the rematch, a poster made with Muse Image, and every agent's face
  {
    const s = content("Demo", "SATURDAY · MADE WITH MUSE IMAGE", "A poster for the rematch, a face for every agent",
      "對戰海報與 agent 大頭貼（Meta Model API 的 Muse Image，每張 $0.01）：\n海報：Muse Image 只畫背景插畫（兩隻吉祥物在球場對峙，不放文字），名字、時間、賭注由 app 用程式疊上去，所以不會出現亂碼字；每場挑戰只產生一次，存在伺服器上。只有球種和單雙打會進 prompt，名字和留言從不送出。一鍵從手機分享到 Instagram / Facebook。\n大頭貼：demo 社團每位成員的 agent 和你自己的 agent 各一張，只產生一次，出現在社群動態、Agent 對話和首頁。");
    phone(s, IMG.v3.poster, 0.75, 1.85, 4.7, "A rematch poster, shared from the phone");
    const x = 3.6;
    T(s, "The poster", x, 1.9, 4.4, 0.32, { fontSize: 15, bold: true });
    T(s, "Muse Image draws only the art: two of the club's mascots facing off, no words in it. The app writes who, when and the stake on top, so nothing reads wrong. Made once per challenge; only the sport and the format go into the prompt, never a name or a note.", x, 2.25, 4.4, 1.6, { fontSize: 11.5, color: MUTED });
    T(s, "Every agent's face", x, 3.95, 4.4, 0.32, { fontSize: 15, bold: true });
    T(s, "One for each member's agent and one for yours, made once (12 images), so you can tell at a glance whose agent is talking: in the feed, in Agent chats and on the home page.", x, 4.3, 4.4, 1.2, { fontSize: 11.5, color: MUTED });
    pill(s, "Muse Image · $0.01 an image · made once", x, 5.65, 3.6, { size: 11, color: AMBER, fill: AMBERBG, line: AMBERBG });
    IMG.faces.forEach((f, i) => { const col = i % 4, row = Math.floor(i / 4); s.addImage({ data: f, x: 8.45 + col * 1.08, y: 1.95 + row * 1.12, w: 0.95, h: 0.95 }); });
    T(s, "The demo club's agents and yours", 8.45, 5.35, 4.3, 0.28, { fontSize: 10.5, color: MUTED });
  }

  // 11 · Meta stack
  pres.addSection({ title: "Use of Meta AI" });
  {
    const s = content("Use of Meta AI", "USE OF META AI · 25%", "15 Meta models and Meta's apps, each with a job",
      "這頁讓評審一眼看到用了哪些 Meta 的東西：15 個 Meta 模型（10 個開放權重在我自己的伺服器上跑，5 個走 Meta Model API）＋ Messenger、Instagram/Facebook，再加上 Meta 的 Agents Rule of Two 框架。\n說法：Muse Glimmer 是大腦；1B 學生模型分擔簡單決策；兩個 guard 把關進出；DRAMA 是記憶；四個視覺模型做 highlight；Messenger 是入口。");
    const G = { Reasoning: [GREEN, GREENBG], Safety: [RED, REDBG], Memory: [MUTED, CARD], Voice: [MUTED, CARD], Vision: [BLUE, BLUEBG], "3D": [BLUE, BLUEBG], API: [AMBER, AMBERBG], Product: [BLUE, WHITE] };
    const items = [
      ["Reasoning", "Muse Glimmer", "Every agent: the tool loop, members' decisions, photos, courts, captions", "RTX 3090 · Ollama · 4 in parallel"],
      ["Reasoning", "Llama 3.2 1B", "Distilled from Glimmer; answers 54–67% of members' decisions when sure", "CPU · simulated club"],
      ["Safety", "Llama Guard 3 1B", "What you write, what a model writes, every idea shared with the club", "CPU"],
      ["Safety", "Prompt Guard 2", "Google reviews before the court judge reads them; shared ideas", "CPU · 86M"],
      ["Memory", "DRAMA", "Finds what matters for your week by meaning (RAG); groups the club's ideas", "CPU"],
      ["Voice", "Omnilingual ASR", "Voice notes in Messenger to text", "CPU · CTC 1B"],
      ["Vision", "DETR", "Finds the people in your video, so the reel follows you", "GPU"],
      ["Vision", "Sapiens2", "Every player's pose on every frame; finds the moment", "GPU · 0.4B"],
      ["Vision", "SAM 2.1", "Cuts each player out for the spotlight and the drawn view", "GPU · Hiera-L"],
      ["3D", "MapAnything", "Depth and the camera for the orbit camera effect", "GPU · optional effect"],
      ["API", "Muse Spark 1.3", "The fallback when my GPU can't answer; the builder's model for new code (Muse Code's family)", "Meta Model API · tested live"],
      ["API", "SAM 3.1", "Checked on the smash against SAM 2.1: same player, IoU 0.97", "Meta Model API · one call"],
      ["API", "Muse Image", "Rematch poster art; a face for every agent, made once", "Meta Model API · $0.01 an image"],
      ["API", "Muse Wonder", "Judges orbit frames for a doubled net or a smear, beside the pixel rule", "Meta Model API · 84 frames"],
      ["API", "Muse Voice", "Transcribe, realtime: talk with your agent and cut in when you like", "Meta Model API · Transcribe"],
      ["Product", "Meta apps", "Messenger: your agent in your chats; join with Facebook or IG; share reels", "Webhook · Send API · Login"],
    ];
    items.forEach(([cat, name, job, where], i) => {
      const col = i % 6, row = Math.floor(i / 6);
      const x = 0.6 + col * 2.03, y = 1.8 + row * 1.6, w = 1.93, h = 1.48;
      const [fg, bg] = G[cat];
      box(s, x, y, w, h, { fill: bg === WHITE ? WHITE : bg, line: bg === WHITE ? LINE : bg });
      T(s, cat === "API" ? "META MODEL API" : cat.toUpperCase(), x + 0.14, y + 0.13, 1.7, 0.25, { fontSize: 8.5, bold: true, color: fg, charSpacing: 1 });
      if (cat === "Product") s.addImage({ data: name === "Meta apps" ? IMG.messenger : IMG.instagram, x: x + w - 0.45, y: y + 0.12, w: 0.28, h: 0.28 });
      T(s, name, x + 0.14, y + 0.38, w - (cat === "Product" ? 0.5 : 0.24), 0.3, { fontSize: 12.5, bold: true });
      T(s, job, x + 0.14, y + 0.68, w - 0.24, 0.52, { fontSize: 8.5, color: INK });
      T(s, where, x + 0.14, y + 1.2, w - 0.22, 0.22, { fontSize: 8, color: MUTED });
    });
    s.addImage({ data: IMG.meta, x: 0.6, y: 6.66, w: 0.3, h: 0.3 });
    T(s, "Ten open-weights models on hardware I own; five on the Meta Model API. Every agent follows Meta's Agents Rule of Two.", 1.0, 6.66, 11.5, 0.3, { fontSize: 12, bold: true, valign: "middle" });
  }

  // 12 · Agents
  {
    const s = content("Use of Meta AI", "AN AGENT, NOT A CHATBOT", "Glimmer plans, agents agree, code decides",
      "規劃 agent：Muse Glimmer 用原生 tool calling 一步一步叫工具，被拒絕的呼叫會變成事實回來，它重新規劃。A2A：每個會員一個 agent、簽章的 Agent Card、一輪就談完、談好的時間先鎖 30 分鐘、每輪存檔可續跑。兩台機器（台北的 GPU 伺服器 + GCP A100）跨網路 22/22 項檢查通過。\n旁白：Then it plans my week… Then it negotiates with three friends' agents at once, over A2A.");
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

  // 13 · Your agent is a member too: the signed agent channel
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

  // 14 · Talk to your agent, both ways at once
  {
    const s = content("Use of Meta AI", "ON THE COURT · HANDS-FREE VOICE", "Sweaty hands after a game? Just ask, and cut in",
      "全雙工語音代理：手機麥克風串流到你的伺服器，伺服器轉接到 Meta 的 Muse Voice Transcribe（即時、ENDPOINTING 模式，自動判斷你講完了，支援中英夾雜），key 只放在伺服器。你講完一句就交給 agent（Muse Glimmer，跟打字問一樣過 Llama Guard、數字核對），回答一句一句用 Kokoro 念出來。你一開口它就停下來聽，還沒念的回答直接丟掉。\n實測一次（voice_live.json）：1.2 秒接通，2.0 秒開始說話，3.6 秒轉寫完成，12.3 秒回答文字出來（本地 Glimmer + 守門）；之後改成一句一句念，第一句不用等整段。");
    phone(s, IMG.v3.live_talk, 0.75, 1.85, 4.7, "Talk, on the agent home");
    const node = (x, y, w, h, k, t, d, fill, c) => { box(s, x, y, w, h, { fill, line: fill }); T(s, k, x + 0.15, y + 0.1, w - 0.3, 0.22, { fontSize: 9.5, bold: true, color: c, charSpacing: 1 }); T(s, t, x + 0.15, y + 0.34, w - 0.3, 0.32, { fontSize: 13, bold: true }); T(s, d, x + 0.15, y + 0.68, w - 0.3, h - 0.72, { fontSize: 10, color: MUTED }); };
    node(3.6, 1.85, 2.2, 1.35, "HEAR", "Muse Voice Transcribe", "Realtime; finds where your turn ends; 25 languages, code-switching", AMBERBG, AMBER);
    arrow(s, 5.82, 2.52, 0.28, 0);
    node(6.12, 1.85, 2.2, 1.35, "THINK", "Your agent", "Muse Glimmer on your GPU; Llama Guard in and out; numbers checked", GREENBG, GREEN);
    arrow(s, 8.34, 2.52, 0.28, 0);
    node(8.64, 1.85, 2.2, 1.35, "SPEAK", "Kokoro, on the server", "A sentence at a time: the first is heard while the rest is made", BLUEBG, BLUE);
    box(s, 3.6, 3.45, 7.24, 1.05, { fill: REDBG, line: REDBG });
    T(s, "Barge-in", 3.8, 3.55, 2, 0.3, { fontSize: 13.5, bold: true, color: RED });
    T(s, "Start speaking while it talks: the transcriber says so, the app stops the voice at once, and a reply still on its way is dropped.", 3.8, 3.88, 6.9, 0.55, { fontSize: 11, color: INK });
    T(s, "ONE LIVE SESSION, IN SECONDS", 3.6, 4.75, 5, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    [["1.2", "line open"], ["2.0", "you start"], ["3.6", "turn heard"], ["12.3", "reply ready"]].forEach(([n, d], i) => {
      const x = 3.6 + i * 1.83;
      box(s, x, 5.05, 1.7, 1.0, { fill: CARD, line: CARD });
      T(s, n, x + 0.15, 5.1, 1.4, 0.5, { fontSize: 22, bold: true, color: i === 2 ? GREEN : INK });
      T(s, d, x + 0.15, 5.62, 1.4, 0.35, { fontSize: 10.5, color: MUTED });
    });
    T(s, "\"When is my next game?\" heard word by word; the reply came from the facts. submission/results/voice_live.json", 3.6, 6.2, 7.3, 0.5, { fontSize: 10, color: SOFT });
  }

  pres.addSection({ title: "Technical depth" });
  // 15 · A federation of clubs: found by their cards, keys that can be rotated
  {
    const s = content("Technical depth", "INTER-CLUB CHALLENGES · FEDERATED A2A", "Challenge the club next door, nothing merged",
      "去中心化的跨社團聯邦：設定檔只寫其他社團的網址。每個社團公開一張名片（/a2a/club.json：名稱、可被邀約的成員公開資料、金鑰位置），gateway 讀名片後就把對方當成 peer，第一次連線釘選對方金鑰。\n換鑰匙：舊鑰匙簽一張交接聲明跟新金鑰一起公開；對方發現釘選的鑰匙不見了，就從釘選的那把沿著聲明鏈驗證，驗過才改釘新的，偽造的聲明一律拒絕。\n測試（test/federation_unit.mjs，真的 HTTP）：三個社團互相發現、互相簽章驗證；B 連續換兩次鑰匙，A 沿兩張聲明跟上；C 用別人簽的假聲明，被拒絕、釘選不變；不是名片的網頁不採用。兩台機器之間的完整約球談判之前已測過 22/22。");
    const cx = [1.6, 4.3, 2.95], cy = [2.3, 2.3, 4.6], nm = ["Club A", "Club B", "Club C"], col = [GREEN, BLUE, AMBER];
    [[0, 1], [0, 2], [1, 2]].forEach(([a, b]) => s.addShape(pres.shapes.LINE, { x: Math.min(cx[a], cx[b]) + 0.6, y: Math.min(cy[a], cy[b]) + 0.5, w: Math.abs(cx[a] - cx[b]) || 0.001, h: Math.abs(cy[a] - cy[b]) || 0.001, flipH: cx[a] > cx[b] !== cy[a] > cy[b], line: { color: LINE, width: 2, dashType: "dash" } }));
    cx.forEach((x, i) => {
      s.addShape(pres.shapes.OVAL, { x, y: cy[i], w: 1.2, h: 1.0, fill: { color: WHITE }, line: { color: col[i], width: 2.5 } });
      T(s, nm[i], x, cy[i] + 0.22, 1.2, 0.3, { fontSize: 12.5, bold: true, align: "center" });
      T(s, "card · key", x, cy[i] + 0.52, 1.2, 0.25, { fontSize: 9, color: MUTED, align: "center" });
    });
    T(s, "Bored of the same faces? Your club's agents can ask the university club's. Each club keeps its own server; the config holds only addresses, and names, members and keys come from each club's card", 0.6, 6.1, 5.4, 0.6, { fontSize: 11, color: MUTED });
    const x = 6.3;
    [["1", "Found by its card", "/a2a/club.json: the club's name, the members others may ask (a public profile each), where its keys are."],
      ["2", "Pinned on first use", "Every request between clubs is signed; the key is pinned the first time, as between our two gateways."],
      ["3", "Keys can change", "The old key signs a hand-over to the new one. A club whose pin is gone follows the chain from its pin, and re-pins only if it holds."],
      ["4", "Forgeries refused", "A hand-over signed by any other key, or a page that isn't a card, is refused and logged."]].forEach(([n, h, d], i) => {
      const y = 1.85 + i * 1.05;
      s.addShape(pres.shapes.OVAL, { x, y: y + 0.03, w: 0.4, h: 0.4, fill: { color: BLUE }, line: { color: BLUE } });
      T(s, n, x, y + 0.03, 0.4, 0.4, { fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, x + 0.58, y, 5.8, 0.3, { fontSize: 14, bold: true });
      T(s, d, x + 0.58, y + 0.33, 5.8, 0.65, { fontSize: 11, color: MUTED });
    });
    box(s, 6.3, 6.05, 6.4, 0.75, { fill: GREENBG, line: GREENBG });
    T(s, "Tested over HTTP with three clubs: found, signed, a rotation followed two hand-overs deep, a forged one refused (test/federation_unit.mjs)", 6.5, 6.05, 6.1, 0.75, { fontSize: 11, bold: true, valign: "middle" });
  }

  // 16 · The Glimmer bottleneck, and the student fine-tuned from it
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · FINE-TUNING", "Muse Glimmer reasons a lot, so I trained a 1B student",
      "痛點與解法同一頁：\n左：記錄了 2,755 次 Muse Glimmer 呼叫，84% 的 token 是推理；關掉 thinking 它還是在隱藏通道推理，預算不夠時 9% 回空白。所以每次呼叫用 think: low 並留推理空間。\n右：把最常見的判斷（會員選哪個時段）交給微調出來的 Llama 3.2 1B（Jev 式決策模型）：用真正的 agent 呼叫讓 Glimmer 標註 4,868 題，LoRA 微調，不生成文字、直接對選項給機率，int4 在 CPU 上約 0.9 秒。留出會員上和 Glimmer 一致 89.5%（Glimmer 跟自己 88.8%），在模擬社團少用 54–67% 的 Glimmer 呼叫。");
    T(s, "WHAT THE LEDGER SHOWED", 0.6, 1.8, 4.2, 0.25, { fontSize: 10.5, bold: true, color: RED, charSpacing: 1 });
    [["2,755", "Muse Glimmer calls logged", INK], ["84%", "of its tokens were reasoning", RED], ["9%", "came back empty: thinking off, it still reasoned in a hidden channel", RED]].forEach(([n, d, c], i) => {
      const y = 2.15 + i * 0.98;
      box(s, 0.6, y, 4.2, 0.86, { fill: WHITE });
      T(s, n, 0.8, y, 1.6, 0.86, { fontSize: 28, bold: true, color: c, valign: "middle" });
      T(s, d, 2.35, y, 2.35, 0.86, { fontSize: 11, valign: "middle" });
    });
    box(s, 0.6, 5.15, 4.2, 1.6, { fill: CARD, line: CARD });
    T(s, [{ text: "So every call asks for think: \"low\" and leaves room to reason. ", options: { bold: true } }, { text: "And the most common choice, which time a member's agent picks, goes to a student that writes nothing.", options: {} }], 0.8, 5.28, 3.85, 1.4, { fontSize: 12 });
    arrow(s, 4.9, 3.6, 0.3, 0, { color: GREEN, width: 2.5 });
    T(s, "THE STUDENT · META'S LLAMA 3.2 1B, FINE-TUNED", 5.35, 1.8, 7.3, 0.25, { fontSize: 10.5, bold: true, color: GREEN, charSpacing: 1 });
    [["Teacher data", "4,868 choices Muse Glimmer made through the real agent call, on a cloud A100"], ["LoRA", "Rank 16 on every projection, 3 epochs: 20 min for the 1B"], ["A decision head", "One pass: a probability per option, and its own yes or no for every time"], ["int4 on the CPU", "0.8 GB, about 0.9 s a decision, 0 tokens written"]].forEach(([h, d], i) => {
      const x = 5.35 + (i % 2) * 3.7, y = 2.15 + Math.floor(i / 2) * 0.98;
      box(s, x, y, 3.58, 0.86, { fill: GREENBG, line: GREENBG });
      T(s, h, x + 0.15, y + 0.07, 3.3, 0.28, { fontSize: 12.5, bold: true });
      T(s, d, x + 0.15, y + 0.36, 3.35, 0.48, { fontSize: 10, color: MUTED });
    });
    s.addChart(pres.charts.BAR, [{ name: "Agrees with Glimmer's answer", labels: ["Glimmer with itself", "First time listed", "1B student (served)"], values: [88.8, 82.7, 89.5] }], {
      x: 5.3, y: 4.2, w: 4.6, h: 2.6, barDir: "bar", chartColors: [SOFT, LINE, GREEN], barGapWidthPct: 45,
      showTitle: true, title: "Agrees with Glimmer, 500 held-out cases", titleFontSize: 11, titleColor: INK, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt", dataLabelColor: INK,
      catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: INK, catAxisOrientation: "maxMin",
      valAxisHidden: true, valAxisMinVal: 60, valAxisMaxVal: 100, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    });
    [["54–67%", "fewer Glimmer calls, no rule broken", GREEN], ["29 / 32", "stated preferences kept (Glimmer 27)", INK]].forEach(([n, d, c], i) => {
      const y = 4.3 + i * 1.25;
      box(s, 10.1, y, 2.6, 1.12, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, 10.25, y + 0.06, 2.35, 0.5, { fontSize: 22, bold: true, color: c });
      T(s, d, 10.25, y + 0.58, 2.35, 0.5, { fontSize: 10, color: MUTED });
    });
  }

  // 17 · The student and Muse Glimmer: when the small model isn't enough, the big one answers
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · THE CASCADE", "When the student isn't sure, Muse Glimmer answers",
      "Jev 學生模型和 Muse Glimmer 的交接（agent/src/agents/student.js、a2a.js fullAnswer）：\n1. 先由程式處理事實能決定的：行事曆、硬規則；只剩一個可行時段就直接回答，不叫任何模型。\n2. 真正需要判斷時，先問 Llama 3.2 1B 學生模型。它只有在三個條件都成立時才回答：選項機率 ≥ 0.6；它自己對「哪些時段可行」的判讀和程式算的一致；worker 有空且夠快（排隊超過 8 秒或超過 20 秒就放棄）。\n3. 任何一個不成立，就交給 Muse Glimmer 完整推理。\n4. 不管誰回答，程式都再檢查一次硬規則，結果才透過 A2A 送出，並標示是哪一層回答的（Agent 對話頁上看得到）。\n右圖：門檻越高，學生回答得越少、整體越準；我們選 0.6：在最難的 196 題裡學生回答 73%，其餘交給 Glimmer。");
    // the flow, left to right
    const node = (x, y, w, h, title, sub, fill, line, c = INK) => { box(s, x, y, w, h, { fill, line, lw: line === GREEN || line === BLUE ? 2 : 1 }); T(s, title, x + 0.16, y + 0.12, w - 0.3, 0.3, { fontSize: 13.5, bold: true, color: c }); T(s, sub, x + 0.16, y + 0.44, w - 0.3, h - 0.5, { fontSize: 10.5, color: MUTED }); };
    node(0.6, 1.95, 2.0, 1.25, "Code first", "Calendars and hard rules; one time left: answered, no model", WHITE, LINE);
    arrow(s, 2.62, 2.57, 0.3, 0);
    node(2.95, 1.95, 2.25, 1.25, "Llama 3.2 1B student", "int4 on the CPU, about 0.9 s, no text written", GREENBG, GREEN, GREEN);
    arrow(s, 5.22, 2.57, 0.3, 0);
    box(s, 5.55, 1.75, 2.45, 1.65, { fill: AMBERBG, line: AMBERBG });
    T(s, "Answers only if", 5.71, 1.85, 2.2, 0.3, { fontSize: 13, bold: true, color: AMBER });
    T(s, [{ text: "sure: 0.6 or more", options: { bullet: { indent: 12 }, breakLine: true } }, { text: "its reading of which times work matches code's", options: { bullet: { indent: 12 }, breakLine: true } }, { text: "up, and answering within 8 to 20 s", options: { bullet: { indent: 12 } } }], 5.71, 2.17, 2.2, 1.2, { fontSize: 10.5 });
    // yes: the student's answer; no: Glimmer
    arrow(s, 6.77, 3.42, 0, 0.45, { color: GREEN });
    T(s, "yes", 6.85, 3.47, 0.5, 0.3, { fontSize: 10.5, bold: true, color: GREEN });
    node(5.55, 3.9, 2.45, 1.05, "The student answers", "a Muse Glimmer call saved", GREENBG, GREENBG, GREEN);
    arrow(s, 3.57, 2.95, 1.96, 0.93, { color: BLUE, flipH: true });
    T(s, "no", 4.05, 3.3, 0.5, 0.3, { fontSize: 10.5, bold: true, color: BLUE });
    node(2.1, 3.9, 2.95, 1.05, "Muse Glimmer reasons", "the full answer, about 450 tokens, 24 to 40 s", BLUEBG, BLUE, BLUE);
    // both: checked by code, then over A2A
    arrow(s, 3.57, 4.97, 0, 0.35); arrow(s, 6.77, 4.97, 0, 0.35);
    box(s, 0.6, 5.35, 7.4, 1.4, { fill: CARD, line: CARD });
    T(s, "Checked by code, then sent over A2A", 0.8, 5.47, 7.0, 0.3, { fontSize: 13.5, bold: true });
    T(s, "Whoever answered, code checks the member's hard rules again before the decision goes to the other agent, labelled with the tier that made it. Agent chats shows it under every message.", 0.8, 5.8, 7.0, 0.9, { fontSize: 11, color: MUTED });
    // the threshold: how much the student answers, and how the cascade agrees
    const th = ["0", "0.5", "0.6", "0.7", "0.8", "0.9"];
    s.addChart(pres.charts.LINE, [
      { name: "Answered by the student", labels: th, values: [100, 96.9, 73.0, 50.0, 34.2, 27.6] },
      { name: "Cascade agrees with Glimmer", labels: th, values: [60.7, 61.2, 68.4, 75.5, 75.0, 75.5] },
    ], {
      x: 8.3, y: 1.75, w: 4.45, h: 3.6, chartColors: [GREEN, BLUE], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
      showTitle: true, title: "The hardest 196 cases, by threshold", titleFontSize: 12, titleColor: INK, titleFontFace: "+mn-lt",
      showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt", legendColor: INK,
      catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: MUTED, catAxisTitle: "Sure at", showCatAxisTitle: true, catAxisTitleFontSize: 10, catAxisTitleColor: MUTED,
      valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt", valAxisLabelColor: MUTED, valAxisLabelFormatCode: "0\"%\"",
      valGridLine: { color: LINE, size: 0.5 }, catGridLine: { style: "none" },
    });
    box(s, 8.3, 5.5, 4.45, 1.25, { fill: GREENBG, line: GREENBG });
    T(s, "Served at 0.6", 8.5, 5.6, 4.1, 0.3, { fontSize: 13.5, bold: true, color: GREEN });
    T(s, "The student answers 73% of the hardest choices and 96% of the test set; Glimmer takes the rest. Glimmer alone agrees with itself 73.5% on these.", 8.5, 5.92, 4.1, 0.8, { fontSize: 10.5, color: MUTED });
  }

  // 18 · RAG: retrieval by meaning with Meta's DRAMA, grounded and checked
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · RAG", "Found by meaning with Meta's DRAMA, checked by code",
      "RAG（agent/src/memory/memory.js、body/context.js）：\n寫入：筆記只來自玩家自己的話和程式產生的事實（比賽、健康 app），其他 agent 寫的東西永遠不會變成筆記（防記憶注入）。新的一句話會跟舊筆記比對：新增、取代、或重複（類似 Mem0）。被取代的筆記保留但不再被檢索。\n檢索：Meta 的 DRAMA（drama-base，768 維）在伺服器 CPU 上把問題和筆記變成向量，用餘弦相似度乘上時間衰減排序（身體筆記 7 天減半），取前幾名。\n生成與接地：Muse Glimmer 拿這些筆記規劃這週；規則由程式從紀錄產生，每條附上來源筆記，程式檢查引用的是同一個部位。\n數字：20 題規劃問題中 DRAMA 第一名就對 12 題（Recall@1 0.60，BM25 0.35）；有更新機制時過期筆記 0 筆還被當真（只追加是 15 筆）、規則正確 90.5%（52.4%）；玩家兩週前說先不要約 Tomás，有記憶時 3/3 都排除他，沒記憶 0/3。");
    const stage = (i, k, h, d, fill, c) => {
      const x = 0.6 + i * 1.53;
      box(s, x, 1.85, 1.42, 2.25, { fill, line: fill });
      T(s, k, x + 0.12, 1.95, 1.2, 0.22, { fontSize: 9.5, bold: true, color: c, charSpacing: 1 });
      T(s, h, x + 0.12, 2.2, 1.2, 0.62, { fontSize: 12.5, bold: true });
      T(s, d, x + 0.12, 2.85, 1.22, 1.2, { fontSize: 9.5, color: MUTED });
      if (i < 3) arrow(s, x + 1.43, 2.97, 0.09, 0);
    };
    stage(0, "1 · NOTES", "Your words and the facts", "Messenger, voice, the app; games and health app. Nothing another agent wrote.", CARD, MUTED);
    stage(1, "2 · EMBED", "Meta's DRAMA", "drama-base, all 768 dimensions, on the server's CPU", BLUEBG, BLUE);
    stage(2, "3 · RETRIEVE", "Meaning × age", "Cosine similarity, faded by age (a body note halves in a week); the top notes", BLUEBG, BLUE);
    stage(3, "4 · GROUND", "Plan, with citations", "Muse Glimmer plans from them; code's rules cite their notes, checked", GREENBG, GREEN);
    box(s, 0.6, 4.3, 6.0, 1.15, { fill: AMBERBG, line: AMBERBG });
    T(s, "Notes that change", 0.8, 4.4, 5.6, 0.3, { fontSize: 13, bold: true, color: AMBER });
    T(s, "A new note is checked against the old ones it may change: added, replacing them, or the same. A replaced note is kept but never recalled, so \"leave Tomás out\" gives way to \"Tomás is fine again\".", 0.8, 4.72, 5.6, 0.7, { fontSize: 10.5 });
    box(s, 0.6, 5.6, 6.0, 1.15, { fill: CARD, line: CARD });
    T(s, "End to end", 0.8, 5.7, 5.6, 0.3, { fontSize: 13, bold: true });
    T(s, "Two weeks after the player said to leave Tomás out, the planner left him out in 3 of 3 weeks with memory on, and in 0 of 3 with it off.", 0.8, 6.02, 5.6, 0.7, { fontSize: 10.5, color: MUTED });
    s.addChart(pres.charts.BAR, [
      { name: "Meta's DRAMA", labels: ["Recall@1", "Recall@3", "MRR"], values: [0.60, 0.75, 0.696] },
      { name: "BM25 (words)", labels: ["Recall@1", "Recall@3", "MRR"], values: [0.35, 0.45, 0.422] },
    ], {
      x: 6.9, y: 1.75, w: 5.85, h: 3.0, barDir: "col", barGrouping: "clustered", chartColors: [BLUE, LINE], barGapWidthPct: 60,
      showTitle: true, title: "Finding the right note: 20 planning questions, 41 notes each", titleFontSize: 12, titleColor: INK, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt", dataLabelColor: INK,
      catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: INK, valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 1,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt", legendColor: INK,
    });
    [["0 vs 15", "out-of-date notes still taken as true, with updates against append-only", GREEN], ["90.5%", "of the rules notes ask for kept right (append-only: 52.4%)", INK]].forEach(([n, d, c], i) => {
      const x = 6.9 + i * 2.98;
      box(s, x, 5.0, 2.87, 1.75, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, x + 0.2, 5.12, 2.5, 0.6, { fontSize: 26, bold: true, color: c });
      T(s, d, x + 0.2, 5.75, 2.5, 0.9, { fontSize: 10.5, color: MUTED });
    });
  }

  // 19 · Seven more pieces, each measured
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · MEASURED THIS WEEK", "Seven more pieces, each one measured",
      "這週加的七件事，每一件都有量測：\n1 私密行事曆貫穿 Match 和規劃：其他成員的空檔只能問「這個時間有空嗎」，每天最多問 24 次。\n2 學出來的意圖路由：正規表示式找到 6/10 約球請求，加上路由 10/10，22 則其他訊息誤報 1 則。\n3 Muse Spark（Muse Code 用的同一系列）蓋 C3 新功能：修正我們自己的 oracle 後第一次就過。\n4 商用授權的記憶 embedder：Granite（Apache 2.0）前三名召回 0.80。\n5 Orbit 視覺裁判：Muse Wonder 看 84 張標註畫面，會說出它看到的瑕疵。\n6 網球籃球的球：WASB 接進 highlight 管線，籃球抽查 12/12 都在球上。\n7 GPU 套件在 A100 上跑過閘門：攻擊 93/93、e2e 58/58、crash matrix 201/201。");
    const rows = [
      ["Private calendars, everywhere", "Match, the planner and the search ask each member's agent 'free then?'; a yes or a no, 24 asks a day", "4 tests: a calendar read by anyone but its agent throws", GREEN],
      ["A learned intent router", "DRAMA vectors and a small head, behind the regular expressions", "Game requests found: 6 of 10 by the expressions alone, 10 of 10 with the router added", GREEN],
      ["New code, built by Muse Spark", "A C3 spec: a new module and a field in the planner (Muse Code's model family)", "Built on the first attempt: Spark 202k tokens, 1.4 min; Glimmer 111k, 1.6 min", GREEN],
      ["An embedder for commercial use", "IBM Granite (Apache 2.0) in place of DRAMA (non-commercial)", "Recall@3 0.80 (DRAMA 0.75): the memory is free for commercial use", BLUE],
      ["A vision judge for orbits", "Muse Wonder looks at each rendered orbit frame, beside the pixel rule", "84 labelled frames judged; it names the defect it rejects: 'a doubled net outline, a blurred band'", AMBER],
      ["The ball in tennis and basketball", "WASB's tennis and basketball trackers, wired into the highlight pipeline", "Basketball: every checked mark was on the ball (12 of 12); about 15 s a 20 s clip on the GPU", BLUE],
      ["The GPU suites, through the gates", "One flag change, Muse Glimmer on a cloud A100", "Attacks 93 of 93, end to end 58 of 58, 201 crash-matrix assertions, oracle passed", GREEN],
    ];
    rows.forEach(([h, what, res, c], i) => {
      const y = 1.78 + i * 0.7;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.12, w: 0.38, h: 0.38, fill: { color: c }, line: { color: c } });
      T(s, String(i + 1), 0.6, y + 0.12, 0.38, 0.38, { fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, 1.15, y + 0.04, 3.6, 0.3, { fontSize: 13.5, bold: true });
      T(s, what, 1.15, y + 0.34, 4.6, 0.32, { fontSize: 9.5, color: MUTED });
      box(s, 6.0, y + 0.02, 6.7, 0.58, { fill: CARD, line: CARD });
      T(s, res, 6.18, y + 0.02, 6.4, 0.58, { fontSize: 11, valign: "middle" });
    });
  }

  // 19 · Measured at scale: what one model call reads as the club grows
  {
    const s = content("Technical depth", "MEASURED", "It stays the same size as the club grows",
      "規模化：把整個社團塞進 prompt，token 隨人數線性成長，401 人以上就放不進 16K 的 context；Serve 先用程式篩出候選人，一週規劃平均每次呼叫約 1,505 → 1,563 token（11 人到 301 人），幾乎不變。");
    s.addImage({ data: IMG.scale, x: 0.6, y: 1.8, w: 8.0, h: 8.0 * 400 / 760 });
    T(s, "Tokens one model call reads to choose players, by club size", 0.6, 1.9 + 8.0 * 400 / 760, 8.0, 0.3, { fontSize: 11, color: MUTED });
    [["1,505 → 1,563", "tokens per call from 11 to 301 members: Serve's shortlist, made by code", GREEN], ["58,203", "tokens, estimated, for a 1,001-member club in the prompt: far past the window", RED], ["16,384", "the context the model has on this server", INK]].forEach(([n, d, c], i) => {
      const y = 1.9 + i * 1.6;
      box(s, 8.95, y, 3.75, 1.45, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, 9.15, y + 0.1, 3.4, 0.55, { fontSize: 24, bold: true, color: c });
      T(s, d, 9.15, y + 0.68, 3.4, 0.7, { fontSize: 10.5, color: MUTED });
    });
  }

  // 20 · Safe by design
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
    T(s, "Meta's Agents Rule of Two, on every agent: the planner, members' agents, the photo reader and the community loop.", 0.6, 6.25, 5.4, 0.6, { fontSize: 12, color: MUTED });

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
    T(s, "93 / 93", 6.95, 5.55, 1.9, 1.25, { fontSize: 30, bold: true, color: GREEN, valign: "middle" });
    T(s, "attacks stopped: injected instructions, poisoned reviews, forged Agent Cards, sock-puppet votes, diffs that book without a yes", 8.85, 5.55, 3.7, 1.25, { fontSize: 11.5, valign: "middle" });
  }

  // 21 · Community loop, with what happened in the simulated club
  {
    const s = content("Technical depth", "SELF-EVOLVING", "The club makes itself better, safely",
      "自我演化的社團：會員在 Messenger 打 /idea 或按讚 → DRAMA 依語意分群，5 人提到才出現 → 二次方投票 → Muse Glimmer 寫規格、人工核准 → coding agent 在自己的分支上實作（從不讀社群文字）→ 九道關卡，第一個失敗就停 → 小規模上線，倒讚變多就自己關掉。\n真實案例（模擬社團 seed 7，管線、關卡、回滾是真的；technical report 5.6）：會員說「晚點再問我」→ 規格 C0：ask.hour 12 → 18，上線給 31 位 beta 會員中的 5 位，倒讚 29% → 23%，升級。故意植入的壞改動 ask.ahead 3 → 2 給 8 人的 canary：倒讚 40% → 60%，自動回滾。\n旁白：And the club evolves itself…");
    pill(s, "Simulated club (seed 7) · the pipeline, gates and rollback are real", 7.0, 0.42, 5.7, { size: 10.5, color: MUTED });
    const steps = [
      ["1 · ASK", "Members' ideas", "\"/idea\" in Messenger, or thumbs"],
      ["2 · GROUP", "Meta's DRAMA", "By meaning; shows at 5 members"],
      ["3 · VOTE", "Quadratic votes", "9 credits a month; n votes cost n²"],
      ["4 · SPEC", "Muse Glimmer drafts", "A person approves it"],
      ["5 · BUILD", "A coding agent", "Own branch; never reads community text"],
    ];
    steps.forEach(([k, h, d], i) => {
      const x = 0.6 + i * 2.45;
      box(s, x, 1.75, 2.25, 1.3, { fill: WHITE });
      T(s, k, x + 0.16, 1.85, 1.95, 0.22, { fontSize: 10, bold: true, color: GREEN });
      T(s, h, x + 0.16, 2.1, 1.98, 0.32, { fontSize: 13.5, bold: true });
      T(s, d, x + 0.16, 2.45, 1.98, 0.55, { fontSize: 10, color: MUTED });
      if (i < 4) arrow(s, x + 2.27, 2.4, 0.16, 0);
    });
    box(s, 0.6, 3.2, 7.6, 1.5, { fill: GREENBG, line: GREENBG });
    T(s, "6 · NINE GATES · stops at the first failure", 0.82, 3.3, 7, 0.28, { fontSize: 12, bold: true, color: GREEN });
    ["policy", "code scan", "unit tests", "crash matrix", "red team", "Messenger end to end", "planner pass^3", "oracle", "privacy canary"].forEach((g, i) => {
      const per = 5, x = 0.82 + (i % per) * 1.47, y = 3.7 + Math.floor(i / per) * 0.44;
      pill(s, g, x, y, 1.42, { size: 9.5, color: GREEN, line: WHITE, h: 0.34 });
    });
    arrow(s, 8.25, 3.95, 0.3, 0);
    box(s, 8.6, 3.2, 4.1, 1.5, { fill: WHITE, line: RED, lw: 2 });
    T(s, "7 · SHIP, OR ROLL BACK", 8.8, 3.3, 3.7, 0.28, { fontSize: 12, bold: true, color: RED });
    T(s, "A small canary that turns itself off if thumbs down rise. Anything beyond a safe setting waits for a person.", 8.8, 3.65, 3.75, 1.0, { fontSize: 11, color: MUTED });
    // what happened in the simulated club
    box(s, 0.6, 4.85, 5.95, 1.3, { fill: GREENBG, line: GREENBG });
    T(s, "SHIPPED", 0.8, 4.95, 2, 0.22, { fontSize: 10, bold: true, color: GREEN, charSpacing: 1 });
    T(s, "\"Ask me later\" → ask.hour 12 → 18", 0.8, 5.2, 5.6, 0.32, { fontSize: 14, bold: true });
    T(s, "Approved as a safe setting, shipped to 5 of 31 beta members: thumbs down 29% → 23% over 7 days, promoted.", 0.8, 5.55, 5.6, 0.55, { fontSize: 10.5, color: MUTED });
    box(s, 6.75, 4.85, 5.95, 1.3, { fill: REDBG, line: REDBG });
    T(s, "ROLLED BACK BY ITSELF", 6.95, 4.95, 3, 0.22, { fontSize: 10, bold: true, color: RED, charSpacing: 1 });
    T(s, "A planted bad change: ask.ahead 3 → 2", 6.95, 5.2, 5.6, 0.32, { fontSize: 14, bold: true });
    T(s, "Sent to a canary of 8: thumbs down on it went from 40% to 60%, and the monitor turned it off with no one asked.", 6.95, 5.55, 5.6, 0.55, { fontSize: 10.5, color: MUTED });
    box(s, 0.6, 6.3, 12.1, 0.55, { fill: INK, line: INK });
    T(s, "NEVER-LIST", 0.85, 6.3, 1.6, 0.55, { fontSize: 11, bold: true, color: WHITE, valign: "middle" });
    T(s, "Booking without a yes · data off the server · a diagnosis or a dose · the guards · the tests · A2A · deployment", 2.45, 6.3, 10.1, 0.55, { fontSize: 12, color: WHITE, valign: "middle" });
  }

  // 22 · Proof
  {
    const s = content("Technical depth", "MEASURED", "Every number names the file it comes from",
      "證據頁：每個數字都有 log。e2e、攻擊測試在雲端 A100 上用同一個 Muse Glimmer（同一個 model digest）跑。可以快速帶過，或只在影片片尾字卡出現。");
    [["93/93", "attacks stopped"], ["58/58", "Messenger end-to-end checks"], ["22/22", "A2A checks across two machines"], ["20/20", "crash checks, stand-in model"]].forEach(([n, d], i) => {
      const x = 0.6 + i * 3.06;
      box(s, x, 1.85, 2.92, 1.35, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, x + 0.22, 1.95, 2.5, 0.72, { fontSize: 34, bold: true, color: i === 0 ? GREEN : INK });
      T(s, d, x + 0.22, 2.68, 2.5, 0.4, { fontSize: 12, color: MUTED });
    });
    const H = { bold: true, color: MUTED, fontSize: 11, fill: { color: WHITE } };
    const rows = [
      [{ text: "Suite", options: H }, { text: "Result", options: H }, { text: "Where it ran", options: H }],
      ["npm test, 23 offline suites", "264 passed, 0 failed", "No model, no GPU"],
      ["Messenger end to end (test/e2e.mjs)", "58 of 58 checks", "Muse Glimmer on a cloud A100"],
      ["Attacks (test/redteam.mjs)", "93 of 93 stopped", "A cloud A100, twice"],
      ["Community loop's attacks, within the 93", "29 of 29 stopped, 5 of 5 controls passed", "The server's CPU, with the real guards"],
      ["A2A between two gateways", "22 of 22 checks", "Taipei GPU server and a GCP A100"],
      ["Crash matrix", "20 of 20 checks", "A stand-in model"],
      ["A federation of three clubs (test/federation_unit.mjs)", "4 of 4: found, signed, rotated, forgery refused", "Real HTTP, one host"],
      ["\"I want to play\" in Messenger", "13 of 13 checks", "Muse Glimmer on a cloud A100"],
    ];
    s.addTable(rows, { x: 0.6, y: 3.45, w: 12.1, colW: [5.0, 3.9, 3.2], fontSize: 12, fontFace: FONT, color: INK, rowH: 0.38, border: { type: "solid", pt: 0.75, color: LINE }, margin: [0, 0.1, 0, 0.1], valign: "middle" });
  }

  // 23 · Full technical architecture
  pres.addSection({ title: "Architecture" });
  {
    const s = content("Architecture", "FULL TECHNICAL ARCHITECTURE", "One GPU server I own, the Meta Model API where it helps",
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
      ["Agent to agent", "A2A v1.0 · signed requests · held times · a federation of clubs, keys rotated"],
      ["Body context", "your words, games, health app · found by DRAMA · rules cite notes"],
      ["Courts near you", "map, reviews, forecast · 4 judged at once · reasons cited"],
      ["Social feed and members", "Facebook / Instagram login · invites · stories · signed agent channel"],
      ["Highlights", "find you, read your pose, cut you out · orbit effect · caption"],
      ["Community loop", "ideas · DRAMA · votes · spec · coding agent · 9 gates · canary"],
      ["Decision tiers", "code first · Llama 3.2 1B when sure · Muse Glimmer if needed"],
      ["Live voice", "mic relayed to Muse Voice Transcribe · barge-in · Kokoro speaks"],
      ["Posters and faces", "Muse Image art, made once and cached · names drawn by the app"],
    ];
    mods.forEach(([h, d], i) => {
      const x = 3.28 + (i % 2) * 3.1, y = 1.98 + Math.floor(i / 2) * 0.72;
      box(s, x, y, 2.98, 0.66, { fill: CARD, line: CARD });
      T(s, h, x + 0.14, y + 0.04, 2.7, 0.26, { fontSize: 11, bold: true });
      T(s, d, x + 0.14, y + 0.28, 2.75, 0.36, { fontSize: 9, color: MUTED });
    });
    box(s, 3.28, 5.62, 6.08, 0.82, { fill: AMBERBG, line: AMBERBG });
    T(s, "Checked by code before anyone sees it", 3.42, 5.68, 5.8, 0.27, { fontSize: 11.5, bold: true, color: AMBER });
    T(s, "Llama Guard 3 in and out · Prompt Guard 2 on reviews and ideas · numbers must be in the facts · JSON Schemas · facts, not prose, between agents · nothing booked without a yes", 3.42, 5.96, 5.85, 0.46, { fontSize: 9.5 });
    T(s, "Token ledger per call site · OpenTelemetry GenAI traces across agents · disclosure budget · tokens on every API call", 3.28, 6.52, 6.1, 0.38, { fontSize: 9.5, color: MUTED });
    // Right: models and data
    arrow(s, 9.57, 2.3, 0.3, 0, { color: GREEN });
    arrow(s, 9.57, 3.2, 0.3, 0, { color: BLUE });
    arrow(s, 9.57, 5.0, 0.3, 0, { color: AMBER });
    T(s, "META MODELS ON MY SERVER", 9.92, 1.62, 3.0, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    const right = [
      ["Muse Glimmer", "GPU 1 · RTX 3090 · 4 in parallel · tools, JSON Schemas, vision", GREENBG, GREEN, 0.78],
      ["Vision · GPU 0", "DETR · Sapiens2 · SAM 2.1 (batched, bf16) · MapAnything", BLUEBG, BLUE, 0.78],
      ["On the CPU", "Llama 3.2 1B student · Llama Guard 3 1B · Prompt Guard 2 86M · DRAMA · Omnilingual ASR · Kokoro (speech)", BLUEBG, BLUE, 1.0],
      ["Meta Model API · key on the server", "Muse Spark 1.3 (fallback) · Muse Voice Transcribe · Muse Image · SAM 3.1 (checked once)", AMBERBG, AMBER, 0.95],
    ];
    let y = 1.92;
    right.forEach(([h, d, fill, c, hh]) => {
      box(s, 9.92, y, 2.95, hh, { fill, line: fill });
      T(s, h, 10.06, y + 0.08, 2.7, 0.27, { fontSize: 11.5, bold: true, color: c });
      T(s, d, 10.06, y + 0.36, 2.72, hh - 0.4, { fontSize: 9.5 });
      y += hh + 0.12;
    });
    T(s, "OPEN DATA", 9.92, y + 0.06, 3.0, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    y += 0.34;
    box(s, 9.92, y, 2.95, 0.5, { fill: WHITE });
    T(s, "OpenStreetMap · Open-Meteo · Google Places (reviews)", 10.06, y, 2.75, 0.5, { fontSize: 9.5, valign: "middle" });
  }

  // 24 · End
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
