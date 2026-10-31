// The tiny layer: a classifier of a few KB in front of the student (A2A_TINY=1; off by default). Same question as the
// student (student.js): the proposed time breaks the member's calendar or a hard rule and two or more listed times keep
// them; ask for one of those, or say the member can't play this week. It reads no text model: each option is a row of
// facts code already holds (weekday, start hour, the member's trip and its rank, how far from the asked time, place in
// time order and in the proposer's list, whether it fits a habit or liking in the member's words, the margins to the
// member's rules), scored by a small MLP and softmaxed over the options, in pure JS on the CPU in well under a
// millisecond. Trained on Muse Glimmer's own choices (the student's 4,868 teacher cases; distill/tiny_times.py).
//   - A second model, the doubt model, reads the tiny model's answer (its top probability, margin, entropy, the number
//     of options, a few facts of the case) and gives the chance its pick differs from Glimmer's. The tiny layer answers
//     only below a threshold set by conformal risk control on held-out members; everything else goes on to the student
//     and Glimmer as before.
//   - Code keeps every hard rule, as for the student: its options are only the times code kept.
//   - Only for a member whose hard limits are all in code (rulesComplete).
// Every answer goes in the token ledger (site a2a.tiny, no tokens), so what it saves is counted. docs/tiny_models.md.
import fs from "node:fs";
import { record } from "../core/ledger.js";

export const tinyOn = () => process.env.A2A_TINY === "1";
const hmOf = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYNAME = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };
const VENUES = ["riverside", "north", "lakeside", "midtown", "westgate"];
const tripOf = (x, m) => x.trip ?? x.c?.travel?.find((t) => t.id === m.id)?.min ?? null;
const venueOf = (x) => x.venue || x.c?.v?.id || VENUES.find((v) => new RegExp(`\\bat ${v}`, "i").test(x.text || "")) || null;

// The soft habits and likings in a member's own words, as flags (the simulated club's phrasings, the reworded ones of
// distill/cases.mjs, and the demo club's); hard limits stay in m.rules.
export function habits(m) {
  const a = String(m.agent || ""), h = { days: new Set(), part: null, venue: null };
  h.earliest = /earliest start|early starts are fine/i.test(a);
  h.weekend = /rather play weekends|any weekend morning/i.test(a);
  h.weeknight = /weeknights to weekends|after work on weekdays/i.test(a);
  h.evening = /prefers evenings|evenings by preference/i.test(a);
  h.lateEvening = /start later in the evening/i.test(a);
  h.lateWeekend = /late start at weekends|no earlier than \d\d:\d\d at weekends/i.test(a);
  h.earlyWeekend = /early weekend mornings|early Sunday games/i.test(a);
  h.satMorning = /Saturday mornings/i.test(a);
  h.sunLate = /Sunday late mornings/i.test(a);
  h.sunMorning = /Sunday mornings|early Sunday/i.test(a);
  h.home = /home venue/i.test(a);
  h.short = /short trips/i.test(a);
  h.long = /longer trip/i.test(a);
  h.any = /happy with any|flexible/i.test(a);
  h.consecutive = /consecutive days/i.test(a);
  for (const [, d] of a.matchAll(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) is best/g)) h.days.add(DAYNAME[d]);
  for (const [, d, p] of a.matchAll(/plays (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (mornings|evenings) by preference/g)) { h.days.add(DAYNAME[d]); h.part = p; }
  const v = a.match(/likes (Riverside|Midtown|North|Lakeside|Westgate)\b|prefers playing at (Riverside|Midtown|North|Lakeside|Westgate)/);
  if (v) h.venue = (v[1] || v[2]).toLowerCase();
  if (h.home && m.venue) h.venue ||= m.venue;
  return h;
}
// where three of an option's facts sit in its row (for the doubt model)
const FIRST_TIME = 22, FIRST_LISTED = 25, LIKED = 40;
const WHY = [/not free/, /no games on/, /ends after/, /trip/, /starts before/, /already/];

