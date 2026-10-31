// A second round when no listed time works for everyone (A2A_STRETCH, on unless "off"). After CalBench: agents that say
// only yes or no to each time pay far more than agents that say how much a time would cost them (excess cost 1.68 and
// 3.64 against 0.26 and 0.32), and the agents that disclose least are the least fair. So when the sets do not meet,
// your agent asks once more, and each member's agent marks the listed times its member could make by stretching one of
// its own limits, by how many minutes. Only as far as the member allowed (rules.stretch: minutes past endBy, before
// notBefore, over maxTrip), and never its calendar, its other games or its days off: code computes it, no model.
// Your agent then takes the time whose largest stretch, counting what each member has already stretched for earlier
// games (the burden ledger), is smallest: the member who gave way last time is asked last.
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";
import { helpers } from "../club/play.js";

const { toMin, hm } = helpers;
export const stretchOn = () => process.env.A2A_STRETCH !== "off";
const FILE = () => path.resolve(process.env.STRETCH_FILE || "data/stretch_burden.json");
// what each member has stretched, in minutes, game by game (kept for 60 days, then it no longer counts)
const KEEP = 60 * 86400000;
let ledger = null;
const load = () => (ledger ||= readJSON(FILE(), {}));
export const forgetBurden = () => { ledger = {}; writeJSON(FILE(), ledger); };
export function burdenOf(id, now = Date.now()) { return (load()[id] || []).filter((e) => now - e.at < KEEP).reduce((a, e) => a + e.min, 0); }
export function noteStretch(byMember, ref, now = Date.now()) {
  const l = load();
  for (const [id, min] of Object.entries(byMember)) if (min > 0) l[id] = [...(l[id] || []).filter((e) => now - e.at < KEEP), { at: now, min, ref }];
  writeJSON(FILE(), l);
}

// how many minutes of stretch time x needs from member m (its own allowance), or null: x works as it is (0 is not
// returned; a time that works is in the works list), or it breaks something that does not stretch, or needs more
export function stretchOf(m, x, minutes, breaks) {
  const r = m.rules || {}, s = r.stretch;
  if (!s || !breaks(m, x, minutes)) return null;
  const weekend = ["Sat", "Sun"].includes(x.slot.day), nb = r.notBefore && (weekend ? r.notBefore.weekend : r.notBefore.weekday);
  const loose = { ...r,
    ...(r.endBy && s.endBy ? { endBy: hm(toMin(r.endBy) + s.endBy) } : {}),
    ...(nb && s.notBefore ? { notBefore: { ...r.notBefore, [weekend ? "weekend" : "weekday"]: hm(Math.max(0, toMin(nb) - s.notBefore)) } } : {}),
    ...(r.maxTrip != null && s.maxTrip ? { maxTrip: r.maxTrip + s.maxTrip } : {}) };
  if (breaks({ ...m, rules: loose }, x, minutes)) return null;
  const trip = x.c?.travel?.find((t) => t.id === m.id)?.min;
  const over = Math.max(0, r.endBy ? x.start + minutes - toMin(r.endBy) : 0) + Math.max(0, nb ? toMin(nb) - x.start : 0) + Math.max(0, r.maxTrip != null && trip != null ? trip - r.maxTrip : 0);
  return over > 0 ? over : null;
}
// the stretch marks a member's agent sends: { id: minutes } for the offered times that do not work but could
export function marksFor(m, offered, works, minutes, breaks, withheld = []) {
  const out = {};
  for (const x of offered) if (x.id && !works.includes(x.id) && !withheld.includes(x.id)) { const c = stretchOf(m, x, minutes, breaks); if (c) out[x.id] = c; }
  return out;
}
// marks from another agent: only offered ids, whole minutes from 1 to 120
export const cleanMarks = (d, ids) => Object.fromEntries(Object.entries(d && typeof d === "object" ? d : {}).filter(([k, v]) => ids.has(k) && Number.isInteger(v) && v >= 1 && v <= 120));

// the time to take: every member's agent says it works or marked it; smallest (largest burden + stretch) first, then
// the least stretch in all, then your agent's own order. Returns { x, by: { memberId: minutes } } or null.
export function pickStretched(offered, members, works, marks, now = Date.now(), useLedger = process.env.A2A_STRETCH_LEDGER !== "off") {
  const cands = [];
  for (const [i, x] of offered.entries()) {
    const by = {};
    let ok = true;
    members.forEach((m, k) => { if (works[k].has(x.id)) return; const c = marks[k]?.[x.id]; if (c) by[m.id] = c; else ok = false; });
    if (!ok || !Object.keys(by).length) continue;
    const worst = Math.max(...Object.entries(by).map(([id, c]) => c + (useLedger ? burdenOf(id, now) : 0)));
    cands.push({ x, by, worst, sum: Object.values(by).reduce((a, c) => a + c, 0), i });
  }
  cands.sort((a, b) => a.worst - b.worst || a.sum - b.sum || a.i - b.i);
  return cands[0] ? { x: cands[0].x, by: cands[0].by } : null;
}
