// Checks on what the model asks for, after its JSON Schema, and on what an action did (TOOL_CHECKS, on; =off for the
// loop as it was, to compare: test/tool_faults.mjs).
//   - semantic: a value can fit its schema and still be wrong: a date that does not exist ("2026-02-30") or is not in
//     the week, a start outside the player's free windows, an id no tool returned, three members for singles, a sport
//     nobody plays. Each call site says what it checks, with the helpers here.
//   - typed: what was wrong goes back to the model in a fixed vocabulary (KINDS), with the field's name when the field
//     is one of the tool's own parameters, never a value the model wrote: what reaches the next prompt is ours.
//     A refused call gets a bounded retry: the model may repair it twice (Repair@1, Repair@2), then is told to move on.
//   - postconditions: after an action that changes state (a hold, a booking, a cancel, an approval asked, a post, a
//     join), code reads the state back and checks the action took effect. One that did not is a failure, in the loop
//     and in the trace (error.type postcondition_failed), never a success. ToolMaze measured that failures a tool does
//     not report cut the repair rate by 37%.
// After JSONSchemaBench (frameworks enforce different parts of a schema: code checks the reply again whatever the
// server enforced), ReliabilityBench (repair from the error, ReAct-style, fixed 80.9% of faults) and ToolMaze.
import { validate, GAME_SPORTS } from "./schema.js";

export const checksOn = () => process.env.TOOL_CHECKS !== "off";
export const REPAIRS = 2;
// the vocabulary: one fixed sentence each, which is all the model hears about what was wrong
export const KINDS = {
  schema_violation: "the arguments do not fit the tool's parameters",
  unknown_tool: "there is no tool by that name",
  unknown_id: "an id that no tool returned",
  date_out_of_range: "a date that does not exist or is outside the allowed days",
  time_out_of_range: "a start time outside the player's free windows",
  breaks_limit: "a choice the player's rules or limits rule out",
  count_out_of_range: "the wrong number of items",
  unknown_sport: "a sport the club does not play",
  postcondition_failed: "the action reported success but the state did not change",
};
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
// one typed error: { kind, field }. A field is kept only if it is one the caller lists (a tool's parameter names)
export function typed(kind, field = null, fields = null) {
  if (!KINDS[kind]) kind = "schema_violation";
  return { kind, ...(field && FIELD.test(field) && (!fields || fields.includes(field)) ? { field } : {}) };
}
// the line the model reads: kinds and fields only
export const say = (errs) => errs.slice(0, 3).map((e) => `${e.kind}${e.field ? ` (${e.field})` : ""}: ${KINDS[e.kind]}`).join("; ");
// schema.js's messages as typed errors: the top-level field when it is one of the schema's own properties
export function fromSchema(errors, schema) {
  const props = Object.keys(schema?.properties || {});
  return errors.map((e) => {
    if (/^no tool called/.test(e)) return typed("unknown_tool");
    const f = /^\$\.([A-Za-z0-9_]+)/.exec(e)?.[1];
    return typed("schema_violation", f, props);
  });
}
// a tool result for a refused call: the error the loop and the trace read, and the kinds
export function refusal(name, errs, left) {
  const tail = left > 0 ? `Call ${name} again with that fixed (${left} ${left > 1 ? "tries" : "try"} left).` : `Do not call ${name} that way again; take another step.`;
  return { error: `refused ${name}: ${say(errs)}. ${tail}`, kind: errs[0].kind, kinds: errs.map((e) => e.kind), ...(errs[0].field ? { field: errs[0].field } : {}) };
}

// ---- the semantic helpers ---------------------------------------------------------------------------------------
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/, TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
// a date that exists: 2026-02-30 fits the pattern and is not one
export function realDate(s) {
  const m = DATE.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const realTime = (s) => TIME.test(String(s || ""));
export const minutesOf = (s) => { const m = TIME.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
export const knownSport = (s, extra = []) => [...GAME_SPORTS, ...extra].includes(String(s || "").toLowerCase());
// a value against its schema, then the call site's own checks: the typed errors, schema ones first
export function check(schema, value, semantic = null) {
  const errs = validate(schema, value);
  if (errs.length) return fromSchema(errs, schema);
  return semantic ? semantic(value).filter(Boolean) : [];
}

// ---- counts, for the evals and the run report --------------------------------------------------------------------
// every refused call by kind, the repairs (a refused call followed by a call to the same tool that passes: after one
// try, Repair@1, or two, Repair@2), and the postconditions checked and failed
export function tally() {
  return { calls: 0, schema: 0, semantic: 0, refused: {}, open: {}, repair1: 0, repair2: 0, unrepaired: 0, post: { checked: 0, failed: 0 } };
}
export function count(t, name, errs) {
  t.calls++;
  const o = t.open[name];
  if (errs?.length) {
    if (errs.some((e) => e.kind === "schema_violation" || e.kind === "unknown_tool")) t.schema++; else t.semantic++;
    for (const e of errs) t.refused[e.kind] = (t.refused[e.kind] || 0) + 1;
    if (o) { o.tries++; if (o.tries >= REPAIRS) { t.unrepaired++; delete t.open[name]; return 0; } return REPAIRS - o.tries; }
    t.open[name] = { tries: 0 };
    return REPAIRS;
  }
  if (o) { if (o.tries === 0) t.repair1++; t.repair2++; delete t.open[name]; }
  return null;
}
// what a run reports: refused calls still open at the end count as not repaired
export function summary(t) {
  const fixed = t.repair2, opened = fixed + t.unrepaired + Object.keys(t.open).length;
  return { calls: t.calls, schemaRefused: t.schema, semanticRefused: t.semantic, byKind: t.refused, refusedFirst: opened, repair1: t.repair1, repair2: t.repair2,
    repair1Rate: opened ? +(t.repair1 / opened).toFixed(3) : null, repair2Rate: opened ? +(t.repair2 / opened).toFixed(3) : null, postChecked: t.post.checked, postFailed: t.post.failed };
}
