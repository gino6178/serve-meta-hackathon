// People in the club feed: their own posts (text, or a photo with a caption), comments, likes and reports, and the
// feed as one member sees it.
//   Before anything a person writes is shown, Prompt Guard 2 reads it (an instruction to the agents), code checks it
//   (text.js: no contact details, nothing about another member's health or private life) and Llama Guard 3 reads it.
//   A flagged one is not kept, and the author is told why in plain words; words of self-harm get the helpline instead.
//   When a guard does not answer, the post waits, seen only by its author, and is checked again every few minutes
//   (retryHeld); nothing is shown unchecked.
//   Rate limits per member (RATES), a report button (three different members' reports hide an item until the
//   maintainer looks), "Not for me" on a post, and /forget (forget) deletes the member's posts, comments, likes, reports
//   and drafts, with their photos and clips.
//   A like on a paper or a highlight is a 👍 for the community loop (features "papers" and "highlights"), and "Not for
//   me" a 👎: counts only, and only for members with /improve on (loop/signals.js decides).
// A player is a Messenger id or "app" (the club's web app); the gateway's token is the club's own machine.
import { deps, guardRules } from "./deps.js";
import * as Tr from "../members/trust.js";
import * as S from "./store.js";
import * as T from "./text.js";
import { perWeekFor, isQuestion, answer } from "./papers.js";
import { lineFor } from "./line.js";
import { find as clubOf } from "../members/clubs.js";
import { holdInvite } from "../members/programs.js";
import * as Consent from "../a2a/consent.js";

const MIN = 6e4, DAY = 864e5, HOUR = 36e5;
// a game short of its minPlayers this long before the start is called off; a spot offered from the waitlist waits this
// long for a yes (never past the cut-off), then goes to the next in line
export const CUTOFF_HOURS = 3, CONFIRM_HOURS = 12;
// how much one member can do: [count, window]
export const RATES = { post: [[4, 10 * MIN], [12, DAY]], comment: [[10, 10 * MIN], [60, DAY]], like: [[120, 60 * MIN]], report: [[10, DAY]], ask: [[10, DAY]], draft: [[10, DAY]], upload: [[20, DAY]] };
export function limited(player, kind) {
  const now = deps.now(), db = S.data(), mine = (db.rate[player] ||= {}), at = (mine[kind] || []).filter((t) => now - t < DAY);
  for (const [n, w] of RATES[kind] || []) {
    const inWin = at.filter((t) => now - t < w);
    if (inWin.length >= n) return { error: `That's the limit for now: ${n} ${kind === "post" ? "posts" : kind === "comment" ? "comments" : `${kind}s`} in ${w >= DAY ? "a day" : `${Math.round(w / MIN)} minutes`}. Try again later.`, code: 429, retryIn: Math.ceil((w - (now - inWin[0])) / 1000) };
  }
  return null;
}
const count = (player, kind) => S.change((d) => { const m = (d.rate[player] ||= {}); m[kind] = [...(m[kind] || []).filter((t) => deps.now() - t < DAY), deps.now()].slice(-200); });

// who a player is in the feed
export function authorOf(player) {
  const club = deps.club(), m = (club.members || []).find((x) => x.id === player);
  return m ? m.name : deps.nameOf(player);
}
const othersNames = () => [...(deps.club().members || []).map((m) => m.name), ...deps.names()];
// Llama Guard's categories that keep a person's text out of the feed: what stops a message to the agent, and also
// defamation (S5) and privacy (S7). (S6, specialized advice, is for what models write; a member may say their knee hurts.)
export const BLOCK_POST = [...guardRules.BLOCK_IN, "S5", "S7"];
// what Prompt Guard reads beside the text: the text folded back to plain letters (NFKC, lookalike letters from other
// scripts, zero-width marks, letters spaced or dotted apart), so a rewrite that only changes how it looks reads the
// same (test/feed_unit.mjs, the adaptive red team)
const LOOK = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h", "ӏ": "l", "ɡ": "g", "ο": "o", "ν": "v", "ι": "i", "Α": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "І": "I", "К": "K", "М": "M", "О": "O", "Р": "P", "Т": "T", "Х": "X", "Υ": "Y", "Ζ": "Z", "Ѕ": "S" };
export function folded(text) {
  const s = String(text).normalize("NFKC").replace(/[​-‍⁠﻿­]/g, "").replace(/[^\x00-\x7f]/g, (c) => LOOK[c] ?? c);
  // (a run keeps one separator, so "i  g  n  o  r  e y  o  u  r" folds to "ignore your"; letters set one space apart
  // with words one space apart run together, which is the guard's to read)
  return s.replace(/(?<!\p{L})\p{L}([\s.\-_*·]{1,2})(?:\p{L}\1){1,}\p{L}(?!\p{L})/gu, (m, sep) => m.split(sep).join("")).replace(/(?<=\p{L})[\-_*·]+(?=\p{L})/gu, "");
}
// the checks on a person's text (and an outside agent's, through the agent channel): { ok } | { refused, why } |
// { helpline } | { down } (a check did not answer). Prompt Guard 2 first (text that instructs the agents that read the
// feed), then code, then Llama Guard 3 (its hazard categories), then the club's own standard, read by Muse Glimmer:
// Llama Guard 3 1B lets most harassment through (veiled threats, insults, demeaning a group, asking someone for
// photos; test/feed_redteam.mjs), which a club feed must not show. Any model not answering: the text waits.
export async function moderate(text, player) {
  const plain = folded(text), pg = await deps.injected(plain === text ? [text] : [text, plain], { site: "feed.person" });
  if ((pg || []).some((x) => x?.injected === true)) return { refused: true, why: "Not posted: it is written to instruct the app's agents.", check: "prompt-guard" };
  if (!pg?.length || pg.some((x) => x?.injected == null)) return { down: true };
  for (const b of T.personProblems(text, { author: authorOf(player), names: othersNames() })) return { refused: true, why: `Not posted: ${b.why}`, code: b.code, check: "code" };
  const g = await deps.screen([{ role: "user", content: text }], { site: "feed.person", timeoutMs: +(process.env.GUARD_OUT_TIMEOUT_MS || 8000) });
  const stop = guardRules.stopsIn(g, text);
  if (stop?.includes("S11")) return { helpline: true, why: guardRules.refusal(["S11"]), categories: stop };
  if (g.safe === false && g.categories.some((c) => BLOCK_POST.includes(c))) return { refused: true, why: `Not posted: ${T.plainWhy(g.categories)}.`, categories: g.categories, check: "llama-guard" };
  if (g.safe == null) return { down: true };
  const k = await deps.standard(text);
  if (k.verdict == null) return { down: true };
  if (k.verdict !== "ok") return { refused: true, why: `Not posted: ${T.STANDARD[k.verdict] || T.STANDARD.harassment}.`, standard: k.verdict, check: "standard" };
  return { ok: true, verdict: g.safe ? "safe" : g.categories.join(","), standard: "ok" };
}

