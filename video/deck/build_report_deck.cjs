// The technical report (submission/technical_report.md) as a slide deck: node build_report_deck.cjs [out.pptx]
// One message per slide, in the report's order, with the upgrades measured since it was written near the end. Every
// number is the report's or the README's, from submission/results/. Speaker notes carry what each slide says.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const SHOTS = path.join(ROOT, "submission/shots");
const OUT = process.argv[2] || path.join(ROOT, "submission/pdf/serve_technical_report.pptx");
const THEME_JS = process.env.APPLY_THEME || "";

const THEME = {
  name: "Serve",
  headFontFace: "Segoe UI Semibold",
  bodyFontFace: "Segoe UI",
  colors: { dk1: "0A0A0B", lt1: "FFFFFF", dk2: "14241B", lt2: "F3F6F4", accent1: "0A7F44", accent2: "0064E0", accent3: "D1352B", accent4: "B26A00", accent5: "55555C", accent6: "8A8A92", hlink: "0064E0", folHlink: "55555C" },
};
const HEX = { ink: "0A0A0B", green: "0A7F44", greenBg: "E9F3EC", muted: "55555C", soft: "8A8A92", line: "DCDCE0", card: "F3F6F4", blue: "0064E0", red: "D1352B", amber: "B26A00", dark: "14241B" };

