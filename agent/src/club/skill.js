// Skill ratings with uncertainty, on the server: each member has a (mu, sigma) per sport, OpenSkill style (Weng and Lin
// 2011, the Bradley-Terry full-pairing update; plain JS, no package). A team's strength is the sum of its players' mu,
// its uncertainty the sum of their sigma squared, so doubles and bigger teams rate the same way as singles.
//   Only games marked competitive move ratings. A casual game, a gentle game, a children's session and a charity
//   programme (members/programs.js) never do, whatever they are marked: counts() says which.
//   A new member starts at mu 25, sigma 25/3; ordinal (mu - 3 sigma) is the cautious number to show.
//   A result counts only once every named player other than the reporter has confirmed their own part in it (nobody
//   is rated for a game they didn't play); while one waits, another for the same sport and players is refused, and the
//   same result twice on one day counts once. Any named player can turn a waiting one down.
//   Pairing reads mu and sigma (pairing.js): a close mu makes a fair game, and a high sigma prefers a close game, the
//   kind that settles a level fastest (learn()).
//   SKILL_FILE (data/skill.json). A store can also live in memory only (the tests: createSkill()).
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

export const MU = 25, SIGMA = 25 / 3, BETA = 25 / 6, KAPPA = 1e-4, TAU = 25 / 300;
export const PROTECTED = ["youth", "seniors", "charity"];
const fresh = () => ({ mu: MU, sigma: SIGMA, games: 0 });
export const ordinal = (r) => r.mu - 3 * r.sigma;

// whether a game may change ratings: marked competitive, and not a gentle game, a children's session or a programme
export function counts(game = {}) {
  if (game.mode !== "competitive") return { ok: false, why: "casual games don't change ratings" };
  if (game.gentle || game.children || game.program || PROTECTED.includes(game.kind)) return { ok: false, why: "gentle games, children's sessions and charity programmes don't change ratings" };
  return { ok: true };
}

// teams: [[{ mu, sigma }, ...], ...]; ranks: lower is better, equal is a draw. -> new [[{ mu, sigma }]]
export function update(teams, ranks, { beta = BETA, kappa = KAPPA, tau = TAU } = {}) {
  const ts = teams.map((t) => t.map((p) => ({ mu: p.mu, sigma: Math.sqrt(p.sigma ** 2 + tau ** 2) })));
  const sum = ts.map((t) => ({ mu: t.reduce((s, p) => s + p.mu, 0), s2: t.reduce((s, p) => s + p.sigma ** 2, 0) }));
  return ts.map((t, i) => {
    let omega = 0, delta = 0;
    for (let q = 0; q < ts.length; q++) {
      if (q === i) continue;
      const c = Math.sqrt(sum[i].s2 + sum[q].s2 + 2 * beta ** 2), p = 1 / (1 + Math.exp((sum[q].mu - sum[i].mu) / c));
      const s = ranks[q] > ranks[i] ? 1 : ranks[q] === ranks[i] ? 0.5 : 0, gamma = Math.sqrt(sum[i].s2) / c;
      omega += (sum[i].s2 / c) * (s - p);
      delta += ((gamma * sum[i].s2) / c ** 2) * p * (1 - p);
    }
    return t.map((p) => { const w = p.sigma ** 2 / sum[i].s2; return { mu: p.mu + w * omega, sigma: Math.sqrt(p.sigma ** 2 * Math.max(1 - w * delta, kappa)) }; });
  });
}
// the chance team a beats team b (lists of { mu, sigma })
export function winChance(a, b, beta = BETA) {
  const m = (t) => t.reduce((s, p) => s + p.mu, 0), v = (t) => t.reduce((s, p) => s + p.sigma ** 2, 0);
  return 1 / (1 + Math.exp((m(b) - m(a)) / Math.sqrt(v(a) + v(b) + 2 * beta ** 2)));
}
// what one game between a and b would teach: the expected share of their uncertainty it takes away (0..1), largest
// when both sigmas are high and the game is close
export function learn(a, b, beta = BETA) {
  const c2 = a.sigma ** 2 + b.sigma ** 2 + 2 * beta ** 2, p = winChance([a], [b], beta), pq = p * (1 - p);
  return ((a.sigma ** 2 / c2) * pq + (b.sigma ** 2 / c2) * pq) / 2;
}

