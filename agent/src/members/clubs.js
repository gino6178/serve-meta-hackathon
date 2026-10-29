// Clubs the members start themselves, each with a place on the map. A member starts one (a name, a sport, a line about
// it, where it plays), others find it on the map near them and join; games and posts can belong to a club (the feed's
// posts carry its id, feed/posts.js). The name and the line are checked like any post (the feed's moderation).
//   data/clubs.json (CLUBS_FILE): { clubs: [{ id, name, sport, about, where, at: {lat, lon}, kind, program, owner, members: [{id, name, at}], created }] }
// A club's kind is a club, children's sessions, gentle games for older adults, or a charity tournament (programs.js).
// A club is public or private. Public: anyone signed in sees its games and posts, and posting in one joins it. Private:
// it is on the map, but its games and posts are for its members; a member asks to join and the club's owner says yes
// or no, and agents do not recommend it. A member who leaves Serve leaves every club; a club left with nobody in it is
// deleted.
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import * as G from "./programs.js";

const FILE = () => path.resolve(process.env.CLUBS_FILE || "data/clubs.json");
let db = null;
const data = () => (db ||= readJSON(FILE(), { clubs: [] }));
const save = () => writeJSON(FILE(), data());
const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash", "running"];
const MAX_OWNED = 3;
const tidy = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const pointOf = (x) => { if (x?.lat == null || x?.lon == null || x.lat === "" || x.lon === "") return null; const lat = +x.lat, lon = +x.lon; return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat: +lat.toFixed(4), lon: +lon.toFixed(4) } : null; };

export const find = (id) => data().clubs.find((c) => c.id === id) || null;
export const isMember = (id, player) => !!find(id)?.members.some((m) => m.id === player);
// may this member see the club's games and posts
export const canSee = (id, player) => { const c = find(id); return !!c && (c.privacy !== "private" || c.members.some((m) => m.id === player)); };