// The rows the model reads: one per option (the times code kept, soonest first, then "can't play this week"), and the
// case's own facts. cur: the proposed time; ok: the listed times that keep the member's calendar and rules; all: every
// listed time, in the proposer's order; why: why the proposed time does not work (talk.js breaks), when known.
export function timeRows(m, cur, ok, all, { minutes = 90, why = "" } = {}) {
  const alts = ok.filter((x) => x !== cur && x.id !== cur.id).sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.start - b.start);
  const h = habits(m), r = m.rules || {}, n = alts.length;
  const listed = all.filter((x) => x.id !== cur.id).map((x) => x.id);
  const trips = alts.map((x) => tripOf(x, m)), known = trips.filter((t) => t != null), minTrip = known.length ? Math.min(...known) : null;
  const rank = (t) => (t == null || known.length < 2 ? 0 : known.filter((u) => u < t).length / (known.length - 1));
  const curDay = (Date.parse(cur.slot.date) || 0) / 864e5;
  const nPrefs = ["earliest", "weekend", "weeknight", "evening", "lateEvening", "lateWeekend", "earlyWeekend", "satMorning", "sunLate", "sunMorning", "short", "long", "any"].filter((k) => h[k]).length + h.days.size + (h.venue ? 1 : 0);
  const whyK = WHY.map((re) => (re.test(why) ? 1 : 0));
  const caseX = [n / 6, 1 / n, nPrefs / 3, h.any ? 1 : 0, h.earliest ? 1 : 0, h.consecutive ? 1 : 0, r.endBy ? 1 : 0, r.maxTrip != null ? 1 : 0, r.noDays?.length ? 1 : 0, r.notBefore ? 1 : 0, ...whyK, Math.min(listed.length, 12) / 12];
  // how far each option is from the asked time, in minutes across days, and its rank among the options
  const gap = alts.map((x) => Math.abs(((Date.parse(x.slot.date) || 0) / 864e5 - curDay) * 1440 + x.start - cur.start));
  const sameDay = alts.map((x) => x.slot.date === cur.slot.date);
  const nearestSame = Math.min(...gap.filter((_, i) => sameDay[i]), Infinity);
  const firstListedId = listed.find((id) => alts.some((y) => y.id === id)), secondListedId = listed.filter((id) => alts.some((y) => y.id === id))[1];
  const rows = alts.map((x, i) => {
    const day = x.slot.day || DAYS[(new Date(`${x.slot.date}T12:00:00Z`).getUTCDay() + 6) % 7], hr = x.start / 60, wk = day === "Sat" || day === "Sun" ? 1 : 0;
    const trip = trips[i], v = venueOf(x), li = listed.indexOf(x.id), d = (Date.parse(x.slot.date) || 0) / 864e5 - curDay;
    const same = d === 0 ? 1 : 0, far = same ? Math.abs(x.start - cur.start) / 180 : 0;
    const morning = hr < 12 ? 1 : 0, evening = hr >= 17 ? 1 : 0;
    const match = {
      earliest: h.earliest && i === 0, weekend: h.weekend && wk, weeknight: h.weeknight && !wk, evening: h.evening && evening, lateEvening: h.lateEvening && evening && hr >= 19.5,
      lateWeekend: h.lateWeekend && wk && hr >= 10.5, earlyWeekend: h.earlyWeekend && wk && hr < 10, satMorning: h.satMorning && day === "Sat" && morning, sunLate: h.sunLate && day === "Sun" && hr >= 10 && hr < 13,
      sunMorning: h.sunMorning && day === "Sun" && morning, day: h.days.has(day) && (!h.part || (h.part === "mornings" ? morning : evening)), venue: !!h.venue && v === h.venue, short: h.short && trip != null && trip === minTrip,
    };
    const liked = Object.values(match).filter(Boolean).length;
    const x_ = [
      0, ...DAYS.map((dd) => (dd === day ? 1 : 0)), wk, (hr - 15) / 5, morning, hr >= 12 && hr < 17 ? 1 : 0, evening,
      trip == null ? 0 : trip / 30, trip == null ? 1 : 0, rank(trip), trip != null && trip === minTrip ? 1 : 0,
      same, far, Math.min(Math.abs(d), 7) / 7, d > 0 ? 1 : 0,
      n > 1 ? i / (n - 1) : 0, i === 0 ? 1 : 0, i === n - 1 ? 1 : 0, li < 0 ? 1 : li / Math.max(1, listed.length - 1), x.id === firstListedId ? 1 : 0,
      ...Object.values(match).map((b) => (b ? 1 : 0)), liked, liked > 0 ? 1 : 0,
      h.short && trip != null ? rank(trip) : 0, h.long && trip != null ? rank(trip) : 0, h.earliest ? i / Math.max(1, n - 1) : 0, h.lateEvening || h.lateWeekend ? (hr - 15) / 5 : 0,
      r.endBy ? Math.max(-1, Math.min(2, (toMin(r.endBy) - x.start - minutes) / 60)) / 2 : 0, r.maxTrip != null && trip != null ? Math.min(2, (r.maxTrip - trip) / 30) / 2 : 0,
      v && m.venue && v === m.venue ? 1 : 0,
      Math.min(gap[i], 7 * 1440) / 1440, n > 1 ? gap.filter((g) => g < gap[i]).length / (n - 1) : 0, gap[i] === Math.min(...gap) ? 1 : 0, sameDay[i] && gap[i] === nearestSame ? 1 : 0,
      x.id === secondListedId ? 1 : 0, sameDay.filter(Boolean).length / Math.max(1, n),
    ];
    return { kind: "counter", x: x_.concat(caseX), t: x };
  });
  const dec = new Array(rows[0]?.x.length - caseX.length || 0).fill(0);
  dec[0] = 1;
  rows.push({ kind: "decline", x: dec.concat(caseX), t: null });
  return { rows, caseX, alts, listed };
}