export function createSkill(file = null) {
  const db = file ? readJSON(file, { members: {}, pending: {} }) : { members: {}, pending: {} };
  db.members ||= {}; db.pending ||= {}; db.done ||= [];
  const save = () => { if (file) writeJSON(file, db); };
  const get = (id, sport = "badminton") => ({ ...(db.members[id]?.[sport] || fresh()) });
  const known = (id, sport = "badminton") => !!db.members[id]?.[sport];
  // a game's result: { sport, teams: [[ids], [ids]], ranks | winner, mode, kind, gentle, children, program }
  function rate(game) {
    const ok = counts(game);
    if (!ok.ok) return { rated: false, why: ok.why };
    const sport = String(game.sport || "badminton");
    if (!/^[a-z][a-z -]{1,23}$/.test(sport) || sport in Object.prototype || sport === "prototype") return { rated: false, why: "the sport is a name like badminton or table tennis" };
    const teams = (game.teams || []).map((t) => [...new Set(t.map(String))]);
    if (teams.length < 2 || teams.some((t) => !t.length) || new Set(teams.flat()).size !== teams.flat().length) return { rated: false, why: "two teams or more, each with its own players" };
    const ranks = Array.isArray(game.ranks) ? game.ranks : teams.map((_, i) => (i === +game.winner ? 0 : 1));
    if (ranks.length !== teams.length) return { rated: false, why: "a rank for every team" };
    const next = update(teams.map((t) => t.map((id) => get(id, sport))), ranks);
    teams.forEach((t, i) => t.forEach((id, j) => { const r = next[i][j], was = get(id, sport); (db.members[id] ||= {})[sport] = { mu: +r.mu.toFixed(4), sigma: +r.sigma.toFixed(4), games: was.games + 1 }; }));
    save();
    return { rated: true, sport, ratings: Object.fromEntries(teams.flat().map((id) => [id, get(id, sport)])) };
  }
  // a result's players, sport and outcome, as keys: the same players in any order are the same game
  const players = (g) => [...new Set((g.teams || []).flat().map(String))].sort();
  const who = (g) => `${String(g.sport || "badminton")}|${players(g).join(",")}`;
  const same = (g) => `${who(g)}|${(g.teams || []).map((t, i) => `${[...t].map(String).sort().join(",")}=${Array.isArray(g.ranks) ? g.ranks[i] : i === +g.winner ? 0 : 1}`).sort().join("/")}`;
  const dayOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  // a result the reporter gives waits until every other named player confirms their own part in it
  function report(by, game, now = Date.now()) {
    const ok = counts(game);
    if (!ok.ok) return { rated: false, why: ok.why };
    if (!(game.teams || []).some((t) => (t || []).map(String).includes(by))) return { error: "Report only a game you played in.", code: 403 };
    if (players(game).length !== (game.teams || []).flat().length) return { error: "A player can be on one team only.", code: 400 };
    for (const [k, g] of Object.entries(db.pending)) if (now - g.at > 14 * 864e5) delete db.pending[k];
    db.done = db.done.filter((d) => now - d.at < 2 * 864e5);
    if (Object.values(db.pending).some((g) => who(g) === who(game))) return { error: "A result for these players in this sport is already waiting to be confirmed (GET /api/members/result/pending).", code: 409 };
    if (db.done.some((d) => d.key === same(game) && d.day === dayOf(now))) return { error: "That result was already confirmed today.", code: 409 };
    const id = `g${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    db.pending[id] = { ...game, by, at: now, yes: [] };
    save();
    return { pending: id, waiting: players(game).length - 1 };
  }
  // a named player confirms their own part; the last one rates it. The answer holds the confirmer's rating only
  function confirm(by, id, now = Date.now()) {
    const g = db.pending[id];
    if (!g || !players(g).includes(by)) return { error: "No such result waiting.", code: 404 };
    if (by === g.by) return { error: "You reported it: the other players confirm it.", code: 403 };
    g.yes = [...new Set([...(g.yes || []), by])];
    const left = players(g).filter((x) => x !== g.by && !g.yes.includes(x)).length;
    if (left) { save(); return { confirmed: true, rated: false, waiting: left }; }
    delete db.pending[id];
    const r = rate(g);
    if (r.rated) db.done.push({ key: same(g), day: dayOf(now), at: now });
    save();
    return r.rated ? { rated: true, sport: r.sport, rating: get(by, r.sport) } : r;
  }
  // a named player (or the reporter) turns a waiting result down: it goes, nobody is rated
  function decline(by, id) {
    const g = db.pending[id];
    if (!g || !players(g).includes(by)) return { error: "No such result waiting.", code: 404 };
    delete db.pending[id]; save();
    return { declined: true };
  }
  // the results waiting that name this member: to confirm, turn down, or (their own) see
  const pendingFor = (me) => Object.entries(db.pending).filter(([, g]) => players(g).includes(me)).map(([id, g]) => ({ id, sport: String(g.sport || "badminton"), teams: g.teams, winner: g.winner, at: g.at, by: g.by, mine: g.by === me, confirmed: me === g.by || (g.yes || []).includes(me), waiting: players(g).filter((x) => x !== g.by && !(g.yes || []).includes(x)).length }));
  // mu and sigma for pairing: only members with a rated game in this sport (the rest fall back to the club rating)
  const table = (ids, sport = "badminton") => Object.fromEntries(ids.filter((id) => known(id, sport)).map((id) => [id, get(id, sport)]));
  const forget = (id) => { delete db.members[id]; for (const [k, g] of Object.entries(db.pending)) if (players(g).includes(id)) delete db.pending[k]; save(); };
  return { get, known, rate, report, confirm, decline, pendingFor, table, forget, view: (id) => Object.fromEntries(Object.entries(db.members[id] || {}).map(([s, r]) => [s, { ...r, ordinal: +ordinal(r).toFixed(2) }])) };
}
let shared = null;
export const store = () => (shared ||= createSkill(path.resolve(process.env.SKILL_FILE || path.join("data", "skill.json"))));