// ---- a photo, screened by a model before anyone sees it ----
// Muse Glimmer looks at it under a strict policy and answers with a verdict, a description and the text written in it
// (deps.see). Code reads the verdict. Prompt Guard 2 reads the text in it (a photo can carry an instruction for the
// agents), code checks that text as it checks a post (contact details, another member's health), and Llama Guard 3
// reads the description and the text. Any of them not answering: the photo waits, unshown (fail closed).
const PHOTO_WHY = {
  nudity: "it shows nudity", sexual: "it has sexual content", violence: "it shows violence or a threat", gore: "it shows blood or a graphic injury", weapon: "it shows a weapon",
  hate: "it has a hate symbol or demeans a group", private: "it shows someone's private details, such as an ID, a card, an address or a phone number", drugs: "it shows drugs",
  self_harm: "it shows self-harm", minor_risk: "it puts a child at risk", other_unsafe: "it isn't safe for the club feed",
};
export async function screenPhoto(m, player) {
  const f = S.mediaFile(m.id, m.type);
  if (!f) return { refused: true, why: "Not posted: the photo could not be read.", check: "code" };
  const t0 = deps.now(), v = await deps.see((await import("node:fs")).readFileSync(f).toString("base64"));
  const seconds = (deps.now() - t0) / 1000;
  if (!v.verdict) return { down: true, seconds };
  if (v.verdict !== "ok") return { refused: true, why: `Not posted: ${PHOTO_WHY[v.verdict] || PHOTO_WHY.other_unsafe}.`, check: "vision", verdict: v.verdict, describe: v.describe, text: v.text, seconds };
  const text = T.tidy(v.text || "", 400);
  if (text) {
    const [pg] = await deps.injected([text], { site: "feed.photo.text" });
    if (pg?.injected == null) return { down: true, seconds };
    if (pg.injected) return { refused: true, why: "Not posted: the photo has text written to instruct the app's agents.", check: "prompt-guard", seconds };
    for (const b of T.personProblems(text, { author: authorOf(player), names: othersNames() })) return { refused: true, why: `Not posted: the text in the photo ${b.why.replace(/^it /, "")}`, check: "code", seconds };
  }
  const g = await deps.screen([{ role: "user", content: `A photo for the club feed. It shows: ${v.describe}${text ? `\nText in the photo: ${text}` : ""}` }], { site: "feed.photo.guard", timeoutMs: +(process.env.GUARD_OUT_TIMEOUT_MS || 8000) });
  if (g.safe == null) return { down: true, seconds };
  if (g.safe === false && g.categories.some((c) => BLOCK_POST.includes(c))) return { refused: true, why: `Not posted: the photo ${T.plainWhy(g.categories).replace(/^it /, "")}.`, check: "llama-guard", categories: g.categories, seconds };
  return { ok: true, verdict: "ok", describe: v.describe, text, llamaGuard: g.safe ? "safe" : g.categories.join(","), seconds };
}
// a post's checks, text and photo together: refused if either is, waiting if either could not be checked
async function screenPost(text, photo, player) {
  const m = text ? await moderate(text, player) : { ok: true, verdict: "no text" };
  if (m.refused || m.helpline) return m;
  const ph = photo ? await screenPhoto(photo, player) : null;
  if (ph?.refused) return ph;
  return { ...m, down: !!(m.down || ph?.down), photo: ph?.ok ? { verdict: "ok", llamaGuard: ph.llamaGuard, seconds: +ph.seconds.toFixed(2) } : null };
}
// paused by the maintainer: { until, reason } or null
export function paused(player) {
  const l = S.data().limits?.[player];
  return l && l.until > deps.now() ? l : null;
}
const pausedWhy = (l) => `Your posts and comments are paused by the club's maintainer until ${new Date(l.until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${l.reason ? `: ${l.reason}` : ""}.`;

