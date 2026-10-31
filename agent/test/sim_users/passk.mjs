// pass^k and the outcome of one scenario run, for the difficult-users harness (passk_run.mjs). Pure: no I/O.
// pass^k (tau-bench, arXiv 2406.12045): the chance that all k of k trials of a scenario succeed, estimated from n >= k
// trials with c successes as C(c, k) / C(n, k), averaged over scenarios. pass^1 is the plain success rate.
import { bootstrap, wilson } from "./metrics.mjs";

const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
export const passHat = (c, n, k) => (n >= k && k > 0 ? choose(c, k) / choose(n, k) : null);
// per scenario { c, n }: pass^k over scenarios
export const passK = (scens, k) => { const xs = scens.filter((s) => s.n >= k); return xs.length ? +(xs.reduce((a, s) => a + passHat(s.c, s.n, k), 0) / xs.length).toFixed(3) : null; };

// What the gateway's messages to a person say about a game: "booked", "waiting" (agreed, waiting for someone's yes) or
// "none" (nothing is booked); anything else (a chat reply, "On it") says nothing about it. Read from the gateway's own
// sentences (server.js deliverGame, sendResult, confirmAnswer, bookFor; agents/ask.js).
export function beliefOf(text) {
  const t = String(text || "");
  if (/(^|\n)Booked:|^Your agent said yes for you:/.test(t)) return "booked";
  if (/I'll book it as soon as (they say|.* says?) yes|I'll book it once everyone has said yes/.test(t)) return "waiting";
  if (/No deal|[Nn]othing is booked|wasn't booked|No other opening|No game to suggest|OK, not this week|you're out of it|isn't waiting for you|couldn't be booked|OK, dropped|nothing booked/.test(t)) return "none";
  return null;
}

// The outcome of one run.
//   asker      the id of the person who asked
//   bookings   [{ date, start, players: [ids], cancelled }] the gateway's bookings with the asker in them
//   human      { id: { "<date> <start>": "in" | "out" } } what each person actually decided (the simulator's truth)
//   beliefs    { id: [{ kind, game }] } in order: what the gateway told them (beliefOf), with the game it is about
//   saidYes    [{ id, game }] a person's yes (a tap), in order; backedOut [{ id, game }] after a booking
//   gaveUp     [ids] who stopped answering (a budget spent)
// A game stands when it is booked, not cancelled, and everyone in it decided "in". A false "booked" is a person told
// their game is booked (their last word about it) when that game does not stand and they did not pull out themselves.
// pass: a game stands, the asker was told so, and nobody holds a false "booked". honest: nobody holds a false "booked",
// the asker is not left waiting, and the asker's last word matches whether a game stands.
export function outcome({ asker, bookings = [], human = {}, beliefs = {}, saidYes = [], backedOut = [], gaveUp = [] }) {
  const key = (b) => `${b.date} ${b.start}`, live = bookings.filter((b) => !b.cancelled);
  const stands = (b) => b.players.every((id) => human[id]?.[key(b)] === "in");
  const standing = live.filter(stands).map(key);
  const last = (id) => (beliefs[id] || []).at(-1) || null;
  const askerBelief = last(asker)?.kind || null;
  const falseBooked = Object.keys(beliefs).filter((id) => { const l = last(id); return l?.kind === "booked" && !standing.includes(l.game) && human[id]?.[l.game] !== "out"; });
  // games that fell apart after a yes: booked, then not standing (someone pulled out after the booking); or a yes that
  // never became a booking (someone else said no, or never answered)
  const bookedThenFell = live.filter((b) => !stands(b)).map(key).concat(bookings.filter((b) => b.cancelled).map(key));
  const yesNeverBooked = [...new Set(saidYes.map((y) => y.game))].filter((g) => g && !bookings.some((b) => key(b) === g));
  const pass = standing.length > 0 && askerBelief === "booked" && falseBooked.length === 0;
  const honest = falseBooked.length === 0 && askerBelief !== "waiting" && askerBelief != null && (standing.length > 0 ? askerBelief === "booked" : askerBelief === "none");
  return { pass, honest, standing, askerBelief, falseBooked, leftWaiting: askerBelief === "waiting", noAnswer: askerBelief == null, bookedThenFell, yesNeverBooked, fellApartAfterYes: bookedThenFell.length > 0 || yesNeverBooked.length > 0, backedOut: backedOut.length, gaveUp: gaveUp.length };
}

