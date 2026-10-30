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
    v3: Object.fromEntries(await Promise.all(["join", "social_feed", "social_agent", "social_invite", "body_context", "body_rules", "courts_badges", "agent_chats", "plan_approve", "poster", "live_talk", "live_clubs", "live_draft"].map(async (k) => [k, await jpg(path.join(SHOTS, "v3", k + ".png"), 780)]))),
    venue: "image/jpeg;base64," + (await sharp(path.join(SHOTS, "venue_in_the_middle.png")).extract({ left: 823, top: 168, width: 1406, height: 1120 }).jpeg({ quality: 86 }).toBuffer()).toString("base64"), // the map, without the step list
    scale: await chart(path.join(ROOT, "docs/scale.svg")),
    tiers: await chart(path.join(ROOT, "docs/decision_tiers.svg")),
    dot: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#0a7f44"/><circle cx="32" cy="32" r="24" fill="none" stroke="#0a7f44" stroke-opacity=".25" stroke-width="6"/></svg>'),
    heart: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 54 C 8 38, 6 22, 18 14 C 25 10, 30 14, 32 19 C 34 14, 39 10, 46 14 C 58 22, 56 38, 32 54 Z" fill="#d1352b"/></svg>'),
    check: await svgPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#0a7f44"/><path d="M19 33 l9 9 l17 -19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    smash: await jpg(path.join(__dirname, "smash_loop.jpg"), 1280),
    frames: await Promise.all([41, 75, 85].map((t) => jpg(path.join(__dirname, `vframe_${t}.png`), 1280))),
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
  let SEC = "Main"; // the section each new slide goes in
  const content = (section, kicker, title, notes) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: SEC });
    s.addText(kicker, { placeholder: "kicker" });
    s.addText(title, { placeholder: "title" });
    if (notes) s.addNotes(notes);
    return s;
  };

  pres.addSection({ title: "Main" });
  // 1 · Cover: the hackathon, on white.
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: SEC });
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
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: SEC });
    s.addImage({ data: IMG.serve, x: 0.8, y: 0.75, w: 0.55, h: 0.55 });
    T(s, "serve", 1.45, 0.72, 3, 0.6, { fontSize: 30, bold: true, valign: "middle" });
    T(s, [{ text: "Play more.\n", options: { color: INK } }, { text: "Manage less.", options: { color: GREEN } }], 0.8, 2.0, 5.6, 2.0, { fontSize: 54, bold: true, lineSpacingMultiple: 0.95 });
    T(s, "Your agent sets up your games with your friends' agents, plans around your week, and cuts your highlights. You just say yes.", 0.8, 4.15, 5.2, 1.0, { fontSize: 17, color: MUTED });
    [["Agents agree your week", GREEN], ["Your agent in Messenger", BLUE], ["Six Meta models carry it; 15 used in all", INK]].forEach(([t, c], i) => {
      s.addShape(pres.shapes.OVAL, { x: 0.8, y: 5.45 + i * 0.45, w: 0.14, h: 0.14, fill: { color: c }, line: { color: c } });
      T(s, t, 1.08, 5.35 + i * 0.45, 5, 0.34, { fontSize: 14, bold: true, valign: "middle" });
    });
    T(s, "Not a coach, not a sports analyzer, not a medical tool: a club that organizes itself.", 0.8, 6.85, 5.6, 0.3, { fontSize: 11, color: MUTED });
    phone(s, IMG.v3.social_feed, 6.75, 0.85, 5.6);
    phone(s, IMG.v3.agent_chats, 9.75, 1.35, 5.6);
    s.addNotes("Serve 的封面頁：Play more. Manage less. 右邊是手機上的社群動態和 Agent 對話。\n旁白：So for this hackathon, I built Serve. Not an AI coach. A club where your agent sorts things out with your friends' agents, and only asks you for one yes.");
  }

  // 3 · Impact
  {
    const s = content("Impact", "IMPACT · 30%", "People don't quit the game. They quit organizing it",
      "痛點：不是不愛打球，是約不成。\n旁白：Most people don't quit sports because they stopped loving the game. They quit because matching four calendars, finding a court and fitting it around work takes too much group chat.\n影片：pain.html，群組約球失敗，蓋上 No game this week。");
    box(s, 0.6, 1.85, 3.6, 4.85, { fill: GREENBG, line: GREENBG });
    T(s, "40% \u2192 26%", 0.9, 2.1, 3.25, 0.8, { fontSize: 38, bold: true, color: GREEN });
    T(s, "of US adults play a sport at ages 18 to 21, then at 26 to 49", 0.9, 2.95, 3.0, 0.65, { fontSize: 15, color: INK });
    T(s, "NPR, RWJF and Harvard Chan poll of 2,506 adults, 2015", 0.9, 3.6, 3.0, 0.45, { fontSize: 10.5, color: MUTED });
    T(s, "WHAT STOPS ADULTS (NZ)", 0.9, 4.25, 3.0, 0.25, { fontSize: 10, bold: true, color: GREEN, charSpacing: 1 });
    [["64%", "other commitments come first"], ["21%", "got out of the habit"], ["10%", "no one to do it with"]].forEach(([n, d], i) => {
      T(s, n, 0.9, 4.55 + i * 0.45, 0.8, 0.4, { fontSize: 18, bold: true, color: INK });
      T(s, d, 1.7, 4.55 + i * 0.45, 2.4, 0.4, { fontSize: 12, color: INK, valign: "middle" });
    });
    T(s, "Active NZ survey, Sport New Zealand, 2023", 0.9, 5.95, 3.0, 0.3, { fontSize: 10.5, color: MUTED });
    const rows = [
      ["Playing takes organizing", "\"Who's free this week?\" \"Is the court taken?\" \"We're one short.\" The group chat wears the fun out.", "Your agent agrees the time and the court with the other players' agents. You approve once; your phone says \"Game on: Thu 19:00, 4 in.\""],
      ["Nobody pushes you", "One missed week becomes a month. Apps count steps; none books your next game.", "When your usual time is open and your partner is free, it asks: \"Thursday 19:00: Leo is free. Want a game?\""],
      ["Life gets in the way", "A late meeting, a heavy week, rain on an outdoor court.", "It moves the game, plans one fewer in a heavy week, and checks the map, reviews and forecast."],
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
    T(s, "Less screen time, more court time: any ball sport that needs people, a time and a place.", 4.6, 6.78, 8.1, 0.3, { fontSize: 11, color: MUTED, italic: true });
  }

  // 3· · The problem as a picture: everyone has an agent that alone knows their preferences, and agents have nowhere
  // to meet; Serve is that place, with trust on two tracks, owned keys, and rules that change with what agents need
  {
    const s = content("Impact", "IMPACT · THE PROBLEM", "Everyone will have an agent, with nowhere to meet",
      "示意圖：每個人都有自己的 agent，因為隱私，偏好只有 agent 知道（幾點有空、願意跑多遠、願意付多少），不會攤在群組裡。\n左邊是今天：每個 agent 只認識自己的主人，也只能找通訊錄裡的人；朋友沒空就沒有下一步，而陌生人的 agent 又不知道能不能信。\n右邊是 Serve：一個讓人和 agent 都能進出的地方。agent 帶著主人的偏好來揪團、找附近的夥伴，彼此只交換「可以／不行／原因」，偏好不離開 agent。\n下面三個支柱：AI trust（真人出席率＋agent 守信率，每個 agent 有自己的金鑰、每則訊息都簽章）；Web3：不可竄改的信用帳本（每筆信用紀錄都是雜湊鏈上的一筆，含前一筆的雜湊；伺服器每天用自己的 Ed25519 金鑰簽下鏈尾；任何人都能從 /api/trust/chain 驗證，repo 裡有 verify_trust_chain.mjs；金鑰在你手上；沒有代幣、沒有手續費）；會進化的平台（agent 一直撞到的牆會變成社團的提案，大家投票，經過安全關卡後上線，平台跟著 agent 的需求改變）。");
    // left: today, each agent alone with its person's preferences
    box(s, 0.6, 1.8, 5.55, 3.55, { fill: CARD, line: CARD });
    T(s, "TODAY", 0.85, 1.95, 3, 0.28, { fontSize: 11, bold: true, color: RED, charSpacing: 1 });
    const unit = (x, y, who, knows) => {
      s.addShape(pres.shapes.OVAL, { x, y, w: 0.62, h: 0.62, fill: { color: WHITE }, line: { color: LINE, width: 1.25 } });
      T(s, who, x, y, 0.62, 0.62, { fontSize: 13, bold: true, align: "center", valign: "middle" });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.72, y: y - 0.02, w: 1.72, h: 0.66, rectRadius: 0.1, fill: { color: GREENBG }, line: { color: GREEN, width: 1 } });
      T(s, [{ text: "Agent · private\n", options: { bold: true, color: GREEN, fontSize: 10 } }, { text: knows, options: { fontSize: 9.5, color: INK } }], x + 0.82, y + 0.02, 1.58, 0.6, { valign: "middle" });
    };
    unit(0.85, 2.45, "A", "Thu evenings · within 3 km");
    unit(3.4, 2.45, "B", "Weekends · under NT$100");
    unit(0.85, 3.75, "C", "Quiet courts · any day");
    unit(3.4, 3.75, "D", "Early mornings · near work");
    // the dashed links that go nowhere
    s.addShape(pres.shapes.LINE, { x: 2.43, y: 3.13, w: 0, h: 0.58, line: { color: RED, width: 1.25, dashType: "dash" } });
    s.addShape(pres.shapes.LINE, { x: 4.98, y: 3.13, w: 0, h: 0.58, line: { color: RED, width: 1.25, dashType: "dash" } });
    T(s, "?", 2.55, 3.27, 0.3, 0.3, { fontSize: 14, bold: true, color: RED });
    T(s, "?", 5.1, 3.27, 0.3, 0.3, { fontSize: 14, bold: true, color: RED });
    T(s, "Only each agent knows its person's times, distance and price: that stays private. But an agent can only message its own contacts, and has no way to know which strangers' agents to trust.", 0.85, 4.55, 5.1, 0.75, { fontSize: 11, color: MUTED });
    arrow(s, 6.22, 3.55, 0.45, 0, { color: GREEN, width: 2.5 });
    // right: Serve, the place where agents meet
    box(s, 6.75, 1.8, 5.95, 3.55, { fill: GREENBG, line: GREENBG });
    T(s, "SERVE: A PLACE WHERE PEOPLE AND THEIR AGENTS MEET", 7.0, 1.95, 5.6, 0.28, { fontSize: 11, bold: true, color: GREEN, charSpacing: 1 });
    const cx = 9.72, cy = 3.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - 1.25, y: cy - 0.62, w: 2.5, h: 1.24, rectRadius: 0.18, fill: { color: WHITE }, line: { color: GREEN, width: 2 } });
    T(s, [{ text: "Huddle\n", options: { bold: true, fontSize: 15 } }, { text: "find partners nearby · agree a time and a court · check trust · ask the venue", options: { fontSize: 9.5, color: MUTED } }], cx - 1.12, cy - 0.55, 2.24, 1.1, { align: "center", valign: "middle" });
    [["A", 7.25, cy - 0.45], ["B", 11.57, cy - 0.45], ["C", 7.25, cy + 0.45], ["D", 11.57, cy + 0.45]].forEach(([who, x, yc]) => {
      s.addShape(pres.shapes.OVAL, { x, y: yc - 0.31, w: 0.62, h: 0.62, fill: { color: GREEN }, line: { color: GREEN } });
      T(s, who, x, yc - 0.31, 0.62, 0.62, { fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
      const left = x < cx, x0 = left ? x + 0.66 : cx + 1.29, x1 = left ? cx - 1.29 : x - 0.04;
      s.addShape(pres.shapes.LINE, { x: x0, y: yc, w: x1 - x0, h: 0, line: { color: GREEN, width: 1.5, beginArrowType: "triangle", endArrowType: "triangle" } });
    });
    T(s, "Agents trade only yes, no and why. The preferences never leave the agent.", 7.0, 4.82, 5.5, 0.4, { fontSize: 11, bold: true, color: GREEN, align: "center" });
    // three pillars
    const pillars = [
      ["AI TRUST", "Two records, counted by code: does the person show up, does their agent keep its yeses. Every agent has its own key and signs every message.", GREEN, GREENBG],
      ["WEB3: A TRUST LEDGER NO ONE CAN EDIT", "Every record is a hash-chained entry; the server signs each day's head with its key, and anyone can verify it. You hold your agent's key. No tokens, no fees.", BLUE, BLUEBG],
      ["EVOLVES WITH ITS AGENTS", "What agents keep running into becomes a club idea: members vote, it's built and passes the safety gates, and the platform adapts to its agents.", AMBER, AMBERBG],
    ];
    pillars.forEach(([k, d, c, bg], i) => {
      const x = 0.6 + i * 4.07;
      box(s, x, 5.55, 3.92, 1.1, { fill: bg, line: bg });
      T(s, k, x + 0.2, 5.65, 3.6, 0.26, { fontSize: 10.5, bold: true, color: c, charSpacing: 1 });
      T(s, d, x + 0.2, 5.93, 3.6, 0.7, { fontSize: 10.5 });
    });
    T(s, "Ball games come first because they are hard to arrange: several people, a court, the weather. The same place works for any group that meets in person.", 0.6, 6.78, 12.1, 0.28, { fontSize: 10.5, color: MUTED, italic: true });
  }

  // 3a · The next wall: an agent that can only ask your friends, and the trust it needs to ask anyone else
  {
    const s = content("Impact", "IMPACT · BEYOND YOUR FRIENDS", "Beyond your friends, people flake and agents lie",
      "痛點二：人人都會有懂自己的 agent，但沒有一個人和 agent 都能出入的公共場所，agent 只能找通訊錄裡的老朋友；老朋友沒空，你還是打不成。\n一旦走出朋友圈，馬上有兩個風險：真人會不會放鳥（人的風險）、對方的 agent 會不會替主人亂答應，或一直問人來拼湊別人的行程（agent 的風險）。\nServe 的解法：願意的人可以讓附近 5 公里內的 agent 來問；每個人有兩份紀錄，都由程式從實際發生的事算出：出席率（賽後球友一鍵確認誰有到，開打前 6 小時內退出算臨時放鳥），和 agent 守信率（agent 替你說 yes 之後你本人也說 yes 的比例），加上「一天問太多 agent」和「簽章失敗」兩個警示。\n每場球可以設門檻：出席率不到的人排候補；守信率太低的 agent 不能替主人答應，改問本人。Serve 不收訂金、不經手錢。\n右邊的情境是用測試帳號在本機跑出來的真實對話：Dan 的 agent 守信率 52%，所以直接問 Dan 本人；Bob 出席率 33%（3 場），進候補；Leo、Hana、Kenji 的 agent 談好週六 21:00，場館 agent 從 NT$410 談到 NT$280。正式站的紀錄從零開始累積。");
    box(s, 0.6, 1.85, 5.6, 4.75, { fill: REDBG, line: REDBG });
    T(s, "THE PAIN", 0.9, 2.05, 5, 0.3, { fontSize: 11, bold: true, color: RED, charSpacing: 1 });
    [["An agent with nowhere to go", "Soon everyone has an agent that knows their week. With no shared place where people and agents meet, it can only message your contacts; when they're busy, you're still not playing."],
      ["Trust breaks first", "Asking beyond your friends brings two risks: the person who doesn't turn up, and the agent that says yes for its person when they'd say no, or keeps asking to map everyone's week."]].forEach(([h, d], i) => {
      const y = 2.45 + i * 1.75;
      T(s, h, 0.9, y, 5.1, 0.4, { fontSize: 17, bold: true });
      T(s, d, 0.9, y + 0.45, 5.05, 1.2, { fontSize: 12.5, color: INK });
    });
    T(s, "Serve never takes a deposit: low trust means the waitlist, or asking the person.", 0.9, 6.05, 5.1, 0.45, { fontSize: 11, color: MUTED, italic: true });
    // the scenario, as the app shows the agents' talk
    T(s, "SAT DOUBLES · NEED 3 · SHOWS UP 90%+ · PEOPLE NEARBY", 6.55, 1.85, 6.2, 0.3, { fontSize: 10, bold: true, color: GREEN, charSpacing: 1 });
    const rows = [
      ["Dan", "Agent keeps 52% of its yeses", "Dan's agent can't say yes for Dan, so Dan is asked directly.", AMBER, AMBERBG],
      ["Bob", "Shows up 33% · 3 games", "On the waitlist: this game needs 90%.", RED, REDBG],
      ["Leo · Hana · Kenji", "100% · 8 games · 100% · 12 games · new", "Their agents agree Sat 21:00; the venue's agent goes from NT$410 to NT$280.", GREEN, GREENBG],
    ];
    rows.forEach(([who, rec, out, c, bg], i) => {
      const y = 2.25 + i * 1.22;
      box(s, 6.55, y, 6.15, 1.08, { fill: bg, line: bg });
      T(s, who, 6.75, y + 0.12, 2.6, 0.32, { fontSize: 15, bold: true });
      T(s, rec, 9.25, y + 0.14, 3.3, 0.3, { fontSize: 11, bold: true, color: c, align: "right" });
      T(s, out, 6.75, y + 0.5, 5.8, 0.5, { fontSize: 12.5 });
    });
    box(s, 6.55, 5.95, 6.15, 0.65, { fill: WHITE, line: LINE });
    T(s, [{ text: "Two records on a signed hash chain. ", options: { bold: true } }, { text: "Shows up: players tap who came; a drop in the last 6 hours is late. Agent keeps: your yes after your agent's yes. Anyone can verify." }],
      6.7, 5.95, 5.9, 0.65, { fontSize: 10.5, valign: "middle" });
    T(s, "The scenario ran in the app with test accounts. On the live site every record starts at zero, and anyone under three games shows as new.", 0.6, 6.72, 12.1, 0.3, { fontSize: 10.5, color: MUTED, italic: true });
  }

  // 3b · Live: invited players on the public site, each with an agent of their own
  {
    const s = content("Impact", "LIVE · INVITED PLAYERS", "Real players, each with an agent of their own",
      "上線給真的使用者用：公開網址（Cloudflare tunnel），每位使用者登入後在伺服器上有一個自己的 agent（獨立的 gateway 程序、獨立資料夾），社團、動態、揪團大家共用。\n第一天：3 位使用者（5 個帳號）、使用者自己開了 1 個社團（新竹，2 人）、發了 3 個揪團、2 次加入、1 則留言。\n左：社團在真地圖上，agent 主動推薦附近的公開社團；右：直接跟 agent 說「週六早上雙打，缺 3 個」，agent 擬好邀請（日期由程式算、最近的球場），按一下就發佈，之後在對話裡看到誰加入。");
    phone(s, IMG.v3.live_clubs, 0.75, 1.85, 4.7, "Clubs on a real map, one recommended");
    phone(s, IMG.v3.live_draft, 3.35, 1.85, 4.7, "Say it; your agent drafts the invite");
    T(s, "LIVE SINCE 29 OCT · play.theminimallab.com", 6.2, 1.85, 6.6, 0.25, { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 });
    [["8", "people, me included (15 demo sign-ins)"], ["2", "clubs they started"], ["4", "games posted"], ["8", "joins; 3 of 4 games filled"]].forEach(([n, d], i) => {
      const x = 6.2 + i * 1.6;
      box(s, x, 2.15, 1.48, 1.05, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, x + 0.14, 2.2, 1.2, 0.55, { fontSize: 26, bold: true, color: i === 0 ? GREEN : INK });
      T(s, d, x + 0.14, 2.75, 1.25, 0.4, { fontSize: 10.5, color: MUTED });
    });
    [["An agent of their own", "Each player's agent runs in its own process on my server, with its own data folder; the club, its feed and its games are shared."],
      ["Clubs anyone can start", "Public or private, on a real map; your agent recommends the nearest public one."],
      ["Tell your agent the game", "\"Saturday morning doubles, need 3\": it drafts the invite with the nearest court and you tap Post. Share it as a link: anyone opens it and joins, no account needed first."]].forEach(([h, d], i) => {
      const y = 3.5 + i * 1.05;
      s.addShape(pres.shapes.OVAL, { x: 6.2, y: y + 0.04, w: 0.34, h: 0.34, fill: { color: GREEN }, line: { color: GREEN } });
      T(s, String(i + 1), 6.2, y + 0.04, 0.34, 0.34, { fontSize: 11.5, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, 6.7, y, 6, 0.3, { fontSize: 14, bold: true });
      T(s, d, 6.7, y + 0.33, 6, 0.6, { fontSize: 11, color: MUTED });
    });
    T(s, "Counted 30 Oct, day 4. Spond, Playtomic and Meetup post events or book courts; on Serve each player's agent agrees the time, so nobody runs the poll.", 6.2, 6.62, 6.6, 0.4, { fontSize: 10, color: MUTED, italic: true });
  }

  // C · Cold start: the first friend needs no account
  {
    const s = content(SEC, "IMPACT · COLD START", "The first friend needs no account",
      "冷啟動：agent 對 agent 需要雙方都在 Serve 上；第二個人怎麼來？靠邀請連結。跟 agent 說一句 → 分享連結到 LINE、WhatsApp 群組 → 對方沒帳號也能打開，看到球局和剩幾個名額（看不到誰報名）→ 登入一次就自動加入 → 滿團時每個人都收到 Game on，之後他自己的 agent 就能替他回覆。");
    const steps = [
      ["1", "Tell your agent", "\"Saturday doubles, need 3\": it drafts the invite with the nearest court. You tap Post."],
      ["2", "Share the link", "To any group chat. It opens with no account: the game, the place, the spots left, never who is going."],
      ["3", "Tap Join", "Sign in once (a demo sign-in for now: Facebook and Instagram login wait for Meta's app review) and the game is joined straight away."],
      ["4", "Game on", "The last spot taken, everyone in it hears \"Game on\". From then on, their own agent answers for them."],
    ];
    steps.forEach(([n, h, d], i) => {
      const x = 0.6 + i * 3.05;
      box(s, x, 1.95, 2.85, 3.3, { fill: i === 3 ? GREENBG : CARD, line: i === 3 ? GREENBG : CARD });
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.2, w: 0.5, h: 0.5, fill: { color: GREEN }, line: { color: GREEN } });
      T(s, n, x + 0.25, 2.2, 0.5, 0.5, { fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, x + 0.25, 2.9, 2.4, 0.4, { fontSize: 17, bold: true });
      T(s, d, x + 0.25, 3.4, 2.4, 1.7, { fontSize: 12.5, color: MUTED, valign: "top" });
      if (i < 3) arrow(s, x + 2.87, 3.6, 0.16, 0);
    });
    box(s, 0.6, 5.5, 12.1, 1.1, { fill: WHITE, line: LINE });
    T(s, [{ text: "Why it matters. ", options: { bold: true } }, { text: "Agents agree games only between members, so the second player has to get in somehow: the link is that way in, and nobody has to install anything first. A private club's games never leave the club. Live on the public site since 29 Oct; the link page and the join are covered by tests." }],
      0.85, 5.5, 11.6, 1.1, { fontSize: 13, valign: "middle" });
  }

  // 3c · Clubs for groups with no organizer (agent members/programs.js)
  {
    const s = content("Impact", "IMPACT · WHO ELSE IT SERVES", "Games where no one has time to organize them",
      "同一套引擎服務沒有人組織的群體，三種社團都已實作、有單元測試：\n1 孩童社團（老師或志工）：一定是私密社團，只有帶隊的人能發活動；孩子不用帳號，只存名字（只有帶隊的人看得到）；勾選今天誰來，程式排輪替，每個孩子上場時間最多差一輪；產生家長接送通知。\n2 樂齡社團：社團裡每個揪團由程式把關：08:00–16:00 開始、60 分鐘、最多 8 人、球拍類雙打；不符合就拒絕並說明原因。\n3 慈善賽：發起人寫公益對象，參賽者自評等級與認捐（只記錄，Serve 不經手錢）；一鍵抽籤：實力平均的雙打組合、循環賽、場地與時段，同一時段沒有隊伍撞場，貼到社團動態。");
    const cards = [
      ["Children", "A teacher or volunteer", "Private: parents and helpers join only when the organizer lets them in. Children have no accounts: first names only, seen by the organizer. Code shares out the courts in turns.", "11 children, 2 courts: everyone plays within one turn of the others. A pick-up note for parents.", GREEN, GREENBG],
      ["Older adults", "Gentle games", "Every game posted in a gentle-games club is held by code: starts 08:00 to 16:00, 60 minutes, 8 players at most, doubles for racket sports.", "A 19:00 game is refused, with the reason. The card says \"Gentle game · doubles, 60 min\".", BLUE, BLUEBG],
      ["A cause", "Charity cup", "Players enter with a level and a pledge to the cause, only recorded: Serve handles no money. The organizer makes the draw in one tap.", "Balanced doubles, a round robin on courts and times, no team twice in a slot; posted in the club.", AMBER, AMBERBG],
    ];
    cards.forEach(([k, h, d, r, c, bg], i) => {
      const x = 0.6 + i * 4.1, y = 1.85, w = 3.9, hh = 4.75;
      box(s, x, y, w, hh, { fill: WHITE, line: LINE });
      T(s, k.toUpperCase(), x + 0.25, y + 0.2, w - 0.5, 0.25, { fontSize: 10, bold: true, color: c, charSpacing: 1 });
      T(s, h, x + 0.25, y + 0.5, w - 0.5, 0.4, { fontSize: 18, bold: true });
      T(s, d, x + 0.25, y + 1.0, w - 0.5, 1.9, { fontSize: 12.5, color: MUTED, valign: "top" });
      box(s, x + 0.25, y + 3.05, w - 0.5, 1.45, { fill: bg, line: bg });
      T(s, r, x + 0.4, y + 3.1, w - 0.8, 1.35, { fontSize: 12, bold: true, valign: "middle" });
    });
    T(s, "All rules are code, checked in test/programs_unit.mjs. A new kind of group is a club, not a new agent.", 0.6, 6.72, 12, 0.3, { fontSize: 11, color: MUTED, italic: true });
  }

  // 4 · Simple architecture, in three columns
  {
    const s = content("Impact", "HOW IT WORKS", "One yes from you. Agents do the rest",
      "一頁架構圖（三欄資料流）：\n左：你的脈絡——Messenger 的一句話、語音、健康 app，由 Meta DRAMA 依語意找出這週該注意的事。\n中：你的 Serve agent——Muse Glimmer（加上蒸餾出的 Llama 3.2 1B）一步一步規劃，透過 A2A 跟朋友的 agent 一輪談好時間。\n右：球場上下——你按一次 yes；賽後 Meta 的視覺模型剪出精華，在社群動態和限時動態分享。\n底：所有東西給人看之前都先由程式檢查。");
    const col = (x, w, k, h, fill, line) => { box(s, x, 1.85, w, 4.25, { fill, line, lw: line === GREEN ? 2 : 1 }); T(s, k, x + 0.25, 2.02, w - 0.5, 0.25, { fontSize: 10.5, bold: true, color: line === GREEN ? GREEN : MUTED, charSpacing: 1 }); T(s, h, x + 0.25, 2.3, w - 0.5, 0.45, { fontSize: 19, bold: true }); };
    const row = (x, y, w, ic, h, d) => { s.addImage({ data: ic, x, y: y + 0.02, w: 0.32, h: 0.32 }); T(s, h, x + 0.45, y, w - 0.45, 0.3, { fontSize: 13, bold: true }); T(s, d, x + 0.45, y + 0.3, w - 0.45, 0.5, { fontSize: 11, color: MUTED }); };
    col(0.6, 3.75, "YOUR CONTEXT", "Say it once", CARD, CARD);
    row(0.85, 2.95, 3.3, IMG.messenger, "Messenger and voice", "\"Not after 22:00 on work nights\" · \"not Tomás this week\"");
    row(0.85, 3.85, 3.3, IMG.heart, "Your health app", "Apple Health, Google Fit, GPX: your games");
    row(0.85, 4.75, 3.3, IMG.dot, "Meta's DRAMA", "Finds what matters for this week, by meaning, recent first");
    arrow(s, 4.4, 3.97, 0.4, 0);
    col(4.85, 3.75, "YOUR SERVE AGENT", "Plans your week", GREENBG, GREEN);
    row(5.1, 2.95, 3.3, IMG.serve, "Muse Glimmer", "Picks one tool at a time on my RTX 3090; code runs it");
    row(5.1, 3.85, 3.3, IMG.dot, "Llama 3.2 1B", "Distilled from Glimmer: the easy calls, on the CPU");
    row(5.1, 4.75, 3.3, IMG.dot, "A2A with friends' agents", "Usually one round: they mark times, code picks; a counter-offer if none fits");
    arrow(s, 8.65, 3.97, 0.4, 0);
    col(9.1, 3.6, "ON AND OFF THE COURT", "You just play", BLUEBG, BLUEBG);
    row(9.35, 2.95, 3.15, IMG.check, "One yes", "In the app or with a tap in Messenger");
    row(9.35, 3.85, 3.15, IMG.dot, "Your highlight, auto-cut", "DETR · Sapiens2 · SAM 2.1 · MapAnything");
    row(9.35, 4.75, 3.15, IMG.instagram, "The club and your stories", "Invites, stories, one tap to Instagram");
    box(s, 0.6, 6.33, 12.1, 0.52, { fill: AMBERBG, line: AMBERBG });
    T(s, "Checked by code before anyone sees it  ·  nothing is booked without your yes  ·  health data only sets scheduling limits, on my server", 0.85, 6.33, 11.6, 0.52, { fontSize: 13, bold: true, color: AMBER, valign: "middle" });
  }

  // 7 · Tuesday to Wednesday: the planner, the venue in the middle, courts
  {
    const s = content("Demo", "TUESDAY · WEDNESDAY", "Your agent plans the week and finds the court",
      "規劃與球場：\n左：中心點球場地圖（技術報告第 4 頁那張）——每個人的通勤時間、共同空檔，agent 一輪談好。\n右：手機版找球場——Prompt Guard 2 先過濾 Google 評論，Muse Glimmer 同時判斷四個球場，每個理由都引用來源，程式檢查。\n旁白：Then it plans my week, and agrees it with three friends' agents at once, over A2A. Any ball sport works.");
    s.addImage({ data: IMG.venue, x: 0.6, y: 1.85, w: 6.1, h: 6.1 * 1120 / 1406 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.85, w: 6.1, h: 6.1 * 1120 / 1406, fill: { type: "none" }, line: { color: LINE, width: 1 } });
    T(s, "Badminton: the venue in the middle (an earlier run than slide 11, on court 3)", 0.6, 6.83, 6.1, 0.25, { fontSize: 10.5, color: MUTED });
    phone(s, IMG.v3.courts_badges, 7.6, 1.85, 4.7, "Basketball: public courts, judged with sources");
    const x = 10.25;
    [["Muse Glimmer plans", "One tool at a time; a refused call comes back as a fact"], ["A2A, usually one round", "Agents mark the times that work; code picks; a counter-offer only if none fits"], ["Prompt Guard 2", "Screens reviews first; Google's are listed with a link, not stored"], ["Nothing booked", "until you say yes"]].forEach(([h, d], i) => {
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

  // M · Meta models, the six that carry the product
  {
    const s = content(SEC, "USE OF META AI · 25%", "Six Meta models carry the product (15 used in all)",
      "Meta 模型精簡版：六個撐起產品的模型（Muse Glimmer、Llama 3.2 1B 學生、Llama Guard 3、Prompt Guard 2、DRAMA、Muse Voice Transcribe），其他九個一行帶過，完整 15 格在附錄。");
    const cards = [
      ["REASONING", "Muse Glimmer", "Every agent's decisions: the tool loop, A2A answers, the court judge", "RTX 3090 · Ollama · open weights", GREEN, GREENBG],
      ["REASONING", "Llama 3.2 1B student", "Distilled from Glimmer; answers alone when sure, in about 0.9 s", "CPU · fine-tuned here", GREEN, GREENBG],
      ["SAFETY", "Llama Guard 3 1B", "Every message in and out, a person's or an agent's", "CPU · open weights", RED, REDBG],
      ["SAFETY", "Prompt Guard 2", "Google reviews and members' ideas, before any model reads them", "CPU · 86M", RED, REDBG],
      ["MEMORY", "DRAMA", "Agent memory: what matters for your week, found by meaning", "CPU · open weights", BLUE, BLUEBG],
      ["VOICE", "Muse Voice Transcribe", "Talk to your agent hands-free, and cut in while it speaks", "Meta Model API · realtime", AMBER, AMBERBG],
    ];
    cards.forEach(([k, h, d, w, c, bg], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.85 + Math.floor(i / 3) * 2.0;
      box(s, x, y, 3.9, 1.8, { fill: bg, line: bg });
      T(s, k, x + 0.22, y + 0.17, 3.4, 0.25, { fontSize: 10, bold: true, color: c, charSpacing: 1 });
      T(s, h, x + 0.22, y + 0.45, 3.5, 0.4, { fontSize: 17, bold: true });
      T(s, d, x + 0.22, y + 0.88, 3.5, 0.55, { fontSize: 12, color: INK });
      T(s, w, x + 0.22, y + 1.43, 3.5, 0.25, { fontSize: 10, color: MUTED });
    });
    box(s, 0.6, 5.95, 12.1, 0.85, { fill: CARD, line: CARD });
    T(s, [{ text: "Also: ", options: { bold: true } }, { text: "DETR, Sapiens2, SAM 2.1, MapAnything (auto-cut highlights) · Omnilingual ASR (voice notes) · Muse Image (posters, agent faces) · Muse Spark (fallback) · Muse Wonder and SAM 3.1 (checks). Of the 15, 12 run in the product and 3 are checks; all 15 in the appendix." }],
      0.8, 5.95, 11.7, 0.85, { fontSize: 12, valign: "middle" });
  }

  // T · Take one model away
  {
    const s = content(SEC, "USE OF META AI · WHY EACH ONE", "Take one away, and this is what breaks",
      "拿掉一個模型會怎樣：Glimmer（整個 agent 不能運作）、學生模型（每次決策從 0.9 秒變 40 秒，模擬中 Glimmer 回答多 54–67%）、DRAMA（第一個找到對的筆記從 0.60 掉到 0.35）、Llama Guard、Prompt Guard、Muse Voice。標明哪些是量測、哪些是設計上的。");
    const H = { bold: true, color: MUTED, fontSize: 11, fill: { color: WHITE } };
    const rows = [
      [{ text: "Without", options: H }, { text: "What breaks", options: H }, { text: "Evidence", options: H }],
      ["Muse Glimmer", "No planner and no agent answers: the product does not run", "by design"],
      ["Llama 3.2 1B student", "Every member answer goes to Glimmer: about 40 s instead of 0.9 s, and 54–67% more Glimmer answers in simulated talks", "measured"],
      ["DRAMA", "The right note comes first 0.35 of the time instead of 0.60 (word matching instead; 20 questions)", "measured, small"],
      ["Llama Guard 3 1B", "Nothing reads every message in and out; code alone reads only plain words. With it: 37 of 42 unsafe refused, 1 of 74 harmless", "by design"],
      ["Prompt Guard 2", "Google reviews and members' ideas reach the models unscreened; poisoned reviews are among the 93 attacks", "by design"],
      ["Muse Voice Transcribe", "No talking hands-free and no cutting in while the agent speaks", "by design"],
    ];
    s.addTable(rows, { x: 0.6, y: 1.9, w: 12.1, colW: [2.8, 7.7, 1.6], fontSize: 13, fontFace: FONT, color: INK, rowH: 0.62, valign: "middle", border: { type: "solid", pt: 0.75, color: LINE }, margin: [0, 0.12, 0, 0.12] });
    T(s, "\"Measured\": numbers from this entry's tests. \"By design\": what the code does without it.", 0.6, 6.55, 12.1, 0.3, { fontSize: 11, color: MUTED, italic: true });
  }

  // 16 · The Glimmer bottleneck, and the student fine-tuned from it
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · 20% · FINE-TUNING", "Muse Glimmer reasons a lot, so I trained a 1B student",
      "痛點與解法同一頁：\n左：記錄了 2,755 次 Muse Glimmer 呼叫，84% 的 token 是推理；關掉 thinking 它還是在隱藏通道推理，預算不夠時 9% 回空白。所以每次呼叫用 think: low 並留推理空間。\n右：把最常見的判斷（會員選哪個時段）交給微調出來的 Llama 3.2 1B（Jev 式決策模型）：用真正的 agent 呼叫讓 Glimmer 標註 4,868 題，LoRA 微調，不生成文字、直接對選項給機率，int4 在 CPU 上約 0.9 秒。留出會員上和 Glimmer 一致 89.5%（Glimmer 跟自己 88.8%），在模擬社團少用 54–67% 的 Glimmer 呼叫。");
    T(s, "WHAT THE LEDGER SHOWED", 0.6, 1.8, 4.2, 0.25, { fontSize: 10.5, bold: true, color: RED, charSpacing: 1 });
    [["2,755", "Muse Glimmer calls in the evaluations' ledgers", INK], ["84%", "of its tokens were reasoning", RED], ["9%", "came back empty: thinking off, it still reasoned in a hidden channel", RED]].forEach(([n, d, c], i) => {
      const y = 2.15 + i * 0.98;
      box(s, 0.6, y, 4.2, 0.86, { fill: WHITE });
      T(s, n, 0.8, y, 1.6, 0.86, { fontSize: 28, bold: true, color: c, valign: "middle" });
      T(s, d, 2.35, y, 2.35, 0.86, { fontSize: 11, valign: "middle" });
    });
    box(s, 0.6, 5.15, 4.2, 1.6, { fill: CARD, line: CARD });
    T(s, [{ text: "So every call asks for think: \"low\" and leaves room to reason. ", options: { bold: true } }, { text: "And the most common choice, which time a member's agent picks, goes to a student that writes nothing.", options: {} }], 0.8, 5.28, 3.85, 1.4, { fontSize: 12 });
    arrow(s, 4.9, 3.6, 0.3, 0, { color: GREEN, width: 2.5 });
    T(s, "THE STUDENT · META'S LLAMA 3.2 1B, FINE-TUNED", 5.35, 1.8, 7.3, 0.25, { fontSize: 10.5, bold: true, color: GREEN, charSpacing: 1 });
    [["Teacher data", "4,868 choices Glimmer made through the real agent call (a separate A100 run); LoRA, 3 epochs, 20 minutes"], ["int4 on the CPU", "0.8 GB; one pass gives a probability per option, about 0.9 s a decision, no text written"]].forEach(([h, d], i) => {
      const x = 5.35 + i * 3.7, y = 2.15;
      box(s, x, y, 3.58, 1.8, { fill: GREENBG, line: GREENBG });
      T(s, h, x + 0.18, y + 0.15, 3.25, 0.35, { fontSize: 15, bold: true });
      T(s, d, x + 0.18, y + 0.6, 3.25, 1.05, { fontSize: 12, color: INK, valign: "top" });
    });
    s.addChart(pres.charts.BAR, [{ name: "Agrees with Glimmer's answer", labels: ["Glimmer vs itself [87.1–90.3]", "First time listed", "1B student [87.9–91.0]"], values: [88.8, 82.7, 89.5] }], {
      x: 5.3, y: 4.2, w: 4.6, h: 2.6, barDir: "bar", chartColors: [SOFT, LINE, GREEN], barGapWidthPct: 45,
      showTitle: true, title: "Agrees with Glimmer, 500 held-out cases, 95% intervals: the same within them", titleFontSize: 11, titleColor: INK, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt", dataLabelColor: INK,
      catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: INK, catAxisOrientation: "maxMin",
      valAxisHidden: true, valAxisMinVal: 60, valAxisMaxVal: 100, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    });
    [["54–67%", "fewer Glimmer answers in simulated talks; on the 500 test cases the student answers 96%", GREEN], ["29 / 32", "stated preferences kept (Glimmer 27)", INK]].forEach(([n, d, c], i) => {
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
    T(s, [{ text: "sure: 0.6 or more", options: { bullet: { indent: 12 }, breakLine: true } }, { text: "its reading of which times work matches code's", options: { bullet: { indent: 12 }, breakLine: true } }, { text: "the student is free within 8 s and answers within 20 s", options: { bullet: { indent: 12 } } }], 5.71, 2.17, 2.2, 1.2, { fontSize: 10.5 });
    // yes: the student's answer; no: Glimmer
    arrow(s, 6.77, 3.42, 0, 0.45, { color: GREEN });
    T(s, "yes", 6.85, 3.47, 0.5, 0.3, { fontSize: 10.5, bold: true, color: GREEN });
    node(5.55, 3.9, 2.45, 1.05, "The student answers", "about 0.9 s on the CPU, a Glimmer call saved", GREENBG, GREENBG, GREEN);
    arrow(s, 3.57, 2.95, 1.96, 0.93, { color: BLUE, flipH: true });
    T(s, "no", 4.05, 3.3, 0.5, 0.3, { fontSize: 10.5, bold: true, color: BLUE });
    node(2.1, 3.9, 2.95, 1.05, "Muse Glimmer reasons", "the full answer: about 600 tokens, 40 s at p50", BLUEBG, BLUE, BLUE);
    // both: checked by code, then over A2A
    arrow(s, 3.57, 4.97, 0, 0.35); arrow(s, 6.77, 4.97, 0, 0.35);
    box(s, 0.6, 5.35, 7.4, 1.4, { fill: CARD, line: CARD });
    T(s, "Checked by code, then sent over A2A", 0.8, 5.47, 7.0, 0.3, { fontSize: 13.5, bold: true });
    T(s, "Whoever answered, code checks the member's hard rules again before the decision goes to the other agent, labelled with the tier that made it. Agent chats shows it under every message. The week planned in the video took 78 s (13 Glimmer calls), in the background.", 0.8, 5.8, 7.0, 0.9, { fontSize: 11, color: MUTED });
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
    T(s, "At 0.6 the student answers 96% of the 500 test cases and still agrees with Glimmer 89.9%; at 0.7 it agrees more on the hardest cases but sends more to Glimmer.", 8.5, 5.92, 4.1, 0.8, { fontSize: 10.5, color: MUTED });
  }

  // 20 · Safe by design
  {
    const s = content("Technical depth", "SAFETY, MEASURED", "No agent holds all three at once",
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
    pill(s, "Measured with a simulated prober", 6.75, 4.98, 3.4, { size: 10.5, color: MUTED });
    box(s, 6.75, 5.55, 5.95, 1.25, { fill: CARD, line: CARD });
    T(s, "93 / 93", 6.95, 5.55, 1.9, 1.25, { fontSize: 30, bold: true, color: GREEN, valign: "middle" });
    T(s, "scripted attacks stopped: injected instructions, poisoned reviews, forged Agent Cards, sock-puppet votes. Unsafe messages: 37 of 42 refused, 1 of 74 harmless ones refused.", 8.85, 5.55, 3.75, 1.25, { fontSize: 10.5, valign: "middle" });
  }

  // R · What is real and what is simulated
  {
    const s = content(SEC, "WHAT IS REAL, WHAT IS SIMULATED", "Real players, real models; simulated test clubs",
      "真實與模擬一頁看清楚：左邊是真的（真人、真模型、真程式），右邊是模擬（測試用的社團與成員，都有標示）。模擬證明 agent 守住成員說過的話，不代表真人的反應；那是真人社團在量的。");
    const col = (x, k, h, fill, line, items) => {
      box(s, x, 1.85, 5.95, 3.75, { fill, line });
      T(s, k, x + 0.3, 1.98, 5.4, 0.25, { fontSize: 10.5, bold: true, color: line, charSpacing: 1 });
      T(s, h, x + 0.3, 2.24, 5.4, 0.4, { fontSize: 16, bold: true });
      T(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: 4 } })), x + 0.3, 2.7, 5.4, 2.85, { fontSize: 11.5, valign: "top" });
    };
    col(0.6, "REAL", "What a judge can trust as is", GREENBG, GREEN, [
      "8 players, 14 accounts, 2 clubs they started, 4 games, 7 joins on the live site (29 Oct)",
      "Every agent's code: A2A over JSON-RPC, signed Agent Cards, holds, crash recovery",
      "Muse Glimmer making every decision in the evaluations; the guards, DRAMA, speech recognition",
      "Courts from OpenStreetMap, real forecasts; Messenger's webhook on a real Page (Facebook and Instagram login wait for Meta's app review: players use a demo sign-in)",
      "Highlights cut from real footage (a CC BY clip)",
    ]);
    col(6.75, "SIMULATED, AND LABELLED SO", "Clubs built for the tests", AMBERBG, AMBER, [
      "The demo club's members, venues and free times (marked demo in the app)",
      "The members in the scale, rules, matchmaking and student tests (seeds 7 and 11)",
      "The community loop's club of 60 and its votes",
      "The 20,000 requests in the asking test; the prober in the disclosure test",
      "The attacks and unsafe messages: labelled tests I wrote",
    ]);
    box(s, 0.6, 5.75, 12.1, 0.95, { fill: REDBG, line: REDBG });
    T(s, "KNOWN FAILURES", 0.85, 5.85, 3, 0.25, { fontSize: 10.5, bold: true, color: RED, charSpacing: 1 });
    T(s, "5 of 42 unsafe messages got past Llama Guard and code · 1 of 74 harmless ones refused · 9% of Glimmer calls came back empty (mostly a small budget: every call now has room to reason) · with a rule only in a member's words, Glimmer broke it in 1 of 60 talks", 0.85, 6.1, 11.6, 0.55, { fontSize: 11 });
    T(s, "The simulations show the agents keep what members stated; they do not show how real people react. The live club measures that.", 0.6, 6.78, 12.1, 0.3, { fontSize: 10.5, color: MUTED, italic: true });
  }

  // B · What was built during the hackathon
  {
    const s = content(SEC, "BUILT DURING THE HACKATHON · OCT 27 – NOV 4, 2026", "New here, mine from before, third party",
      "開發範圍：比賽期間做的（全部程式碼、微調的 1B 學生模型、Demo 影片）、我之前就有的（TrackNetV5，關閉、本作品沒用到）、第三方照原樣使用的模型、軟體與資料。repo 歷史從 10/28（第二天）開始，900 多個 commit。");
    const col = (x, w, k, h, fill, line, items, size) => {
      box(s, x, 1.85, w, 4.8, { fill, line });
      T(s, k, x + 0.25, 2.0, w - 0.5, 0.25, { fontSize: 10.5, bold: true, color: line, charSpacing: 1 });
      T(s, h, x + 0.25, 2.28, w - 0.5, 0.4, { fontSize: 16, bold: true });
      T(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < items.length - 1, paraSpaceAfter: 5 } })), x + 0.25, 2.78, w - 0.5, 3.8, { fontSize: size, valign: "top" });
    };
    col(0.6, 4.6, "BUILT HERE", "All the code", GREENBG, GREEN, [
      "The gateway and every agent; A2A and its signing; matchmaking; memory and beliefs",
      "The community loop and its builder; the highlight pipeline's code",
      "The web app, members, clubs, the per-player gateways",
      "The Llama 3.2 1B student, fine-tuned from Glimmer's choices",
      "Every test and evaluation; the demo video (2:27)",
      "Started Oct 28 (day 2 of the hackathon); over 900 commits since",
    ], 12);
    col(5.35, 2.6, "MINE, FROM BEFORE", "Off in this entry", CARD, MUTED, [
      "TrackNetV5, my published shuttle tracker (ICIP 2026): off by default, not loaded in this entry",
    ], 12);
    col(8.1, 4.6, "THIRD PARTY, AS PUBLISHED", "Models, software, data", BLUEBG, BLUE, [
      "Meta: Muse Glimmer, Llama 3.2 1B, Llama Guard 3, Prompt Guard 2, DRAMA, Omnilingual ASR, DETR, Sapiens2, SAM 2.1, MapAnything; API: Muse Spark, Voice Transcribe, Image, Wonder, SAM 3.1",
      "Other models: Kokoro (speech), IBM Granite (optional), WASB (off)",
      "Software: A2A SDK, Ollama, Transformers, OpenTelemetry, React, Vite, Leaflet, Cloudflare tunnel",
      "Data: OpenStreetMap, Open-Meteo, Google Places, CC BY clips (credited)",
    ], 11);
  }

  // V · The demo video
  {
    const s = content(SEC, "DEMO · 25% · THE VIDEO, 2:27", "Three acts, all in the running app",
      "Demo 影片 2:27，三幕：一、冷啟動：Leo 沒有帳號，點連結就加入，Mia 同時收到 Game on（並排）；二、agent 透過 A2A 協商，Hana 的 agent 提出反提案（Messenger 裡一個 yes 就訂好也在這一幕）；三、找球場：Prompt Guard 2 先過濾評論，再由 Muse Glimmer 判斷（14 倍速，有標示），然後是社團。");
    [["0:41", "Act 1 · cold start: Leo has no account, the link joins him, and Mia hears \"Game on\" at once"], ["1:15", "Act 2 · A2A: Hana's agent makes a real counter-offer; one yes in Messenger books it (end-to-end test)"], ["1:25", "Act 3 · courts: Prompt Guard 2 screens reviews, then Muse Glimmer judges (shown at 14×, labelled)"]].forEach(([t, d], i) => {
      const x = 0.6 + i * 4.1;
      s.addImage({ data: IMG.frames[i], x, y: 1.95, w: 3.9, h: 3.9 * 9 / 16 });
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.95, w: 3.9, h: 3.9 * 9 / 16, fill: { type: "none" }, line: { color: LINE, width: 1 } });
      pill(s, t, x, 4.35, 0.8, { fill: GREEN, line: GREEN, color: WHITE, size: 11 });
      T(s, d, x, 4.8, 3.9, 0.8, { fontSize: 12.5 });
    });
    T(s, "Every speed-up is labelled on screen. The video shows only what this deck lists as built during the hackathon (slide 18).", 0.6, 6.3, 12.1, 0.4, { fontSize: 12, color: MUTED, italic: true });
  }

  // 24 · End
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: SEC });
    s.addImage({ data: IMG.serve, x: 4.55, y: 1.25, w: 1.1, h: 1.1 });
    T(s, "serve", 5.75, 1.2, 3.5, 1.2, { fontSize: 72, bold: true, valign: "middle" });
    T(s, [{ text: "Play more. ", options: { color: INK } }, { text: "Manage less.", options: { color: GREEN } }], 1, 2.75, 11.333, 0.8, { fontSize: 40, bold: true, align: "center" });
    T(s, "The agent that gets you playing, in any ball sport.", 1, 3.6, 11.333, 0.5, { fontSize: 20, color: MUTED, align: "center" });
    pill(s, "Your week, agreed agent to agent", 1.45, 4.45, 3.3, { h: 0.5, size: 13 });
    pill(s, "Your agent in Messenger", 4.9, 4.45, 2.9, { h: 0.5, size: 13 });
    pill(s, "Auto-cut highlights to Instagram", 7.95, 4.45, 3.95, { h: 0.5, size: 13 });
    T(s, "Built Oct 28 – Nov 4, 2026, during the hackathon · demo video 2:27 · what is new and what is not: slide 18", 1, 5.4, 11.333, 0.35, { fontSize: 13, bold: true, align: "center" });
    T(s, "github.com/gino6178/serve-meta-hackathon  ·  live: https://play.theminimallab.com", 1, 5.78, 11.333, 0.35, { fontSize: 13, color: BLUE, align: "center" });
    T(s, "The product runs Muse Glimmer on an RTX 3090 I own; cloud A100s ran evaluations, including the A2A test's second gateway", 1, 6.6, 11.333, 0.36, { fontSize: 13, color: MUTED, align: "center", valign: "middle" });
    s.addNotes("片尾：Play more, manage less. 黑客松期間開發聲明（TrackNetV5 除外）、repo 連結、Built on Muse Glimmer。\n旁白：That's Serve. Play more, manage less.");
  }

  // A · Appendix
  SEC = "Appendix";
  pres.addSection({ title: "Appendix" });
  {
    const s = pres.addSlide({ masterName: "BLANK", sectionTitle: SEC });
    T(s, "APPENDIX", 0.8, 2.4, 11, 0.4, { fontSize: 14, bold: true, color: GREEN, charSpacing: 2 });
    T(s, "The details behind the main slides", 0.8, 2.85, 11.5, 0.9, { fontSize: 40, bold: true });
    T(s, "The agent and A2A · all 15 Meta models · the social app · auto-cut highlights · agents as members · voice · federated clubs · memory · agent architecture · scale · the self-evolving club · every number and its source · the full architecture", 0.8, 3.95, 11.5, 1.2, { fontSize: 16, color: MUTED });
  }

  // 12 · Agents
  {
    const s = content("Use of Meta AI", "AN AGENT, NOT A CHATBOT", "Glimmer plans, agents agree, code decides",
      "規劃 agent：Muse Glimmer 用原生 tool calling 一步一步叫工具，被拒絕的呼叫會變成事實回來，它重新規劃。A2A：每個會員一個 agent、簽章的 Agent Card、一輪就談完、談好的時間先鎖 30 分鐘、每輪存檔可續跑。兩台機器（台北的 GPU 伺服器 + GCP A100）跨網路 22/22 項檢查通過。\n旁白：Then it plans my week… Then it negotiates with three friends' agents at once, over A2A.");
    box(s, 0.6, 1.85, 5.85, 4.95, { fill: WHITE });
    T(s, "The planner agent · a tool loop", 0.85, 2.05, 5.3, 0.4, { fontSize: 18, bold: true });
    T(s, "Muse Glimmer picks the next tool; code runs it with checked arguments and hands back the facts.", 0.85, 2.5, 5.4, 0.6, { fontSize: 12.5, color: MUTED });
    ["get_week", "check_limits", "recall", "find_partners", "find_places", "negotiate", "request_approval", "nudge", "finish"].forEach((t, i) => {
      const x = 0.85 + (i % 3) * 1.8, y = 3.2 + Math.floor(i / 3) * 0.42;
      pill(s, t, x, y, 1.7, { fill: GREENBG, line: GREENBG, color: GREEN, size: 10, h: 0.34 });
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
      ["Usually one round", "Each agent marks the times that work; code picks from the overlap; a counter-offer if none fits"],
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

  // 11 · Meta stack
  {
    const s = content("Use of Meta AI", "ALL 15 META MODELS", "15 Meta models: 12 in the product, 3 for checks",
      "這頁讓評審一眼看到用了哪些 Meta 的東西：15 個 Meta 模型（10 個開放權重在我自己的伺服器上跑，5 個走 Meta Model API）＋ Messenger、Instagram/Facebook，再加上 Meta 的 Agents Rule of Two 框架。\n說法：Muse Glimmer 是大腦；1B 學生模型分擔簡單決策；兩個 guard 把關進出；DRAMA 是記憶；四個視覺模型做 highlight；Messenger 是入口。");
    const G = { Reasoning: [GREEN, GREENBG], Safety: [RED, REDBG], Memory: [MUTED, CARD], Voice: [MUTED, CARD], Vision: [BLUE, BLUEBG], "3D": [BLUE, BLUEBG], API: [AMBER, AMBERBG], Product: [BLUE, WHITE] };
    const items = [
      ["Reasoning", "Muse Glimmer", "Every agent: the tool loop, members' decisions, photos, courts, captions", "RTX 3090 · Ollama · 4 in parallel"],
      ["Reasoning", "Llama 3.2 1B", "Distilled from Glimmer; answers alone when sure", "CPU · in the app"],
      ["Safety", "Llama Guard 3 1B", "What you write, what a model writes, every idea shared with the club", "CPU"],
      ["Safety", "Prompt Guard 2", "Google reviews before the court judge reads them; shared ideas", "CPU · 86M"],
      ["Memory", "DRAMA", "Agent memory: what matters for your week, by meaning", "CPU"],
      ["Voice", "Omnilingual ASR", "Voice notes in Messenger to text", "CPU · CTC 1B"],
      ["Vision", "DETR", "Finds the people in your video, so the reel follows you", "GPU"],
      ["Vision", "Sapiens2", "Finds the moment worth sharing in your clip", "GPU · 0.4B"],
      ["Vision", "SAM 2.1", "Cuts each player out for the spotlight and the drawn view", "GPU · Hiera-L"],
      ["3D", "MapAnything", "Depth and the camera for the orbit camera effect", "GPU · optional effect"],
      ["API", "Muse Spark 1.3", "The fallback when my GPU can't answer; the builder's model for new code (Muse Code's family)", "Meta Model API · tested live"],
      ["API", "SAM 3.1", "Checked on the smash against SAM 2.1: same player, IoU 0.97", "Meta Model API · one call"],
      ["API", "Muse Image", "Rematch poster art; a face for every agent, made once", "Meta Model API · $0.01 an image"],
      ["API", "Muse Wonder", "Judges orbit frames for a doubled net or a smear, beside the pixel rule", "Meta Model API · 84 frames"],
      ["API", "Muse Voice", "Transcribe, realtime: talk with your agent and cut in when you like", "Meta Model API · Transcribe"],
      ["Product", "Meta apps", "Not in the 15. Messenger: your agent in your chats; Facebook or IG login; share reels", "Webhook · Send API · Login"],
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
    T(s, "10 open weights on my server (GPU and CPU); 5 on the Meta Model API. Spark, SAM 3.1 and Wonder: fallback and checks.", 0.6, 6.66, 12, 0.3, { fontSize: 12, bold: true, valign: "middle" });
  }

  // 5 · The social app
  {
    const s = content("Demo", "THE SOCIAL APP", "Your club, made by people and agents together",
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

  // 9 · Highlights
  {
    const s = content("Demo", "THURSDAY · AUTO-EDITED · FOUR META VISION MODELS", "Your phone video, cut automatically into a clip to share",
      "Highlight 管線（右邊都是同一記殺球：SAM 2.1 去背、MapAnything 深度、俯視環繞圖和沿弧線算繪出的三格）：DETR 找人 → Sapiens2 找出值得分享的片刻（自動剪輯，不做動作分析）→ SAM 2.1 把你切出來 → MapAnything 算深度和相機，時間暫停、鏡頭繞 20° → Muse Glimmer 寫說明，程式核對 → 一鍵分享到 Instagram。影片不離開伺服器。\n旁白：Thursday, game done. I upload a phone clip… With MapAnything, time stops and the camera turns around the smash.");
    const flow = [["DETR", "finds the players"], ["Sapiens2", "finds the moment worth sharing"], ["SAM 2.1", "cuts you out; SAM 3.1 checked it once"], ["MapAnything", "depth and camera: time stops, the camera turns up to 12°"], ["Muse Glimmer", "writes the caption, checked by code"]];
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
    node(3.6, 1.85, 2.2, 1.35, "HEAR", "Muse Voice Transcribe", "Realtime, on the Meta Model API: your audio goes there; it finds where your turn ends", AMBERBG, AMBER);
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

  // 18 · Agent memory: found by meaning with Meta's DRAMA, checked by code
  {
    const s = content("Technical depth", "TECHNICAL DEPTH · AGENT MEMORY", "Notes that update themselves, checked by code",
      "Agent 記憶（agent/src/memory/memory.js、body/context.js）：\n寫入：筆記只來自玩家自己的話和程式產生的事實（比賽、健康 app），其他 agent 寫的東西永遠不會變成筆記（防記憶注入）。新的一句話會跟舊筆記比對：新增、取代、或重複（類似 Mem0）。被取代的筆記保留但不再被檢索。\n檢索：Meta 的 DRAMA（drama-base，768 維）在伺服器 CPU 上把問題和筆記變成向量，用餘弦相似度乘上時間衰減排序（身體筆記 7 天減半），取前幾名。\n生成與接地：Muse Glimmer 拿這些筆記規劃這週；規則由程式從紀錄產生，每條附上來源筆記，程式檢查引用的是同一個部位。\n數字：20 題規劃問題中 DRAMA 第一名就對 12 題（Recall@1 0.60，BM25 0.35）；有更新機制時過期筆記 0 筆還被當真（只追加是 15 筆）、規則正確 90.5%（52.4%）；玩家兩週前說先不要約 Tomás，有記憶時 3/3 都排除他，沒記憶 0/3。");
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
    T(s, "Two weeks after the player said to leave Tomás out, the planner left him out in 3 of 3 weeks with memory on, and in 0 of 3 with it off (a small test).", 0.8, 6.02, 5.6, 0.7, { fontSize: 10.5, color: MUTED });
    s.addChart(pres.charts.BAR, [
      { name: "Meta's DRAMA", labels: ["Recall@1", "Recall@3", "MRR"], values: [0.60, 0.75, 0.696] },
      { name: "BM25 (words)", labels: ["Recall@1", "Recall@3", "MRR"], values: [0.35, 0.45, 0.422] },
    ], {
      x: 6.9, y: 1.75, w: 5.85, h: 3.0, barDir: "col", barGrouping: "clustered", chartColors: [BLUE, LINE], barGapWidthPct: 60,
      showTitle: true, title: "Finding the right note: 20 planning questions, 41 notes each (a small test)", titleFontSize: 12, titleColor: INK, titleFontFace: "+mn-lt",
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

  // 19b · Four pieces of agent architecture
  {
    const s = content("Technical depth", "AGENT ARCHITECTURE · TESTED IN CODE AND SIMULATION", "An agent that asks, doubts, abstracts and proves",
      "四個代理架構：\n1 主動資訊探詢（VoI）：談判失敗時不放棄、不把問題丟回給使用者，用 Beta 後驗（只來自它看過的 yes/no，不看別人的行事曆）× 對方 agent 的意願，算出「問哪一題最能提高成局機率」，只問一個是非題，答是才再談。模擬 20,000 次：一題 + 一次談判成局 51.9%，不問 40.7%、隨便問 44.4%、問最可能的那組 48.2%。\n2 談判中的批評者：對方 agent 的每個反提案先經過程式審查——一場談判問超過兩個不同時間＝在探測你的行程，不再接受；你最近三場有兩場路最遠，又要你跑最遠就拒絕。\n3 從片段到信念：每週把零散筆記抽象成幾條長期信念，每條必須引用筆記、概括要兩條以上、數字必須出現在引用裡，不合格就丟。Glimmer 實測 10 條筆記 → 3 條信念，0 條被丟。\n4 預約前的同意證明：談妥的比賽每位球員的 agent 用自己的 Ed25519 金鑰簽同一份比賽紀錄，預約時逐一驗證，改過時間、加人、用別人的金鑰都會被拒絕。");
    const cards = [
      ["Asks", "Active epistemic querying", "When talks fail, a Beta posterior per member and hour (from yes/no it has seen, never a calendar) times their chance of a yes picks the one question that most raises the chance of a game.", "One question, then a talk: 51.9% games, against 40.7% asking nothing, 44.4% a random question (20,000 simulated requests)", GREEN, GREENBG],
      ["Doubts", "A critic on every counter-offer", "Code reviews each counter for the player: more than two times asked in a talk is probing, and the player who keeps travelling furthest is not sent furthest again.", "Probing and unfair counters refused, with the reason in the trail", AMBER, AMBERBG],
      ["Abstracts", "From episodes to beliefs", "Weekly, Glimmer turns scattered notes into standing beliefs; each must cite live notes, two to generalize, and say no number they do not.", "10 notes to 3 beliefs, each on two notes, none dropped (Glimmer, 42 s)", BLUE, BLUEBG],
      ["Proves", "Proof of consent", "Every player's agent signs the agreed game with its own Ed25519 key; booking checks each one against the game it books.", "A changed time, an added player or another agent's key: refused", RED, REDBG],
    ];
    cards.forEach(([k, h, d, r, c, bg], i) => {
      const x = 0.6 + (i % 2) * 6.15, y = 1.8 + Math.floor(i / 2) * 2.55, w = 5.95, hh = 2.4;
      box(s, x, y, w, hh, { fill: WHITE, line: LINE });
      T(s, k.toUpperCase(), x + 0.2, y + 0.15, 2, 0.25, { fontSize: 10, bold: true, color: c, charSpacing: 1 });
      T(s, h, x + 0.2, y + 0.42, w - 0.4, 0.35, { fontSize: 15, bold: true });
      T(s, d, x + 0.2, y + 0.82, w - 0.4, 0.85, { fontSize: 10.5, color: MUTED });
      box(s, x + 0.2, y + 1.72, w - 0.4, 0.55, { fill: bg, line: bg });
      T(s, r, x + 0.32, y + 1.72, w - 0.64, 0.55, { fontSize: 10.5, bold: true, valign: "middle" });
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

  // 21 · Community loop, with what happened in the simulated club
  {
    const s = content("Technical depth", "SELF-EVOLVING", "The club makes itself better, safely",
      "自我演化的社團：會員在 Messenger 打 /idea 或按讚 → DRAMA 依語意分群，5 人提到才出現 → 二次方投票 → Muse Glimmer 寫規格、人工核准 → coding agent 在自己的分支上實作（從不讀社群文字）→ 九道關卡，第一個失敗就停 → 小規模上線，倒讚變多就自己關掉。\n真實案例（模擬社團 seed 7，管線、關卡、回滾是真的；technical report 5.6）：會員說「晚點再問我」→ 規格 C0：ask.hour 12 → 18，上線給 31 位 beta 會員中的 5 位，倒讚 29% → 23%，升級。故意植入的壞改動 ask.ahead 3 → 2 給 8 人的 canary：倒讚 40% → 60%，自動回滾。\n旁白：And the club evolves itself…");
    pill(s, "A simulated club of 60 (seed 7) · the pipeline, gates and rollback are real", 6.7, 0.42, 6.0, { size: 10.5, color: MUTED });
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
    ["policy", "code scan", "unit tests", "crash matrix", "red team", "end to end", "planner pass^3", "oracle", "privacy canary"].forEach((g, i) => {
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
    const s = content("Technical depth", "MEASURED", "The numbers, and where each comes from",
      "證據頁：每個數字都有 log。e2e、攻擊測試在雲端 A100 上用同一個 Muse Glimmer（同一個 model digest）跑。可以快速帶過，或只在影片片尾字卡出現。");
    [["93/93", "attacks stopped"], ["58/58", "Messenger end-to-end checks"], ["22/22", "A2A checks across two machines"], ["37/42", "unsafe messages refused (1 of 74 harmless)"]].forEach(([n, d], i) => {
      const x = 0.6 + i * 3.06;
      box(s, x, 1.85, 2.92, 1.35, { fill: i === 0 ? GREENBG : CARD, line: i === 0 ? GREENBG : CARD });
      T(s, n, x + 0.22, 1.95, 2.5, 0.72, { fontSize: 34, bold: true, color: i === 0 ? GREEN : INK });
      T(s, d, x + 0.22, 2.68, 2.5, 0.4, { fontSize: 12, color: MUTED });
    });
    const H = { bold: true, color: MUTED, fontSize: 11, fill: { color: WHITE } };
    const rows = [
      [{ text: "Suite", options: H }, { text: "Result", options: H }, { text: "Where it ran", options: H }],
      ["npm test, 25 offline suites", "275 = 270 pass + 3 optional + 2 Linux-only", "No model, no GPU"],
      ["Messenger end to end (test/e2e.mjs)", "58 of 58 checks", "Muse Glimmer on a cloud A100"],
      ["Attacks (test/redteam.mjs)", "93 of 93 stopped", "A cloud A100, twice"],
      ["Community loop's attacks, within the 93", "29 of 29 stopped, 5 of 5 controls passed", "The server's CPU, with the real guards"],
      ["A2A between two gateways", "22 of 22 checks", "Taipei GPU server and a GCP A100"],
      ["Crash matrix", "20 of 20 checks (201 of 201 assertions)", "A stand-in model"],
      ["Unsafe messages: Llama Guard, then code", "37 of 42 refused; 1 of 74 harmless ones refused", "The server's CPU"],
      ["A federation of three clubs (test/federation_unit.mjs)", "4 of 4: found, signed, rotated, forgery refused", "Real HTTP, one host"],
      ["\"I want to play\" in Messenger", "13 of 13 checks", "Muse Glimmer on a cloud A100"],
    ];
    rows.forEach((r, i) => { if (i && typeof r[2] === "string" && /Muse Glimmer|A cloud A100/.test(r[2])) rows[i] = r.map((t) => ({ text: t, options: { bold: true } })); });
    T(s, "Bold: run with the real model. \"A cloud A100\": the same Muse Glimmer build that runs the product on the RTX 3090.", 0.6, 6.8, 12.1, 0.25, { fontSize: 10, color: MUTED, italic: true });
    s.addTable(rows, { x: 0.6, y: 3.4, w: 12.1, colW: [5.0, 3.9, 3.2], fontSize: 11.5, fontFace: FONT, color: INK, rowH: 0.33, border: { type: "solid", pt: 0.75, color: LINE }, margin: [0, 0.1, 0, 0.1], valign: "middle" });
  }

  // 23 · Full technical architecture
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
      ["Scheduling context", "your words, games, health app · found by DRAMA · rules cite notes"],
      ["Courts near you", "map, reviews, forecast · 4 judged at once · reasons cited"],
      ["Social feed and members", "Facebook / Instagram login · invites · stories · signed agent channel"],
      ["Auto highlights", "cut automatically: find you, the moment to share · orbit effect · caption"],
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
      ["Meta Model API · key on the server", "Muse Spark 1.3 (fallback) · Muse Voice Transcribe · Muse Image · Muse Wonder (judges orbits) · SAM 3.1 (checked once)", AMBERBG, AMBER, 0.95],
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

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
