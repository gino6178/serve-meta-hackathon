// Getting a game together (a huddle): the hard part of playing with other people is finding one time and one place
// that suit everyone, when one of them minds the time, another the distance, another the price. Here each person's
// agent stands in for them, the way they would answer, and the people only say yes once.
//   1. A member asks for a game: the sport, how many players, and who (people from their clubs, or anyone in a club).
//   2. Code lays out the options: the next seven days at nine starting times, at the courts and sports centres around
//      the middle of the group (deals.js), each with its trip for each person, how full it usually is and a price.
//   3. Each person's agent scores every option with what it has learned about them (taste.js). The host's agent
//      proposes the option that is fairest to the group (the worst-off player's score counts most, then the average);
//      every other agent answers yes when the option is as good for its person as most of the others, or says no,
//      with the one reason that matters most to its person, and counters with its person's best option. Agents never
//      share a calendar, an address or a score: only yes, no, a reason in words, and a counter. The host's agent
//      weighs the counters and proposes again, for up to four rounds.
//   4. At a sports centre, the host's agent then talks price with the venue's agent (deals.js).
//   5. Each player gets one question: "the agents agreed Saturday 10:30 at Riverside. Yes?" A yes is a yes; a no
//      teaches their agent why (taste.js) and the agents look again (twice at most). When everyone is in, the game is
//      posted to the feed with them in it, and everyone hears "Game on".
// The member's agent also works without being asked (today, nudge): it puts games near them that fit how they play in
// front of them, asks the questions it still needs, and points out quiet hours a venue would sell cheap.
//   data/huddles.json (HUDDLE_FILE): { huddles: [...], nudged: { <member>: { at, seen } } }
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import * as T from "./taste.js";
import * as D from "./deals.js";
import * as C from "./clubs.js";
import * as P from "../feed/posts.js";
import * as Tr from "./trust.js";
import * as N from "./needs.js";

