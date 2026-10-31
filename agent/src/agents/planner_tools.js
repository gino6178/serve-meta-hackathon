// The planner's tool list, cut to what the week can use, and a nudge out of a loop. After TokenEconomizer (Microsoft,
// 2026: tools left unused across sessions are pruned, and a turn stuck repeating a failure gets one redirect note,
// 18 to 31% lower cost for coding agents). Every tool's schema is read again on every step of the planner's loop, so
// a tool the week cannot use costs its tokens at every step.
//   - pruning (PLANNER_PRUNE, on unless "off"): by what code knows of this run (the week and the body are read by code
//     before the first step, a court near a club only matters outdoors or once no club court was free, memory only
//     when there are notes, approval only once a game is agreed), and by use: a tool no run used in the last 10 runs
//     is left out until something needs it. Nothing a tool can do is lost: a tool comes back the moment its rule holds.
//   - loops (PLANNER_LOOPS, on unless "off"): the same call failing twice, or three failed calls in a row, gets one
//     note naming what is not working and the next steps that are open, at most twice a run. Code decides; no model.
import path from "node:path";
import { readJSON, writeJSON } from "../core/jsonfile.js";

export const pruneOn = () => process.env.PLANNER_PRUNE !== "off";
export const loopsOn = () => process.env.PLANNER_LOOPS !== "off";
const FILE = () => path.resolve(process.env.PLANNER_TOOLS_FILE || "data/planner_tools.json");
const WINDOW = 10;

// the tools the planner may call now. ctx: { pre: code read the week and the body, outdoor, courtFailed, notes,
// agreed, used: the tools this run called so far }
export function offered(tools, ctx = {}) {
  if (!pruneOn()) return tools;
  const recent = history().slice(-WINDOW), usedLately = new Set(recent.flat());
  const need = {
    get_week: true, // cheap, and read again after a booking changes the week
    check_limits: !ctx.pre,
    find_places: !!(ctx.outdoor || ctx.courtFailed),
    find_partners: true, negotiate: true,
    recall: !!ctx.notes,
    request_approval: (ctx.agreed || 0) > 0,
    nudge: (ctx.agreed || 0) === 0,
    finish: true,
  };
  return tools.filter((t) => {
    const n = t.function.name;
    if (need[n] === false) return false;
    // by use: only once there are enough runs to judge, and never the core of the loop
    if (recent.length >= WINDOW && !usedLately.has(n) && !["find_partners", "negotiate", "finish", "request_approval", "nudge"].includes(n) && !(ctx.used || new Set()).has(n) && !(n === "find_places" && ctx.courtFailed)) return false;
    return true;
  });
}

// the tools each run called, newest last (kept for the last 50 runs)
function history() { const h = readJSON(FILE(), { runs: [] }); return Array.isArray(h.runs) ? h.runs : []; }
export function noteRun(used) { const runs = [...history(), [...used]].slice(-50); writeJSON(FILE(), { runs }); }
export const forgetRuns = () => writeJSON(FILE(), { runs: [] });

// a failed call, in a form that compares: the tool and its arguments, without the reason the model gives
export const signature = (name, args = {}) => `${name} ${JSON.stringify(Object.fromEntries(Object.entries(args || {}).filter(([k]) => k !== "reason").sort(([a], [b]) => a.localeCompare(b))))}`;
export const failed = (name, res) => !!(res && (res.error || res.refused || (name === "negotiate" && !res.agreed)));

// watches the calls of one run and says when to step in
export function loopWatch({ max = 2 } = {}) {
  const seen = new Map();
  let streak = 0, notes = 0;
  return {
    // after each call: returns a note to give the model, or null
    after(name, args, res) {
      if (!loopsOn() || notes >= max) return null;
      if (!failed(name, res)) { streak = 0; return null; }
      streak++;
      const sig = signature(name, args), n = (seen.get(sig) || 0) + 1;
      seen.set(sig, n);
      if (n < 2 && streak < 3) return null;
      notes++; streak = 0;
      const what = n >= 2 ? `${name} with the same arguments has failed ${n} times` : "the last three calls failed";
      return `This is not working: ${what}. Do not repeat it. Take another candidate or the next habitual time (get_week's otherFreeTimes when those run out); if games are already agreed, request_approval; if nothing can be agreed, nudge the player and finish.`;
    },
    get notes() { return notes; },
  };
}