// ---- inference: a small MLP per option (tanh), softmax over the options; logistic regression for the doubt ----
export function mlpScores(net, rows) {
  if (Array.isArray(net)) { const all = net.map((n1) => mlpScores(n1, rows)); return rows.map((_, i) => all.reduce((a, s) => a + s[i], 0) / all.length); }
  const { W1, b1, w2, b2, mu, sd } = net;
  return rows.map(({ x }) => {
    let s = b2;
    for (let j = 0; j < b1.length; j++) { let a = b1[j]; const w = W1[j]; for (let k = 0; k < x.length; k++) a += w[k] * ((x[k] - mu[k]) / sd[k]); s += w2[j] * Math.tanh(a); }
    return s;
  });
}
const softmax = (s) => { const mx = Math.max(...s), e = s.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); };
// what the doubt model reads about one answer
export function doubtX(p, rows, caseX) {
  const o = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), top = o[0][0], second = o[1]?.[0] ?? 0;
  const H = -p.reduce((a, v) => a + (v > 0 ? v * Math.log(v) : 0), 0) / Math.log(Math.max(2, p.length));
  const pick = rows[o[0][1]], px = pick.x;
  return [top, top - second, H, p.length / 6, pick.kind === "decline" ? 1 : 0, px[FIRST_TIME], px[FIRST_LISTED], px[LIKED], ...caseX];
}
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const doubtOf = (lr, x) => sigmoid(lr.b + lr.w.reduce((a, w, k) => a + w * ((x[k] - lr.mu[k]) / lr.sd[k]), 0));

let model = null;
export function loadTimes(file = process.env.A2A_TINY_FILE || new URL("./tiny_times.json", import.meta.url)) {
  if (!model) model = JSON.parse(fs.readFileSync(file, "utf8"));
  return model;
}
// the tiny model's reading of one choice: { p: per row, pick, doubt, rows }
export function tinyRead(m, cur, ok, all, opts = {}, net = loadTimes()) {
  const { rows, caseX } = timeRows(m, cur, ok, all, opts);
  if (rows.length < 3) return null;
  const p = softmax(mlpScores(net.mlp, rows));
  const top = p.indexOf(Math.max(...p));
  return { p, rows, pick: rows[top], top: p[top], doubt: doubtOf(net.doubt, doubtX(p, rows, caseX)) };
}
export const tinyStats = { asked: 0, answered: 0, doubted: 0 };
// m, cur, ok, all as studentAnswer; opts.why: why the proposed time does not work (talk.js breaks). Returns a decision in
// fullAnswer's shape (without its sentence), or null for the student and Glimmer.
export function tinyAnswer(m, cur, ok, all, opts = {}) {
  if (!tinyOn() || !m.rulesComplete || !cur?.id || all.some((x) => !x.id)) return null;
  const alts = ok.filter((x) => x !== cur);
  if (alts.length < 2) return null;
  const t0 = process.hrtime.bigint(), net = loadTimes(), r = tinyRead(m, cur, ok, all, opts, net);
  if (!r) return null;
  tinyStats.asked++;
  const max = +(process.env.A2A_TINY_DOUBT || net.threshold), used = r.doubt <= max;
  record({ site: "a2a.tiny", model: "tiny-times", prompt: 0, cached: 0, output: 0, reasoning: 0, seconds: Number(process.hrtime.bigint() - t0) / 1e9, confidence: +r.top.toFixed(3), doubt: +r.doubt.toFixed(3), used });
  if (!used) { tinyStats.doubted++; return null; }
  tinyStats.answered++;
  const tier = { tier: "tiny", confidence: +r.top.toFixed(3) };
  if (r.pick.kind === "decline") return { intent: "decline", date: "", start: "", works: [], ...tier };
  return { intent: "counter", date: r.pick.t.slot.date, start: hmOf(r.pick.t.start), works: alts.map((y) => y.id), ...tier };
}
