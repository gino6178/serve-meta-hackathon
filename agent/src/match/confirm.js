// A partner's "Are you in?" and what follows it (CLUB_PLAYERS=1: their agent agreed a game, they keep "ask me first"
// on). The pass^k harness with difficult simulated people (test/sim_users/passk_run.mjs) found six ways this went wrong;
// each has its rule here:
//   1. a back-out sent as words ("can't make it after all") is read by code, confirmed with one quick reply (it changes
//      the game for others), then acted on: the game is called off, everyone in it is told, and the host's agent looks
//      for someone else
//   2. the ask lapses when the hold does (A2A_LEASE_MS), with one nudge at half time; then the asker is told and the
//      search moves on. A yes after that is checked against the state now, and the asker is asked again
//   3. vague words to "Are you in?" get the question once more, with three buttons; a second vague answer is taken as
//      no answer (the lapse above), and nothing promises a later check
//   4. a change of usual days said in words ("no Saturdays any more") becomes a preference record (memory/prefs.js),
//      which the member's agent keeps when it answers (a2a/talk.js breaks)
//   5. a new search leaves out everyone who said no or let the ask lapse in this request, and stops after MAX_ROUNDS
//      searches, telling the asker plainly
//   6. a game called off by someone's no or silence is told to everyone who was asked
// The state (data/partner_confirm.json, data/confirm_chains.json) and what is sent are the caller's (server.js passes
// deps); the reading of words is pure and exported for the tests.
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import * as prefs from "../memory/prefs.js";

export const MAX_ROUNDS = 3; // searches after the first, per request
const DAY = 864e5;
const LONG = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
const ZH_DAY = { 日: "Sun", 天: "Sun", 一: "Mon", 二: "Tue", 三: "Wed", 四: "Thu", 五: "Fri", 六: "Sat" };
const first = (n) => String(n || "").split(" ")[0];

