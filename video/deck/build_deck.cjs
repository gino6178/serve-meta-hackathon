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

(async () => {
  const IMG = {
    meta: await png(path.join(SCENES, "meta.svg")),
    messenger: await png(path.join(SCENES, "messenger.svg")),
    instagram: await png(path.join(SCENES, "instagram.svg")),
    facebook: await png(path.join(SCENES, "facebook.svg")),
    serve: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 48 C 22 8, 42 8, 54 30" fill="none" stroke="#0a0a0b" stroke-width="5.5" stroke-linecap="round"/><circle cx="54" cy="30" r="5" fill="#0a7f44"/></svg>'),
    cover: await jpg(path.join(ROOT, "submission/cover.png"), 1920),
    body: await jpg(path.join(SHOTS, "body_log.png")),
    autopilot: await jpg(path.join(SHOTS, "autopilot_week.png")),
    courts: await jpg(path.join(SHOTS, "courts_near_you.png")),
    leaderboard: await jpg(path.join(SHOTS, "club_leaderboard.png")),
    moment: await jpg(path.join(SHOTS, "orbit/moment.png")),
    depth: await jpg(path.join(SHOTS, "orbit/cutout_depth.png")),
    phone: await jpg(path.join(SHOTS, "phone_home.png"), 780),
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

  // 4 · Simple architecture
  {
    const s = content("Impact", "HOW IT WORKS", "One yes from you. Agents do the rest",
      "一頁架構圖（給一般觀眾）：你只在 Messenger 或 app 按一次 yes；你的 agent（Muse Glimmer）用工具排好一週，跟朋友的 agent 透過 A2A 談好時間；球場、精華、社團都在同一台伺服器上；所有東西給人看之前都先被程式檢查。\n旁白重點：Agents only mark which times work; code picks from the overlap. Nothing is booked until I say yes.");
    // You
    box(s, 0.6, 2.05, 2.45, 2.3, { fill: WHITE });
    T(s, "You", 0.85, 2.25, 2, 0.4, { fontSize: 18, bold: true });
    s.addImage({ data: IMG.messenger, x: 0.85, y: 2.8, w: 0.36, h: 0.36 });
    T(s, "Messenger", 1.3, 2.8, 1.6, 0.36, { fontSize: 13, valign: "middle" });
    s.addImage({ data: IMG.serve, x: 0.85, y: 3.28, w: 0.36, h: 0.36 });
    T(s, "Serve app", 1.3, 3.28, 1.6, 0.36, { fontSize: 13, valign: "middle" });
    T(s, "approve with one tap", 0.85, 3.8, 2, 0.3, { fontSize: 11, color: MUTED });
    arrow(s, 3.1, 3.2, 0.55, 0, { both: true });
    // Your agent
    box(s, 3.7, 1.85, 4.75, 2.7, { fill: GREENBG, line: GREEN, lw: 2 });
    T(s, "Your agent", 3.95, 2.05, 3, 0.42, { fontSize: 20, bold: true });
    T(s, "Autopilot · Muse Glimmer on my RTX 3090", 3.95, 2.5, 4.3, 0.3, { fontSize: 12, bold: true, color: GREEN });
    T(s, "Picks one tool at a time; code runs it and hands back the facts, until the week is planned.", 3.95, 2.88, 4.3, 0.65, { fontSize: 12.5 });
    [["Body", "limits from what hurts"], ["Match", "\"want a game?\""], ["Talk", "agrees with their agents"]].forEach(([h, d], i) => {
      const x = 3.95 + i * 1.45;
      box(s, x, 3.6, 1.35, 0.8, { fill: WHITE, line: WHITE });
      T(s, h, x + 0.12, 3.67, 1.15, 0.3, { fontSize: 13, bold: true });
      T(s, d, x + 0.12, 3.97, 1.18, 0.4, { fontSize: 10, color: MUTED });
    });
    // Friends' agents
    arrow(s, 8.5, 3.2, 0.95, 0, { both: true, color: BLUE });
    T(s, "A2A v1.0", 8.5, 2.82, 0.95, 0.3, { fontSize: 11, bold: true, color: BLUE, align: "center" });
    T(s, "facts only", 8.5, 3.3, 0.95, 0.3, { fontSize: 10, color: MUTED, align: "center" });
    box(s, 9.5, 1.85, 3.2, 2.7, { fill: BLUEBG, line: BLUEBG });
    T(s, "Friends' agents", 9.75, 2.05, 2.8, 0.42, { fontSize: 18, bold: true });
    ["Leo's agent", "Hana's agent", "Tomás's agent"].forEach((n, i) => {
      s.addShape(pres.shapes.OVAL, { x: 9.8, y: 2.55 + i * 0.5, w: 0.42, h: 0.42, fill: { color: WHITE }, line: { color: BLUE, width: 1.25 } });
      T(s, n[0], 9.8, 2.55 + i * 0.5, 0.42, 0.42, { fontSize: 13, bold: true, color: BLUE, align: "center", valign: "middle" });
      T(s, n, 10.35, 2.55 + i * 0.5, 2.2, 0.42, { fontSize: 13, valign: "middle" });
    });
    T(s, "They mark which times work; code picks from the overlap.", 9.75, 4.08, 2.85, 0.45, { fontSize: 10, color: MUTED });
    // What the agent reaches
    const reach = [
      ["Courts near you", "OpenStreetMap, Google reviews, the forecast; judged by Muse Glimmer"],
      ["Highlights", "Your phone clip, read by Meta's vision models; one tap to Instagram"],
      ["Club", "A scoreboard photo, checked by code; rankings and challenges"],
    ];
    reach.forEach(([h, d], i) => {
      const x = 3.7 + i * 3.02;
      box(s, x, 4.95, 2.9, 1.2, { fill: WHITE });
      T(s, h, x + 0.2, 5.08, 2.5, 0.32, { fontSize: 14, bold: true });
      T(s, d, x + 0.2, 5.42, 2.55, 0.7, { fontSize: 11, color: MUTED });
    });
    arrow(s, 6.07, 4.58, 0, 0.34);
    box(s, 0.6, 6.33, 12.1, 0.52, { fill: AMBERBG, line: AMBERBG });
    T(s, "Checked by code before anyone sees it  ·  nothing is booked without your yes  ·  video and health data stay on the server", 0.85, 6.33, 11.6, 0.52, { fontSize: 13, bold: true, color: AMBER, valign: "middle" });
  }

  // 5 · Demo: a week
  pres.addSection({ title: "Demo" });
  {
    const s = content("Demo", "DEMO · 25%", "A week with Serve, live",
      "Demo 段落（影片 0:30–1:34）：照一週的順序走，每個 Meta 模型出場時左上角都有標籤。\n週一：膝蓋 → 身體紀錄。Autopilot 排一週＋A2A 談判。找球場。週四：上傳影片 → highlight（時間暫停、鏡頭轉 20°）。賽後：記分板照片 → 排名。\n旁白開頭：Here's a live run of my week.");
    const steps = [
      [IMG.body, "MONDAY", "\"My right knee is sore\"", "Muse Glimmer files it on your body and turns it into a rule: doubles first, one game fewer."],
      [IMG.autopilot, "TUESDAY", "Autopilot plans the week", "One tool at a time, then three friends' agents at once, over A2A. Nothing booked until you say yes."],
      [IMG.courts, "WEDNESDAY", "A court in any ball sport", "Prompt Guard 2 screens the reviews; Glimmer judges four courts at once, citing its sources."],
      [IMG.moment, "THURSDAY", "Your highlight", "DETR, Sapiens2 and SAM 2.1 find your moment; MapAnything turns the camera round it."],
      [IMG.leaderboard, "AFTER THE GAME", "A scoreboard photo", "Glimmer reads 21–17, 19–21, 21–15; code checks it against the rules; your ranking moves."],
    ];
    steps.forEach(([img, day, h, d], i) => {
      const x = 0.6 + i * 2.45, w = 2.3;
      s.addImage({ data: img, x, y: 1.9, w, h: 1.44, sizing: { type: "cover", w, h: 1.44 } });
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.9, w, h: 1.44, fill: { type: "none" }, line: { color: LINE, width: 1 } });
      T(s, day, x, 3.55, w, 0.28, { fontSize: 11, bold: true, color: GREEN, charSpacing: 1 });
      T(s, h, x, 3.85, w, 0.62, { fontSize: 15, bold: true });
      T(s, d, x, 4.5, w, 1.4, { fontSize: 12, color: MUTED });
    });
    box(s, 0.6, 6.05, 12.1, 0.75, { fill: CARD, line: CARD });
    s.addImage({ data: IMG.messenger, x: 0.85, y: 6.24, w: 0.38, h: 0.38 });
    T(s, "All of it also works from Messenger: \"Line up my week\" → On it → Lined up [Book it] → Booked. Real replies from the end-to-end test.", 1.38, 6.05, 11.1, 0.75, { fontSize: 13, valign: "middle" });
  }

  // 6 · Meta stack
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
      ["Memory", "DRAMA", "Memory by meaning for the Autopilot; groups the club's ideas", "CPU"],
      ["Voice", "Omnilingual ASR", "Voice notes in Messenger to text", "CPU · CTC 1B"],
      ["Vision", "DETR", "Finds the people in your video, so the reel follows you", "GPU"],
      ["Vision", "Sapiens2", "Every player's pose on every frame; finds the moment", "GPU · 0.4B"],
      ["Vision", "SAM 2.1", "Cuts each player out for the spotlight and the drawn view", "GPU · Hiera-L"],
      ["3D", "MapAnything", "Depth and the camera for the orbit camera effect", "GPU · optional effect"],
      ["Product", "Messenger Platform", "Your agent in your chats: plans, a tap to approve, check-ins", "Signed webhook · Send API"],
      ["Product", "Instagram · Facebook", "Your reel and its caption, shared by you", "The phone's share sheet"],
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

  // 7 · Agents
  {
    const s = content("Use of Meta AI", "AN AGENT, NOT A CHATBOT", "Glimmer plans, agents agree, code decides",
      "Autopilot：Muse Glimmer 用原生 tool calling 一步一步叫工具，被拒絕的呼叫會變成事實回來，它重新規劃。A2A：每個會員一個 agent、簽章的 Agent Card、一輪就談完、談好的時間先鎖 30 分鐘、每輪存檔可續跑。兩台機器（台北的 GPU 伺服器 + GCP A100）跨網路 22/22 項檢查通過。\n旁白：Autopilot takes over… Then it negotiates with three friends' agents at once, over A2A.");
    box(s, 0.6, 1.85, 5.85, 4.95, { fill: WHITE });
    T(s, "Autopilot · a tool loop", 0.85, 2.05, 5.3, 0.4, { fontSize: 18, bold: true });
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

  // 8 · Highlights
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

  // 9 · Muse Glimmer in practice
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

  // 10 · Safe by design
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

  // 11 · Community loop
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

  // 12 · Proof
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

  // 13 · Full technical architecture
  pres.addSection({ title: "Architecture" });
  {
    const s = content("Architecture", "FULL TECHNICAL ARCHITECTURE", "Everything runs on one GPU server I own",
      "完整技術架構（放最後給想深入的評審）：左邊是使用者的入口；中間是 Node.js gateway 上的各個模組；右邊是 Meta 模型實際跑在哪（GPU 1 Muse Glimmer、GPU 0 視覺、CPU 上的小模型），以及外部開放資料。底下是「給人看之前先由程式檢查」與帳本/追蹤。");
    // Left: you
    T(s, "YOU", 0.45, 1.62, 2.2, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    const you = [["Serve app", "React · phone to desktop", false], ["Messenger", "your agent in your chats", true], ["Health export", "Apple Health, Google Fit, GPX", false], ["Your video", "any ball sport, from a phone", false], ["Instagram · Facebook", "your reel, shared by you", true]];
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
      ["Autopilot", "tool loop · native tool calling · 12 steps max · rules finish if it stalls"],
      ["Agent to agent", "A2A v1.0 · signed Agent Cards · one round · held times · checkpoints"],
      ["Body log", "what hurts, by a tool call · health app linked to games · check-ins"],
      ["Courts near you", "map, reviews, forecast · 4 judged at once · reasons cited"],
      ["Club and Play", "scoreboard photo · leaderboard · challenges · best match"],
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

  // 14 · End
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