// ---- posting ----
// An invite (a game anyone in the club can join): the sport, the day and time, where, how many spots. A member's agent
// may post one for its member through the agent channel (members.js): agent is { id, owner }, and the post says it is
// that member's agent. The place is checked with the text, as anything a person writes is.
export const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash", "running"];
const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function inviteOf(x) {
  if (!x) return { invite: null };
  const sport = String(x.sport || "").toLowerCase(), day = String(x.day || ""), start = String(x.start || ""), where = T.tidy(x.where, 60), spots = Math.round(+x.spots);
  if (!SPORTS.includes(sport)) return { error: `The sport must be one of: ${SPORTS.join(", ")}.` };
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d{4}-\d{2}-\d{2})$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return { error: "Say the day (Mon to Sun, or a date) and the time (HH:MM)." };
  if (/^\d{4}-/.test(day) && localDay(new Date(`${day}T12:00`).getTime()) !== day) return { error: "That date doesn't exist: use YYYY-MM-DD." };
  if (/^\d{4}-/.test(day) && day < localDay(deps.now())) return { error: "That date has passed: pick today or a later day." };
  if (!where) return { error: "Say where you'll play." };
  if (!(spots >= 1 && spots <= 12)) return { error: "Between 1 and 12 spots." };
  if (x.each != null && x.each !== "" && !(+x.each >= 0 && +x.each <= 5000)) return { error: "each is the price per person, from 0 to 5000." };
  if (x.gate?.minShow != null && !(+x.gate.minShow >= 0 && +x.gate.minShow <= 1)) return { error: "gate.minShow is from 0 to 1 (0.75 is 75%)." };
  // the fewest players (the host counted) the game is worth playing with: short of it at the cut-off, it's called off
  const minPlayers = x.minPlayers == null || x.minPlayers === "" ? null : Math.round(+x.minPlayers);
  if (minPlayers != null && !(minPlayers >= 2 && minPlayers <= spots + 1)) return { error: `minPlayers counts the host: from 2 to ${spots + 1} for ${spots} spot${spots > 1 ? "s" : ""}.` };
  // the place on the map, when it was picked there (rounded to about 10 m)
  const lat = +x.at?.lat, lon = +x.at?.lon, at = isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat: +lat.toFixed(4), lon: +lon.toFixed(4) } : null;
  // a gate (members/trust.js): people under its show-up rate wait; agents that keep too few promises can't answer
  const gate = x.gate ? Tr.gateOf(x.gate) : null, each = x.each == null || x.each === "" ? null : Math.round(+x.each), weeks = Math.round(+x.repeat?.weekly || 0);
  if (weeks && !/^\d{4}-/.test(day)) return { error: "A weekly game needs its first date (YYYY-MM-DD)." };
  return { invite: { sport, day, start, where, spots, ...(at ? { at } : {}), ...(gate && (gate.minShow || gate.agentMin) ? { gate } : {}), ...(each != null && each >= 0 && each <= 5000 ? { each } : {}), ...(weeks > 0 ? { repeat: { weekly: Math.min(8, weeks) } } : {}), ...(minPlayers ? { minPlayers } : {}), going: [] } };
}
export async function post(player, { text = "", media = null, invite = null, agent = null, room = null, fromHuddle = null } = {}) {
  const t = T.tidy(text, 600);
  // a post in a club members started (members/clubs.js): clubs are open, so posting there joins it (a member's agent
  // posts for its member)
  if (room && !(await import("../members/clubs.js")).find(String(room))) return { error: "No such club.", code: 404 };
  if (room && !(await import("../members/clubs.js")).joinById(String(room), agent ? agent.owner : player, authorOf(agent ? agent.owner : player))) return { error: "This club is private: ask to join first.", code: 403 };
  const iv = inviteOf(invite); if (iv.error) return { error: iv.error, code: 400 };
  // a game in a children's club is the organiser's; in an older adults' club, a gentle one (members/programs.js)
  if (iv.invite && room) { const h = holdInvite(clubOf(room), agent?.owner || player, iv.invite); if (h.error) return { error: h.error, code: 400 }; iv.invite = h.invite; }
  if (!t && !media && !iv.invite) return { error: "Write something, or add a photo.", code: 400 };
  const stop = paused(player); if (stop) return { error: pausedWhy(stop), code: 403, paused: true };
  // (a game the agents agreed is the result of a talk, not someone posting a lot: no rate limit for it)
  const lim = fromHuddle ? null : limited(player, "post"); if (lim) return lim;
  let photo = null;
  if (media) {
    const up = S.data().uploads.find((u) => u.id === media && u.player === player);
    if (!up || up.type !== "image/jpeg") return { error: "That photo is not one you uploaded.", code: 400 };
    photo = { id: up.id, type: up.type, w: up.w, h: up.h };
  }
  count(player, "post");
  // a game that overlaps one the person already hosts or plays in (games run about 90 minutes): not both, as for joining
  const owner = agent?.owner || player, at0 = iv.invite ? startOf(iv.invite) : null;
  const overlap = at0 ? S.data().posts.find((q) => q.kind === "invite" && q.invite && !q.hidden && ((q.by.player || q.by.agentOf) === owner || q.invite.going.includes(owner)) && Math.abs(startOf(q.invite) - at0) < 90 * 60e3) : null;
  // (a game the agents agreed counts too, except the one this post is the result of)
  const agreed = at0 ? huddleBusy(owner, null).find((x) => x.huddle !== fromHuddle && Math.abs(x.at - at0) < 90 * 60e3) : null;
  if (agreed) return { error: `That overlaps ${agreed.what}. Pick another time, or answer no there first.`, code: 409, clash: agreed.huddle };
  if (overlap) return { error: `That overlaps ${overlap.invite.sport} ${dayWords(overlap.invite.day)} ${overlap.invite.start} at ${overlap.invite.where}, already in your games. Pick another time, or call that one off first.`, code: 409, clash: overlap.id };
  const m = await screenPost([t, iv.invite?.where].filter(Boolean).join("\n"), photo, player);
  if (m.refused || m.helpline) { if (photo) dropUpload(player, photo.id); return { refused: true, why: m.why, check: m.helpline ? "helpline" : m.check, ...(m.helpline ? { helpline: true } : {}) }; }
  const x = S.change((d) => {
    const p = { id: S.newId("p"), kind: iv.invite ? "invite" : photo ? "photo" : "note", at: deps.now(), by: agent ? { type: "agent", agentOf: agent.owner, agentId: agent.id } : { type: "person", player }, text: t, media: photo, ...(iv.invite ? { invite: iv.invite } : {}), likes: [], comments: [], reports: [], ...(m.down ? { held: true } : {}),
      ...(room ? { room: String(room) } : {}), checks: { llamaGuard: m.verdict ?? null, standard: m.standard ?? null, ...(m.photo ? { photo: m.photo } : {}) } };
    d.posts.push(p);
    if (photo) d.uploads = d.uploads.filter((u) => u.id !== photo.id);
    return p;
  });
  const clash = x.invite ? busyAt(owner).some((t) => t !== startOf(x.invite) && Math.abs(t - startOf(x.invite)) < 3 * 3600e3) : false;
  return { post: view(x, player), ...(clash ? { warning: "You already have a game within three hours of this one." } : {}), ...(m.down ? { held: true, why: `The safety check${photo ? " for photos" : ""} isn't answering right now. Your post shows once it is checked; only you can see it until then.` } : {}) };
}
function dropUpload(player, id) {
  S.change((d) => { const u = d.uploads.find((x) => x.id === id && x.player === player); if (u) S.dropMedia(u); d.uploads = d.uploads.filter((x) => x !== u); });
}
// a photo before it is posted: kept for an hour, for its owner only
export function upload(player, { id, type, w = null, h = null }) {
  S.change((d) => {
    const old = d.uploads.filter((u) => deps.now() - u.at > 36e5);
    old.forEach((u) => S.dropMedia(u));
    d.uploads = [...d.uploads.filter((u) => !old.includes(u)), { id, type, w, h, player, at: deps.now() }];
  });
}