const FILE = () => path.resolve(process.env.HUDDLE_FILE || "data/huddles.json");
let db = null, from = null;
const data = () => { if (from !== FILE()) { db = readJSON(FILE(), { huddles: [], nudged: {} }); db.nudged ||= {}; from = FILE(); } return db; };
const save = () => writeJSON(FILE(), data());
// starting times: a 90-minute game ends by 22:00 (when sports centres here close); a public court, whose lights the map
// doesn't tell, starts by 19:30. A time picked from Courts & prices is used as it is.
export const STARTS = ["07:00", "09:00", "10:30", "12:00", "14:00", "16:00", "17:00", "18:00", "19:00", "19:30", "20:30"];
const opensFor = (place, start) => (place.kind === "public" ? start <= "19:30" : start <= "20:30");
const MINUTES = 90, ROUNDS = 4, TRIES = 2, INDOOR = ["badminton", "table tennis", "squash"];
const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash"];
const first = (id) => String(P.authorOf(id) || "A member").split(" ")[0];
const names = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] || "");
export const when = (o) => `${T.dayText(o.date)}, ${o.start}`;
// what a no rules out: that game, that time at any place (the time), or that place at any time (too far, too dear)
const matches = (x, o) => (x.date == null || x.date === o.date) && (x.start == null || x.start === o.start) && (x.place == null || x.place === o.place.id);
const startMs = (o) => { const d = T.dateOf(o.date), [h, m] = o.start.split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
export const find = (id) => data().huddles.find((h) => h.id === id) || null;

// the people a member can get a game with: everyone in the clubs they are in
export function people(me) {
  const out = new Map();
  for (const c of C.mine(me)) for (const m of c.members) if (m.id !== me) { const x = out.get(m.id) || { id: m.id, name: m.name, clubs: [] }; x.clubs.push(c.name); out.set(m.id, x); }
  return { people: [...out.values()].map((p) => ({ ...p, knows: T.isSure(T.get(p.id)) })), clubs: C.mine(me).map((c) => ({ id: c.id, name: c.name, sport: c.sport, members: c.members.length })) };
}

// ---- 1. asking ----
export function start(me, b = {}, { now = new Date(), wait = false } = {}) {
  const sport = String(b.sport || "badminton").toLowerCase(), need = Math.round(+b.need || 4);
  if (!SPORTS.includes(sport)) return { error: `The sport must be one of: ${SPORTS.join(", ")}.`, code: 400 };
  if (!(need >= 2 && need <= 12)) return { error: "Between 2 and 12 players.", code: 400 };
  const mine = C.mine(me), club = b.club ? mine.find((c) => c.id === b.club) : null;
  if (b.club && !club) return { error: "You're not in that club.", code: 403 };
  const can = new Set(mine.flatMap((c) => c.members.map((m) => m.id)));
  let invited = club ? club.members.map((m) => m.id) : (Array.isArray(b.invite) ? b.invite.map(String) : []);
  invited = [...new Set(invited.filter((id) => id !== me && can.has(id)))];
  // people nearby who said other agents may ask theirs (taste.js open), within about 5 km of the host
  const home = T.get(me).home;
  if (b.nearby && !home) return { error: "Share your rough area first, so your agent can look nearby.", code: 400 };
  const near = b.nearby ? T.openNear(home, sport, 5).map((x) => x.id).filter((id) => id !== me && !invited.includes(id)) : [];
  invited = [...invited, ...near].slice(0, 24);
  if (!invited.length) return { error: b.nearby ? `Nobody within about 5 km who plays ${sport} has let other agents ask theirs yet. Start a club, or post the game and share its link: the first friend needs no account.` : club ? "Nobody else is in that club yet." : !mine.length && !home ? "Share your rough area so your agent can ask people nearby, or join a club." : !mine.length ? "Tick \"Also ask people nearby\", or join a club." : "Pick who to play with, or a club.", code: 400 };
  if (invited.length < need - 1 && !club && !b.nearby) return { error: `You asked for ${need} players but picked ${invited.length + 1} people with you. Pick more, or fewer players.`, code: 400 };
  if (data().huddles.filter((h) => h.host === me && ["talking", "asking"].includes(h.status)).length >= 3) return { error: "You have three games being worked out already.", code: 429 };
  const pin = b.pin && /^\d{4}-\d{2}-\d{2}$/.test(b.pin.date) && /^\d{2}:\d{2}$/.test(b.pin.start) ? { date: b.pin.date, start: b.pin.start, place: b.pin.place ? String(b.pin.place) : null } : null;
  const h = { id: `h-${crypto.randomUUID().slice(0, 8)}`, host: me, sport, need, club: club?.id || null, clubName: club?.name || null, invited, created: Date.now(), status: "talking",
    talk: [], answers: { [me]: "yes" }, players: [], tries: 0, excluded: [], out: [], nearby: near, gate: Tr.gateOf(b.gate || {}), ...(pin ? { pin } : {}) };
  data().huddles.push(h); save();
  Tr.asked(me, near.length); // asking everyone nearby, again and again, is what a prober does (your clubs are fine)
  const job = run(h, now).catch((e) => { h.status = "stuck"; line(h, "agent", `Something went wrong while the agents talked (${e.message}).`); save(); });
  return wait ? job.then(() => ({ huddle: view(h, me) })) : { huddle: view(h, me) };
}
const line = (h, from, text, extra = {}) => { h.talk.push({ at: Date.now(), from, text, ...extra }); };
// what anyone sees of a person's two records (trust.js)
export const trustOf = (id) => { const b = Tr.badge(id); return { show: Tr.showText(b), agent: Tr.agentText(b), newShow: b.show.new, newAgent: b.agent.new, rate: b.show.new ? null : b.show.rate, kept: b.agent.new ? null : b.agent.rate, flag: b.agent.probe || !!b.agent.badSig }; };
// when someone already plays: their feed games and the huddles they are in (ms), for nobody to be booked twice
const busyOf = (id, except = null) => [...P.busyAt(id), ...data().huddles.filter((h) => h.id !== except && ["asking", "on"].includes(h.status) && h.pick && h.players.includes(id)).map((h) => startMs(h.pick))];

// ---- 2-4. the agents talk ----
async function run(h, now = new Date()) {
  const host = h.host, everyone = [host, ...h.invited.filter((id) => !h.out.includes(id))];
  const taste = Object.fromEntries(everyone.map((id) => [id, T.get(id)]));
  const homes = everyone.map((id) => taste[id].home).filter(Boolean), club = h.club ? C.find(h.club) : null;
  const center = homes.length ? { lat: homes.reduce((s, p) => s + p.lat, 0) / homes.length, lon: homes.reduce((s, p) => s + p.lon, 0) / homes.length } : club?.at || null;
  const hostName = first(host);
  if (h.tries === 0) line(h, "host", `${h.need} for ${h.sport} in the next seven days. I'll ask ${h.invited.length} people's agents${h.nearby?.length ? `, ${h.nearby.length} of them people nearby who are open to being asked` : ""}. Nobody shares a calendar or an address: only yes, no, and why.`, { who: hostName });
  if (!center) { h.status = "stuck"; line(h, "host", "Nobody in the group has shared their rough area yet, so I can't look for courts. Share yours on the Huddle page and ask again.", { who: hostName }); return save(); }
  // the courts found the first time are kept: a re-plan without someone moves the middle a little, and must not lose them
  let places = h.places?.length ? h.places : await D.placesNear(center, h.sport);
  if (places.length && !h.places?.length) h.places = places.map(({ id, name, lat, lon, kind, sport, list, sample }) => ({ id, name, lat, lon, kind, sport, ...(list ? { list, sample } : {}) }));
  let pinned = h.pin?.place ? places.find((p) => p.id === h.pin.place) : null;
  if (h.pin?.place && !pinned) pinned = (await D.placesNear(taste[host].home || center, h.sport, { venues: 4, courts: 4 })).find((p) => p.id === h.pin.place) || null;
  if (pinned) places = [pinned];
  else {
    // badminton, table tennis and squash are indoor games: an outdoor court only when there is no hall nearby
    if (INDOOR.includes(h.sport) && places.some((p) => p.kind === "venue")) places = places.filter((p) => p.kind === "venue");
    if (club?.at && !INDOOR.includes(h.sport) && !places.some((p) => T.km(p, club.at) < 0.3)) places.push({ id: `club:${club.id}`, name: club.where || club.name, lat: club.at.lat, lon: club.at.lon, kind: "public", sport: h.sport });
  }
  if (!places.length) { h.status = "stuck"; line(h, "host", `I found no ${h.sport} courts near the group on the map.`, { who: hostName }); N.saw("no_courts", h.id); return save(); }
  const games = P.openInvites(host).map((g) => ({ at: g.invite.at, day: g.invite.day, start: g.invite.start }));
  // first, the games already open nearby: one that fits the host needs no talking at all
  if (h.tries === 0) {
    const fit = gamesFor(host, { now, n: 5 }).find((g) => g.sport === h.sport && g.score >= 0.6);
    if (fit) { h.found = fit; line(h, "host", `First I looked at the open games nearby: ${fit.host} has ${h.sport} ${fit.when} at ${fit.where}, ${fit.left} spot${fit.left > 1 ? "s" : ""} left (${fit.why.join(", ")}). You can join that one instead; I'll work out a new game too.`, { who: hostName }); }
  }
  // the game's gate (trust.js): who waits, whose agent may answer for them, who is asked themself
  const verdict = Object.fromEntries(h.invited.filter((id) => !h.out.includes(id)).map((id) => [id, Tr.check(id, h.gate)]));
  if (h.tries === 0) for (const [id, c] of Object.entries(verdict)) {
    const nm = first(id);
    if (c.verdict === "waitlist") line(h, "host", `${nm} goes on the waitlist: ${c.why}.`, { who: hostName, gate: "waitlist" });
    if (c.verdict === "confirm") line(h, "host", `${nm}'s agent can't answer for ${nm} here (${c.why}); if a spot is left, ${nm} is asked directly.`, { who: hostName, gate: "confirm" });
  }
  h.waitlist = Object.keys(verdict).filter((id) => verdict[id].verdict === "waitlist");
  const direct = Object.keys(verdict).filter((id) => verdict[id].verdict === "confirm");
  // what the agents run into goes to the club's ideas once it keeps happening (needs.js)
  if (h.tries === 0 && h.waitlist.length * 2 >= Object.keys(verdict).length && h.waitlist.length) N.saw("waitlist", h.id);
  if (h.tries === 0 && direct.length) N.saw("agent_unsure", h.id);
  const kmFor = (id, p) => +T.km(taste[id].home || center, p).toFixed(1);
  // the options: every start in the next seven days at every place, at least three hours from now, not when the host plays
  const opts = [], hostBusy = busyOf(host, h.id);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i); const date = T.ymd(d);
    for (const start of h.pin ? [h.pin.start] : STARTS) {
      if (h.pin && h.pin.date !== date) continue;
      for (const place of places) {
        if (!h.pin && !opensFor(place, start)) continue;
        const o = { date, start, place, busy: D.busy(place, date, start, games), each: D.guessEach(place, date, start, h.need) };
        if (startMs(o) - now.getTime() < 3 * 3600e3 || h.excluded.some((x) => matches(x, o)) || hostBusy.some((x) => Math.abs(x - startMs(o)) < 3 * 3600e3)) continue;
        opts.push(o);
      }
    }
  }
  if (!opts.length) { h.status = "stuck"; line(h, "host", h.pin ? `${when(h.pin)} doesn't work: it's too soon, or you already play then.` : "There's no time left that I haven't already tried this week.", { who: hostName }); return save(); }
  const game = (id, o) => ({ date: o.date, start: o.start, km: kmFor(id, o.place), each: o.each, busy: o.busy });
  const hard = Object.fromEntries(everyone.map((id) => { const b = busyOf(id, h.id); return [id, opts.map((o) => (b.some((x) => Math.abs(x - startMs(o)) < 3 * 3600e3) ? "busy" : T.hardNo(taste[id], game(id, o))))]; }));
  const U = Object.fromEntries(everyone.map((id) => [id, opts.map((o, k) => (hard[id][k] ? -1 : T.worth(taste[id], game(id, o))))]));
  // with a show-up gate, among those who said yes the reliable come first (someone new counts as middling)
  const pickScore = (id, k) => U[id][k] + (h.gate?.minShow ? 0.2 * (Tr.badge(id).show.rate ?? 0.6) : 0);
  // only agents the gate lets answer take part in the talk; the people asked directly come after
  const others = everyone.filter((id) => id !== host && verdict[id]?.verdict === "ok"), want = h.need - 1;
  // the fairest options for the host and the best-suited `want` of the others: the worst-off counts most, then the mean
  const score = (k) => { const us = [U[host][k], ...others.map((id) => U[id][k]).sort((a, b) => b - a).slice(0, want)]; return Math.min(...us) + 0.25 * us.reduce((a, b) => a + b, 0) / us.length; };
  const ranked = opts.map((o, k) => ({ k, s: score(k) })).sort((a, b) => b.s - a.s);
  const short = ranked.slice(0, 30).map((x) => x.k), bonus = {}, tried = new Set();
  const bar = (id, r) => { const us = short.map((k) => U[id][k]).sort((a, b) => a - b); return us[Math.floor(us.length * (T.isSure(taste[id]) ? 0.55 : 0.4))] - 0.04 * r; };
  const bestOf = (id) => short.reduce((b, k) => (U[id][k] > U[id][b] ? k : b), short[0]);
  let agreed = null, bestTry = null;
  for (let r = 0; r < ROUNDS && !agreed; r++) {
    const k = short.filter((x) => !tried.has(x)).sort((a, b) => (score(b) + (bonus[b] || 0)) - (score(a) + (bonus[a] || 0)))[0];
    if (k == null) break;
    tried.add(k);
    const o = opts[k];
    line(h, "host", `${r === 0 ? "How about" : "Then how about"} ${when(o)} at ${o.place.name}?`, { who: hostName });
    const yes = [];
    for (const id of others) {
      const nm = first(id);
      if (U[id][k] >= bar(id, r)) {
        yes.push(id);
        // the reason their agent gives is what matters most to them, when this game is good on it
        const f = T.fits(taste[id], game(id, o)), w = T.weights(taste[id]), top = T.FACTORS.filter((x) => (x !== "price" || o.each > 0) && f[x] >= 0.55).sort((a, b) => w[b] - w[a])[0] || [...T.FACTORS].sort((a, b) => f[b] - f[a])[0];
        const why = { time: `${T.cellWords(T.cellOf(o.date, o.start))} suit ${nm}`, place: `it's close for ${nm}`, price: `the price works for ${nm}`, quiet: "it's usually quiet then" }[top];
        line(h, id, `${nm} can do that: ${why}.`, { who: nm, agent: true, yes: true, trust: trustOf(id) });
      } else {
        const b = bestOf(id), why = hard[id][k] === "busy" ? "busy" : hard[id][k] || T.mainWhy(taste[id], game(id, o), game(id, opts[b]));
        bonus[b] = (bonus[b] || 0) + 0.06;
        line(h, id, `Not that one for ${nm}: ${{ busy: `${nm} is busy then`, time: `it's not a good time for ${nm}`, place: `it's too far for ${nm}`, price: `it costs more than ${nm} wants to pay`, quiet: "it's usually too busy then" }[why]}. ${nm} could do ${when(opts[b])} at ${opts[b].place.name}.`, { who: nm, agent: true, yes: false, why, trust: trustOf(id) });
      }
    }
    if (yes.length >= want) { const ranked2 = yes.sort((a, b) => pickScore(b, k) - pickScore(a, k)); agreed = { k, players: [host, ...ranked2.slice(0, want)], alternates: ranked2.slice(want) }; }
    else if (!bestTry || yes.length > bestTry.players.length - 1) bestTry = { k, players: [host, ...yes] };
  }
  if (!agreed && bestTry && (bestTry.players.length >= 2 || direct.length)) {
    agreed = bestTry;
    line(h, "host", `No time suits all ${h.need} this week. ${when(opts[agreed.k])} suits the most of you (${agreed.players.length}); the other ${h.need - agreed.players.length} spot${h.need - agreed.players.length > 1 ? "s" : ""} will be open to the club.`, { who: hostName });
  }
  if (!agreed && direct.length && short.length) agreed = { k: short[0], players: [host] };
  { const nos = h.talk.filter((l) => l.yes === false).map((l) => l.why); if (nos.filter((w) => w === "place").length >= 2) N.saw("too_far", h.id); if (nos.filter((w) => w === "price").length >= 2) N.saw("too_dear", h.id); }
  if (!agreed || agreed.players.length < h.need) N.saw("no_time", h.id);
  if (!agreed) { h.status = "stuck"; line(h, "host", "The agents couldn't find a time that suits enough of you this week. Try fewer players, or more people.", { who: hostName }); return save(); }
  const o = opts[agreed.k];
  h.promised = agreed.players.filter((id) => id !== host); // their agents said yes for them: a promise each (trust.js)
  h.alternates = agreed.alternates || []; // others whose agents said yes: the first takes a spot someone gives up
  // for the people asked directly, what their agent would have said: a right guess counts for the agent (trust.js)
  h.shadow = Object.fromEntries(direct.map((id) => [id, U[id][agreed.k] >= bar(id, 0)]));
  // spots the agents couldn't fill go to the people asked directly, best-suited first
  const extra = direct.sort((a, b) => U[b][agreed.k] - U[a][agreed.k]).slice(0, Math.max(0, h.need - agreed.players.length));
  if (extra.length) { agreed.players = [...agreed.players, ...extra]; line(h, "host", `Asking ${names(extra.map(first))} directly, without an agent's yes.`, { who: hostName }); }
  let deal = { each: 0, price: 0 };
  if (o.place.kind === "venue") {
    const push = agreed.players.reduce((s, id) => s + T.weights(taste[id]).price, 0) / agreed.players.length;
    deal = D.talk(o.place, { date: o.date, start: o.start, players: h.need, minutes: MINUTES, push: Math.min(1, push * 2.5), games, group: hostName });
    for (const l of deal.lines) line(h, l.from.endsWith(`${hostName}'s agent`) ? "host" : "venue", l.text, { who: l.from.replace(/'s agent$/, ""), venue: l.from.startsWith(o.place.name) });
  }
  h.pick = { date: o.date, start: o.start, minutes: MINUTES, where: o.place.name, place: o.place.id, kind: o.place.kind, at: { lat: o.place.lat, lon: o.place.lon }, busy: +o.busy.toFixed(2),
    each: deal.each || 0, price: deal.price || 0, list: deal.list || 0, off: deal.off || 0, sample: !!deal.sample, km: Object.fromEntries(agreed.players.map((id) => [id, kmFor(id, o.place)])) };
  h.players = agreed.players; h.direct = extra; h.answers = { [host]: "yes" }; h.status = "asking"; h.askedAt = now.getTime();
  h.askedOf = Object.fromEntries(agreed.players.map((id) => [id, now.getTime()]));
  line(h, "host", `Agreed: ${when(o)} at ${o.place.name}${deal.each ? `, ${D.CURRENCY}${deal.each} each` : ", a free court"}. Asking ${names(agreed.players.filter((id) => id !== host).map(first))} for one yes.`, { who: hostName, agreed: true });
  for (const id of agreed.players) if (id !== host) P.notify(id, "huddle", `Your agent and ${hostName}'s agreed ${h.sport} ${when(o)} at ${o.place.name}. One yes from you?`, { huddle: h.id });
  save();
}

// ---- 5. one yes from each player ----
export async function reply(me, id, yes, why = null, { now = new Date(), wait = false } = {}) {
  const h = find(id);
  if (!h || !h.players.includes(me)) return { error: "That game isn't one you're in.", code: 404 };
  if (h.status !== "asking") return { error: "The agents are still talking, or it's settled.", code: 409 };
  const o = h.pick, mine = { date: o.date, start: o.start, km: o.km[me] ?? 3, each: o.each, busy: o.busy };
  const r = T.reply(me, mine, yes, why);
  keepScore(h, me, yes, why);
  if (yes) {
    h.answers[me] = "yes";
    if (h.players.every((x) => h.answers[x] === "yes")) await book(h);
    save();
    return { huddle: view(h, me), line: r.line };
  }
  const back = await drop(h, me, why, now, wait);
  return { huddle: view(h, me), line: r.line, ...back };
}
// an agent's yes, and the person's answer, as a promise on the trust chain: once per person per huddle, never for "busy"
// (a busy evening is not the agent's mistake), and for someone asked directly only when their agent would have said yes
function keepScore(h, me, yes, why) {
  h.scored ||= [];
  if (h.scored.includes(me) || (!yes && why === "busy")) return;
  if (h.promised?.includes(me) || h.shadow?.[me] === true) { Tr.promise(me, yes, h.host); h.scored.push(me); }
}
// someone gives up their place (a no, or no answer by the deadline): the next player whose agent said yes takes it and
// everyone else's yes stands; with nobody left, the agents talk again
async function drop(h, me, why, now = new Date(), wait = false) {
  const o = h.pick, nm = first(me);
  line(h, me, `${nm} can't make ${when(o)}${why ? ` (${T.NO[why] || (why === "none" ? "no answer in time" : why)})` : ""}.`, { who: nm });
  if (why === "busy" || why === "none") { h.out = [...new Set([...h.out, me])]; if (why === "busy") N.saw("busy", h.id); }
  if (why === "place") N.saw("too_far", h.id);
  if (why === "price") N.saw("too_dear", h.id);
  h.players = h.players.filter((x) => x !== me); delete h.answers[me];
  const next = (h.alternates || []).find((x) => !h.players.includes(x) && !h.out.includes(x) && !busyOf(x, h.id).some((t) => Math.abs(t - startMs(o)) < 3 * 3600e3));
  if (next) {
    h.alternates = h.alternates.filter((x) => x !== next);
    h.players.push(next); h.promised = [...(h.promised || []), next]; (h.askedOf ||= {})[next] = now.getTime();
    { const home = T.get(next).home; o.km[next] = home && o.at ? +T.km(home, o.at).toFixed(1) : null; }
    line(h, "host", `${first(next)}'s agent had said yes too, so ${first(next)} takes the spot; everyone else's yes stands.`, { who: first(h.host) });
    P.notify(next, "huddle", `A spot opened: your agent and ${first(h.host)}'s agreed ${h.sport} ${when(o)} at ${o.where}. One yes from you?`, { huddle: h.id });
    if (h.players.every((x) => h.answers[x] === "yes")) await book(h);
    save();
    return { replaced: first(next) };
  }
  h.tries++;
  if (h.tries > TRIES) {
    h.status = "stuck";
    line(h, "host", `That's ${h.tries} tries. I'll leave it here; ${first(h.host)} can start again with other people or another week.`, { who: first(h.host) });
    P.notify(h.host, "huddle", `The agents couldn't settle ${h.sport} this week after ${h.tries} tries.`, { huddle: h.id });
    save();
    return {};
  }
  h.status = "talking"; h.answers = { [h.host]: "yes" }; h.players = []; delete h.pick;
  line(h, "host", `Nobody else had said yes to that time. Looking again, with what ${nm}'s agent just learned.`, { who: first(h.host) });
  save();
  const job = run(h, now).catch((e) => { h.status = "stuck"; line(h, "agent", `Something went wrong (${e.message}).`); save(); });
  if (wait) await job;
  return {};
}
// a yes is due within a day, and at least three hours before the game: who hasn't answered by then gives up their place
// (each player has their own day: someone who just took a freed spot gets a full one)
const dueOf = (h, id) => Math.min(((h.askedOf || {})[id] || h.askedAt || h.created) + 24 * 3600e3, startMs(h.pick) - 3 * 3600e3);
export async function sweep(now = new Date()) {
  for (const h of data().huddles.filter((x) => x.status === "asking" && x.pick)) {
    for (const id of h.players.filter((x) => !h.answers[x] && now.getTime() >= dueOf(h, x))) { if (h.status !== "asking") break; await drop(h, id, "none", now); }
  }
}
export const dueBy = (h, id = null) => (h.status === "asking" && h.pick ? (id ? dueOf(h, id) : Math.min(...h.players.map((x) => dueOf(h, x)))) : null);
// everyone said yes: the game goes on the feed with them in it (the feed's own "Game on" follows)
async function book(h) {
  const o = h.pick;
  const r = await P.post(h.host, { text: `Our agents agreed this one: ${o.where}${o.each ? `, ${D.CURRENCY}${o.each} each` : ""}.`, invite: { sport: h.sport, day: o.date, start: o.start, where: o.where.slice(0, 60), spots: h.need - 1, at: o.at, gate: h.gate, each: o.kind === "venue" ? o.each : 0 }, room: h.club }).catch((e) => ({ error: e.message }));
  h.status = "on";
  Tr.expect(r?.post?.id || h.id, h.players, startMs(o)); // after the game, the players say who came
  if (r?.post?.id) { h.post = r.post.id; for (const id of h.players) if (id !== h.host) P.join(id, h.post, true); }
  line(h, "host", `Everyone said yes. ${when(o)} at ${o.where} is on${h.players.length < h.need ? `; ${h.need - h.players.length} spot${h.need - h.players.length > 1 ? "s are" : " is"} open in the feed` : ""}.`, { who: first(h.host), agreed: true });
  if (!r?.post) for (const id of h.players) P.notify(id, "gameon", `Game on: ${h.sport} ${when(o)} at ${o.where}. ${names(h.players.filter((x) => x !== id).map(first))} ${h.players.length > 2 ? "are" : "is"} in.`, { huddle: h.id });
}
export function cancel(me, id) {
  const h = find(id);
  if (!h || h.host !== me) return { error: "Only the person who asked can call it off.", code: 403 };
  if (!["talking", "asking", "stuck", "on"].includes(h.status)) return { error: "It's already called off.", code: 409 };
  if (h.status === "on" && h.post) P.remove(me, h.post);
  h.status = "cancelled"; line(h, "host", `${first(me)} called it off.`, { who: first(me) });
  for (const x of h.players) if (x !== me) P.notify(x, "huddle", `${first(me)} called off ${h.sport} ${h.pick ? when(h.pick) : ""}.`.replace(/ \.$/, "."), { huddle: h.id });
  save();
  return { huddle: view(h, me) };
}

// ---- what a member sees ----
export function view(h, me) {
  const o = h.pick;
  return { id: h.id, sport: h.sport, need: h.need, club: h.clubName, host: first(h.host), mine: h.host === me, status: h.status, created: h.created, post: h.post || null,
    invited: h.invited.length, talk: h.talk.map((l) => ({ at: l.at, from: l.from === me ? "me" : l.from === "host" ? (h.host === me ? "me" : "host") : l.from === "venue" ? "venue" : l.from === "agent" ? "agent" : "other", who: l.who, text: l.text, ...(l.agent ? { agent: true } : {}), ...(l.venue ? { venue: true } : {}), ...(l.agreed ? { agreed: true } : {}), ...(l.yes != null ? { yes: l.yes } : {}), ...(l.trust ? { trust: l.trust } : {}), ...(l.gate ? { gate: l.gate } : {}) })),
    ...(o ? { pick: { date: o.date, start: o.start, when: when(o), where: o.where, kind: o.kind, each: o.each, price: o.price, list: o.list, off: o.off, busy: o.busy, sample: o.sample, km: o.km[me] ?? null, at: o.at } } : {}),
    players: h.players.map((id) => ({ name: id === me ? "You" : first(id), answer: h.answers[id] || null, host: id === h.host, direct: (h.direct || []).includes(id), trust: trustOf(id) })),
    waitlist: (h.waitlist || []).map(first), gate: h.gate || null, nearby: (h.nearby || []).length, ...(h.found ? { found: h.found } : {}),
    ask: h.status === "asking" && h.players.includes(me) && !h.answers[me], due: h.players.includes(me) ? dueBy(h, me) : dueBy(h) };
}
export const mineFor = (me) => data().huddles.filter((h) => h.host === me || h.players.includes(me)).sort((a, b) => b.created - a.created).slice(0, 12).map((h) => view(h, me));

// ---- the agent, without being asked ----
// why a game suits this member, in a few words
function reasons(t, g) {
  const f = T.fits(t, g), out = [];
  if (f.time >= 0.6) out.push(`one of your good times (${T.cellWords(T.cellOf(g.date, g.start))})`);
  if (g.km <= Math.max(1.5, t.maxKm * 0.4)) out.push(`close: ${g.km < 1 ? `${Math.round(g.km * 1000)} m` : `${g.km} km`}`);
  if (g.busy <= 0.35) out.push("usually quiet then");
  if (g.each === 0) out.push("free court");
  return out.length ? out : [`${g.km} km away`];
}
const dateFor = (day, now) => { if (/^\d{4}-/.test(day)) return day; const d = new Date(now); for (let i = 0; i < 7; i++) { if (T.DAYS[d.getDay()] === day) return T.ymd(d); d.setDate(d.getDate() + 1); } return T.ymd(now); };
// games near the member, posted by others, that still have room, best for them first
export function gamesFor(me, { now = new Date(), n = 3 } = {}) {
  const t = T.get(me), today = T.ymd(now), mine = P.busyAt(me);
  return P.openInvites(me, (room) => C.canSee(room, me)).map((g) => {
    const date = dateFor(g.invite.day, now), at = g.invite.at || (g.room ? C.find(g.room)?.at : null);
    if (date < today || (date === today && g.invite.start <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)) return null;
    const k = t.home && at ? +T.km(t.home, at).toFixed(1) : 3, place = at ? { id: g.id, ...at, kind: "public" } : { id: g.id, kind: "public" };
    const gm = { date, start: g.invite.start, km: k, each: g.invite.each ?? null, busy: at ? D.busy(place, date, g.invite.start) : 0.5 };
    if (g.invite.gate && Tr.check(me, g.invite.gate).verdict === "waitlist") return null;
    if (t.home && at && k > Math.max(t.maxKm * 2, 8)) return null;
    // not when they already play within three hours of it
    const at0 = startMs({ date, start: g.invite.start });
    if (mine.some((x) => Math.abs(x - at0) < 3 * 3600e3)) return null;
    return { post: g.id, host: g.host, hostTrust: trustOf(g.hostId), gate: g.invite.gate || null, sport: g.invite.sport, date, start: g.invite.start, when: when(gm), where: g.invite.where, left: g.invite.spots - g.invite.going, km: at && t.home ? k : null, each: gm.each, score: +T.worth(t, { ...gm, each: gm.each ?? 0 }).toFixed(2), why: reasons(t, gm), club: g.room ? C.find(g.room)?.name || null : null };
  }).filter(Boolean).filter((g) => !t.sports.length || t.sports.includes(g.sport)).sort((a, b) => b.score - a.score).slice(0, n);
}
// the cheapest quiet hour near the member at a time that suits them, with what the venue's agent would take
export async function dealFor(me, { now = new Date() } = {}) {
  const t = T.get(me);
  if (!t.home) return null;
  const sport = t.sports[0] || "badminton", places = (await D.placesNear(t.home, sport, { wait: false })).filter((p) => p.kind === "venue");
  let best = null;
  for (const p of places) for (let i = 1; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i); const date = T.ymd(d);
    for (const start of STARTS) {
      const g = { date, start, km: +T.km(t.home, p).toFixed(1), busy: D.busy(p, date, start), each: D.guessEach(p, date, start, 4) };
      if (!opensFor(p, start) || T.hardNo(t, g)) continue;
      const s = T.worth(t, g) + 0.3 * (1 - g.busy);
      if (!best || s > best.s) best = { s, p, g };
    }
  }
  if (!best) return null;
  const deal = D.talk(best.p, { date: best.g.date, start: best.g.start, players: 4, push: Math.min(1, T.weights(t).price * 2.5), group: "Your" });
  return { sport, place: { id: best.p.id, name: best.p.name }, date: best.g.date, start: best.g.start, when: when(best.g), km: best.g.km, busy: +best.g.busy.toFixed(2), list: deal.list, price: deal.price, each: deal.each, off: deal.off, lines: deal.lines, sample: true, currency: D.CURRENCY };
}
export async function today(me, { now = new Date() } = {}) {
  await sweep(now); P.promoteDue(now.getTime());
  const t = T.get(me), cards = [];
  for (const h of data().huddles.filter((x) => x.status === "asking" && x.players.includes(me) && !x.answers[me])) cards.push({ kind: "huddle", huddle: view(h, me) });
  const games = P.gamesOf(me, now.getTime());
  if (games.length) cards.push({ kind: "mine", games: games.map((g) => ({ ...g, when: when({ date: dateFor(g.day, now), start: g.start }), club: g.room ? C.find(g.room)?.name || null : null })) });
  for (const c of Tr.pending(me, now.getTime())) { const d = new Date(c.at); cards.push({ kind: "attend", attend: { key: c.key, when: when({ date: T.ymd(d), start: d.toTimeString().slice(0, 5) }), players: c.players.map((id) => ({ id, name: first(id) })) } }); }
  const places = t.home ? await D.placesNear(t.home, t.sports[0] || "badminton", { wait: false }) : [];
  const q = T.question(me, { places: places.map((p) => ({ ...p, km: +T.km(t.home, p).toFixed(1) })), now });
  if (q) cards.push({ kind: "question", question: q });
  for (const g of gamesFor(me, { now })) cards.push({ kind: "game", game: g });
  const deal = await dealFor(me, { now }).catch(() => null);
  if (deal && deal.off >= 10) cards.push({ kind: "deal", deal });
  // nobody to play with yet (no club with others, nobody nearby open to it): say what helps, instead of an empty page
  const sport = t.sports[0] || "badminton", near = t.home ? T.openNear(t.home, sport, 5).filter((x) => x.id !== me).length : 0;
  if (t.home && !near && !C.mine(me).some((c) => c.members.length > 1) && !cards.some((c) => c.kind === "game")) cards.push({ kind: "alone", alone: { sport, open: !!t.open } });
  const busy = data().huddles.some((h) => h.host === me && ["talking", "asking"].includes(h.status));
  const clubs = C.mine(me).filter((c) => c.members.length > 1);
  if (!busy && clubs.length) cards.push({ kind: "club", club: { id: clubs[0].id, name: clubs[0].name, sport: clubs[0].sport, members: clubs[0].members.length } });
  return { taste: T.view(t), cards, home: !!t.home, looking: D.loading(t.home, t.sports[0] || "badminton") };
}
// one thing worth a toast, at most every six hours: a game waiting for their yes, or a new game near them that fits
export function nudge(me, { now = new Date() } = {}) {
  const n = data().nudged[me] || { at: 0, seen: [] };
  if (now.getTime() - n.at < 6 * 3600e3) return { nudge: null };
  const t = T.get(me);
  if (!t.home && !t.answers.length) return { nudge: null };
  const g = gamesFor(me, { now, n: 5 }).find((x) => !n.seen.includes(x.post) && x.score >= 0.55);
  if (!g) return { nudge: null };
  data().nudged[me] = { at: now.getTime(), seen: [...n.seen, g.post].slice(-50) }; save();
  return { nudge: { kind: "game", text: `${g.sport[0].toUpperCase() + g.sport.slice(1)} ${g.when} at ${g.where}: ${g.why.join(", ")}. ${g.left} spot${g.left > 1 ? "s" : ""} left.`, post: g.post } };
}
// the member's answer to a game their agent recommended: join it, or say why not (their agent learns either way)
export function answerGame(me, postId, yes, why = null, { now = new Date() } = {}) {
  const g = gamesFor(me, { now, n: 50 }).find((x) => x.post === postId);
  if (!g) {
    const open = P.openInvites(me, (room) => C.canSee(room, me)).find((x) => x.id === postId);
    if (!open) return { error: "That game isn't open any more.", code: 404 };
    if (open.invite.gate && Tr.check(me, open.invite.gate).verdict === "waitlist") return { error: `Its host wants people who show up ${Math.round(open.invite.gate.minShow * 100)}% or more; you'd go on the waitlist.`, code: 409 };
    return { error: "It clashes with a game you're already in.", code: 409 };
  }
  const r = T.reply(me, { date: g.date, start: g.start, km: g.km ?? 3, each: g.each ?? 0, busy: 0.5 }, yes, why);
  if (yes) {
    const j = P.join(me, postId, true); if (j.error) return j;
    if (j.waitlisted) return { line: `You're on the waitlist: ${j.why}. If a spot is open the day before, it's yours.`, taste: r.taste, waitlisted: true };
    return { line: `You're in. ${r.line}`, taste: r.taste };
  }
  P.notForMe(me, postId);
  return { line: r.line, taste: r.taste };
}
export function forget(me) {
  const d = data();
  d.huddles = d.huddles.filter((h) => h.host !== me);
  for (const h of d.huddles) { h.invited = h.invited.filter((x) => x !== me); h.players = h.players.filter((x) => x !== me); delete h.answers[me]; }
  delete d.nudged[me]; save(); T.forget(me); Tr.forget(me);
}