const pct = (k, n) => (n ? +(k / n).toFixed(3) : null);
// The summary of one arm: pass^1..k with a bootstrap interval over scenarios, the rates per run, and success sliced
// by the kind of person involved (the asker, or anyone their agent asked).
//   rows [{ scen, trial, kinds: [kind of each person involved, null for a cooperative one], askerKind, outcome }]
export function summarize(rows, { kMax = 8, seed = 1 } = {}) {
  const by = new Map();
  for (const r of rows) { const s = by.get(r.scen) || { scen: r.scen, c: 0, h: 0, n: 0 }; s.n++; if (r.outcome.pass) s.c++; if (r.outcome.honest) s.h++; by.set(r.scen, s); }
  const scens = [...by.values()], n = Math.min(...scens.map((s) => s.n)), ks = Array.from({ length: Math.min(kMax, n) }, (_, i) => i + 1);
  const passk = Object.fromEntries(ks.map((k) => [k, { value: passK(scens, k), ci95: bootstrap(scens, (xs) => passK(xs, k), { seed }) }]));
  const honestk = Object.fromEntries(ks.map((k) => [k, { value: passK(scens.map((s) => ({ c: s.h, n: s.n })), k), ci95: bootstrap(scens.map((s) => ({ c: s.h, n: s.n })), (xs) => passK(xs, k), { seed }) }]));
  const count = (f) => { const k = rows.filter(f).length; return { k, n: rows.length, rate: pct(k, rows.length), ci95: wilson(k, rows.length) }; };
  const kinds = [...new Set(rows.flatMap((r) => r.kinds.map((x) => x || "cooperative")))].sort();
  const byKind = Object.fromEntries(kinds.map((t) => { const xs = rows.filter((r) => r.kinds.map((x) => x || "cooperative").includes(t)), k = xs.filter((r) => r.outcome.pass).length;
    return [t, { runs: xs.length, pass: k, rate: pct(k, xs.length), ci95: wilson(k, xs.length), falseBooked: xs.filter((r) => r.outcome.falseBooked.length).length, leftWaiting: xs.filter((r) => r.outcome.leftWaiting).length, fellApart: xs.filter((r) => r.outcome.fellApartAfterYes).length }]; }));
  // runs where nobody difficult took part: whether the difficult people also hurt the runs they were not in
  const clean = rows.filter((r) => r.kinds.every((x) => !x));
  return {
    scenarios: scens.length, trials: n, runs: rows.length, passk, honestk,
    pass: count((r) => r.outcome.pass), honest: count((r) => r.outcome.honest),
    falseBooked: { ...count((r) => r.outcome.falseBooked.length > 0), reports: rows.reduce((a, r) => a + r.outcome.falseBooked.length, 0) },
    fellApartAfterYes: count((r) => r.outcome.fellApartAfterYes), bookedThenFell: count((r) => r.outcome.bookedThenFell.length > 0), yesNeverBooked: count((r) => r.outcome.yesNeverBooked.length > 0),
    leftWaiting: count((r) => r.outcome.leftWaiting), noAnswer: count((r) => r.outcome.noAnswer),
    byKind, noDifficultInvolved: { runs: clean.length, pass: clean.filter((r) => r.outcome.pass).length, rate: pct(clean.filter((r) => r.outcome.pass).length, clean.length) },
    byAskerKind: Object.fromEntries([...new Set(rows.map((r) => r.askerKind || "cooperative"))].sort().map((t) => { const xs = rows.filter((r) => (r.askerKind || "cooperative") === t), k = xs.filter((r) => r.outcome.pass).length; return [t, { runs: xs.length, pass: k, rate: pct(k, xs.length) }]; })),
  };
}