export async function comment(player, postId, text, { agent = null } = {}) {
  const t = T.tidy(text, 400);
  if (!t) return { error: "Write a comment first.", code: 400 };
  const p = find(postId);
  if (!p || !visible(p, player)) return { error: "That post is not in the feed any more.", code: 404 };
  const stop = paused(player); if (stop) return { error: pausedWhy(stop), code: 403, paused: true };
  const lim = limited(player, "comment"); if (lim) return lim;
  count(player, "comment");
  const m = await moderate(t, player);
  if (m.refused || m.helpline) return { refused: true, why: m.why.replace(/^Not posted/, "Not sent"), check: m.helpline ? "helpline" : m.check, ...(m.helpline ? { helpline: true } : {}) };
  const asks = p.kind === "paper" && !m.down && isQuestion(t) && !limited(player, "ask");
  const c = S.change(() => {
    const x = { id: S.newId("c"), at: deps.now(), by: agent ? { type: "agent", agentOf: agent.owner, agentId: agent.id } : { type: "person", player }, text: t, ...(m.down ? { held: true } : {}), ...(asks ? { asking: true } : {}), reports: [], checks: { llamaGuard: m.verdict ?? null, standard: m.standard ?? null } };
    p.comments.push(x);
    return x;
  });
  // a question on a paper: the member's own agent answers from the paper's abstract, in the background
  if (asks) { count(player, "ask"); answerLater(p.id, c.id, player, t); }
  if (p.kind === "invite" && p.invite && !m.down && isQuestion(t)) inviteReply(p, `${spotsLine(p)} ${p.invite.going.includes(player) ? "You're in." : "Tap Join and you're in."}`);
  return { comment: commentView(c, player), answering: asks, ...(m.down ? { held: true, why: "The safety check isn't answering right now. Your comment shows once it is checked." } : {}) };
}
// the poster's agent, in the comments of an invite: sentences made by code from the invite, never a model's
const first = (n = "") => String(n).split(" ")[0];
const spotsLine = (p) => { const v = p.invite, left = v.spots - v.going.length; return `${left > 0 ? `${left} of ${v.spots} spot${v.spots > 1 ? "s" : ""} left` : "Full"} for ${v.sport} ${dayWords(v.day)} ${v.start} at ${v.where}.`; };
function inviteReply(p, text, about = null) {
  const owner = p.by.agentOf || p.by.player;
  S.change(() => { p.comments.push({ id: S.newId("c"), at: deps.now(), by: { type: "agent", agentOf: owner }, text, reply: true, ...(about ? { about } : {}), reports: [], checks: { made: "code" } }); });
}
// joining an invite (or leaving it): the poster's agent says who is in and how many spots are left. A yes is signed and
// kept (a2a/consent.js record): via says where it was given ("feed", "ask"), agent whether their agent gave it; via null
// when the yes was already signed elsewhere (a huddle's)
export function join(player, postId, on = true, { via = "feed", agent = false } = {}) {
  const p = find(postId);
  if (!p || !visible(p, player) || p.kind !== "invite" || !p.invite) return { error: "That invite is not in the feed any more.", code: 404 };
  if ((p.by.player || p.by.agentOf) === player) return { error: "It's your own invite.", code: 400 };
  const v = p.invite, was = v.going.includes(player), waiting = (v.waitlist || []).includes(player), host = p.by.player || p.by.agentOf;
  const nm = first(authorOf(player) || "A member");
  // leaving the waitlist
  if (!on && waiting) { S.change(() => { v.waitlist = v.waitlist.filter((x) => x !== player); }); return { post: view(p, player), left: "waitlist" }; }
  // a spot offered from the waitlist: this yes takes it
  if (on && was && v.offered?.[player]) {
    S.change(() => { delete v.offered[player]; });
    if (via) signYes(player, p, "confirm", agent);
    inviteReply(p, `${nm} is in. ${spotsLine(p)}`, player);
    if (full(v)) gameOn(p);
    return { post: view(p, player), confirmed: true };
  }
  if (on === was) return { post: view(p, player) };
  if (on && p.room && !roomJoin(p.room, player)) return { error: "This club is private: ask to join it first.", code: 403 };
  // a game that overlaps one they're already in (games run about 90 minutes): not both
  // (a game the agents agreed, not posted yet, counts too: members/huddle.js tells which)
  const agreedClash = on && startOf(v) ? huddleBusy(player, p.id).find((x) => Math.abs(x.at - startOf(v)) < 90 * 60e3) : null;
  if (agreedClash) return { error: `You're already in ${agreedClash.what}, which overlaps this one. Answer no there first.`, code: 409, clash: agreedClash.huddle };
  const at = startOf(v), clash = on && at ? S.data().posts.find((q) => q.id !== p.id && q.kind === "invite" && q.invite && !q.hidden && ((q.by.player || q.by.agentOf) === player || q.invite.going.includes(player)) && Math.abs(startOf(q.invite) - at) < 90 * 60e3) : null;
  if (clash) return { error: `You're already in ${clash.invite.sport} ${dayWords(clash.invite.day)} ${clash.invite.start} at ${clash.invite.where}, which overlaps this one. Leave that game first.`, code: 409, clash: clash.id };
  // a full game: the waitlist, first come first in when a spot opens
  if (on && v.going.length >= v.spots) {
    if (!waiting) { S.change(() => { v.waitlist = [...(v.waitlist || []), player]; }); inviteReply(p, `${nm} is on the waitlist: the game is full. A spot that opens is ${nm}'s.`, player); }
    return { post: view(p, player), waitlisted: true, why: "the game is full" };
  }
  // the game's gate: someone under its show-up rate goes on the waitlist, and the poster's agent says why
  if (on && v.gate) {
    const c = Tr.check(player, v.gate);
    if (c.verdict === "waitlist") {
      if (!waiting) { S.change(() => { v.waitlist = [...(v.waitlist || []), player]; }); inviteReply(p, `${nm} is on the waitlist. If a spot is still open the day before, it's ${nm}'s.`, player); } // the reason (their record) goes to them, not to everyone reading the game
      return { post: view(p, player), waitlisted: true, why: c.why };
    }
  }
  // leaving: the leaver's notices for it go, and nobody keeps a "Game on: it's full" that's no longer true
  if (!on && was) { onLeft(player, p.id); S.change((d) => { d.notices = (d.notices || []).filter((x) => !(x.post === p.id && (x.player === player || x.kind === "gameon"))); }); }
  if (on && !was) onJoined(player, p.id); // (its "Game on" is stale now)
  // a late drop: leaving in the last six hours after being in for more than half an hour (a quick mistake is not one)
  // (turning down a spot offered from the waitlist is not one)
  const late = !on && !v.offered?.[player] && deps.now() - ((v.joinedAt || {})[player] || 0) > 30 * 60e3 && Tr.left(player, startOf(v));
  S.change(() => {
    if (v.offered) delete v.offered[player];
    v.going = on ? [...v.going, player] : v.going.filter((x) => x !== player);
    v.joinedAt = { ...(v.joinedAt || {}) }; if (on) v.joinedAt[player] = deps.now(); else delete v.joinedAt[player];
  });
  if (!on) Tr.unexpect(p.id, player); // off the after-game check of a game they left
  if (on && via) signYes(player, p, via, agent);
  inviteReply(p, `${on ? `${nm} is in.` : `${nm} can't make it${late ? " (a late drop, under six hours before the start)" : ""}.`} ${spotsLine(p)}`, player);
  if (!on) {
    notify(host, "left", `${nm} can't make your ${v.sport} ${dayWords(v.day)} ${v.start}. ${spotsLine(p)}`, { post: p.id });
    promote(p); // the first on the waitlist takes the spot
  }
  if (on && full(v)) gameOn(p);
  return { post: view(p, player) };
}
// full, and nobody still to confirm a spot offered from the waitlist
const full = (v) => v.going.length >= v.spots && !Object.keys(v.offered || {}).length;
// the game a yes to an invite agrees to, signed by the member's agent key and chained (a2a/consent.js)
const yesGame = (p) => ({ post: p.id, host: p.by.player || p.by.agentOf, sport: p.invite.sport, day: p.invite.day, start: p.invite.start, where: p.invite.where });
function signYes(player, p, via, agent = false) {
  try { return Consent.record(player, yesGame(p), { via, ref: p.id, agent, now: deps.now() }); } catch (e) { console.error("consent record", e.message); return null; }
}
// a spot opens, or the game is a day away with spots still open: the waitlist moves up, first come first in, and is told.
// The spot is offered: it is theirs until confirmBy (CONFIRM_HOURS, and never past the cut-off), and with no yes by then
// it goes to the next in line (promoteDue)
const confirmBy = (v, now) => { const at = startOf(v), due = now + CONFIRM_HOURS * HOUR; return at ? Math.max(Math.min(due, at - CUTOFF_HOURS * HOUR), Math.min(now + HOUR, at)) : due; };
export function promote(p, { dayBefore = false } = {}) {
  const v = p.invite;
  if (!v?.waitlist?.length || v.going.length >= v.spots) return 0;
  let n = 0;
  // the first in line who isn't in another game at that time (games or agreed games overlapping it): they keep their place otherwise
  const at = startOf(v), free = (x) => !at || (!S.data().posts.some((q) => q.id !== p.id && q.kind === "invite" && q.invite && !q.hidden && ((q.by.player || q.by.agentOf) === x || q.invite.going.includes(x)) && Math.abs(startOf(q.invite) - at) < 90 * 60e3) && !huddleBusy(x, p.id).some((y) => Math.abs(y.at - at) < 90 * 60e3));
  while (v.going.length < v.spots) {
    const x = v.waitlist.find(free);
    if (!x) break;
    const due = confirmBy(v, deps.now());
    S.change(() => { v.waitlist = v.waitlist.filter((y) => y !== x); v.going = [...v.going, x]; v.joinedAt = { ...(v.joinedAt || {}), [x]: deps.now() }; v.offered = { ...(v.offered || {}), [x]: due }; });
    onJoined(x, p.id);
    notify(x, "moved-up", `A spot opened${dayBefore ? " the day before" : ""} for ${v.sport} ${dayWords(v.day)} ${v.start} at ${v.where}. It's yours if you say yes by ${clock(due)}; after that it goes to the next in line.`, { post: p.id, confirmBy: due });
    inviteReply(p, `${first(authorOf(x) || "A member")} moves up from the waitlist. ${spotsLine(p)}`, x);
    n++;
  }
  if (full(v)) gameOn(p);
  return n;
}
const clock = (ms) => { const d = new Date(ms); return `${dayWords(localDay(ms))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
// a spot offered from the waitlist with no yes in time: it goes back, and the next in line is offered it
function lapse(p, x) {
  const v = p.invite;
  S.change(() => { delete v.offered[x]; v.going = v.going.filter((y) => y !== x); if (v.joinedAt) delete v.joinedAt[x]; });
  onLeft(x, p.id); Tr.unexpect(p.id, x);
  notify(x, "lapsed", `No yes in time, so the spot in ${v.sport} ${dayWords(v.day)} ${v.start} at ${v.where} went to the next in line.`, { post: p.id });
  inviteReply(p, `${first(authorOf(x) || "A member")}'s spot goes to the next in line. ${spotsLine(p)}`, x);
  promote(p);
}
// a game still short of its minPlayers at the cut-off: called off, the way a host calls one off (remove), and everyone
// who said yes (the host, those in, those waiting) told once; the post goes, so it can't be called off twice
function callOff(p) {
  const v = p.invite, host = p.by.player || p.by.agentOf, game = `${v.sport} ${dayWords(v.day)} ${v.start} at ${v.where}`, have = 1 + v.going.filter((x) => !v.offered?.[x]).length;
  if (v.repeat?.weekly > 0 && !v.rolled) roll(p, deps.now()); // next week's still goes up
  notify(host, "called-off", `Your ${game} is called off: ${have} of the ${v.minPlayers} players it needs, ${CUTOFF_HOURS} hours before.`, { post: p.id });
  for (const x of [...new Set([...v.going, ...(v.waitlist || [])])]) if (x !== host) notify(x, "called-off", `${game} is called off: too few players ${CUTOFF_HOURS} hours before.`, { post: p.id });
  for (const x of v.going) Tr.unexpect(p.id, x);
  S.change((d) => { if (!v.rolled) S.dropMedia(p.media); d.posts = d.posts.filter((y) => y !== p); d.notices = (d.notices || []).filter((y) => !(y.post === p.id && y.kind !== "called-off")); }); // (next week's keeps the photo)
  onRemoved(p.id);
}
// a weekly game that has passed (or was called off) posts next week's, the same host, game and gate, nobody in yet
function roll(p, now) {
  const [y, m, d] = p.invite.day.split("-").map(Number), x = new Date(y, m - 1, d + 7), day = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  S.change((db) => { p.invite.rolled = true; db.posts.push({ ...p, id: S.newId("p"), at: now, invite: { ...p.invite, day, going: [], waitlist: [], joinedAt: {}, offered: {}, rolled: false, repeat: { weekly: p.invite.repeat.weekly - 1 } }, likes: [], comments: [], reports: [] }); });
}
// the games starting within a day that still have spots: their waitlists move up (run whenever members look). The same
// pass lets offered spots with no yes in time go to the next in line, and calls off games short of their minPlayers at
// the cut-off
export function promoteDue(now = deps.now()) {
  let n = 0;
  for (const p of [...S.data().posts]) if (p.kind === "invite" && p.invite?.repeat?.weekly > 0 && !p.invite.rolled && !p.hidden && (startOf(p.invite) || Infinity) < now) roll(p, now);
  for (const p of [...S.data().posts]) if (p.kind === "invite" && p.invite?.offered && !p.hidden) for (const [x, due] of Object.entries(p.invite.offered)) if (now >= due && p.invite.offered[x]) lapse(p, x);
  for (const p of [...S.data().posts]) if (p.kind === "invite" && p.invite?.minPlayers && !p.hidden) {
    const t = startOf(p.invite), have = 1 + p.invite.going.filter((x) => !p.invite.offered?.[x]).length;
    if (t && t > now && t - now <= CUTOFF_HOURS * HOUR && have < p.invite.minPlayers) callOff(p);
  }
  for (const p of S.data().posts) if (p.kind === "invite" && p.invite?.waitlist?.length && !p.hidden) { const t = startOf(p.invite); if (t && t > now && t - now < 864e5) n += promote(p, { dayBefore: true }); }
  return n;
}
// a day as people say it: "Wed 4 Nov" for a date, the weekday as it is
export const dayWords = (day) => { if (!/^\d{4}-/.test(day)) return day; const [y, m, d] = day.split("-").map(Number), x = new Date(y, m - 1, d); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()]} ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`; };
// the last spot taken: the game is on, and everyone in it hears so wherever they are in the app (GET /api/feed/notices)
// when an invite's game starts: its date (or the next of its weekday) and time, in ms
export function startOf(v) {
  if (!v?.start) return null;
  const [h, m] = v.start.split(":").map(Number);
  let d;
  if (/^\d{4}-/.test(v.day)) { const [y, mo, da] = v.day.split("-").map(Number); d = new Date(y, mo - 1, da); }
  else { d = new Date(deps.now()); d.setHours(0, 0, 0, 0); const want = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v.day); for (let i = 0; i < 7 && d.getDay() !== want; i++) d.setDate(d.getDate() + 1); }
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}
function gameOn(p) {
  const v = p.invite, host = p.by.player || p.by.agentOf, game = `${v.sport} ${dayWords(v.day)} ${v.start}${v.where ? ` at ${v.where}` : ""}`;
  const names = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] || "";
  inviteReply(p, `Game on: all ${v.spots} spots are taken. See you ${dayWords(v.day)} ${v.start}.`);
  Tr.expect(p.id, [host, ...v.going], startOf(v)); // after the game, the players say who came
  S.change((d) => {
    d.notices ||= [];
    d.notices.push({ player: host, at: deps.now(), kind: "gameon", post: p.id, text: `Game on: your ${game} is full. ${names(v.going.map((x) => first(authorOf(x) || "A member")))} ${v.going.length > 1 ? "are" : "is"} in.` });
    for (const x of v.going) d.notices.push({ player: x, at: deps.now(), kind: "gameon", post: p.id, text: `Game on: ${game} with ${first(authorOf(host) || "the host")} is full. You're in.` });
  });
}
// the notices waiting for a member, taken once (the feed shows them too)
export function takeNotices(player) {
  const mine = (S.data().notices || []).filter((x) => x.player === player);
  if (mine.length) S.change((d) => { d.notices = d.notices.filter((x) => x.player !== player); });
  return mine.map((x) => ({ text: x.text, kind: x.kind || "note", post: x.post || null, ...(x.huddle ? { huddle: x.huddle } : {}) }));
}
export const pendingAnswers = new Set();
function answerLater(postId, commentId, player, question) {
  const job = (async () => {
    const p = find(postId);
    let a;
    try { a = await answer(p, question); } catch { a = { text: "I couldn't read the paper just now. The link has the full paper.", link: p.paper.link, answered: false }; }
    S.change(() => {
      const q = find(postId), c = q?.comments.find((x) => x.id === commentId);
      if (!q || !c) return; // deleted meanwhile (/forget)
      delete c.asking;
      if (a.held) return;
      q.comments.push({ id: S.newId("c"), at: deps.now(), by: { type: "agent", agentOf: player }, reply: commentId, text: a.text, link: a.link, answered: a.answered, reports: [] });
    });
  })();
  pendingAnswers.add(job); job.finally(() => pendingAnswers.delete(job));
}

