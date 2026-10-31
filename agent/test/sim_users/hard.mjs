// Difficult simulated people. LLM-simulated users are more cooperative than the people they stand for and make agents
// look better than they are (Sim2Real, arXiv 2603.11245: 451 humans against 31 simulators); tau-bench (arXiv
// 2406.12045) asks the same task k times and counts only the agent that succeeds every time. So a share of the trial
// club (25%: five of the twenty) is given one of five difficulties, each a profile the person keeps (as SimulatorArena
// conditions its simulators on user profiles). Everyone else answers as the inertia model says (inertia.mjs), which
// is the cooperative club. Whether and what a person answers is drawn from named dice (rng.mjs) under the run's seed,
// the scenario, the trial and the step, so a run is the same from the same numbers. Pure: no I/O, no model.
import { u, stream, shuffle, pick } from "./rng.mjs";
import * as I from "./inertia.mjs";

export const KINDS = {
  flipper: "says yes readily, then backs out by message once the game is booked (70% of trials)",
  ghost: "answers nothing (half the trials) or answers after the hold has lapsed (the other half)",
  budget: "gives up without saying so after 1-2 questions or 3-5 messages from the agent in one go",
  drifter: "stopped playing on one of their usual days this week, tells their agent once, then turns that day down",
  vague: "answers in vague words instead of tapping a button (75% of questions)",
};
export const TYPES = Object.keys(KINDS);
export const SHARE = 0.25;
const LONG = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const ZH = { Mon: "星期一", Tue: "星期二", Wed: "星期三", Thu: "星期四", Fri: "星期五", Sat: "星期六", Sun: "星期日" };

// who is difficult, and how: round(share x club) people, drawn by the seed; the kinds dealt in turn, so each comes up
export function assign(personas, seed, share = SHARE) {
  const n = Math.round(personas.length * share), who = shuffle(stream(seed, "hard-who"), personas.map((p) => p.id)).slice(0, n);
  const kinds = shuffle(stream(seed, "hard-kinds"), TYPES);
  return Object.fromEntries(who.map((id, i) => [id, kinds[i % kinds.length]]));
}

// one person's dice in one trial of one scenario
const key = (ctx, ...k) => [ctx.scen, ctx.trial, ...k].join(":");
// the drifter's dropped day: one of their usual days (their free windows), the same in every trial
export const dropDay = (seed, p) => pick(stream(seed, "drift", p.id), I.windows(p.free).map((w) => w.day));
export const driftText = (seed, p) => {
  const d = dropDay(seed, p);
  return p.lang === "zh" ? `跟你說一下，從這週開始${ZH[d]}我都不能打了。` : `heads up: I can't play on ${LONG[d]}s any more, starting this week.`;
};
// the budget person's hidden tolerance in this trial: questions with buttons, and messages of any kind
export const budgetOf = (seed, p, ctx) => ({ questions: 1 + Math.floor(u(seed, "budget-q", p.id, key(ctx)) * 2), messages: 3 + Math.floor(u(seed, "budget-m", p.id, key(ctx)) * 3) });
// the ghost in this trial: silent, or late
export const ghostMode = (seed, p, ctx) => (u(seed, "ghost", p.id, key(ctx)) < 0.5 ? "silent" : "late");
// the flipper backs out of a booked game in this trial
export const flips = (seed, p, ctx) => u(seed, "flip", p.id, key(ctx)) < 0.7;

const VAGUE = { en: ["hmm maybe, depends on work", "could be ok I guess?", "not sure yet, let me see", "maybe! will know later", "possibly, ask me again closer to the day"],
  zh: ["嗯…可能吧，看工作", "應該可以吧？", "還不確定耶，再看看", "也許，到時候再說", "可能喔，晚點跟你說"] };
export const vagueText = (seed, p, ctx, step) => pick(stream(seed, "vague-text", p.id, key(ctx, step)), VAGUE[p.lang === "zh" ? "zh" : "en"]);
export const bailText = (p, day, start) => (p.lang === "zh" ? `抱歉，${ZH[day] || day} ${start}那場我臨時不能去了。` : `sorry, something came up, I can't make ${LONG[day] || day} ${start} after all`);

// The answer to a question with buttons about one game: "yes" (I'm in, Book it, Yes set it up), "no" (Can't make it,
// Drop it, Not this week), "other" (Another time, where there is such a button), "text" (words, no tap: vague), or
// "silent". delay: "now" or "late" (after the hold lapsed). The cooperative answer is the inertia model's
// (answerGame, with this trial's dice); `asked` is the asker's own request, which they keep when the time is theirs.
//   ctx { scen, trial, step, date, start, minutes, kind ("confirm" | "book" | "ask" | "notice"), asked: { date, start }
//         | null, seen: { questions, messages } so far in this scenario, club: the club seed (the drifter's day; default
//         the seed) }
export function answer(seed, p, type, ctx) {
  const k = key(ctx, ctx.kind, ctx.step);
  const mine = ctx.asked && ctx.asked.date === ctx.date && ctx.asked.start === ctx.start;
  const coop = mine ? "yes" : I.answerGame(seed, p, { date: ctx.date, start: ctx.start, minutes: ctx.minutes || 90, need: 1, key: k });
  const tap = (a) => ({ act: a === "yes" ? "yes" : a === "other" ? "other" : a === "ignore" ? "silent" : "no", delay: "now", coop });
  if (!type) return { ...tap(coop), why: "cooperative" };
  // (a difficult person who would have let it lie answers, where their difficulty is about how they answer)
  const keen = coop === "ignore" ? "yes" : coop;
  switch (type) {
    case "flipper": return { ...tap(I.freeThen(seed, p, ctx.date, ctx.start, ctx.minutes || 90) || mine ? "yes" : keen), why: "says yes readily" };
    case "ghost": { const g = ghostMode(seed, p, ctx); return g === "silent" ? { act: "silent", delay: "now", coop, why: "ghost: never answers" } : { ...tap(keen), delay: "late", why: "ghost: answers after the hold lapsed" }; }
    case "budget": { const b = budgetOf(seed, p, ctx), s = ctx.seen || { questions: 0, messages: 0 };
      if (s.questions > b.questions || s.messages > b.messages) return { act: "silent", delay: "now", coop, why: `gave up (${s.questions} questions, ${s.messages} messages; tolerance ${b.questions} and ${b.messages})`, gaveUp: true };
      return { ...tap(keen), why: "within tolerance" }; }
    case "drifter": { const d = dropDay(ctx.club ?? seed, p); return I.dayOf(ctx.date) === d ? { act: "no", delay: "now", coop, why: `no longer plays on ${d}` } : { ...tap(keen), why: "a day they still play" }; }
    case "vague": return u(seed, "vague", p.id, k) < 0.75 ? { act: "text", text: vagueText(seed, p, ctx, ctx.step), delay: "now", coop, why: "vague words, no tap" } : { ...tap(keen), why: "tapped" };
    default: return { ...tap(coop), why: "cooperative" };
  }
}
// after a game they are in is booked: whether they back out (only the flipper, in the trials it flips)
export const backsOut = (seed, p, type, ctx) => type === "flipper" && flips(seed, p, ctx);

// what the asker writes to ask for a game: a phrase Serve reads as a request (the informed arm of run.mjs: this
// measures what happens after the request, not how it is worded, so it is in English for everyone); the vague asker
// names no day or time
export function requestText(p, type, slot) {
  if (type === "vague") return "maybe up for a game sometime this week if anyone's around";
  return `I want to play ${slot.format} on ${LONG[slot.day]} at ${slot.start}`;
}
