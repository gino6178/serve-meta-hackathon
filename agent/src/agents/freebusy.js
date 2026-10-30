// Free or busy, never the calendar. With private calendars (safety/privacy.js) the code that plans for one player (the
// Match helper's daily ask, the planner's find_partners and its check before a talk, the play search, best match)
// does not read another member's free times: it asks that member's agent "is your member free on <date> at <start>
// for <minutes>?", and the member's agent answers yes or no from its own calendar. Each answer is charged to the same
// rolling ledger as the talks' disclosure budget (safety/disclosure.js): an hour of the week ("Thu 19") told to one
// asker about one member counts once in the window, whatever the date, so walking new dates buys nothing new, and past
// the budget (A2A_BUDGET_CELLS per asker, A2A_BUDGET_MEMBER_CELLS per member, in A2A_BUDGET_DAYS) the answer is no and
// the refusal is counted. Without private calendars it reads the shared calendar, as before.
// Within one gateway this is a boundary in code and a budget, not cryptography (the asker and the member's agent share
// the process); a member on another gateway is asked over A2A in the talk itself, and its calendar never leaves it.
import { ledger, cellOf, createLedger, useLedger, settings } from "../safety/disclosure.js";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

// the asker's side: each new hour of the week asked about is granted (or not) by the member's ledger; the answer is
// worked out first so the ledger can keep it for its inference check, but never decides the grant
let count = { asked: 0, refused: 0 };
export function free(m, { date, start, minutes = 90, asker = "you", priv = false, now = Date.now() } = {}) {
  const st = toMin(start);
  if (!priv) return answer(m, date, st, minutes);
  const v = answer(m, date, st, minutes), id = `${date} ${st}`;
  const g = ledger().grant(m.id, asker, [{ id, cell: cellOf(date, st), v }], now);
  if (!g.allowed.has(id)) { count.refused++; return false; }
  count.asked++;
  return v;
}
// the date of the next `day` (Mon..Sun) from now, for callers that know only the weekday
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dateFor = (day, now = new Date()) => { for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() + i); if (DAYS[d.getDay()] === day) return ymd(d); } return null; };
export const probes = () => ({ ...count, budget: settings().cells });
// (for the tests: a fresh, in-memory ledger, shared with the talks as before)
export const resetProbes = () => { useLedger(createLedger()); count = { asked: 0, refused: 0 }; };