export function like(player, postId, on = true) {
  const p = find(postId);
  if (!p || !visible(p, player)) return { error: "That post is not in the feed any more.", code: 404 };
  const has = p.likes.includes(player);
  if (on && !has) { const lim = limited(player, "like"); if (lim) return lim; count(player, "like"); }
  S.change(() => { p.likes = on ? [...new Set([...p.likes, player])] : p.likes.filter((x) => x !== player); });
  // a first like on a paper or a highlight: a 👍 for the community loop (counted only with /improve on)
  let signal = null;
  if (on && !has && (p.kind === "paper" || p.kind === "highlight")) signal = deps.thumb(player, p.kind === "paper" ? "papers" : "highlights", 1);
  return { likes: p.likes.length, liked: on, signal: signal?.recorded ? "counted" : null };
}
// "Not for me": the post leaves this member's feed; on a paper or a highlight it is a 👎 for the loop
export function notForMe(player, postId) {
  const p = find(postId);
  if (!p) return { error: "That post is not in the feed any more.", code: 404 };
  S.change(() => { p.hiddenFor = [...new Set([...(p.hiddenFor || []), player])]; });
  if (p.kind === "paper" || p.kind === "highlight") deps.thumb(player, p.kind === "paper" ? "papers" : "highlights", -1);
  return { hidden: true };
}