async function img(file, width = 1800) {
  const s = sharp(file, file.endsWith(".svg") ? { density: 220 } : {});
  const buf = await s.resize({ width, withoutEnlargement: !file.endsWith(".svg") }).flatten({ background: "#ffffff" }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { data: "image/png;base64," + buf.toString("base64"), ratio: m.height / m.width };
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = "Serve: technical report";
  pres.author = "Serve";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333, H = 7.5, M = 0.6;

  // layouts: a dark title frame, a light content frame with the title at the top and the slide number
  pres.defineSlideMaster({ title: "DARK", background: { color: HEX.dark }, objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.3, w: 8.6, h: 1.6, fontSize: 48, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.05, w: 8.6, h: 1.2, fontSize: 20, color: "C9D6CE", valign: "top", align: "left", margin: 0 }, text: "" } },
  ] });
  pres.defineSlideMaster({ title: "CONTENT", background: { color: "FFFFFF" }, slideNumber: { x: W - 1.0, y: H - 0.45, w: 0.5, h: 0.3, fontSize: 10, color: HEX.soft, align: "right" }, objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.4, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Serve · technical report", options: { x: M, y: H - 0.45, w: 4, h: 0.3, fontSize: 10, color: HEX.soft, margin: 0 } } },
  ] });

  const I = {
    arch: await img(path.join(ROOT, "submission/architecture.png"), 1600),
    flow: await img(path.join(SHOTS, "flow_four.png"), 2000),
    strip: await img(path.join(SHOTS, "highlight_strip.png"), 1952),
    booking: await img(path.join(SHOTS, "booking_sequence.svg"), 1900),
    chats: await img(path.join(SHOTS, "v3/agent_chats.png"), 700),
    swarm: await img(path.join(__dirname, "swarm.png"), 2400),
  };
  const note = (s, t) => s.addNotes(t);
  const title = (s, t) => s.addText(t, { placeholder: "title" });
  const text = (s, runs, o) => s.addText(runs, { isTextBox: true, margin: 0, fontSize: 15, color: HEX.ink, valign: "top", paraSpaceAfter: 6, ...o });
  const bullets = (items) => items.map((t, i) => {
    const [head, rest] = Array.isArray(t) ? t : [null, t];
    const br = i < items.length - 1;
    return head ? [{ text: head + " ", options: { bold: true, bullet: true } }, { text: rest, options: { breakLine: br } }] : [{ text: rest, options: { bullet: true, breakLine: br } }];
  }).flat();
  const card = (s, x, y, w, h, fill = HEX.card) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
  const stat = (s, x, y, w, big, label, color = HEX.green) => {
    card(s, x, y, w, 1.65);
    s.addText(big, { isTextBox: true, x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.75, fontSize: 36, bold: true, color, margin: 0, fontFace: THEME.headFontFace });
    s.addText(label, { isTextBox: true, x: x + 0.25, y: y + 0.92, w: w - 0.5, h: 0.65, fontSize: 13, color: HEX.muted, margin: 0, valign: "top" });
  };
  const picture = (s, im, x, y, w, maxH) => { let ww = w, hh = w * im.ratio; if (maxH && hh > maxH) { hh = maxH; ww = hh / im.ratio; } s.addImage({ data: im.data, x: x + (w - ww) / 2, y, w: ww, h: hh }); return hh; };
  const bar = (s, labels, values, o) => s.addChart(pres.charts.BAR, [{ name: o.name || "value", labels, values }], {
    x: o.x, y: o.y, w: o.w, h: o.h, barDir: o.dir || "bar", chartColors: o.colors || [HEX.green], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: o.fmt || "0.0", dataLabelFontSize: 12, dataLabelColor: HEX.ink,
    catAxisLabelColor: HEX.muted, catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: !!o.title, title: o.title, titleFontSize: 13, titleColor: HEX.muted, catAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt", valAxisMinVal: o.min ?? 0, valAxisMaxVal: o.max,
    ...(o.varyColors ? { } : {}) });
  // several series on one chart: columns side by side, or lines
  const multi = (s, type, series, o) => s.addChart(type, series, {
    x: o.x, y: o.y, w: o.w, h: o.h, barDir: "col", barGrouping: "clustered", chartColors: o.colors, showValue: !!o.values, dataLabelPosition: "outEnd", dataLabelFormatCode: o.fmt || "0", dataLabelFontSize: 10, dataLabelColor: HEX.ink,
    catAxisLabelColor: HEX.muted, catAxisLabelFontSize: 11, valAxisLabelColor: HEX.muted, valAxisLabelFontSize: 10, valAxisHidden: !!o.hideVal, valGridLine: { color: "E6E8E7", size: 0.5 }, catGridLine: { style: "none" },
    showLegend: series.length > 1, legendPos: "t", legendFontSize: 11, legendColor: HEX.muted, legendFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt",
    showTitle: !!o.title, title: o.title, titleFontSize: 13, titleColor: HEX.muted, valAxisMinVal: o.min ?? 0, valAxisMaxVal: o.max, lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
    ...(o.catTitle ? { showCatAxisTitle: true, catAxisTitle: o.catTitle, catAxisTitleFontSize: 11, catAxisTitleColor: HEX.muted } : {}) });
  const arrow = (s, x1, y1, x2, y2, color = HEX.soft) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipV: y2 < y1, line: { color, width: 2, endArrowType: "triangle" } });
  // a box with a bold head and a smaller line under it
  const box = (s, x, y, w, h, head, sub, fill = HEX.card, ink = HEX.ink) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
    s.addText([{ text: head, options: { bold: true, fontSize: 14, breakLine: !!sub } }, ...(sub ? [{ text: sub, options: { fontSize: 11.5, color: ink === "FFFFFF" ? "D9EBDF" : HEX.muted } }] : [])], { isTextBox: true, x: x + 0.15, y, w: w - 0.3, h, valign: "middle", align: "center", margin: 0, color: ink });
  };

  // 1. title
  let s = pres.addSlide({ masterName: "DARK" });
  picture(s, I.chats, W - 3.6, 0.6, 2.9, 6.3);
  title(s, "Serve: Play more.\nManage less.");
  s.addText("Technical report · Meta Global AI Developer Hackathon 2026 · Indie Developer track", { placeholder: "body" });
  s.addText("play.theminimallab.com · github.com/gino6178/serve-meta-hackathon", { isTextBox: true, x: M, y: H - 1.0, w: 9, h: 0.4, fontSize: 14, color: "9FB3A7", margin: 0 });
  note(s, "Serve is a platform where people and agents make games together. This deck follows the technical report: impact, technical depth, Meta models, and what is not done yet.");

  // 2. impact: the three barriers
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "The pain: people stop playing because organising is hard");
  // who plays, by age
  bar(s, ["18 to 21", "26 to 49"], [40, 26], { x: M, y: 1.4, w: 3.6, h: 4.2, dir: "col", title: "Play a sport, by age (%)", fmt: "0", max: 50, colors: [HEX.soft] });
  text(s, "NPR, RWJF and Harvard Chan poll, 2015", { x: M, y: 5.65, w: 3.6, h: 0.35, fontSize: 11, color: HEX.muted });
  // what stops them, each answered by a helper
  bar(s, ["No regular people to play with", "No way to keep the habit going", "Times hard to fit around other commitments"], [10.2, 21.3, 64.2], { x: M + 3.9, y: 1.4, w: 5.3, h: 4.2, title: "What stops adults playing regularly (%)", fmt: "0.0", max: 80, colors: [HEX.red] });
  text(s, "Sport New Zealand, Active NZ survey, 2023", { x: M + 3.9, y: 5.65, w: 5.3, h: 0.35, fontSize: 11, color: HEX.muted });
  [["Talk", "fits the time: the agents agree it among themselves"], ["Match", "keeps the habit: it asks first, at the player's usual times"], ["The agents", "find the people: free players nearby, ranked"]].forEach(([h, d], i) => {
    const y = 1.55 + i * 1.33;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 9.5, y, w: W - 2 * M - 9.5, h: 1.13, fill: { color: HEX.greenBg }, line: { color: HEX.greenBg }, rectRadius: 0.08 });
    s.addText([{ text: h, options: { bold: true, fontSize: 16, color: HEX.green, breakLine: true } }, { text: d, options: { fontSize: 12 } }], { isTextBox: true, x: M + 9.7, y, w: W - 2 * M - 9.9, h: 1.13, valign: "middle", margin: 0, color: HEX.ink });
  });
  text(s, [{ text: "Most people who stop have not lost interest: they are worn down by organising. Serve turns hours of back-and-forth into " }, { text: "one yes from each person.", options: { bold: true, color: HEX.green } }], { x: M, y: 6.25, w: W - 2 * M, h: 0.5, fontSize: 15 });
  note(s, "40% of 18 to 21 year olds played a sport but only 26% of 26 to 49 year olds. The top barrier, times that are hard to fit together, is 64.2%. Each barrier maps to one of Serve's helpers.");

  // 2b. a group-chat poll against Serve, step by step
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A group-chat poll against Serve, step by step");
  const lane = (x, w, head, color, steps) => {
    s.addText(head, { isTextBox: true, x, y: 1.35, w, h: 0.45, fontSize: 18, bold: true, color, margin: 0 });
    steps.forEach(([t, who], i) => {
      const y = 1.95 + i * 0.78, mine = who === "me";
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mine ? x + 0.9 : x, y, w: w - 0.9, h: 0.62, fill: { color: mine ? (color === HEX.green ? HEX.green : "E4E6E5") : HEX.card }, line: { color: mine ? (color === HEX.green ? HEX.green : "E4E6E5") : HEX.card }, rectRadius: 0.12 });
      s.addText(t, { isTextBox: true, x: (mine ? x + 0.9 : x) + 0.2, y, w: w - 1.3, h: 0.62, fontSize: 13, color: mine && color === HEX.green ? "FFFFFF" : HEX.ink, valign: "middle", margin: 0 });
    });
  };
  lane(M, 5.7, "Group chat: the organiser does everything", HEX.muted, [["Anyone up for badminton this week?", "me"], ["Maybe Thu? / Sat works / not Fri", "them"], ["Poll: Tue 19 · Thu 20 · Sat 10", "me"], ["Votes trickle in over a day", "them"], ["Books the court, posts the result", "me"], ["Someone new? Add them to the chat first", "me"]]);
  lane(M + 6.4, W - 2 * M - 6.4, "Serve: one sentence, one tap each", HEX.green, [["“Doubles on Saturday”", "me"], ["The card: the day, the nearest court, 7 ms", "them"], ["The players' agents agree the time in the background", "them"], ["Each person taps once: one yes", "me"], ["Booked; the agent posts each join in the thread", "them"]]);
  note(s, "Settled when: in the group chat, when everyone has voted and the organiser posts; in Serve, when the spots fill. Someone not in the group opens the link and joins.");

  // 3. a first real club, and the flow
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A first real club: 3 invites, 2 games played in three days");
  picture(s, I.flow, M, 1.4, W - 2 * M, 3.3);
  card(s, M, 4.95, 5.9, 1.65);
  text(s, [{ text: "More than 10 people", options: { bold: true, breakLine: true } }, { text: "of a real badminton club used Serve during the hackathon; of the 3 game invites sent through it, 2 became games that were played." }], { x: M + 0.25, y: 5.12, w: 5.4, h: 1.4, fontSize: 14 });
  card(s, M + 6.2, 4.95, W - 2 * M - 6.2, 1.65, HEX.greenBg);
  text(s, [{ text: "“It's actually really handy. You just talk to the agent.”", options: { italic: true, breakLine: true } }, { text: "“The way it suggests games first can make people more motivated to play.”", options: { italic: true, breakLine: true } }, { text: "Players A and B, translated from Chinese", options: { fontSize: 11, color: HEX.muted } }], { x: M + 6.45, y: 5.12, w: W - 2 * M - 6.7, h: 1.4, fontSize: 14 });
  note(s, "On the web a sentence becomes an invite, the players' agents agree the time, one tap books it; in Messenger the same booking, with the agent's real replies from the Messenger end-to-end test.");

  // 3b. the three helpers, and anyone anywhere
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Three helpers take the friction out, for anyone, anywhere");
  [["Match", "asks first", "“Thursday 19:00: Leo is free. Want a game?” It learns the player's usual times and asks when one is open and the people they play best with are free.", HEX.green], ["Talk", "agents agree on their own", "The person only says they want to play. Each player's agent agrees the time, the people and the court with the others' agents in the background.", HEX.blue], ["Body", "schedules around the body", "A body log and health-app export become scheduling limits: doubles while a knee is sore, one game fewer in a heavy week. Not medical advice.", HEX.amber]].forEach(([h, sub, d, c], i) => {
    const x = M + i * 4.1;
    card(s, x, 1.4, 3.85, 2.75);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.6, w: 0.6, h: 0.6, fill: { color: c }, line: { color: c } });
    s.addText(String(i + 1), { isTextBox: true, x: x + 0.25, y: 1.6, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText([{ text: h, options: { bold: true, fontSize: 18, breakLine: true } }, { text: sub, options: { fontSize: 12, color: HEX.muted } }], { isTextBox: true, x: x + 1.0, y: 1.55, w: 2.7, h: 0.75, margin: 0, color: HEX.ink, valign: "middle" });
    s.addText(d, { isTextBox: true, x: x + 0.25, y: 2.45, w: 3.4, h: 1.6, fontSize: 12.5, color: HEX.ink, margin: 0, valign: "top" });
  });
  s.addText("Build for Your World: any town with courts on OpenStreetMap, any ball sport, in a phone's browser and in Messenger", { isTextBox: true, x: M, y: 4.4, w: W - 2 * M, h: 0.4, fontSize: 14, bold: true, color: HEX.green, margin: 0 });
  ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer"].forEach((sp, i) => {
    const x = M + i * 1.73;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.95, w: 1.58, h: 0.5, fill: { color: HEX.greenBg }, line: { color: HEX.greenBg }, rectRadius: 0.25 });
    s.addText(sp, { isTextBox: true, x, y: 4.95, w: 1.58, h: 0.5, fontSize: 12, color: HEX.green, bold: true, align: "center", valign: "middle", margin: 0 });
  });
  [["Groups nobody organises", "children's sessions with fair turns and no child accounts, gentle daytime doubles for older adults, charity round-robins that record pledges but handle no money"], ["Quiet courts", "a group's agent asks a venue's agent for a quiet-hour price, so venues fill empty hours"]].forEach(([h, d], i) => {
    s.addText([{ text: h + ": ", options: { bold: true } }, { text: d }], { isTextBox: true, x: M + i * 6.15, y: 5.75, w: 5.95, h: 0.95, fontSize: 12.5, color: HEX.ink, margin: 0, valign: "top" });
  });
  note(s, "The demo town sits on Taipei, with prices in NT$, but nothing in Serve is tied to one place or one sport.");

  // 4. validated by agents
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Validated by 153 AI agents in 25 rounds: how a round worked");
  // the loop
  const loopSteps = [["Fresh local copy", "same code as the live site; 12 neighbours, 3 clubs, 3 open games"], ["Six new testers", "each a fresh model with only a persona and the address"], ["One verdict line", "CLEAN, or n BLOCKER, m BUG; every request logged"], ["Fix what they found", "then unit tests, a browser check, deploy"]];
  loopSteps.forEach(([h, d], i) => {
    const x = M + i * 3.08;
    box(s, x, 1.45, 2.7, 1.35, h, d, i === 3 ? HEX.green : HEX.card, i === 3 ? "FFFFFF" : HEX.ink);
    if (i < 3) arrow(s, x + 2.72, 2.12, x + 3.06, 2.12);
  });
  s.addText("↺ next round, new testers", { isTextBox: true, x: M, y: 2.9, w: W - 2 * M, h: 0.35, fontSize: 12, color: HEX.green, align: "right", margin: 0, italic: true });
  // the six testers of a round
  s.addText("The six testers in each round (from round 6)", { isTextBox: true, x: M, y: 3.45, w: 6, h: 0.4, fontSize: 15, bold: true, color: HEX.ink, margin: 0 });
  [["2 new agents", "arrive cold: find the guide, sign their person in, register an Ed25519 key, get a game; or audit privacy and the API", HEX.blue], ["2 member agents", "a seeded member's session: host and answer games, re-check last round's fixes", HEX.green], ["2 web users", "in the browser, one at phone size and one on a laptop: read the screen and click", HEX.amber]].forEach(([h, d, c], i) => {
    const x = M + i * 4.1, y = 4.0;
    card(s, x, y, 3.85, 1.75);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: c }, line: { color: c } });
    s.addText(h, { isTextBox: true, x: x + 0.9, y: y + 0.25, w: 2.8, h: 0.5, fontSize: 16, bold: true, color: HEX.ink, valign: "middle", margin: 0 });
    s.addText(d, { isTextBox: true, x: x + 0.25, y: y + 0.85, w: 3.4, h: 0.85, fontSize: 12, color: HEX.muted, valign: "top", margin: 0 });
  });
  text(s, "From round 21 a bug meant a problem in a core flow: getting a game, yes or no, joining and leaving, calling off, limits and permission, privacy, trust records. The testers were AI models, not people.", { x: M, y: 6.05, w: W - 2 * M, h: 0.7, fontSize: 12, color: HEX.muted });
  note(s, "Between October 29 and 30, 25 rounds. After every round we fixed what they found, ran the unit tests, checked the pages in a browser, deployed, and started the next round with new testers.");

  // 4b. the rounds, in numbers
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Round by round: bugs fell to zero, clean reports rose to 6 of 6");
  const R = Array.from({ length: 20 }, (_, i) => String(i + 6));
  multi(s, pres.charts.BAR, [{ name: "Bugs reported", labels: R, values: [5, 9, 10, 10, 13, 6, 19, 16, 11, 8, 9, 7, 10, 9, 9, 2, 2, 3, 4, 0] }], { x: M, y: 1.35, w: 8.0, h: 2.75, colors: [HEX.red], values: true, title: "Bugs reported per round (rounds 21 to 25: core flows only)", catTitle: "round", max: 22 });
  multi(s, pres.charts.LINE, [{ name: "Clean reports (of 6)", labels: R, values: [2, 1, 2, 1, 1, 2, 1, 2, 2, 2, 2, 2, 1, 1, 2, 4, 4, 3, 4, 6] }], { x: M, y: 4.15, w: 8.0, h: 2.55, colors: [HEX.green], values: true, title: "Testers whose report came back CLEAN (of 6)", catTitle: "round", max: 6 });
  stat(s, M + 8.4, 1.4, W - 2 * M - 8.4, "153", "AI testers, one report each");
  stat(s, M + 8.4, 3.2, W - 2 * M - 8.4, "16,713", "requests logged, with a hash of the session, never the session");
  stat(s, M + 8.4, 5.0, W - 2 * M - 8.4, "6 of 6", "clean in round 25, on every core flow");
  note(s, "Rounds 1 to 5 used free-form reports before the verdict line. A few reported bugs turned out to be the test setup, not Serve. From round 21 the rule changed to core flows only, which let the loop end on a clear rule.");

  // 4c. every session, every request
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "146 tester sessions from the logs: every request, in order");
  picture(s, I.swarm, M, 1.3, 9.2, 5.3);
  text(s, [{ text: "One row per tester session, rounds 4 to 25; one dot per request at its time since the session began.", options: { breakLine: true } }, { text: "● ", options: { color: HEX.green } }, { text: "2xx answered  " }, { text: "● ", options: { color: HEX.amber } }, { text: "4xx refused or not found", options: { breakLine: true } }, { text: "11,525 requests drawn: 10,135 answered, 1,389 refused, not found or invalid, and no server errors (5xx)." }], { x: M + 9.5, y: 1.4, w: W - 2 * M - 9.5, h: 3.6, fontSize: 13, paraSpaceAfter: 10 });
  card(s, M + 9.5, 5.1, W - 2 * M - 9.5, 1.5, HEX.greenBg);
  text(s, [{ text: "An agent with only the address ", options: { bold: true } }, { text: "was doing useful work by its third request and found its person a Sunday 09:00 tennis game, free, 2.6 km away." }], { x: M + 9.7, y: 5.22, w: W - 2 * M - 9.9, h: 1.3, fontSize: 12.5 });
  note(s, "Built from each round's requests.jsonl (video/shotcraft/public/swarm/sessions.json, video/deck/make_swarm.py). The same sessions are replayed side by side in the demo film.");

  // 4d. what the testers found
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "What the testers found, and what changed");
  [["Privacy", "A host could count who nearby was open to being asked; a waitlist note showed a show-up rate.", "Nearby people appear only once they can play; others see badge words only."], ["Limits and permission", "An agent's game ignored “no new people” and the price cap; a learned distance overrode the person's own.", "The person's settings decide, on every path."], ["Double-booking", "Overlapping joins, a post over an agreed game, a waitlist promotion into a clash.", "One clash rule for posts, joins, promotions and the agents' talk."], ["Telling the truth", "“Agreed” with too few players; a called-off game left people uninformed.", "Every affected person is told what happened, once."], ["Fills of a posted game", "Stopping the agents and calling the game off were one action.", "Two actions; a game that fills stops the agents and tells those asked."], ["Agents arriving cold", "Hard to find the way in.", "A guide in the site's HTML, /llms.txt with a six-call quick start."]].forEach(([h, a, b], i) => {
    const x = M + (i % 3) * 4.1, y = 1.4 + Math.floor(i / 3) * 2.65;
    card(s, x, y, 3.85, 2.45);
    s.addText([{ text: h, options: { bold: true, fontSize: 16, color: HEX.ink, breakLine: true } }, { text: "Found: ", options: { bold: true, fontSize: 12, color: HEX.red } }, { text: a, options: { fontSize: 12, breakLine: true } }, { text: "Now: ", options: { bold: true, fontSize: 12, color: HEX.green } }, { text: b, options: { fontSize: 12 } }], { isTextBox: true, x: x + 0.25, y: y + 0.2, w: 3.35, h: 2.1, valign: "top", margin: 0, color: HEX.ink, paraSpaceAfter: 6 });
  });
  note(s, "Grouped by kind from the 25 rounds' reports (submission/agent_testing.md).");

  // 5. the rule, and the architecture
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Code computes the facts; models choose among preferences");
  const ah = picture(s, I.arch, M, 1.35, W - 2 * M, 4.6);
  text(s, "That keeps a model's mistake from turning into a wrong booking or a clash. Four pieces of engineering underneath: a standard A2A protocol with a negotiation engine, active querying by the value of information, a community that evolves the platform with rollback, and 3D reconstruction from a phone video.", { x: M, y: 1.35 + ah + 0.2, w: W - 2 * M, h: 1.0, fontSize: 14, color: HEX.muted });
  note(s, "The one rule throughout: code computes the facts and keeps the hard rules; the models choose only among the real preferences left.");

  // 6. A2A: facts only, one round, holds
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A2A v1.0: facts only, settled in one round by intersection");
  // the host's agent, the proposal of facts, three members' agents, their sets, the intersection
  box(s, M, 2.55, 2.0, 1.4, "Host's agent", "lists up to 12 times that fit every calendar and have a court", HEX.green, "FFFFFF");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 2.35, y: 2.45, w: 2.55, h: 1.6, fill: { color: "FFFFFF" }, line: { color: HEX.line, width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: "serve.proposal", options: { bold: true, fontSize: 12, breakLine: true, color: HEX.green } }, { text: "{ id, date, start,\n  venue, court, trip }", options: { fontFace: "Consolas", fontSize: 12, breakLine: true } }, { text: "facts only, signed (Ed25519)", options: { fontSize: 10.5, color: HEX.muted } }], { isTextBox: true, x: M + 2.5, y: 2.5, w: 2.3, h: 1.5, margin: 0, valign: "middle", color: HEX.ink });
  arrow(s, M + 2.02, 3.25, M + 2.33, 3.25);
  const sets = [["Ana's agent", ["t1", "t2", "t4"]], ["Leo's agent", ["t2", "t3", "t4"]], ["Kenji's agent", ["t2", "t4", "t5"]]];
  sets.forEach(([n, ws], k) => {
    const y = 1.4 + k * 1.3;
    arrow(s, M + 4.92, 3.25, M + 5.3, y + 0.5);
    card(s, M + 5.32, y, 3.1, 1.05);
    s.addText(n, { isTextBox: true, x: M + 5.5, y: y + 0.08, w: 2.8, h: 0.35, fontSize: 13, bold: true, color: HEX.ink, margin: 0 });
    ["t1", "t2", "t3", "t4", "t5"].forEach((t, j) => {
      const on = ws.includes(t), c = on ? ((t === "t2" || t === "t4") ? HEX.green : "8CC5A6") : "E1E4E2";
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 5.5 + j * 0.55, y: y + 0.5, w: 0.48, h: 0.38, fill: { color: c }, line: { color: c }, rectRadius: 0.05 });
      s.addText(t, { isTextBox: true, x: M + 5.5 + j * 0.55, y: y + 0.5, w: 0.48, h: 0.38, fontSize: 11, bold: on, color: on ? "FFFFFF" : HEX.soft, align: "center", valign: "middle", margin: 0 });
    });
    arrow(s, M + 8.44, y + 0.5, M + 8.85, 3.25);
  });
  box(s, M + 8.9, 2.45, 3.2, 1.6, "Intersection: t2, t4", "every agent's set is binding; code takes the best, t2. Most talks end in round one", HEX.greenBg);
  s.addText("Illustrative sets. Hard rules (days off, the latest finish, the longest trip) take times off before any model sees the list.", { isTextBox: true, x: M + 5.32, y: 5.35, w: 6.8, h: 0.5, fontSize: 11, color: HEX.muted, margin: 0 });
  [["Contract Net + one-shot intersection", "a simple distributed constraint satisfaction"], ["No model reads another side's words", "sentences between agents are templates filled by code"], ["To the standard", "jku on cards, proposal and hold extensions required, the protocol's error codes"]].forEach(([h, d], i) => {
    s.addText([{ text: h, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { fontSize: 11.5, color: HEX.muted } }], { isTextBox: true, x: M + i * 4.1, y: 6.0, w: 3.9, h: 0.75, margin: 0, color: HEX.ink, valign: "top" });
  });
  note(s, "A proposal carries each time as id, date, start, venue, court and trip, nothing else; an answer carries intent, date, start and the times that work. No agent can inject instructions into another.");

  // 6b. holds, recovery, fairness
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Holds, recovery and the fairest venue, measured");
  bar(s, ["With holds", "Without holds"], [0, 11], { x: M, y: 1.4, w: 3.9, h: 3.4, dir: "col", title: "Pairs of talks that booked one member twice (of 12)", fmt: "0", max: 12, colors: [HEX.red] });
  bar(s, ["Nash product", "Shortest total trip", "Minimax (Serve)"], [0.58, 0.59, 0.73], { x: M + 4.2, y: 1.4, w: 4.3, h: 3.4, title: "Fairness score of the booked games", fmt: "0.00", max: 0.9, colors: [HEX.green] });
  stat(s, M + 8.8, 1.4, W - 2 * M - 8.8, "20 / 20", "recovery checks, the gateway killed at 5 points in a booking; nothing booked twice");
  stat(s, M + 8.8, 3.2, W - 2 * M - 8.8, "22 / 22", "checks across two machines, 12 talks at once, +185 ms a request");
  text(s, bullets([["Holds, all or nothing:", "every player's agent holds the agreed time for 30 minutes, asked in a fixed order (leases with resource ordering)."], ["The fairest venue:", "the longest trip shortest, from home areas, never addresses; at 2.3 more minutes per game over 12 simulated games, and no one ever got a longer longest trip than the best venue possible."], ["Durable:", "saved before every round, answered once, idempotent booking."]]), { x: M, y: 5.05, w: W - 2 * M, h: 1.7, fontSize: 13, paraSpaceAfter: 6 });
  note(s, "With two talks at once for one member, 11 of 12 pairs booked the member twice without holds and 0 of 12 with them.");

  // 7. ranking by the chance everyone accepts
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Times ranked by the chance everyone says yes");
  text(s, bullets([["The product of each player's chance of a yes,", "with a least-misery floor: a time where anyone's chance is under 0.15 goes to the back."], ["Why it matters:", "with shared calendars, the first time proposed decides whether each agent can say yes by code or must ask a model."], ["3,000 simulated requests of each kind;", "with private calendars it found no more games."]]), { x: M, y: 1.5, w: 4.6, h: 4.8, fontSize: 15, paraSpaceAfter: 12 });
  bar(s, ["Doubles, now", "Doubles, before", "Singles, now", "Singles, before"], [89.1, 73.9, 92.4, 89.8], { x: M + 5.0, y: 1.4, w: 7.1, h: 3.3, title: "First time proposed keeps every player's rules (%)", max: 100, fmt: "0.0", colors: [HEX.green] });
  stat(s, M + 5.0, 4.95, 7.1, "0.261 → 0.109", "model choices per doubles request, so most doubles talks need no model at all");
  note(s, "Before, times were ordered by how many players had them free. Now they are ordered by the chance that every player accepts.");

  // 8. value of information
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "When talks fail, ask the one question worth most");
  bar(s, ["No question", "A random question", "The likeliest pair", "Value of information"], [40.7, 44.4, 48.2, 51.9], { x: M, y: 1.4, w: 6.4, h: 3.6, title: "Game found, one question then one talk (%), 20,000 requests each", min: 0, max: 60, colors: [HEX.green] });
  text(s, bullets([["A belief per player and hour,", "a Beta posterior over what the agent has seen of that player's agent, never their calendar."], ["One answer teaches about similar hours", "(after Pep and VPL): Brier 0.223 → 0.200; first talk lands 68.9% → 73.7%, or 75.1% → 79.2% with one question first."], ["Private by budget:", "every free-or-busy question is charged to the disclosure budget; an agent that keeps asking learns at most 24 of 112 weekly hours in 28 days."], ["At most 3 asks a week,", "and an .ics calendar can be imported (busy times only)."]]), { x: M + 6.8, y: 1.45, w: W - 2 * M - 6.8, h: 5.2, fontSize: 14, paraSpaceAfter: 10 });
  text(s, "Each rate is good to about 0.7 points either way.", { x: M, y: 5.15, w: 6.4, h: 0.4, fontSize: 12, color: HEX.muted });
  note(s, "The agent neither gives up nor asks the player again: it asks the single yes-or-no question whose answer most raises the expected chance of a game.");

  // 9. community loop
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A community that evolves the platform, and rolls itself back");
  const steps = ["Unmet request", "One sentence, shared only with a yes", "Screened", "Idea and quadratic vote", "Spec and class", "Nine gates", "Canary of members", "Kept, or rolled back"];
  steps.forEach((t, i) => {
    const x = M + i * 1.53, last = i === steps.length - 1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w: 1.38, h: 1.25, fill: { color: last ? HEX.green : HEX.card }, line: { color: last ? HEX.green : HEX.card }, rectRadius: 0.08 });
    s.addText(t, { isTextBox: true, x: x + 0.08, y: 1.5, w: 1.22, h: 1.25, fontSize: 12, bold: true, color: last ? "FFFFFF" : HEX.ink, align: "center", valign: "middle", margin: 0 });
  });
  text(s, bullets([["Code makes every decision;", "models only write short sentences that code checks. The class comes from what a change does, never from the draft."], ["Nine gates:", "policy, a code scan, unit tests, the crash matrix, the red team, Messenger end to end, the planner test, the spec's oracle and a privacy canary."], ["Anything bigger goes to a person:", "the builder agent writes it on a branch with read-only tests and no network."]]), { x: M, y: 3.1, w: 6.6, h: 3.6, fontSize: 14, paraSpaceAfter: 10 });
  stat(s, M + 7.0, 3.1, 2.55, "0.6%", "harmless changes rolled back (anytime-valid test)");
  stat(s, M + 9.75, 3.1, 2.4, "22%", "with a z-test checked at every look", HEX.red);
  card(s, M + 7.0, 5.0, W - 2 * M - 7.0, 1.6, HEX.greenBg);
  text(s, "In 20,000 simulated 7-day canaries of 5 members, looked at every 5 minutes. The price is caution: a bad change (thumbs down 25% → 60%) was caught in 61% of canaries.", { x: M + 7.25, y: 5.15, w: W - 2 * M - 7.5, h: 1.35, fontSize: 13 });
  note(s, "It draws on the Darwin Godel Machine (tests read-only), AlphaEvolve (keep a change only when evaluators pass it), Clio (minimum cluster sizes) and CaMeL.");

  // 10. 3D and highlights
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "3D replays and automatic highlights from one phone video");
  picture(s, I.strip, M, 1.4, W - 2 * M);
  text(s, "An automatic highlight as the pipeline cut it (clip: Badminton klub Ljubljana, CC BY 3.0)", { x: M, y: 3.75, w: W - 2 * M, h: 0.35, fontSize: 11, color: HEX.muted });
  stat(s, M, 4.3, 3.0, "1.00 / 0.79", "precision / recall of the learned arc threshold (first rule: 0.45 / 0.64)");
  stat(s, M + 3.2, 4.3, 2.7, "87%", "Muse Wonder agreed with the labels, and says why");
  stat(s, M + 6.1, 4.3, 2.7, "19.9 s", "a moment on the RTX 3090, models loaded");
  text(s, bullets([["MapAnything", "reads depth and the camera; SAM 2.1 cuts the player out."], ["RT-DETR", "follows the right player on all three test clips, about 2× faster than DETR."]]), { x: M + 9.1, y: 4.35, w: W - 2 * M - 9.1, h: 2.2, fontSize: 13, paraSpaceAfter: 8 });
  note(s, "Arcs of about 6 to 12 degrees look like a real camera move; a learned threshold on the share of invented pixels picks the widest arc that still looks right, or falls back to a zoom.");

  // 11. tiered decision engine
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A tiered decision engine: each layer takes what is left");
  const tiers = [["Code", "milliseconds", "Free times, clashes, trips, every hard rule; the game's card in 7 ms (median)"], ["Our 1B student", "about 0.9 s, CPU", "Answers when at least 0.6 sure: 96.0% of ordinary choices, 73.0% of the hardest"], ["Two cheap reads that agree", "0.53 s", "The one-token decider and the student on the same time: settled without Glimmer 72.1% → 79.0%"], ["Muse Glimmer, stopped early", "20 to 40 s", "Early exit after DEER: 596 → 420 tokens an answer, no later (22.3 s → 21.3 s)"]];
  tiers.forEach(([n, t, d], i) => {
    const y = 1.45 + i * 1.25, shade = ["E9F3EC", "D3E8DB", "BCDCC9", "A6D0B7"][i];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + i * 0.35, y, w: 3.4, h: 1.05, fill: { color: shade }, line: { color: shade }, rectRadius: 0.08 });
    s.addText([{ text: n, options: { bold: true, breakLine: true, fontSize: 15 } }, { text: t, options: { fontSize: 12, color: HEX.muted } }], { isTextBox: true, x: M + i * 0.35 + 0.2, y, w: 3.0, h: 1.05, valign: "middle", margin: 0, color: HEX.ink });
    s.addText(d, { isTextBox: true, x: M + i * 0.35 + 3.6, y, w: W - 2 * M - i * 0.35 - 3.6, h: 1.05, fontSize: 14, valign: "middle", margin: 0, color: HEX.ink });
  });
  text(s, "Following FrugalGPT. Before any of them, Match works ahead of time, so the agents have often agreed a game before anyone waits at all.", { x: M, y: 6.5, w: W - 2 * M, h: 0.4, fontSize: 13, color: HEX.muted });
  note(s, "Every wait the person starts shows a moving bar and a status line within 250 ms.");

  // 12. booking step by step
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A booking, step by step, with its measured times");
  picture(s, I.booking, M, 1.35, W - 2 * M, 5.5);
  note(s, "Times as measured: the card on a local copy; the hop between two machines; the student on the server CPU; the decider and Glimmer on the RTX 3090.");

  // 13. our 1B
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Our own model: a Llama 3.2 1B distilled from Muse Glimmer");
  stat(s, M, 1.45, 2.9, "89.5%", "agreement with Glimmer on 500 held-out cases (Glimmer with itself: 88.8%)");
  stat(s, M + 3.1, 1.45, 2.9, "0.9 s", "a choice on the CPU, about 44× faster than Glimmer's ~40 s");
  stat(s, M + 6.2, 1.45, 2.9, "0.052", "expected calibration error: its confidence can be trusted");
  stat(s, M + 9.3, 1.45, W - 2 * M - 9.3, "4,868", "of Glimmer's choices distilled");
  text(s, bullets([["A decision model, like TypeSafe's Jev:", "options declared in advance and scored together in one read; it never writes text that could break a rule."], ["Served at 0.6 sure:", "answers 96.0% of 500 and 73.0% of the 196 hardest; agreement 89.9% and 68.4% (Glimmer again: 73.5%)."], ["0.5 was tried and not kept:", "96.9% of the hardest answered, but agreement there fell to 61.2%."], ["In talks with the simulated club:", "Glimmer's member answers cut by 67% (54% with private calendars), no rule broken."]]), { x: M, y: 3.45, w: 6.6, h: 3.3, fontSize: 14, paraSpaceAfter: 9 });
  bar(s, ["Our 1B student (CPU)", "One-token decider (GPU)", "Glimmer, full answer (GPU)"], [0.9, 0.53, 40], { x: M + 6.9, y: 3.35, w: W - 2 * M - 6.9, h: 3.35, title: "Seconds per choice", fmt: "0.0#", max: 48, colors: [HEX.green] });
  note(s, "Why distil when the decider takes 0.53 s? The decider is still Glimmer and needs the GPU; the student runs on the CPU and leaves the GPU free for work only Glimmer can do.");

  // 13b. how it was made: the distillation pipeline
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "How we distilled it: from Glimmer's calls to the CPU");
  const pipe = [["Real agent calls", "the talks' own code builds each case from the simulated club"], ["Glimmer labels", "muse-glimmer:30b through fullAnswer: 4,868 training choices"], ["One prompt, ~240 tokens", "profile, the game, the times; letters in time order"], ["LoRA on Llama 3.2 1B", "rank 16, alpha 32, 3 epochs, 20 min on one A100"], ["int4 GGUF", "merged, llama.cpp Q4_K_M, 0.8 GB"], ["CPU worker", "8 threads, nice 19, prefix cache, one at a time"]];
  pipe.forEach(([h, d], i) => {
    const x = M + i * 2.05;
    box(s, x, 1.45, 1.85, 1.75, h, d, i === 3 ? HEX.green : HEX.card, i === 3 ? "FFFFFF" : HEX.ink);
    if (i < 5) arrow(s, x + 1.86, 2.32, x + 2.04, 2.32);
  });
  // the data sets and the two losses
  s.addTable([[{ text: "Set", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green } } }, { text: "Cases", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green }, align: "right" } }, { text: "What it is", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green } } }],
    ...[["train", "3,000", "private calendars, habits reworded"], ["trainshared", "596", "shared calendars (Serve's default)"], ["asked", "1,378", "the asked time breaks a hard rule"], ["test (held out)", "500", "3 Glimmer answers each"], ["decider (held out)", "196", "the hardest: asked time breaks a rule"]].map((r, i) => r.map((t, k) => ({ text: t, options: { fill: { color: i % 2 ? "FFFFFF" : HEX.card }, align: k === 1 ? "right" : "left" } })))],
    { x: M, y: 3.55, w: 6.2, colW: [1.7, 0.9, 3.6], fontSize: 12, color: HEX.ink, border: { type: "none" }, margin: [0.05, 0.1, 0.05, 0.1], rowH: 0.42 });
  card(s, M + 6.6, 3.55, W - 2 * M - 6.6, 2.55, HEX.greenBg);
  text(s, [{ text: "Two losses, at positions code knows; no text generated", options: { bold: true, fontSize: 15, color: HEX.green, breakLine: true } },
    { text: "Choice: ", options: { bold: true, bullet: true } }, { text: "cross-entropy at the answer position over the valid letters only, against Glimmer's answer", options: { breakLine: true } },
    { text: "Works: ", options: { bold: true, bullet: true } }, { text: "yes or no at a marker after every time, against code's truth: its own reading of the calendar and rules, checked against code's before it may answer" }], { x: M + 6.85, y: 3.7, w: W - 2 * M - 7.1, h: 2.3, fontSize: 13, paraSpaceAfter: 6 });
  text(s, "Like TypeSafe's Jev decision models: options declared in advance and scored together in one read. Teacher: the same Glimmer blob as our server (digest de878ce33ad8).", { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontSize: 12, color: HEX.muted });
  note(s, "Half the training prompts list every offered time and half only the ones Glimmer is shown. The 3B was trained the same way (44 minutes) and is kept as an option.");

  // 13c. one decision, as the student reads it
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "One decision, one forward pass: a real held-out case");
  text(s, "Case s009, from the 196 hardest: the player asked for a time that ends after the member's “home by” limit on Tuesday. The student's own numbers, from the saved predictions:", { x: M, y: 1.35, w: W - 2 * M, h: 0.6, fontSize: 14, color: HEX.muted });
  // its reading of each time
  s.addText("Its reading: does each time work? (P at the works? marker)", { isTextBox: true, x: M, y: 2.1, w: 5.6, h: 0.4, fontSize: 14, bold: true, color: HEX.ink, margin: 0 });
  [["t1, the asked time", 0.0], ["t2", 1.0], ["t3", 1.0], ["t4", 1.0], ["t5", 1.0]].forEach(([n, p], i) => {
    const y = 2.6 + i * 0.62, ok = p >= 0.5;
    card(s, M, y, 5.6, 0.5, ok ? HEX.greenBg : "FBEAE9");
    s.addText(n, { isTextBox: true, x: M + 0.2, y, w: 3.4, h: 0.5, fontSize: 13, color: HEX.ink, valign: "middle", margin: 0 });
    s.addText(`${p.toFixed(1)}  ${ok ? "works" : "breaks a rule"}`, { isTextBox: true, x: M + 3.4, y, w: 2.0, h: 0.5, fontSize: 13, bold: true, color: ok ? HEX.green : HEX.red, valign: "middle", align: "right", margin: 0 });
  });
  text(s, "Matches code's truth (t2 to t5 work), so it may answer.", { x: M, y: 5.75, w: 5.6, h: 0.4, fontSize: 13, color: HEX.green, bold: true });
  bar(s, ["can't play", "t5", "t4", "t3", "t2"], [0.0001, 0.001, 0.008, 0.318, 0.673], { x: M + 6.1, y: 2.05, w: W - 2 * M - 6.1, h: 3.6, title: "Its choice: softmax over the valid letters", fmt: "0.000", max: 1, colors: [HEX.green] });
  card(s, M + 6.1, 5.75, W - 2 * M - 6.1, 0.95, HEX.greenBg);
  text(s, [{ text: "t2 at 0.673, above the 0.6 threshold: answered in one read. ", options: { bold: true } }, { text: "Glimmer's two full answers both chose t2." }], { x: M + 6.3, y: 5.85, w: W - 2 * M - 6.5, h: 0.8, fontSize: 13 });
  note(s, "From submission/results/decision_model/preds_1b_v3_decider.jsonl (bf16 predictions). Below 0.6, or if its reading of which times work differed from code's, the case would go on to the decider and Glimmer.");

  // 13d. three training rounds, and the threshold
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Three training rounds, then the threshold");
  multi(s, pres.charts.BAR, [{ name: "Agreement on the hardest cases (%)", labels: ["1. private calendars", "2. + asked times", "3. letters in time order"], values: [58.7, 69.4, 69.4] }],
    { x: M, y: 1.4, w: 5.6, h: 4.3, colors: [HEX.green], values: true, fmt: "0.0", title: "Agreement with Glimmer on the hardest cases (%), 3B student", max: 80 });
  text(s, "Round 1 never saw an asked time. Round 2 read “the earliest start” as the earliest hour: the stated preference kept in 18 of 32. Round 3's letters in time order fixed it: 26 of 32 (Glimmer 27).", { x: M, y: 5.8, w: 5.6, h: 0.95, fontSize: 12, color: HEX.muted });
  const TH = ["0", "0.5", "0.6", "0.7", "0.8", "0.9"];
  multi(s, pres.charts.LINE, [
    { name: "Hardest: share it answers", labels: TH, values: [100, 96.9, 73.0, 50.0, 34.2, 27.6] },
    { name: "Hardest: agreement with Glimmer", labels: TH, values: [60.7, 61.2, 68.4, 75.5, 75.0, 75.5] },
    { name: "Test: share it answers", labels: TH, values: [100, 99.0, 96.0, 92.6, 87.4, 78.4] },
    { name: "Test: agreement with Glimmer", labels: TH, values: [89.4, 89.6, 89.9, 90.7, 90.9, 90.0] },
  ], { x: M + 5.9, y: 1.4, w: W - 2 * M - 5.9, h: 4.3, colors: [HEX.green, HEX.red, "7FBF9E", "E59A94"], title: "The served 1B, int4, by threshold (%)", catTitle: "sure at", min: 0, max: 100 });
  card(s, M + 5.9, 5.8, W - 2 * M - 5.9, 0.95, HEX.greenBg);
  text(s, [{ text: "Served at 0.6: ", options: { bold: true } }, { text: "answers 96% of ordinary choices and 73% of the hardest; 0.5 answers more but agrees less (61.2%)." }], { x: M + 6.1, y: 5.9, w: W - 2 * M - 6.3, h: 0.8, fontSize: 13 });
  note(s, "The cascade is the student where it is sure and Glimmer elsewhere. Glimmer alone agrees with itself 73.5% on the hardest cases and 88.3% on the test set.");

  // 13e. can its confidence be trusted
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Its confidence can be trusted: calibration on 500 held-out cases");
  const BINS = ["0.5–0.6 (15)", "0.6–0.7 (16)", "0.7–0.8 (21)", "0.8–0.9 (41)", "0.9–1.0 (404)"];
  multi(s, pres.charts.BAR, [{ name: "Its confidence (mean)", labels: BINS, values: [57.0, 63.6, 75.2, 86.5, 98.5] }, { name: "How often Glimmer agreed", labels: BINS, values: [66.7, 68.8, 65.1, 76.4, 94.4] }],
    { x: M, y: 1.4, w: 7.6, h: 4.9, colors: [HEX.soft, HEX.green], values: true, fmt: "0", title: "By confidence bin (cases in brackets), %", catTitle: "confidence bin", max: 110 });
  stat(s, M + 8.0, 1.45, W - 2 * M - 8.0, "0.052", "expected calibration error (10 bins)");
  stat(s, M + 8.0, 3.3, W - 2 * M - 8.0, "89% / 7%", "at 0.8 sure: share it answers / disagreement with Glimmer");
  card(s, M + 8.0, 5.15, W - 2 * M - 8.0, 1.5, HEX.greenBg);
  text(s, "404 of 500 cases sit above 0.9, where it is close (98.5% against 94.4%); in the middle bins it is off by up to 10 points. The routing threshold uses conformal risk control.", { x: M + 8.2, y: 5.25, w: W - 2 * M - 8.4, h: 1.3, fontSize: 12.5 });
  note(s, "From submission/results/student_calibration.json, bf16 predictions; the served int4 picks the same option on 492 of 500 test cases.");

  // 14. what surprised us
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "What surprised us, running Meta's models in a product");
  [["Glimmer reasons even when told not to", "84% of the tokens it wrote over 2,755 calls were reasoning; 9% of calls came back empty. Every call now asks for think \"low\" with 900 tokens of room."], ["A 1B agrees with Glimmer as often as Glimmer agrees with itself", "89.5% against 88.8% on 500 held-out cases, in 0.9 s instead of about 40 s."], ["Glimmer can decide in one token", "Read with no chat template, its next token gives a probability for each option: 0.53 s, no reasoning. It mostly reads the order, though: 99.5% of picks were the first time listed."], ["Llama Guard 3 reads sports injuries as medical advice", "Its S6 category flagged 6 to 8 of 15 ordinary injury-care answers; S6 now blocks only when code also finds a dose, a medicine or a condition."]].forEach(([h, d], i) => {
    const x = M + (i % 2) * 6.15, y = 1.45 + Math.floor(i / 2) * 2.65;
    card(s, x, y, 5.95, 2.4);
    s.addText([{ text: h, options: { bold: true, breakLine: true, fontSize: 16, color: HEX.green } }, { text: d, options: { fontSize: 12 } }], { isTextBox: true, x: x + 0.3, y: y + 0.2, w: 3.3, h: 2.05, valign: "top", margin: 0, color: HEX.ink, paraSpaceAfter: 6 });
    // a small chart of each finding
    const cx = x + 3.7, cy = y + 0.15, cw = 2.1, ch = 2.1;
    const base = { x: cx, y: cy, w: cw, h: ch, showLegend: false, dataLabelFontSize: 10, dataLabelColor: HEX.ink, catAxisLabelColor: HEX.muted, catAxisLabelFontSize: 9, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt" };
    if (i === 0) s.addChart(pres.charts.DOUGHNUT, [{ name: "tokens", labels: ["reasoning", "answer"], values: [84, 16] }], { ...base, chartColors: [HEX.red, HEX.green], showPercent: true, showLegend: true, legendPos: "b", legendFontSize: 9, legendColor: HEX.muted, holeSize: 55, dataLabelColor: "FFFFFF" });
    if (i === 1) s.addChart(pres.charts.BAR, [{ name: "agreement", labels: ["Glimmer vs itself", "Our 1B"], values: [88.8, 89.5] }], { ...base, barDir: "col", chartColors: [HEX.green], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 80, valAxisMaxVal: 92 });
    if (i === 2) s.addChart(pres.charts.DOUGHNUT, [{ name: "picks", labels: ["first listed", "other"], values: [99.5, 0.5] }], { ...base, chartColors: [HEX.amber, HEX.soft], showPercent: true, showLegend: true, legendPos: "b", legendFontSize: 9, legendColor: HEX.muted, holeSize: 55, dataLabelColor: "FFFFFF" });
    if (i === 3) s.addChart(pres.charts.BAR, [{ name: "flagged", labels: ["fewest runs", "most runs"], values: [6, 8] }], { ...base, barDir: "col", chartColors: [HEX.red], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", valAxisMinVal: 0, valAxisMaxVal: 15, showTitle: true, title: "of 15 injury-care answers", titleFontSize: 9, titleColor: HEX.muted, titleFontFace: "+mn-lt" });
  });
  note(s, "Four findings, each measured. The order finding was measured after the report: on 196 hard cases the one-token decider picked the first listed time 99.5% of the time.");

  // 15. security
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Security, and a failure the agents found");
  stat(s, M, 1.45, 2.6, "93 / 93", "attack cases stopped, named by OWASP LLM Top 10 risk");
  // untrusted text, layer by layer
  s.addText("Untrusted text (posts, comments, reviews, wishes), layer by layer", { isTextBox: true, x: M + 2.9, y: 1.45, w: 9.2, h: 0.35, fontSize: 13, bold: true, color: HEX.ink, margin: 0 });
  [["Text in", "a post, a review"], ["Prompt Guard", "2 (86M): injections"], ["Llama Guard", "3 (1B): harms"], ["Code checks", "numbers, names, links"], ["Then a model", "never the one that acts"]].forEach(([h, d], i) => {
    const x = M + 2.9 + i * 1.86;
    box(s, x, 1.9, 1.62, 1.15, h, d, i === 0 ? "FBEAE9" : i === 4 ? HEX.green : HEX.card, i === 4 ? "FFFFFF" : HEX.ink);
    if (i < 4) arrow(s, x + 1.63, 2.47, x + 1.84, 2.47);
  });
  // the signed chain of yeses
  s.addText("A signed record of every yes", { isTextBox: true, x: M, y: 3.4, w: 6, h: 0.35, fontSize: 13, bold: true, color: HEX.ink, margin: 0 });
  ["yes #1", "yes #2", "yes #3", "yes #4"].forEach((t, i) => {
    const x = M + i * 1.55;
    box(s, x, 3.85, 1.3, 0.85, t, "signed · hash of the last", HEX.greenBg);
    if (i < 3) arrow(s, x + 1.31, 4.27, x + 1.53, 4.27, HEX.green);
  });
  // no-shows without money
  s.addText("No-shows, with no money", { isTextBox: true, x: M + 6.6, y: 3.4, w: 5.5, h: 0.35, fontSize: 13, bold: true, color: HEX.ink, margin: 0 });
  [["60 days", "half-life of a show-up record, shown in words"], ["3 h", "before: a short game is called off"], ["12 h", "to confirm a freed spot"]].forEach(([b, d], i) => {
    const x = M + 6.6 + i * 1.85;
    card(s, x, 3.85, 1.7, 0.85);
    s.addText([{ text: b, options: { bold: true, fontSize: 16, color: HEX.green, breakLine: true } }, { text: d, options: { fontSize: 9.5, color: HEX.muted } }], { isTextBox: true, x: x + 0.12, y: 3.85, w: 1.5, h: 0.85, margin: 0, valign: "middle" });
  });
  card(s, M, 5.05, W - 2 * M, 1.25, "FBEAE9");
  text(s, [{ text: "A failure, and the fix. ", options: { bold: true, color: HEX.red } }, { text: "A tester working as a host could work out how many people nearby were open to being asked, first from a count, then from the talk. Now nearby people appear only once they can actually play, and everyone else sees only published badge words; later rounds re-checked it and found nothing. The Agents Rule of Two: no agent holds untrusted input, private data and the power to act at once." }], { x: M + 0.3, y: 5.15, w: W - 2 * M - 0.6, h: 1.1, fontSize: 13 });
  note(s, "93 attack cases all stopped; crash and recovery checks are on the A2A slide.");

  // 16. Meta models and routing by length
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Meta models, and which one answers: by length");
  // where each model runs: our server (data stays there) and the Meta Model API
  const zone = (x, w, head, sub, groups) => {
    card(s, x, 1.35, w, 3.65);
    s.addText([{ text: head, options: { bold: true, fontSize: 15, breakLine: true } }, { text: sub, options: { fontSize: 11, color: HEX.muted } }], { isTextBox: true, x: x + 0.2, y: 1.42, w: w - 0.4, h: 0.6, margin: 0, color: HEX.ink });
    groups.forEach(([g, ms, c], k) => {
      const y = 2.1 + k * 0.95;
      s.addText(g, { isTextBox: true, x: x + 0.2, y, w: 1.15, h: 0.8, fontSize: 11, bold: true, color: HEX.muted, margin: 0, valign: "middle" });
      ms.forEach((mname, j) => {
        const bw = (w - 1.55 - 0.1 * (ms.length - 1)) / ms.length, bx = x + 1.35 + j * (bw + 0.1);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: y + 0.08, w: bw, h: 0.64, fill: { color: c }, line: { color: c }, rectRadius: 0.06 });
        s.addText(mname, { isTextBox: true, x: bx + 0.05, y: y + 0.08, w: bw - 0.1, h: 0.64, fontSize: 10.5, bold: true, color: c === HEX.green ? "FFFFFF" : HEX.ink, align: "center", valign: "middle", margin: 0 });
      });
    });
  };
  zone(M, 7.0, "Our GPU server (two RTX 3090s and their CPU)", "players' data stays here", [["GPU 1", ["Muse Glimmer 30B: every agent's reasoning"], HEX.green], ["CPU", ["Our 1B", "Tiny layer", "Llama Guard 3", "Prompt Guard 2", "DRAMA", "Speech (ASR)"], HEX.greenBg], ["GPU 0", ["SAM 2.1", "Sapiens2", "MapAnything", "DETR / RT-DETR"], HEX.greenBg]]);
  zone(M + 7.3, W - 2 * M - 7.3, "Meta Model API", "only what needs it", [["Text", ["Muse Spark 1.3: long calls, fallback"], "DCE6F5"], ["Voice", ["Muse Voice Transcribe"], "DCE6F5"], ["Vision", ["Muse Image", "Muse Wonder", "SAM 3.1"], "DCE6F5"]]);
  // the length scale
  s.addText("Which model answers a text call, by its length in tokens", { isTextBox: true, x: M, y: 5.2, w: 8, h: 0.35, fontSize: 13, bold: true, color: HEX.ink, margin: 0 });
  [[0, 1.6, "≤ 700, checked site: our 1B", HEX.green, "FFFFFF"], [1.6, 7.6, "longer, or any other site: Muse Glimmer (16,384-token context)", HEX.greenBg, HEX.ink], [9.2, W - 2 * M - 9.2, "12,000+: Muse Spark", "DCE6F5", HEX.ink]].forEach(([x0, w0, t, c, ink]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: M + x0, y: 5.65, w: w0, h: 0.55, fill: { color: c }, line: { color: "FFFFFF", width: 1 } });
    s.addText(t, { isTextBox: true, x: M + x0 + 0.1, y: 5.65, w: w0 - 0.2, h: 0.55, fontSize: 11, bold: true, color: ink, valign: "middle", margin: 0 });
  });
  s.addText("Every short site was tried on the 1B first: 9 end-to-end checks failed, 2 of 6 hostile comments got through and 4 of 10 injected reviews were obeyed, so only five checked sites go to it.", { isTextBox: true, x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontSize: 11.5, color: HEX.muted, margin: 0 });
  note(s, "Open weights run on our own GPU server so players' data stays there; the Meta Model API handles live voice, long calls, images and checks.");

  // 17. upgrades since the report
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Measured since the report: seven more agent upgrades");
  const ups = [["Send gate", "When not to ask: opt-outs 37.7% → 26.2%, games from asks 3.97 → 4.39 (simulated)"], ["Preference records", "Newest word wins: stale-preference decisions 95% → 17% once the player says it (simulated)"], ["Tool-call checks", "Silent failures passed as success 53 of 53 → 0 of 56 (fault injection)"], ["Courts judged ahead", "Wait after moving the time 49.0 s → 25.7 s, at twice the judgings (RTX 3090)"], ["Harder simulated users", "With 25% difficult people pass^1 0.69 → 0.38; six flow bugs found, then fixed"], ["Order of the options", "Glimmer changed 40% of answers in a new order, against 26.5% asked again in the same order; kept as is"], ["Stretch round", "Games found +0.3 (singles) and +1.3 points (doubles): small, reported as such"]];
  // before and after, each on its own scale: [label, before, after, how to write a value]
  const pairs = [["opt-outs", 37.7, 26.2, (v) => `${v}%`], ["stale decisions", 95, 17, (v) => `${v}%`], ["silent failures passed", 100, 0, (v) => `${v}%`], ["wait", 49.0, 25.7, (v) => `${v.toFixed(1)} s`], ["pass^1", 0.69, 0.38, (v) => v.toFixed(2)], ["answers changed", 26.5, 40, (v) => `${v}%`], ["doubles games", 84.1, 85.4, (v) => `${v}%`]];
  ups.forEach(([h, d], i) => {
    const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4, x = M + col * 6.15, y = 1.45 + row * 1.3;
    card(s, x, y, 5.95, 1.12);
    s.addText([{ text: h, options: { bold: true, breakLine: true, fontSize: 15, color: HEX.green } }, { text: d, options: { fontSize: 11 } }], { isTextBox: true, x: x + 0.25, y: y + 0.08, w: 3.5, h: 0.98, valign: "middle", margin: 0, color: HEX.ink });
    const [lab, a, b, fmt] = pairs[i], max = Math.max(a, b) || 1, bx = x + 3.85, bw = 0.85;
    [[a, i === 5 ? "same order" : i === 4 ? "cooperative" : "before", HEX.soft], [b, i === 5 ? "new order" : i === 4 ? "difficult" : "after", i === 4 ? HEX.red : HEX.green]].forEach(([v, t, c], k) => {
      const yy = y + 0.2 + k * 0.42, len = Math.max(0.03, (bw * v) / max);
      s.addShape(pres.shapes.RECTANGLE, { x: bx, y: yy, w: len, h: 0.26, fill: { color: c }, line: { color: c } });
      s.addText(`${fmt(v)} ${t}`, { isTextBox: true, x: bx + len + 0.05, y: yy - 0.04, w: 1.2, h: 0.34, fontSize: 10, color: HEX.muted, margin: 0, valign: "middle" });
    });
  });
  text(s, "Each from a 2024–2026 paper, built and measured against what ran before; most numbers are simulated and say so (README, submission/results/).", { x: M + 6.15, y: 5.4, w: 5.95, h: 1.0, fontSize: 13, color: HEX.muted });
  note(s, "After the report: send gate (Oralytics, EOPA), preference records (PersonaMem, Mem0), tool checks (JSONSchemaBench, ToolMaze), judging ahead (Speculative Actions), pass^k (tau-bench, Sim2Real), order (Magentic Marketplace), stretch round (CalBench).");

  // 17b. the tiny layer
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A 27.6 KB classifier in front of the 1B, on by default");
  multi(s, pres.charts.BAR, [
    { name: "Ordinary choices (500)", labels: ["Tiny layer (27.6 KB)", "Our 1B (0.8 GB)", "Glimmer vs itself", "First listed time"], values: [88.5, 89.5, 88.8, 82.7] },
    { name: "Hardest choices (196)", labels: ["Tiny layer (27.6 KB)", "Our 1B (0.8 GB)", "Glimmer vs itself", "First listed time"], values: [69.4, 63.3, 73.5, 58.2] },
  ], { x: M, y: 1.4, w: 7.6, h: 4.6, colors: [HEX.soft, HEX.green], values: true, fmt: "0.0", title: "Agreement with Glimmer over all held-out cases (%)", min: 0, max: 100 });
  stat(s, M + 8.0, 1.4, W - 2 * M - 8.0, "0.06 ms", "a choice on one CPU thread, in plain JS (the 1B: about 0.9 s)");
  stat(s, M + 8.0, 3.2, W - 2 * M - 8.0, "59.8% / 4.3%", "of ordinary choices it answers itself / disagreement among them");
  card(s, M + 8.0, 5.0, W - 2 * M - 8.0, 1.7, HEX.greenBg);
  text(s, "Four small MLPs over facts code holds per option (weekday, hour, trip, distance from the asked time, the member's habits and rules), and a doubt model that sends anything it doubts to the 1B and Glimmer. Measured offline; the post prefilter (87 KB) stays off: it passed 0 of 762 hostile comments but only 11% of ordinary ones.", { x: M + 8.2, y: 5.1, w: W - 2 * M - 8.4, h: 1.55, fontSize: 11 });
  text(s, "Trained on the student's 4,868 Glimmer choices; on the hardest choices it agrees with Glimmer more often than our 1B.", { x: M, y: 6.15, w: 7.6, h: 0.55, fontSize: 12, color: HEX.muted });
  note(s, "From submission/results/tiny.json. It saves 299 of 500 student calls on ordinary choices but only a few Glimmer calls, since the student already answers what it is sure of; overall agreement rises from 89.9% to 90.3%.");

  // 17c. six flow bugs the difficult users found, fixed
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Six flow bugs found by difficult simulated people, fixed");
  multi(s, pres.charts.BAR, [
    { name: "Before the fixes", labels: ["False “booked”", "Asker left waiting", "Searches that looped", "Asked again after a no"], values: [12, 19, 16, 19] },
    { name: "After", labels: ["False “booked”", "Asker left waiting", "Searches that looped", "Asked again after a no"], values: [0, 0, 0, 0] },
  ], { x: M, y: 1.4, w: 7.4, h: 4.2, colors: [HEX.red, HEX.green], values: true, fmt: "0", title: "Failures in 160 code-only runs, difficult club", max: 22 });
  multi(s, pres.charts.BAR, [
    { name: "Cooperative club", labels: ["pass^1", "pass^4"], values: [0.69, 0.50] },
    { name: "Difficult club, before", labels: ["pass^1", "pass^4"], values: [0.38, 0.25] },
    { name: "Difficult club, after", labels: ["pass^1", "pass^4"], values: [0.47, 0.38] },
  ], { x: M + 7.7, y: 1.4, w: W - 2 * M - 7.7, h: 4.2, colors: [HEX.soft, HEX.red, HEX.green], values: true, fmt: "0.00", title: "With Muse Glimmer (8 requests × 4)", max: 0.8 });
  text(s, [{ text: "25% difficult people ", options: { bold: true } }, { text: "(the flipper, the ghost, the budget person, the drifter, the vague one); pass^k counts a request only if every one of k runs succeeds (τ-bench). Now: a back-out by message is confirmed and acted on, an ask lapses with its hold, a vague reply is asked once more with buttons, a stated day off is kept, the search leaves out everyone who said no, and everyone asked is told. The pass^k gains are small and their intervals still include no change." }], { x: M, y: 5.75, w: W - 2 * M, h: 1.0, fontSize: 12 });
  note(s, "From submission/results/sim_users_hard.json. The after runs are on main, which also has the other upgrades merged since the before runs.");

  // 18. not done yet
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "What is not done yet");
  [["Most validation is simulated", "Beyond one real club and two games, the evidence comes from AI agents, simulated members and local copies."], ["The slow path still exists", "When the small models are unsure, Glimmer takes about 20 to 40 s; the steps stream in, but it is still a wait."], ["Venues are samples", "No venue has joined yet, so quiet-hour prices are sample prices."], ["The community loop has not run on real members", "An idea shows only once 5 different members ask for it."], ["Orbit replays are short", "Only arcs of about ±6 to 12° look right; otherwise a zoom."]].forEach(([h, d], i) => {
    const y = 1.45 + i * 1.02;
    s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.12, w: 0.42, h: 0.42, fill: { color: HEX.amber }, line: { color: HEX.amber } });
    s.addText(String(i + 1), { isTextBox: true, x: M, y: y + 0.12, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText([{ text: h, options: { bold: true, breakLine: true, fontSize: 16 } }, { text: d, options: { fontSize: 14, color: HEX.muted } }], { isTextBox: true, x: M + 0.7, y, w: W - 2 * M - 0.7, h: 0.92, valign: "top", margin: 0, color: HEX.ink });
  });
  note(s, "Said plainly: this is a nine-day build, validated mostly by agents and simulation.");

  // 18b. references and sources
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "References, and where every number comes from");
  const REFS = ["NPR, RWJF and Harvard Chan: Sports and Health in America, 2015", "Sport New Zealand: Active NZ survey, 2023", "Agent2Agent (A2A) Protocol v1.0, Linux Foundation", "Smith: The Contract Net Protocol, 1980", "Yokoo et al.: Distributed Constraint Satisfaction, 1998", "Gray and Cheriton: Leases, SOSP 1989", "Havender: Avoiding Deadlock, 1968", "RFC 7515 JSON Web Signature; RFC 8785 JSON Canonicalization", "Lalley and Weyl: Quadratic Voting, 2018", "LlamaFirewall, arXiv 2505.03574", "Darwin Gödel Machine, arXiv 2505.22954", "AlphaEvolve, arXiv 2506.13131", "Clio, arXiv 2412.13678", "CaMeL, arXiv 2503.18813", "MapAnything, 3DV 2026", "SAM 2, 2024", "RT-DETR, CVPR 2024", "FrugalGPT, arXiv 2305.05176", "TypeSafe: Jev decision models, 2026", "Meta: Agents Rule of Two, 2025", "Ramdas et al.: Safe Anytime-Valid Inference, 2023", "DEER: Dynamic Early Exit, arXiv 2504.15895", "Pep, arXiv 2602.15012", "VPL, NeurIPS 2024", "Consensus vs. Dissent, RecSys 2026", "τ-bench, arXiv 2406.12045; Sim2Real gap, arXiv 2603.11245"];
  [REFS.slice(0, 13), REFS.slice(13)].forEach((col, c) => {
    s.addText(col.map((r, i) => ({ text: `${c * 13 + i + 1}. ${r}`, options: { breakLine: i < col.length - 1 } })), { isTextBox: true, x: M + c * 4.25, y: 1.35, w: 4.05, h: 5.4, fontSize: 10.5, color: HEX.ink, margin: 0, valign: "top", paraSpaceAfter: 3 });
  });
  card(s, M + 8.6, 1.35, W - 2 * M - 8.6, 5.35, HEX.greenBg);
  text(s, [{ text: "Where the numbers come from", options: { bold: true, fontSize: 14, color: HEX.green, breakLine: true } }, { text: "Each number is from a result file in submission/results/ or from docs/ in the repository: the student in docs/decision_model.md, the agent testing in submission/agent_testing.md.", options: { breakLine: true } }, { text: "Real and simulated: the badminton club is real people; the demo club, the evaluation clubs and the testers' members are simulated, and the testers were AI models.", options: { breakLine: true } }, { text: "Built during the hackathon, from October 27; an AI coding agent wrote code to our instructions, credited in the commits." }], { x: M + 8.8, y: 1.5, w: W - 2 * M - 9.0, h: 5.1, fontSize: 11.5, paraSpaceAfter: 8 });
  note(s, "Code: github.com/gino6178/serve-meta-hackathon, with the full evaluation in README.md and docs/.");

  // 19. close
  s = pres.addSlide({ masterName: "DARK" });
  title(s, "One yes from each person");
  s.addText("Live: play.theminimallab.com · Code: github.com/gino6178/serve-meta-hackathon · Every number from submission/results/", { placeholder: "body" });
  note(s, "Serve turns hours of back-and-forth into one tap from each person.");

  await pres.writeFile({ fileName: OUT });
  if (THEME_JS) { const { applyTheme } = require(THEME_JS); await applyTheme(OUT, THEME); }
  console.log("wrote", OUT);
})();
