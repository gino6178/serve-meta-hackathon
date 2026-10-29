// Free or busy, never the calendar. With private calendars (safety/privacy.js) the code that plans for one player (the
// Match helper's daily ask, the planner's find_partners and its check before a talk, the play search, best match)
// does not read another member's free times: it asks that member's agent "is your member free on <date> at <start>
// for <minutes>?", and the member's agent answers yes or no from its own calendar. One asker may ask about one member
// at most A2A_PROBE_BUDGET (24) different times a day, so a week can't be read back hour by hour: past the budget the
// answer is no, and the refusal is counted. Without private calendars it reads the shared calendar, as before.
// Within one gateway this is a boundary in code and a budget, not cryptography (the asker and the member's agent share
// the process); a member on another gateway is asked over A2A in the talk itself, and its calendar never leaves it.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const budget = () => Math.max(0, +(process.env.A2A_PROBE_BUDGET ?? 24));
const toMin = (t) => (typeof t === "number" ? t : (([h, m]) => +h * 60 + +(m || 0))(String(t).split(":")));
const dayOf = (date) => new Date(`${date}T12:00:00`).getDay();

// the member's agent's side: it alone reads its member's windows (reading() is true only while it does, for the tests)
let inside = false;
export const reading = () => inside;
function answer(m, date, start, minutes) {
  inside = true;
  try {
    const d = dayOf(date);
    return (m.free || []).some((w) => { const x = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return x && DAYS.indexOf(x[1]) === d && +x[2] * 60 <= start && start + minutes <= +x[3] * 60; });
  } finally { inside = false; }
}

// the asker's side: asked[asker|member|date] = the times asked about; a time asked again costs nothing
let asked = new Map(), count = { asked: 0, refused: 0 };
export function free(m, { date, start, minutes = 90, asker = "you", priv = false } = {}) {
  const st = toMin(start);
  if (!priv) return answer(m, date, st, minutes);
  const k = `${asker}|${m.id}|${date}`, seen = asked.get(k) || new Set();
  if (!seen.has(st)) {
    if (seen.size >= budget()) { count.refused++; return false; }
    seen.add(st); asked.set(k, seen); count.asked++;
  }
  return answer(m, date, st, minutes);
}
// the date of the next `day` (Mon..Sun) from now, for callers that know only the weekday
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dateFor = (day, now = new Date()) => { for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() + i); if (DAYS[d.getDay()] === day) return ymd(d); } return null; };
export const probes = () => ({ ...count, budget: budget() });
export const resetProbes = () => { asked = new Map(); count = { asked: 0, refused: 0 }; };