export const REASONS = { spam: "Spam", unkind: "Unkind or harassing", private: "Shares someone's private details", unsafe: "Unsafe or harmful", wrong: "Misleading about a paper", other: "Something else" };
export const HIDE_AT = () => +(process.env.FEED_REPORT_HIDE || 3);
export function report(player, postId, { comment: cid = null, reason = "other" } = {}) {
  const p = find(postId);
  if (!p) return { error: "That post is not in the feed any more.", code: 404 };
  if (!REASONS[reason]) return { error: "Pick a reason.", code: 400 };
  const target = cid ? p.comments.find((c) => c.id === cid) : p;
  if (!target) return { error: "That comment is not there any more.", code: 404 };
  if ((target.by?.player || target.by?.agentOf) === player && target.by?.type === "person") return { error: "You can delete your own post instead.", code: 400 };
  const lim = limited(player, "report"); if (lim) return lim;
  count(player, "report");
  // one report per member per item: a member reporting the same thing again counts once
  const r = S.change(() => {
    target.reports = [...(target.reports || []).filter((x) => x.player !== player), { player, reason, at: deps.now() }];
    if (new Set(target.reports.map((x) => x.player)).size >= HIDE_AT()) target.hidden = target.hidden || { at: deps.now(), why: "reported by members" };
    return { hidden: !!target.hidden };
  });
  return { ok: true, ...r, note: "Thanks. The club's maintainer sees reports; three members' reports hide it until then." };
}
// an author deletes their own post or comment
export function remove(player, postId, cid = null) {
  const p = find(postId);
  if (!p) return { error: "That post is not in the feed any more.", code: 404 };
  if (cid) {
    const c = p.comments.find((x) => x.id === cid);
    if (!c || c.by.player !== player) return { error: "Only its author can delete that comment.", code: 403 };
    S.change(() => { p.comments = p.comments.filter((x) => x.id !== cid && x.reply !== cid); });
    return { deleted: true };
  }
  if (!(p.by.player === player || p.by.agentOf === player)) return { error: "Only its author can delete that post.", code: 403 };
  // a deleted game: everyone in it or waiting for it hears it's off
  if (p.invite) { const host = first(authorOf(p.by.player || p.by.agentOf) || "The host"); for (const x of [...p.invite.going, ...(p.invite.waitlist || [])]) if (x !== player) notify(x, "called-off", `${host} called off ${p.invite.sport} ${dayWords(p.invite.day)} ${p.invite.start} at ${p.invite.where}.`, { post: p.id }); }
  S.change((d) => { S.dropMedia(p.media); d.posts = d.posts.filter((x) => x !== p); });
  onRemoved(p.id);
  return { deleted: true };
}
// the games the agents agreed (or are asking about) that aren't a feed post: {at, what, huddle}; members/huddle.js sets it
let huddleBusy = () => [];
export const busyFrom = (f) => { huddleBusy = f; };
// joining a club's game joins its club (members/api.js sets it: public clubs say yes, private ones only to members)
let roomJoin = () => true;
export const joinRoomWith = (f) => { roomJoin = f; };
// someone left or joined a game: the agents' record of who's in follows (members/huddle.js sets it)
let onLeft = () => {}, onJoined = () => {};
export const whenJoined = (f) => { onJoined = f; };
export const whenLeft = (f) => { onLeft = f; };
// a deleted game: the agents filling it stop too (members/huddle.js registers this)
let onRemoved = () => {};
export const whenRemoved = (f) => { onRemoved = f; };