// ---- words (code) ----
// a change that holds from now on, not one game: "any more", "from now on", a plural day, "every"
const STANDING = /\b(any ?more|no longer|from now on|starting (this|next)|these days|every (mon|tue|wed|thu|fri|sat|sun|week)\w*|(mon|tues|wednes|thurs|fri|satur|sun)days|weekdays|weekends)\b|從.{0,8}開始|以後|都不(能|打|行)/i;
const BACK = /\b(can'?t|cannot|can not|won'?t|unable to|not able to)\s+(make|come|go|play|do it|do that)\b|\bsomething came up\b|\bhave to (cancel|drop out|pull out|bail)\b|\bdrop(ping)? (me )?out\b|\bpull(ing)? out\b|\bcount me out\b|\bi'?m out\b|\bcancel (it|my|the|that)\b|不能去|去不了|不能來|來不了|臨時不能|沒辦法去|要取消|取消/i;
const VAGUE = /\b(maybe|not sure|unsure|depends|might|perhaps|possibly|let me see|will know|i guess|we'?ll see|probably|could be|later|dunno|not yet)\b|可能|也許|不確定|再看看|再說|應該|看看|晚點|不一定/i;
const OTHER = /\b(another|other|different) (time|day)\b|改天|換個時間|別的時間/i;
const NO = /^\s*(no|nope|nah|sorry)\b|\b(can'?t|cannot|not able to|unable to) (make|do|come|go|play)\b|\bcount me out\b|\bi'?m out\b|不行|不能|沒辦法|不去|不要/i;
const YES = /^\s*(yes|yep|yeah|yup|sure|ok|okay|in|deal|great|perfect)\b|\b(i'?m in|count me in|sounds good|works for me|see you there)\b|好啊|好的|可以|沒問題|我參加|算我一個|^好/i;
// an answer in words to an open "Are you in?": "yes", "no", "other", "vague", or null (something else: chat)
export function answerWords(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (VAGUE.test(t)) return "vague";
  if (OTHER.test(t)) return "other";
  if (NO.test(t)) return "no";
  if (YES.test(t)) return "yes";
  return null;
}
// a back-out from one game ("sorry, something came up, I can't make Thursday 19:00 after all"), not a standing change
export const backOut = (text) => BACK.test(String(text || "")) && !STANDING.test(String(text || ""));
// the day and the start a text names, either may be null ("Thursday 19:00", "週四", "thu")
export function whenOf(text) {
  const t = String(text || "");
  const m = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(t), z = /(?:星期|週|周|禮拜)([日天一二三四五六])/.exec(t), s = /\b(\d{1,2}):(\d{2})\b/.exec(t);
  const day = m ? m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase() : z ? ZH_DAY[z[1]] : null;
  return { day, start: s ? `${s[1].padStart(2, "0")}:${s[2]}` : null };
}
// preference records in a standing change of usual days ("I can't play on Saturdays any more"), or []
export function standing(text) {
  const t = String(text || "");
  if (!STANDING.test(t)) return [];
  const out = prefs.extract(t).filter((r) => r.kind === "time");
  // (Chinese: a day and a "can't" in it; memory/prefs.js reads English)
  for (const z of t.matchAll(/(?:星期|週|周|禮拜)([日天一二三四五六])/g)) if (/不能|不行|沒辦法|不打/.test(t)) { const key = ZH_DAY[z[1]].toLowerCase(); if (!out.some((r) => r.key === key)) out.push({ kind: "time", key, value: "no" }); }
  return out;
}
// a game's day and start, for the short questions
export const short = (o) => `${LONG[o.day] || o.day} ${o.start}`;

// ---- the asks ----
// deps: send(id, text, opts), describe(o, forId), releaseHolds(o), book(by, o) -> { error? }, research(by, o, leaveOut),
//   bookingsOf(id) -> [{ id, option }] (upcoming, not cancelled), callOff(booking), recheck(o) -> { ok, why },
//   record(id, r, meta), nameOf(id), leaseMs(), now(), file, chainsFile
export function createConfirm(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const FILE = path.resolve(deps.file || "data/partner_confirm.json"), CFILE = path.resolve(deps.chainsFile || "data/confirm_chains.json");
  const pending = readJSON(FILE, {}), chains = readJSON(CFILE, {});
  const save = () => { writeJSON(FILE, pending); writeJSON(CFILE, chains); };
  const lease = () => Math.max(1000, +(deps.leaseMs ? deps.leaseMs() : 30 * 60000));
  const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const nameOf = (P, id) => (id === P.by ? P.byName : P.option.partners.find((x) => x.id === id)?.name || "Your partner");
  const waitingOf = (P) => Object.keys(P.asked).filter((k) => P.asked[k].state === "waiting");
  const sync = (P) => { P.waiting = waitingOf(P); };
  const BUTTONS = (id) => [{ title: "I'm in", payload: `pc:${id}:yes` }, { title: "Can't make it", payload: `pc:${id}:no` }, { title: "Another time", payload: `pc:${id}:other` }];
  // the request's chain: who said no or let the ask lapse, and how many searches it has had (one per asker, a day)
  // the list a running search was given is the same array, so a no that lands while it runs still reaches it
  const live = {};
  const leave = (by, id, kind = "no") => { const c = chainOf(by), list = kind === "lapse" ? c.lapsed : c.no; if (!list.includes(id)) list.push(id); if (live[by] && !live[by].includes(id)) live[by].push(id); };
  const chainOf = (by) => { const c = chains[by]; return c && now() - c.at < DAY ? c : (chains[by] = { no: [], lapsed: [], rounds: 0, at: now() }); };

  async function ask(by, byName, o, who) {
    const id = `pc-${now().toString(36)}${crypto.randomBytes(3).toString("hex")}`, t = now();
    chainOf(by);
    pending[id] = { id, by, byName, option: { ...o, by: o.by || by, byName: o.byName || byName }, at: t, until: t + lease(), status: "open", asked: Object.fromEntries(who.map((p) => [p.id, { state: "waiting", nudged: false, vague: 0 }])) };
    sync(pending[id]); save();
    for (const p of who) await deps.send(p.id, `${first(byName)} wants a game with you: ${deps.describe(pending[id].option, p.id)}. Your agent is holding the time for you until ${hhmm(pending[id].until)}. Are you in?`, { buttons: BUTTONS(id).slice(0, 2), reminder: true }).catch(() => {});
    return { asking: who.map((p) => p.name), id };
  }
  // the game is off: the time is let go, everyone asked is told why, and the asker's agent looks again (5) or stops
  async function off(P, cause, kind) {
    P.status = kind === "lapse" ? "lapsed" : "off"; P.endedAt = now(); P.offWhy = cause.map((id) => first(nameOf(P, id))).join(" and ");
    const c = chainOf(P.by), list = kind === "lapse" ? c.lapsed : c.no;
    for (const id of cause) leave(P.by, id, kind);
    sync(P); save();
    await Promise.resolve(deps.releaseHolds(P.option)).catch(() => {});
    const g = short(P.option), why = kind === "lapse" ? `${P.offWhy} didn't answer in time` : `${P.offWhy} can't make it`;
    for (const id of cause) await deps.send(id, kind === "lapse" ? `I held ${g} for you but didn't hear back in time, so I've let it go. Nothing is booked.` : `OK, you're out of it. I've let go of the time and told ${first(P.byName)}'s agent.`).catch(() => {});
    // (6) everyone else who was asked: their yes, or their open question, is closed
    for (const id of Object.keys(P.asked).filter((k) => !cause.includes(k))) await deps.send(id, `${deps.describe(P.option, id)} is off: ${why}, so nothing is booked.`).catch(() => {});
    return searchAgain(P.by, P.option, `${deps.describe(P.option, P.by)}: ${why}, so nothing is booked.`);
  }
  async function searchAgain(by, o, lead) {
    const c = chainOf(by);
    c.rounds++; c.at = now(); save();
    const out = (live[by] = [...new Set([...c.no, ...c.lapsed])]);
    if (c.rounds > MAX_ROUNDS) {
      delete chains[by]; save();
      return deps.send(by, `${lead} I've now asked ${out.length} ${out.length === 1 ? "person" : "people"} for ${short(o)} and none could make it, so I've stopped looking. Send /game to try another time.`);
    }
    await deps.send(by, `${lead} Looking for someone else…`);
    return deps.research(by, o, out);
  }
  async function book(P) {
    P.status = "booked"; sync(P); save();
    const b = await deps.book(P.by, P.option);
    if (b?.error) { P.status = "off"; save(); await deps.send(P.by, `${deps.describe(P.option, P.by)} wasn't booked: ${b.error}`); for (const id of Object.keys(P.asked)) await deps.send(id, `It couldn't be booked after all: ${b.error}`).catch(() => {}); return; }
    delete chains[P.by]; save();
    const yes = Object.keys(P.asked).map((id) => first(nameOf(P, id)));
    await deps.send(P.by, `Booked: ${deps.describe(P.option, P.by)}, court ${P.option.court}. ${yes.join(" and ")} said yes. I'll remind you an hour before.`);
  }
  // a tap on I'm in / Can't make it / Another time
  async function tap(psid, id, value) {
    const P = pending[id], me = P?.asked[psid];
    if (!P || !me) return deps.send(psid, "That game isn't waiting for you any more.");
    if (P.status === "lapsed" && me.state === "lapsed") return value === "yes" ? late(P, psid) : deps.send(psid, "OK. That time had already lapsed, so nothing changes.");
    // (a no that arrives after someone else's no ended the ask still counts: the next search leaves them out too)
    if (P.status !== "open" && value !== "yes" && me.state === "waiting") { me.state = "no"; leave(P.by, psid); sync(P); save(); }
    if (P.status !== "open") return deps.send(psid, P.offWhy ? `That game is off (${P.offWhy}), so nothing is booked.` : "That game isn't waiting for you any more.");
    if (me.state !== "waiting") return deps.send(psid, me.state === "yes" ? "You're already in." : "That game isn't waiting for you any more.");
    if (value !== "yes") { me.state = "no"; return off(P, [psid], "no"); }
    me.state = "yes"; sync(P); save();
    if (P.waiting.length) return deps.send(psid, "Thanks, you're in. I'll book it once everyone has said yes.");
    return book(P);
  }
  // (2) the ask's own clock: a nudge at half time, then it lapses with the hold
  async function tick() {
    const t = now();
    for (const P of Object.values(pending)) {
      if (P.status !== "open") { if ((P.endedAt || P.at) < t - DAY) { delete pending[P.id]; save(); } continue; }
      const w = waitingOf(P);
      if (!w.length) continue;
      if (t >= P.until) { for (const id of w) P.asked[id].state = "lapsed"; await off(P, w, "lapse"); continue; }
      if (t >= P.at + (P.until - P.at) / 2) for (const id of w.filter((k) => !P.asked[k].nudged)) {
        P.asked[id].nudged = true; save();
        await deps.send(id, `Still holding ${deps.describe(P.option, id)} for you until ${hhmm(P.until)}. Are you in?`, { buttons: BUTTONS(P.id), reminder: true }).catch(() => {});
      }
    }
  }
  // (2) a yes after the ask lapsed: checked against now, and the asker asked again; never booked on its own
  async function late(P, psid) {
    const others = Object.keys(P.asked).filter((k) => k !== psid);
    const newer = Object.values(pending).some((x) => x !== P && x.by === P.by && x.at > P.at && ["open", "booked"].includes(x.status)) || deps.bookingsOf(P.by).some((b) => b.option.date === P.option.date && b.option.start === P.option.start);
    if (newer || others.some((k) => P.asked[k].state !== "yes")) return deps.send(psid, `Thanks. The time I held lapsed before your yes, and ${first(P.byName)}'s game has moved on since, so nothing is booked.`);
    const r = await deps.recheck(P.option);
    if (!r?.ok) return deps.send(psid, `Thanks, but ${short(P.option)} doesn't work any more (${r?.why || "it was taken"}), so nothing is booked.`);
    P.late = psid; save();
    await deps.send(psid, `Thanks. The time I held had lapsed, so I've asked ${first(P.byName)} whether to book it now.`);
    return deps.send(P.by, `${first(nameOf(P, psid))} said yes after the time I held lapsed. ${deps.describe(P.option, P.by)} still works for everyone. Book it now?`, { buttons: [{ title: "Book it", payload: `pl:${P.id}:yes` }, { title: "Leave it", payload: `pl:${P.id}:no` }] });
  }
  async function lateTap(psid, id, yes) {
    const P = pending[id];
    if (!P || P.by !== psid || !P.late || P.status !== "lapsed") return deps.send(psid, "That question isn't open any more.");
    const who = P.late; P.late = null;
    if (!yes) { save(); await deps.send(who, `${first(P.byName)} left it, so nothing is booked.`).catch(() => {}); return deps.send(psid, "OK, nothing is booked."); }
    const r = await deps.recheck(P.option);
    if (!r?.ok) { save(); await deps.send(who, `It couldn't be booked: ${r?.why || "it was taken"}. Nothing is booked.`).catch(() => {}); return deps.send(psid, `${short(P.option)} doesn't work any more (${r?.why || "it was taken"}), so nothing is booked.`); }
    P.asked[who].state = "yes";
    return book(P);
  }
  const openFor = (psid) => Object.values(pending).filter((P) => P.status === "open" && P.asked[psid]).sort((a, b) => b.at - a.at);
  // words from a person, before the chat sees them: true when they were handled here
  async function text(psid, words) {
    // (1-3) an open "Are you in?": an answer in words, or vague words (asked once more, then taken as no answer)
    const P = openFor(psid).find((x) => x.asked[psid].state === "waiting");
    if (P) {
      const a = answerWords(words);
      if (a === "yes" || a === "no" || a === "other") { await tap(psid, P.id, a); return true; }
      if (a === "vague") {
        const me = P.asked[psid]; me.vague++; save();
        if (me.vague === 1) { await deps.send(psid, `Just checking: are you in for ${deps.describe(P.option, psid)}? I'm holding it for you until ${hhmm(P.until)}.`, { buttons: BUTTONS(P.id) }); return true; }
        me.state = "lapsed"; save();
        await off(P, [psid], "lapse");
        return true;
      }
    }
    // (1) a back-out from a game they are in: one quick question first, since it changes the game for others
    if (backOut(words)) {
      const w = whenOf(words), fits = (o) => (!w.day || o.day === w.day) && (!w.start || o.start === w.start);
      const b = deps.bookingsOf(psid).filter((x) => fits(x.option)).sort((x, y) => `${x.option.date} ${x.option.start}`.localeCompare(`${y.option.date} ${y.option.start}`))[0];
      const p = !b && openFor(psid).find((x) => x.asked[psid].state === "yes" && fits(x.option));
      if (b || p) {
        const o = b ? b.option : p.option, ref = b ? `b~${b.id}` : `p~${p.id}`;
        await deps.send(psid, `Drop out of ${short(o)} (${deps.describe(o, psid)})? The others will be told.`, { buttons: [{ title: "Yes, drop out", payload: `pd:${ref}:yes` }, { title: "No, I'm in", payload: `pd:${ref}:no` }] });
        return true;
      }
    }
    // (4) a change of usual days: a preference record the member's agent keeps; the chat still answers
    for (const r of standing(words)) deps.record(psid, r, { source: { type: "chat", text: String(words).slice(0, 160) }, confidence: prefs.CONF.said, explicit: true });
    return false;
  }
  // the answer to "Drop out of ...?"
  async function dropTap(psid, ref, yes) {
    if (!yes) return deps.send(psid, "OK, you're still in.");
    const [kind, id] = String(ref).split("~");
    if (kind === "p") { const P = pending[id]; if (!P || P.status !== "open" || P.asked[psid]?.state !== "yes") return deps.send(psid, "That game isn't waiting for you any more."); P.asked[psid].state = "no"; return off(P, [psid], "no"); }
    const b = deps.bookingsOf(psid).find((x) => x.id === id);
    if (!b) return deps.send(psid, "That game isn't on the book any more.");
    const o = b.option, players = [...new Set([o.by, ...(o.partners || []).map((x) => x.id)].filter(Boolean))], others = players.filter((x) => x !== psid);
    const nm = (x) => (deps.nameOf ? deps.nameOf(x) : null) || o.partners?.find((p) => p.id === x)?.name || x;
    await deps.callOff(b);
    await deps.send(psid, `OK, you're out of ${short(o)}. It's called off and I've told ${others.map((x) => first(nm(x))).join(" and ")}.`);
    if (psid === o.by || !o.by) { for (const x of others) await deps.send(x, `${first(nm(psid))} called off ${deps.describe(o, x)}, so nothing is booked.`).catch(() => {}); return; }
    for (const x of others.filter((k) => k !== o.by)) await deps.send(x, `${first(nm(psid))} dropped out of ${deps.describe(o, x)}, so it's called off and nothing is booked.`).catch(() => {});
    // the host's agent looks for someone else, leaving out the one who dropped out (the same chain as a no)
    leave(o.by, psid); save();
    return searchAgain(o.by, o, `${first(nm(psid))} dropped out of ${deps.describe(o, o.by)}, so it's called off and nothing is booked.`);
  }
  return { ask, tap, tick, text, dropTap, lateTap, pending, chains };
}
