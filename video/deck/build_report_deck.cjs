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

  // 1. title
  let s = pres.addSlide({ masterName: "DARK" });
  picture(s, I.chats, W - 3.6, 0.6, 2.9, 6.3);
  title(s, "Serve: Play more.
Manage less.");
  s.addText("Technical report · Meta Global AI Developer Hackathon 2026 · Indie Developer track", { placeholder: "body" });
  s.addText("play.theminimallab.com · github.com/gino6178/serve-meta-hackathon", { isTextBox: true, x: M, y: H - 1.0, w: 9, h: 0.4, fontSize: 14, color: "9FB3A7", margin: 0 });
  note(s, "Serve is a platform where people and agents make games together. This deck follows the technical report: impact, technical depth, Meta models, and what is not done yet.");

  // 2. impact: the three barriers
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "People stop playing because organising is hard");
  text(s, "What stops adults playing regularly (Sport New Zealand, Active NZ 2023). Serve's three helpers answer them in turn.", { x: M, y: 1.35, w: W - 2 * M, h: 0.5, color: HEX.muted });
  [["64.2%", "times hard to fit together around other commitments", "Talk fits the time"], ["21.3%", "no way to keep the habit going", "Match keeps the habit"], ["10.2%", "no regular people to play with", "The agents find the people"]].forEach(([big, lab, ans], i) => {
    const x = M + i * 4.1;
    stat(s, x, 2.15, 3.8, big, lab);
    card(s, x, 4.0, 3.8, 0.8, HEX.greenBg);
    s.addText(ans, { isTextBox: true, x: x + 0.25, y: 4.0, w: 3.3, h: 0.8, fontSize: 17, bold: true, color: HEX.green, margin: 0, valign: "middle" });
  });
  text(s, [{ text: "40% ", options: { bold: true } }, { text: "of 18 to 21 year olds played a sport, but only " }, { text: "26% ", options: { bold: true } }, { text: "of 26 to 49 year olds (NPR, RWJF and Harvard Chan, 2015). Serve's core value: hours of back-and-forth in a chat app become " }, { text: "one yes", options: { bold: true, color: HEX.green } }, { text: " from each person." }], { x: M, y: 5.25, w: W - 2 * M, h: 1.0 });
  note(s, "Most people who stop playing have not lost interest; they are worn down by organising a game. The three barriers map to Serve's three helpers: Talk, Match, and the agents.");

  // 3. a first real club, and the flow
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A first real club: 3 invites, 2 games played in three days");
  picture(s, I.flow, M, 1.4, W - 2 * M, 3.3);
  card(s, M, 4.95, 5.9, 1.65);
  text(s, [{ text: "More than 10 people", options: { bold: true, breakLine: true } }, { text: "of a real badminton club used Serve during the hackathon; of the 3 game invites sent through it, 2 became games that were played." }], { x: M + 0.25, y: 5.12, w: 5.4, h: 1.4, fontSize: 14 });
  card(s, M + 6.2, 4.95, W - 2 * M - 6.2, 1.65, HEX.greenBg);
  text(s, [{ text: "“It's actually really handy. You just talk to the agent.”", options: { italic: true, breakLine: true } }, { text: "“The way it suggests games first can make people more motivated to play.”", options: { italic: true, breakLine: true } }, { text: "Players A and B, translated from Chinese", options: { fontSize: 11, color: HEX.muted } }], { x: M + 6.45, y: 5.12, w: W - 2 * M - 6.7, h: 1.4, fontSize: 14 });
  note(s, "On the web a sentence becomes an invite, the players' agents agree the time, one tap books it; in Messenger the same booking, with the agent's real replies from the Messenger end-to-end test.");

  // 4. validated by agents
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Validated in nine days by 153 independent AI agents");
  stat(s, M, 1.5, 2.6, "25", "rounds of agent testing");
  stat(s, M + 2.85, 1.5, 2.6, "153", "agents, each a new model with only a persona and the address");
  stat(s, M, 3.4, 2.6, "16,713", "logged requests on fresh copies of the live code");
  stat(s, M + 2.85, 3.4, 2.6, "0", "faults in a core flow from the last round's six agents");
  text(s, bullets([["Fixed between rounds:", "what each round found was fixed before the next."], ["An agent with only the address:", "the best of three was doing useful work by its third API request, and found its person a Sunday 09:00 tennis game, free, 2.6 km away."], ["Honest scope:", "the testers were AI models, not people; beyond one real club the evidence is simulated."]]), { x: M, y: 5.35, w: 5.6, h: 1.6, fontSize: 13 });
  picture(s, I.chats, M + 6.3, 1.45, W - 2 * M - 6.3, 5.4);
  note(s, "A long trial with real players is not possible in a nine-day build, so Serve was also checked by agents: six a round, five to ten in the first five rounds.");

  // 5. the rule, and the architecture
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Code computes the facts; models choose among preferences");
  const ah = picture(s, I.arch, M, 1.35, W - 2 * M, 4.6);
  text(s, "That keeps a model's mistake from turning into a wrong booking or a clash. Four pieces of engineering underneath: a standard A2A protocol with a negotiation engine, active querying by the value of information, a community that evolves the platform with rollback, and 3D reconstruction from a phone video.", { x: M, y: 1.35 + ah + 0.2, w: W - 2 * M, h: 1.0, fontSize: 14, color: HEX.muted });
  note(s, "The one rule throughout: code computes the facts and keeps the hard rules; the models choose only among the real preferences left.");

  // 6. A2A: facts only, one round, holds
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A2A v1.0: facts only, settled in one round by intersection");
  text(s, bullets([
    ["Facts only.", "A proposal carries each time as {id, date, start, venue, court, trip}; sentences between agents are templates filled by code, so no agent's model reads another side's words."],
    ["One round, by intersection.", "The host lists up to 12 times that fit every calendar; each agent marks the ones that work, and that is binding. Contract Net with a one-shot intersection."],
    ["Durable and signed.", "Saved before every round, answered once, idempotent booking; Agent Cards signed (Ed25519 JWS over canonical JSON)."],
    ["To the standard.", "jku on cards, the proposal and hold extensions declared and required, the protocol's own error codes."],
  ]), { x: M, y: 1.45, w: 6.6, h: 5.2, fontSize: 15, paraSpaceAfter: 10 });
  stat(s, M + 7.0, 1.45, 2.65, "0 of 12", "double bookings with holds (11 of 12 without)");
  stat(s, M + 9.85, 1.45, 2.3, "20 / 20", "recovery checks, gateway killed at 5 points");
  stat(s, M + 7.0, 3.35, 2.65, "22 / 22", "checks across two machines, 12 talks at once");
  stat(s, M + 9.85, 3.35, 2.3, "185 ms", "added per request by the cross-machine hop");
  card(s, M + 7.0, 5.25, W - 2 * M - 7.0, 1.35, HEX.greenBg);
  text(s, [{ text: "The fairest venue. ", options: { bold: true } }, { text: "Code picks the venue whose longest trip is shortest. Fairness score 0.73, against 0.59 (shortest total trip) and 0.58 (Nash), at 2.3 more minutes per game." }], { x: M + 7.25, y: 5.38, w: W - 2 * M - 7.5, h: 1.15, fontSize: 13 });
  note(s, "Holds are leases with resource ordering: all or nothing, 30 minutes, asked in a fixed order.");

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
  text(s, bullets([["A decision model, like TypeSafe's Jev:", "options declared in advance and scored together in one read; it never writes text that could break a rule."], ["Served at 0.6 sure:", "answers 96.0% of 500 and 73.0% of the 196 hardest; agreement 89.9% and 68.4% (Glimmer again: 73.5%)."], ["0.5 was tried and not kept:", "96.9% of the hardest answered, but agreement there fell to 61.2%."], ["In talks with the simulated club:", "Glimmer's member answers cut by 67% (54% with private calendars), no rule broken."]]), { x: M, y: 3.4, w: W - 2 * M, h: 3.3, fontSize: 15, paraSpaceAfter: 9 });
  note(s, "Why distil when the decider takes 0.53 s? The decider is still Glimmer and needs the GPU; the student runs on the CPU and leaves the GPU free for work only Glimmer can do.");

  // 14. what surprised us
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "What surprised us, running Meta's models in a product");
  [["Glimmer reasons even when told not to", "84% of the tokens it wrote over 2,755 calls were reasoning; 9% of calls came back empty. Every call now asks for think \"low\" with 900 tokens of room."], ["A 1B agrees with Glimmer as often as Glimmer agrees with itself", "89.5% against 88.8% on 500 held-out cases, in 0.9 s instead of about 40 s."], ["Glimmer can decide in one token", "Read with no chat template, its next token gives a probability for each option: 0.53 s, no reasoning. It mostly reads the order, though: 99.5% of picks were the first time listed."], ["Llama Guard 3 reads sports injuries as medical advice", "Its S6 category flagged 6 to 8 of 15 ordinary injury-care answers; S6 now blocks only when code also finds a dose, a medicine or a condition."]].forEach(([h, d], i) => {
    const x = M + (i % 2) * 6.15, y = 1.45 + Math.floor(i / 2) * 2.65;
    card(s, x, y, 5.95, 2.4);
    s.addText([{ text: h, options: { bold: true, breakLine: true, fontSize: 17, color: HEX.green } }, { text: d, options: { fontSize: 14 } }], { isTextBox: true, x: x + 0.3, y: y + 0.2, w: 5.35, h: 2.0, valign: "top", margin: 0, color: HEX.ink, paraSpaceAfter: 6 });
  });
  note(s, "Four findings, each measured. The order finding was measured after the report: on 196 hard cases the one-token decider picked the first listed time 99.5% of the time.");

  // 15. security
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Security, and a failure the agents found");
  stat(s, M, 1.45, 3.0, "93 / 93", "attack cases stopped, named by OWASP LLM Top 10 risk");
  text(s, bullets([["Prompt Guard 2 first:", "every post and comment, before Llama Guard 3 and code."], ["A signed record of every yes:", "each entry signed and chained to the one before, so a yes cannot be changed or removed unseen."], ["No-shows, with no money:", "show-up fades with a 60-day half-life and is shown as a range in words; a short game is called off 3 hours before; a freed spot goes to the waitlist with 12 hours to confirm."], ["The Agents Rule of Two:", "no agent holds untrusted input, private data and the power to act at once."]]), { x: M + 3.4, y: 1.45, w: W - 2 * M - 3.4, h: 3.4, fontSize: 15, paraSpaceAfter: 9 });
  card(s, M, 5.0, W - 2 * M, 1.6, "FBEAE9");
  text(s, [{ text: "A failure, and the fix. ", options: { bold: true, color: HEX.red } }, { text: "A tester working as a host could work out how many people nearby were open to being asked, first from a count, then from the talk. Now nearby people appear only once they can actually play, and everyone else sees only published badge words; later rounds re-checked it and found nothing." }], { x: M + 0.3, y: 5.15, w: W - 2 * M - 0.6, h: 1.35, fontSize: 14 });
  note(s, "93 attack cases all stopped; crash and recovery checks are on the A2A slide.");

  // 16. Meta models and routing by length
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Meta models, and which one answers: by length");
  const rows = [["Muse Glimmer (30B)", "RTX 3090", "Every agent's reasoning; a JSON Schema on every call"], ["Our Llama 3.2 1B", "Server CPU, int4", "Choices between times; short text at five checked sites"], ["Muse Spark 1.3", "Meta Model API", "Calls of 12,000+ tokens, and the fallback"], ["Muse Voice Transcribe", "Meta Model API", "Live voice, full duplex"], ["Muse Image · Muse Wonder · SAM 3.1", "Meta Model API", "Agent faces and posters · orbit judge (87%) · outline cross-check (0.974 IoU)"], ["Llama Guard 3 · Prompt Guard 2", "Server CPU", "Safety on Messenger, wishes, posts and reviews"], ["DRAMA · Omnilingual ASR", "Server CPU", "Memory by meaning, game-request router · voice notes"], ["SAM 2.1 · Sapiens2 · MapAnything", "RTX 3090", "Highlights and 3D replays"]];
  s.addTable([[{ text: "Model", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green } } }, { text: "Runs on", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green } } }, { text: "Its job in Serve", options: { bold: true, color: "FFFFFF", fill: { color: HEX.green } } }], ...rows.map((r, i) => r.map((t) => ({ text: t, options: { fill: { color: i % 2 ? "FFFFFF" : HEX.card } } })))],
    { x: M, y: 1.4, w: 7.6, colW: [2.6, 1.7, 3.3], fontSize: 11.5, color: HEX.ink, border: { type: "none" }, margin: [0.05, 0.08, 0.05, 0.08], rowH: 0.42 });
  card(s, M + 7.9, 1.4, W - 2 * M - 7.9, 5.2, HEX.greenBg);
  text(s, [{ text: "Routing by length", options: { bold: true, fontSize: 17, color: HEX.green, breakLine: true } },
    { text: "Short (≤ ~700 tokens) at a checked site → our 1B", options: { bullet: true, breakLine: true } }, { text: "Longer, or anywhere else → Muse Glimmer", options: { bullet: true, breakLine: true } }, { text: "12,000+ tokens → Muse Spark", options: { bullet: true, breakLine: true } },
    { text: "Every short site was tried on the 1B first: 9 end-to-end checks failed, 2 of 6 hostile comments got through, 4 of 10 injected reviews were obeyed. So only five checked sites, and the red team stays 93 of 93.", options: { breakLine: false } }], { x: M + 8.15, y: 1.6, w: W - 2 * M - 8.4, h: 4.9, fontSize: 13.5, paraSpaceAfter: 8 });
  note(s, "Open weights run on our own GPU server so players' data stays there; the Meta Model API handles live voice, long calls, images and checks.");

  // 17. upgrades since the report
  s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Measured since the report: seven more agent upgrades");
  const ups = [["Send gate", "When not to ask: opt-outs 37.7% → 26.2%, games from asks 3.97 → 4.39 (simulated)"], ["Preference records", "Newest word wins: stale-preference decisions 95% → 17% once the player says it (simulated)"], ["Tool-call checks", "Silent failures passed as success 53 of 53 → 0 of 56 (fault injection)"], ["Courts judged ahead", "Wait after moving the time 49.0 s → 25.7 s, at twice the judgings (RTX 3090)"], ["Harder simulated users", "With 25% difficult people pass^1 0.69 → 0.38; six flow bugs found and being fixed"], ["Order of the options", "Glimmer changed 24 of 60 answers when only the order changed; kept as is"], ["Stretch round", "Games found +0.3 (singles) and +1.3 points (doubles): small, reported as such"]];
  ups.forEach(([h, d], i) => {
    const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4, x = M + col * 6.15, y = 1.45 + row * 1.3;
    card(s, x, y, 5.95, 1.12);
    s.addText([{ text: h, options: { bold: true, breakLine: true, fontSize: 15, color: HEX.green } }, { text: d, options: { fontSize: 12.5 } }], { isTextBox: true, x: x + 0.25, y: y + 0.1, w: 5.45, h: 0.95, valign: "middle", margin: 0, color: HEX.ink });
  });
  text(s, "Each from a 2024–2026 paper, built and measured against what ran before; most numbers are simulated and say so (README, submission/results/).", { x: M + 6.15, y: 5.4, w: 5.95, h: 1.0, fontSize: 13, color: HEX.muted });
  note(s, "After the report: send gate (Oralytics, EOPA), preference records (PersonaMem, Mem0), tool checks (JSONSchemaBench, ToolMaze), judging ahead (Speculative Actions), pass^k (tau-bench, Sim2Real), order (Magentic Marketplace), stretch round (CalBench).");

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

  // 19. close
  s = pres.addSlide({ masterName: "DARK" });
  title(s, "One yes from each person");
  s.addText("Live: play.theminimallab.com · Code: github.com/gino6178/serve-meta-hackathon · Every number from submission/results/", { placeholder: "body" });
  note(s, "Serve turns hours of back-and-forth into one tap from each person.");

  await pres.writeFile({ fileName: OUT });
  if (THEME_JS) { const { applyTheme } = require(THEME_JS); await applyTheme(OUT, THEME); }
  console.log("wrote", OUT);
})();