// a club's program as a member sees it (programs.js): the roster for the organiser only; a charity's entries as counts,
// the member's own entry, and the draw
function programView(c, viewer, inIt) {
  const kind = c.kind || "club", g = c.program || {};
  if (kind === "youth") return { kind, ...(c.owner === viewer ? { roster: g.roster || [] } : {}), ...(inIt && g.plan ? { plan: g.plan } : {}) };
  if (kind === "seniors") return { kind, gentle: G.GENTLE };
  if (kind === "charity") {
    const es = g.entrants || [], me = es.find((e) => e.id === viewer);
    return { kind, cause: g.cause || "", entrants: es.length, pledged: es.reduce((n, e) => n + e.pledge, 0), ...(me ? { entry: { level: me.level, pledge: me.pledge } } : {}), ...(g.draw ? { draw: g.draw } : {}) };
  }
  return { kind };
}
// a club as a member sees it
export function view(c, viewer, from = null) {
  const inIt = c.members.some((m) => m.id === viewer), mine = c.owner === viewer;
  return { id: c.id, name: c.name, sport: c.sport, about: c.about, where: c.where, at: c.at, members: c.members.length, privacy: c.privacy || "public", ...programView(c, viewer, inIt),
    asked: !inIt && (c.requests || []).some((r) => r.id === viewer), ...(mine ? { requests: (c.requests || []).map((r) => ({ id: r.id, name: r.name })) } : {}),
    names: c.members.slice(0, 8).map((m) => (m.id === viewer ? "You" : m.name.split(" ")[0])), joined: c.members.some((m) => m.id === viewer), mine: c.owner === viewer,
    ...(from ? { km: +km(from, c.at).toFixed(1) } : {}) };
}
// the clubs near a point (the member's own first), or every club when there is no point
export function list(viewer, { lat, lon, n = 50 } = {}) {
  const from = pointOf({ lat, lon });
  const cs = data().clubs.map((c) => view(c, viewer, from));
  cs.sort((a, b) => (b.joined - a.joined) || (from ? a.km - b.km : b.members - a.members));
  return { clubs: cs.slice(0, Math.min(100, n)) };
}
// start a club; moderate(text) is the feed's check on what a member writes
export async function start(member, b, moderate) {
  const name = tidy(b.name, 40), about = tidy(b.about, 160), where = tidy(b.where, 60), sport = String(b.sport || "").toLowerCase(), at = pointOf(b.at);
  if (name.length < 3) return { error: "Give the club a name (3 to 40 characters).", code: 400 };
  if (!SPORTS.includes(sport)) return { error: `The sport must be one of: ${SPORTS.join(", ")}.`, code: 400 };
  if (!at) return { error: "Pick where the club plays on the map.", code: 400 };
  if (data().clubs.filter((c) => c.owner === member.id).length >= MAX_OWNED) return { error: `You can start ${MAX_OWNED} clubs at most.`, code: 429 };
  if (data().clubs.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { error: "A club has that name already.", code: 409 };
  const kind = G.KINDS.includes(b.kind) ? b.kind : "club", cause = tidy(b.cause, 80);
  if (kind === "charity" && cause.length < 3) return { error: "Say who the tournament is for (3 to 80 characters).", code: 400 };
  const m = await moderate([name, about, where, cause].filter(Boolean).join("\n"), member.id);
  if (m?.refused || m?.helpline) return { refused: true, why: m.why || "The club's name or line was not allowed." };
  // children's sessions are always private: the organiser lets in the parents and helpers
  const privacy = kind === "youth" || b.privacy === "private" ? "private" : "public";
  const c = { id: `c-${crypto.randomUUID().slice(0, 8)}`, name, sport, about, where: where || name, at, privacy, kind, ...(kind === "charity" ? { program: { cause, entrants: [] } } : kind === "youth" ? { program: { roster: [] } } : {}),
    owner: member.id, members: [{ id: member.id, name: member.name, at: Date.now() }], requests: [], created: Date.now() };
  data().clubs.push(c); save();
  return { club: view(c, member.id) };
}
export function join(member, id, on = true) {
  const c = find(id);
  if (!c) return { error: "No such club.", code: 404 };
  const inIt = c.members.some((m) => m.id === member.id);
  // a private club: asking, and the owner answers (answer below); asking again, or leaving, takes the ask back
  if (c.privacy === "private" && on && !inIt) {
    if (!(c.requests ||= []).some((r) => r.id === member.id)) c.requests.push({ id: member.id, name: member.name, at: Date.now() });
    save(); return { club: view(c, member.id), asked: true };
  }
  if (!on) c.requests = (c.requests || []).filter((r) => r.id !== member.id);
  if (on && !inIt) c.members.push({ id: member.id, name: member.name, at: Date.now() });
  if (!on && inIt) c.members = c.members.filter((m) => m.id !== member.id);
  if (!c.members.length) data().clubs = data().clubs.filter((x) => x !== c);
  else if (c.owner === member.id && !on) c.owner = c.members[0].id; // the longest-standing member takes it over
  save();
  return { club: c.members.length ? view(c, member.id) : null };
}
// a member's agent recommends the nearest club they are not in yet (within 15 km), their sport first; null if none
export function suggest(viewer, { lat, lon, sport = null } = {}) {
  const from = pointOf({ lat, lon });
  if (!from) return { club: null };
  const near = data().clubs.filter((c) => c.privacy !== "private" && !c.members.some((m) => m.id === viewer)).map((c) => ({ c, d: km(from, c.at) })).filter((x) => x.d <= 15)
    .sort((a, b) => ((b.c.sport === sport) - (a.c.sport === sport)) || a.d - b.d)[0];
  if (!near) return { club: null };
  const v = view(near.c, viewer, from);
  return { club: v, why: `${v.km < 1 ? `${Math.round(v.km * 1000)} m` : `${v.km} km`} from you, ${v.sport}, ${v.members} member${v.members === 1 ? "" : "s"}` };
}
// someone who posts in a club joins it (clubs are open); false for a club that is not there
export function joinById(id, player, name) {
  const c = find(id);
  if (!c) return false;
  if (c.privacy === "private") return c.members.some((m) => m.id === player);
  if (!c.members.some((m) => m.id === player)) { c.members.push({ id: player, name: name || "A member", at: Date.now() }); save(); }
  return true;
}
// the owner of a private club says yes or no to someone who asked
export function answer(owner, id, who, yes) {
  const c = find(id);
  if (!c) return { error: "No such club.", code: 404 };
  if (c.owner !== owner.id) return { error: "Only the club's owner answers.", code: 403 };
  const r = (c.requests || []).find((x) => x.id === who);
  if (!r) return { error: "Nobody by that name asked.", code: 404 };
  c.requests = c.requests.filter((x) => x !== r);
  if (yes && !c.members.some((m) => m.id === who)) c.members.push({ id: r.id, name: r.name, at: Date.now() });
  save();
  return { club: view(c, owner.id) };
}
// ---- programs (programs.js) ----
const owned = (owner, id, kind) => { const c = find(id); if (!c) return { error: "No such club.", code: 404 }; if ((c.kind || "club") !== kind) return { error: `Not a ${kind} club.`, code: 400 }; if (c.owner !== owner.id) return { error: "Only the organiser can do that.", code: 403 }; return { c }; };
// the organiser's roster of children, first names only, checked like any post
export async function setRoster(owner, id, names, moderate) {
  const { c, error, code } = owned(owner, id, "youth"); if (error) return { error, code };
  const r = G.rosterOf(names); if (r.error) return { error: r.error, code: 400 };
  const m = r.roster.length ? await moderate(r.roster.join("\n"), owner.id) : null;
  if (m?.refused) return { refused: true, why: m.why };
  c.program = { ...(c.program || {}), roster: r.roster }; save();
  return { club: view(c, owner.id) };
}
// today's session: who came (from the roster), the courts, the times; the plan is for the club's members to see
export function planSession(owner, id, b) {
  const { c, error, code } = owned(owner, id, "youth"); if (error) return { error, code };
  const roster = c.program?.roster || [], present = (b.present || []).filter((x) => roster.includes(x));
  const r = G.youthPlan({ ...b, present, sport: c.sport, where: c.where }); if (r.error) return { error: r.error, code: 400 };
  c.program = { ...c.program, plan: r.plan }; save();
  return { club: view(c, owner.id), plan: r.plan };
}
// entering a charity tournament joins the club; entering again changes the entry, and on: false takes it back
export function enter(member, id, b) {
  const c = find(id);
  if (!c || c.kind !== "charity") return { error: "Not a charity tournament.", code: 400 };
  if (c.program.draw) return { error: "The draw is made: entries are closed.", code: 409 };
  c.program.entrants = (c.program.entrants || []).filter((e) => e.id !== member.id);
  if (b.on !== false) {
    const r = G.entryOf(b); if (r.error) return { error: r.error, code: 400 };
    c.program.entrants.push({ id: member.id, name: member.name, ...r.entry, at: Date.now() });
    if (!c.members.some((m) => m.id === member.id)) c.members.push({ id: member.id, name: member.name, at: Date.now() });
  }
  save();
  return { club: view(c, member.id) };
}
export function makeDraw(owner, id, b) {
  const { c, error, code } = owned(owner, id, "charity"); if (error) return { error, code };
  const r = G.draw(c.program.entrants || [], b); if (r.error) return { error: r.error, code: 400 };
  c.program.draw = r.draw; save();
  return { club: view(c, owner.id), draw: r.draw };
}
export function forget(player) {
  let changed = false;
  for (const c of data().clubs) {
    if (!c.members.some((m) => m.id === player) && !(c.requests || []).some((r) => r.id === player)) continue;
    c.members = c.members.filter((m) => m.id !== player); c.requests = (c.requests || []).filter((r) => r.id !== player); changed = true;
    if (c.program?.entrants) c.program.entrants = c.program.entrants.filter((e) => e.id !== player);
    if (c.owner === player && c.members.length) c.owner = c.members[0].id;
  }
  data().clubs = data().clubs.filter((c) => c.members.length);
  if (changed) save();
}