// what waited for the guard: checked again; shown, or dropped (its author is told when they next look), or still waiting
export async function retryHeld() {
  const out = { shown: 0, dropped: 0, waiting: 0 }, db = S.data();
  const items = [...db.posts.filter((p) => p.held).map((p) => [p, null]), ...db.posts.flatMap((p) => p.comments.filter((c) => c.held).map((c) => [p, c]))];
  for (const [p, c] of items) {
    const x = c || p, who = x.by.player;
    if (deps.now() - x.at > 7 * DAY) { drop(p, c); out.dropped++; continue; }
    const m = c ? await moderate(x.text, who) : await screenPost(p.text, p.kind === "photo" ? p.media : null, who);
    if (m.down) { out.waiting++; continue; }
    if (m.ok) { S.change(() => { delete x.held; x.checks = { llamaGuard: m.verdict }; }); out.shown++; continue; }
    drop(p, c, m.why); out.dropped++;
  }
  return out;
}
function drop(p, c, why = "Not posted: it waited a week for the safety check.") {
  S.change((d) => {
    const who = (c || p).by.player;
    (d.notices ||= []).push({ player: who, at: deps.now(), text: why.replace(/^Not posted/, c ? "Your comment was not posted" : "Your post was not posted") });
    if (c) p.comments = p.comments.filter((x) => x !== c);
    else { S.dropMedia(p.media); d.posts = d.posts.filter((x) => x !== p); }
  });
}

// ---- what a member sees ----
export const find = (id) => S.data().posts.find((p) => p.id === id);
// an invite as a link shows it to someone not in the club yet: the game and the spots left, never who is going
export function publicInvite(id, canSee = () => true) {
  const p = find(id);
  if (!p || p.kind !== "invite" || !p.invite || p.held || p.hidden || (p.room && !canSee(p.room))) return null;
  const v = p.invite;
  return { id: p.id, sport: v.sport, day: v.day, start: v.start, where: v.where, at: v.at || null, spots: v.spots, going: v.going.length,
    full: v.going.length >= v.spots, host: first(authorOf(p.by.player || p.by.agentOf) || "A member"), room: p.room || null };
}
// the invites a member can see that still have room and are not theirs, for their agent to recommend (members/huddle.js)
export function openInvites(viewer, canSee = () => true) {
  return S.data().posts.filter((p) => p.kind === "invite" && p.invite && !p.held && !p.hidden && visible(p, viewer) && (!p.room || canSee(p.room))
    && (p.by.player || p.by.agentOf) !== viewer && !p.invite.going.includes(viewer) && p.invite.going.length < p.invite.spots)
    .map((p) => ({ id: p.id, at: p.at, room: p.room || null, hostId: p.by.player || p.by.agentOf, host: first(authorOf(p.by.player || p.by.agentOf) || "A member"), invite: { ...p.invite, going: p.invite.going.length } }));
}
// the member's own coming games (posted, joined or waiting for a spot), wherever they are, for their agent home
export function gamesOf(player, now = deps.now()) {
  return S.data().posts.filter((p) => p.kind === "invite" && p.invite && !p.hidden && ((p.by.player || p.by.agentOf) === player || p.invite.going.includes(player) || (p.invite.waitlist || []).includes(player)) && (startOf(p.invite) || 0) > now)
    .sort((a, b) => startOf(a.invite) - startOf(b.invite)).slice(0, 6)
    .map((p) => ({ post: p.id, sport: p.invite.sport, day: p.invite.day, start: p.invite.start, where: p.invite.where, going: p.invite.going.length, spots: p.invite.spots, room: p.room || null, mine: (p.by.player || p.by.agentOf) === player, waiting: (p.invite.waitlist || []).includes(player), host: first(authorOf(p.by.player || p.by.agentOf) || "A member") }));
}
// the notices about one huddle, once the member has answered it (so nothing keeps asking for a yes already given)
export function dropNotices(player, huddle) { S.change((d) => { d.notices = (d.notices || []).filter((x) => !(x.player === player && x.huddle === huddle)); }); }
// when the member already plays: every invite they posted or joined, as start times (ms), for their agent not to clash
export const busyAt = (player) => S.data().posts.filter((p) => p.kind === "invite" && p.invite && !p.hidden && ((p.by.player || p.by.agentOf) === player || p.invite.going.includes(player))).map((p) => startOf(p.invite)).filter(Boolean);
// a notice for a member, shown wherever they are in the app (GET /api/feed/notices); extra carries a link, e.g. { huddle }
export function notify(player, kind, text, extra = {}) {
  S.change((d) => { (d.notices ||= []).push({ player, at: deps.now(), kind, text, ...extra }); });
}
function visible(p, viewer) {
  const mine = p.by.player === viewer || p.by.agentOf === viewer;
  if ((p.held || p.hidden) && !mine) return false;
  if ((p.hiddenFor || []).includes(viewer)) return false;
  // a paper beyond the week's number for this viewer (a canary's extra) is not shown to them
  if (p.kind === "paper" && p.rank > perWeekFor(viewer)) return false;
  return true;
}
const whoView = (by, viewer, simulated = false) => {
  if (by.type === "agent" && by.agent === "club") return { type: "agent", agent: "club", name: "The club's reading agent" };
  // a member's own agent, on the agent channel (members.js): its name, and that every request it made was signed
  const signed = by.agentId ? { channel: "signed", agentName: deps.nameOf(by.agentId) || "Agent" } : {};
  const id = by.player || by.agentOf, you = id === viewer, name = you ? "You" : authorOf(id) || "A member";
  const sim = simulated && (deps.club().members || []).some((m) => m.id === id);
  return by.type === "agent"
    ? { type: "agent", agentOf: you ? "you" : id, name: you ? "Your agent" : name === "A member" ? "A member's agent" : `${name.split(" ")[0]}'s agent`, owner: name, you, ...signed, ...(sim ? { simulated: true } : {}) }
    : { type: "person", member: you ? "you" : id, name, you, ...(sim ? { simulated: true } : {}) };
};
function commentView(c, viewer) {
  return { id: c.id, at: c.at, by: whoView(c.by, viewer, c.simulated), text: c.text, ...(c.link ? { link: c.link } : {}), ...(c.reply ? { reply: c.reply } : {}), ...(c.held ? { held: true } : {}), ...(c.asking ? { asking: true } : {}), ...(c.by.player === viewer || c.by.agentOf === viewer ? { mine: true } : {}) };
}
// a photo or clip as the app asks for it: by id from /api/feed/media (with the gateway's token), or, for the demo's
// one clip, from the app's own files
export const mediaView = (m) => (m.static ? { static: true, src: m.src, posterSrc: m.poster || null, type: m.type, w: m.w ?? null, h: m.h ?? null }
  : { id: m.id, type: m.type, ...(m.poster ? { poster: m.poster.id } : {}), w: m.w ?? null, h: m.h ?? null });
