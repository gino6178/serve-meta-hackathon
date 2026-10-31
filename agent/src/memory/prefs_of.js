// A player's preference records, gathered from what is already stored (prefs.js settles them): nothing is migrated,
// so data written before the records existed is read as it is.
//   - their notes (memory.js), the player's own words: what code finds in each, and the rule memory_update.js checked;
//     a replaced note's records have ended, a note past its last day has expired, a deleted note has none
//   - what a Messenger player's agent learned from their messages (store.js memories)
//   - the weekly beliefs (beliefs.js): inferred, dated by the newest note each one cites
//   - records kept on their own (prefs.js stored: a member's answers, a setting)
import { readClub } from "../club/club.js";
import { helpers } from "../club/play.js";
import * as memory from "./memory.js";
import * as beliefs from "./beliefs.js";
import * as store from "../core/store.js";
import * as P from "./prefs.js";

const club = () => { try { return readClub(); } catch { return { members: [] }; } };
const venueNames = () => { try { const v = helpers.readVenues(); return (v.venues || v || []).map((x) => x.name).filter(Boolean); } catch { return []; } };

export function recordsOf(player, { now = Date.now(), members = club().members, venues = venueNames() } = {}) {
  if (!P.on() || !player) return [];
  const out = [], ctx = { members, venues };
  const notes = memory.list(player, now), byId = new Map(notes.map((n) => [n.id, n]));
  for (const n of notes) {
    if (n.kind !== "said") continue;
    const src = { type: "note", id: n.id, text: n.text.slice(0, 160) };
    const found = P.extract(n.text, ctx), rule = P.fromRule(n.rule);
    if (rule && !found.some((r) => r.kind === rule.kind && r.key === rule.key)) found.push(rule);
    for (const r of found) {
      const rec = P.make(r, { since: n.at, source: src, confidence: P.CONF.said, explicit: true, until: n.until || null });
      if (n.replacedAt) rec.ended = { at: n.replacedAt, by: n.replacedBy };
      out.push(rec);
    }
  }
  const p = store.get(player);
  for (const m of p?.memories || []) for (const r of P.extract(m.text, ctx)) out.push(P.make(r, { since: m.at || 0, source: { type: "chat", text: String(m.text).slice(0, 160) }, confidence: 0.8, explicit: true }));
  for (const b of beliefs.of(player)?.beliefs || []) {
    const since = Math.max(0, ...(b.cites || []).map((id) => byId.get(id)?.at || 0));
    if (!since) continue;
    for (const r of P.extract(b.text, ctx)) out.push(P.make(r, { since, source: { type: "belief", text: b.text, cites: b.cites }, confidence: P.CONF.belief, explicit: false }));
  }
  return [...out, ...P.stored(player)];
}
// the player's preferences, settled (extra: records the caller has, such as a habit)
export function of(player, { now = Date.now(), extra = [] } = {}) {
  if (!P.on() || !player) return P.empty();
  return P.resolve([...recordsOf(player, { now }), ...extra], now);
}
// what a weekly belief says that a newer record has since overruled: the belief is dropped from what the planner reads
// (beliefs.current's { belief, notes }), so a week-old summary cannot bring back a preference the player changed
export function fresh(Ps, standing) {
  const byId = new Map(Ps.all.map((r) => [r.id, r]));
  const sup = new Set(Ps.all.filter((r) => r.source?.type === "belief" && r.status !== "current" && !(r.status === "superseded" && byId.get(r.by)?.value === r.value)).map((r) => r.source.text));
  return (standing || []).filter((b) => !sup.has(b.belief));
}
// the texts whose every record a newer one with another value has overruled (a note, a Messenger memory): what the
// player said before and has since changed, so it is not put in front of a model as if it still held
export function staleTexts(Ps) {
  const byId = new Map(Ps.all.map((r) => [r.id, r])), per = new Map();
  for (const r of Ps.all) {
    const t = r.source?.text; if (!t || r.source.type === "belief") continue;
    const over = r.status === "ended" || r.status === "expired" || (r.status === "superseded" && byId.get(r.by)?.value !== r.value);
    per.set(t, (per.get(t) ?? true) && over);
  }
  return new Set([...per].filter(([, v]) => v).map(([t]) => t));
}
export const names = () => Object.fromEntries(club().members.map((m) => [m.id, m.name.split(" ")[0]]));
export const view = (player, { now = Date.now() } = {}) => P.view(of(player, { now }), names());
