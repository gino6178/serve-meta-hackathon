// A reference change for each benchmark spec, as exact replacements (what write_patch does). They only prove the
// oracles: each oracle fails on the base and passes with its reference (run.mjs --check-oracles). The builder never
// sees this file: the bench builds from a copy of the repository whose base commit leaves the benchmark out.
export default {
  "P-B01": [{ path: "agent/src/club/life.js", old: "let logged = `Logged in the last 7 days: ${sessions} session${sessions === 1 ? \"\" : \"s\"}`;", new: "let logged = sessions ? `Logged in the last 7 days: ${sessions} session${sessions === 1 ? \"\" : \"s\"}` : \"Nothing logged in the last 7 days.\";" }],
  "P-B02": [{ path: "agent/src/club/places.js", old: "      if (r.cite === \"weather\" && !(w && outdoor(p))) return false;", new: "      if (r.cite === \"weather\" && !(w && outdoor(p))) return false;\n      if (String(r.text || \"\").length > 160) return false;" }],
  "P-B03": [{ path: "agent/src/club/places.js", old: "under construction|demolish)/i", new: "under construction|demolish|flooded|puddles?)/i" }],
  "P-B04": [
    { path: "agent/src/club/places.js", old: "limit = 6, onStep = () => {} } = {}) {", new: "limit = 6, indoorOnly = false, onStep = () => {} } = {}) {" },
    { path: "agent/src/club/places.js", old: "  await english(pick);", new: "  if (indoorOnly) pick = pick.filter((p) => !outdoor(p));\n  await english(pick);" },
    { path: "agent/src/agents/autopilot.js", old: 'start: { type: "string", description: "HH:MM" }, reason: { type: "string" } }, required: ["day", "start", "reason"]', new: 'start: { type: "string", description: "HH:MM" }, indoorOnly: { type: "boolean", description: "optional: only indoor or covered places" }, reason: { type: "string" } }, required: ["day", "start", "reason"]' },
    { path: "agent/src/agents/autopilot.js", old: 'async find_places({ day, start = "19:00" }) {', new: 'async find_places({ day, start = "19:00", indoorOnly = false }) {' },
    { path: "agent/src/agents/autopilot.js", old: 'radius: flags.get("places.radius", player || messenger), onStep:', new: 'radius: flags.get("places.radius", player || messenger), indoorOnly, onStep:' },
  ],
  "P-B05": [
    { path: "agent/src/club/life.js", old: "export function upcoming(p, days = 7, now = new Date()) {", new: "export function upcoming(p, days = 7, now = new Date(), maxPerDay) {" },
    { path: "agent/src/club/life.js", old: "  return p.events.filter((e) => at(e) >= from && at(e) < until);", new: "  const n = {};\n  return p.events.filter((e) => at(e) >= from && at(e) < until).filter((e) => !(maxPerDay > 0) || (n[e.date] = (n[e.date] || 0) + 1) <= maxPerDay);" },
  ],
  "P-B06": [
    { path: "agent/src/agents/autopilot.js", old: "(g[k] ||= { day, start: h.start, count: 0, played: [], sports: {} }).count++;", new: "(g[k] ||= { day, start: h.start, count: 0, played: [], sports: {}, last: h.date }).count++;\n    if (h.date > g[k].last) g[k].last = h.date;" },
    { path: "agent/src/agents/autopilot.js", old: "usualMinutes: h.minutes, alreadyTaken: h.taken }))", new: "usualMinutes: h.minutes, alreadyTaken: h.taken, lastPlayed: h.last }))" },
  ],
  "P-B07": [
    { path: "agent/src/club/streak.js", old: "", new: `// weeks in a row with at least one game, Monday to Sunday, counting back from this week (or last, if this week has none yet)
const monday = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
export function streak(history = [], now = new Date()) {
  const weeks = new Set();
  for (const h of history) { const [y, m, d] = String(h.date).split("-").map(Number), at = new Date(y, m - 1, d); if (at <= now) weeks.add(Math.round(monday(at) / 864e5)); }
  let w = Math.round(monday(now) / 864e5);
  if (!weeks.has(w)) w -= 7;
  let n = 0;
  while (weeks.has(w)) { n++; w -= 7; }
  return n;
}
` },
    { path: "agent/src/agents/autopilot.js", old: 'import * as align from "../safety/align.js";', new: 'import * as align from "../safety/align.js";\nimport { streak } from "../club/streak.js";' },
    { path: "agent/src/agents/autopilot.js", old: "return { today: `${DAYS[now.getDay()]} ${ymd(now)}`,", new: "return { today: `${DAYS[now.getDay()]} ${ymd(now)}`, playStreak: streak(hist, now)," },
  ],
};