// how the agents filling a posted game are getting on (members/huddle.js registers it; the feed can't import it)
let fillInfo = () => null;
export const onFill = (f) => { fillInfo = f; };
// two people with the same first name in one game: told apart as "Ana", "Ana (2)"
const sameApart = (list) => { const seen = {}; return list.map((n) => { seen[n] = (seen[n] || 0) + 1; return seen[n] > 1 && n !== "You" ? `${n} (${seen[n]})` : n; }); };
export function view(p, viewer) {
  const mine = p.by.player === viewer || p.by.agentOf === viewer;
  return {
    id: p.id, kind: p.kind, at: p.at, room: p.room || null, by: whoView(p.by, viewer, p.simulated), text: p.kind === "recap" && p.crew ? lineFor({ players: p.crew, game: p.game }, viewer) : p.text, mine, ...(p.crew ? { crew: p.crew.length } : {}),
    ...(p.media ? { media: mediaView(p.media) } : {}),
    ...(p.paper ? { paper: p.paper, forWhom: p.forWhom, sport: p.sport } : {}),
    ...(p.game ? { game: p.game } : {}), ...(p.open ? { open: p.open } : {}), ...(p.credit ? { credit: p.credit } : {}),
    ...(p.invite ? { invite: { ...p.invite, shareUrl: `/#/invite?id=${p.id}`, joinedAt: undefined, offered: undefined, confirmBy: p.invite.offered?.[viewer] || null, waitlist: undefined, going: p.invite.going.length, waitlist: (p.invite.waitlist || []).length, waiting: (p.invite.waitlist || []).includes(viewer), host: (() => { const b = Tr.badge(p.by.player || p.by.agentOf); return { show: Tr.showText(b), range: Tr.rangeText(b), agent: Tr.agentText(b) }; })(), names: sameApart(p.invite.going.map((x) => (x === viewer ? "You" : first(authorOf(x) || "A member")))), joined: p.invite.going.includes(viewer), full: full(p.invite), ...(mine && fillInfo(p.id) ? { filling: fillInfo(p.id) } : {}) } } : {}),
    ...(p.simulated ? { simulated: true } : {}), ...(p.held ? { held: true } : {}), ...(p.hidden ? { hidden: true } : {}),
    likes: p.likes.length, liked: p.likes.includes(viewer),
    comments: p.comments.filter((c) => (!c.held && !c.hidden) || c.by.player === viewer).map((c) => commentView(c, viewer)),
    reported: (p.reports || []).some((r) => r.player === viewer),
  };
}
export function feed(viewer, { before = Infinity, n = 30, room = null } = {}) {
  // one club's posts, or (no room) the club feed everyone shares
  const db = S.data(), all = db.posts.filter((p) => p.at < before && (room ? p.room === room : !p.room) && visible(p, viewer)).sort((a, b) => b.at - a.at);
  const posts = all.slice(0, Math.min(60, Math.max(1, n))).map((p) => view(p, viewer));
  const notices = (db.notices || []).filter((x) => x.player === viewer);
  if (notices.length) S.change((d) => { d.notices = d.notices.filter((x) => x.player !== viewer); });
  return { posts, more: all.length > posts.length, notices: notices.map((x) => x.text) };
}

// ---- /forget ----
export function forget(player) {
  const out = { posts: 0, comments: 0, likes: 0, reports: 0, drafts: 0, media: 0 };
  S.change((d) => {
    for (const p of d.posts.filter((x) => x.by.player === player || x.by.agentOf === player)) { if (p.media) { S.dropMedia(p.media); out.media++; } }
    const n = d.posts.length;
    d.posts = d.posts.filter((x) => x.by.player !== player && x.by.agentOf !== player);
    out.posts = n - d.posts.length;
    for (const p of d.posts) {
      // (and an agent's line that names them: "Mia is in")
      const mine = new Set(p.comments.filter((c) => c.by.player === player || c.by.agentOf === player || c.about === player).map((c) => c.id));
      if (p.invite) { p.invite.going = p.invite.going.filter((x) => x !== player); if (p.invite.waitlist) p.invite.waitlist = p.invite.waitlist.filter((x) => x !== player); if (p.invite.joinedAt) delete p.invite.joinedAt[player]; if (p.invite.offered) delete p.invite.offered[player]; }
      const before = p.comments.length;
      p.comments = p.comments.filter((c) => !mine.has(c.id) && !mine.has(c.reply));
      out.comments += before - p.comments.length;
      if (p.likes.includes(player)) { p.likes = p.likes.filter((x) => x !== player); out.likes++; }
      for (const x of [p, ...p.comments]) { const r = (x.reports || []).length; x.reports = (x.reports || []).filter((y) => y.player !== player); out.reports += r - x.reports.length; }
      if (p.hiddenFor) p.hiddenFor = p.hiddenFor.filter((x) => x !== player);
    }
    for (const x of d.drafts.filter((y) => y.player === player)) { S.dropMedia(x.media); out.drafts++; }
    d.drafts = d.drafts.filter((x) => x.player !== player);
    for (const u of d.uploads.filter((y) => y.player === player)) S.dropMedia(u);
    d.uploads = d.uploads.filter((x) => x.player !== player);
    delete d.rate[player];
    d.notices = (d.notices || []).filter((x) => x.player !== player);
    // the maintainer's pause on them, and their id in the moderation log (the action stays, without who it was about)
    if (d.limits) delete d.limits[player];
    for (const a of d.audit || []) if (a.author === player) { a.author = null; a.authorName = "a member who left"; }
  });
  return out;
}
// what the feed holds about one player, for /forget's check and the tests: counts only
export function heldFor(player) {
  const d = S.data();
  return {
    posts: d.posts.filter((x) => x.by.player === player || x.by.agentOf === player).length,
    comments: d.posts.reduce((a, p) => a + p.comments.filter((c) => c.by.player === player || c.by.agentOf === player).length, 0),
    likes: d.posts.filter((p) => p.likes.includes(player)).length,
    reports: d.posts.reduce((a, p) => a + [p, ...p.comments].filter((x) => (x.reports || []).some((r) => r.player === player)).length, 0),
    drafts: d.drafts.filter((x) => x.player === player).length, uploads: d.uploads.filter((x) => x.player === player).length, rate: !!d.rate[player],
  };
}
