// A stand-in for the model server (Ollama's /api/chat), for tests that check the gateway's own logic, not the model:
// it answers at once and the same way every time. A member's decision (a reply in the MEMBER_REPLY schema) is a yes,
// with every listed time in its "works"; any other reply is a plain sentence (which the gateway's checks may reject,
// and then its rules or templates speak, as they would for a real model). It counts what it was asked.
// An Autopilot turn (a request with tools) gets the next tool call from a fixed plan, read off the tool results so
// far (autopilotTurn): the open usual times in order, find_partners for each, negotiate with its candidates one at a
// time, request_approval once the week's games are agreed (or nudge when nothing was), then finish. So the same week
// gives the same calls, turn by turn, which is what the crash test compares a resumed run with.
import http from "node:http";

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
// the tool calls so far with their results, in order
function history(messages) {
  const calls = [], out = [];
  for (const m of messages) {
    if (m.role === "assistant") for (const c of m.tool_calls || []) calls.push({ name: c.function?.name, args: typeof c.function?.arguments === "string" ? parse(c.function.arguments) || {} : c.function?.arguments || {} });
    else if (m.role === "tool") { const c = calls[out.length] || { name: m.tool_name, args: {} }; out.push({ ...c, name: m.tool_name || c.name, res: parse(m.content) || {} }); }
  }
  return out;
}
export function autopilotTurn(messages) {
  const h = history(messages), last = (n) => [...h].reverse().find((x) => x.name === n);
  const call = (name, args = {}) => [{ function: { name, arguments: { ...args, reason: args.reason || `the plan's next step: ${name}` } } }];
  if (h.some((x) => x.name === "request_approval" && x.res.sent) || h.some((x) => x.name === "nudge" && x.res.sent)) return call("finish", { summary: "Your week is lined up and waits for your yes." });
  const week = h.find((x) => x.name === "get_week")?.res;
  if (!week) return [...call("get_week"), ...call("check_limits")];
  const wins = h.filter((x) => x.name === "negotiate" && x.res.agreed), used = new Set(wins.map((x) => x.args.day));
  const asked = (n) => h.filter((x) => x.name === n && !x.res.error).length;
  if ((week.stillNeeded || 0) - wins.length <= 0) return asked("request_approval") ? call("finish") : call("request_approval");
  const times = [...(week.habitualTimes || []).filter((t) => !t.alreadyTaken), ...(week.otherFreeTimes || [])];
  for (const t of times) {
    if (used.has(t.day)) continue;
    const fp = [...h].reverse().find((x) => x.name === "find_partners" && x.args.day === t.day && x.args.start === t.start);
    if (!fp || (fp.res.summary && !fp.res.candidates)) return call("find_partners", { day: t.day, start: t.start, format: "singles" });
    if (fp.res.error || !fp.res.candidates) continue;
    const tried = new Set(h.filter((x) => x.name === "negotiate" && x.args.day === t.day).flatMap((x) => x.args.members || []));
    const next = fp.res.candidates.slice(0, 2).find((c) => !tried.has(c.id));
    if (next) return call("negotiate", { members: [next.id], day: t.day, start: t.start, format: "singles" });
  }
  // nothing left to try: ask about what was agreed, or tell the player
  if (wins.length) return call("request_approval");
  return asked("nudge") ? call("finish") : call("nudge", { text: "Nothing fit this week." });
}

// Fault injection (faults: { schema, semantic, seed }, test/tool_faults.mjs): each call to find_partners, negotiate or
// find_places the plan asks for is, at those rates (seeded), sent with arguments that break the tool's schema or that
// fit it but are wrong. A refused call and its result are taken out of the history before the plan is read again, so
// the plan asks for the same call again: a repair, itself faulty at the same rates. Every faulty call is logged with
// what came of it (refused or run) and every chain of retries with the try that came through, from the tool results
// the gateway sent back, so the counts are the model's, not the gateway's own.
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const FAULTY = ["find_partners", "negotiate", "find_places"];
const SCHEMA_FAULTS = [
  ["missing day", (a) => { const { day, ...x } = a; return x; }],
  ["format not in enum", (a, n) => (n === "find_places" ? { ...a, start: 1900 } : { ...a, format: "triples" })],
  ["start a number", (a) => ({ ...a, start: 1900 })],
  ["members a string", (a, n) => (n === "negotiate" ? { ...a, members: String(a.members?.[0] || "x") } : { ...a, day: ["Mon"] })],
];
const SEMANTIC_FAULTS = [
  ["day that does not exist", (a) => ({ ...a, day: "Someday" })],
  ["start outside the free windows", (a) => ({ ...a, start: "04:00" })],
  ["start not HH:MM", (a) => ({ ...a, start: "7pm" })],
  ["member id nobody returned", (a, n) => (n === "negotiate" ? { ...a, members: ["ghost-1"] } : n === "find_partners" ? { ...a, leaveOut: ["ghost-2"] } : { ...a, day: "Someday" })],
  ["wrong number of members", (a, n) => (n === "negotiate" ? { ...a, members: [...(a.members || []), a.members?.[0] === "hana" ? "ravi" : "hana"] } : { ...a, start: "04:00" })],
];
function faultyTurn(messages, state) {
  const { log, chains, rand, rates } = state;
  // what came of the faulty calls so far: their results are in the history
  const pending = new Map(log.filter((f) => f.outcome == null).map((f) => [f.tag, f]));
  const keep = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.tool_calls?.length) { keep.push(m); continue; }
    const results = [];
    for (let k = i + 1; k < messages.length && messages[k].role === "tool" && results.length < m.tool_calls.length; k++) results.push(messages[k]);
    const drop = new Set();
    m.tool_calls.forEach((c, k) => {
      const a = typeof c.function?.arguments === "string" ? parse(c.function.arguments) || {} : c.function?.arguments || {};
      const tag = /#f(\d+)$/.exec(a.reason || "")?.[1];
      const res = parse(results[k]?.content || "") || {};
      const f = tag && log[+tag];
      if (f && f.outcome == null) {
        f.outcome = res.error ? "refused" : "run"; f.typed = !!res.kind; f.echoed = /Someday|7pm|04:00|ghost-|triples/.test(String(res.error || "")); pending.delete(tag);
        // (a faulty call that ran ends its chain unrepaired: nothing told the model it was wrong)
        const ch = chains.get(f.chain); if (!res.error && ch && !ch.done) { ch.done = true; ch.ranThrough = true; }
      }
      // a refused faulty call leaves the history, so the plan asks for the same call again
      if (f && res.error) drop.add(k);
    });
    const calls = m.tool_calls.filter((_, k) => !drop.has(k));
    if (calls.length) keep.push({ ...m, tool_calls: calls });
    results.forEach((r, k) => { if (!drop.has(k)) keep.push(r); });
    i += results.length;
  }
  const out = autopilotTurn(keep);
  return out.map((c) => {
    const name = c.function.name, args = c.function.arguments, key = JSON.stringify([name, { ...args, reason: "" }]);
    const ch = chains.get(key);
    if (!FAULTY.includes(name)) return c;
    const r = rand(), kind = r < rates.schema ? "schema" : r < rates.schema + rates.semantic ? "semantic" : null;
    // (a chain is open while its last faulty call was refused: a clean call now is its repair)
    if (!kind) { if (ch && !ch.done) { ch.done = true; ch.repairedAfter = ch.tries; } state.clean++; return c; }
    const list = kind === "schema" ? SCHEMA_FAULTS : SEMANTIC_FAULTS, [what, f] = list[Math.floor(rand() * list.length)];
    const tag = log.length, bad = { ...f(args, name), reason: `${args.reason} #f${tag}` };
    log.push({ tag, kind, what, name, outcome: null, retry: !!(ch && !ch.done), chain: key });
    if (ch && !ch.done) ch.tries++; else { const c = { tries: 0, done: false, first: tag, kind, what, name }; chains.set(key, c); state.all.push(c); }
    return { function: { name, arguments: bad } };
  });
}

// (stallAfter: from that Autopilot turn on, it calls no tool, as a model that stalls; the rules then finish the run)
export async function fakeModel({ delayMs = 0, stallAfter = Infinity, faults = null } = {}) {
  const asked = { decisions: 0, other: 0, turns: 0, decisionPrompts: [] };
  const fs0 = faults ? { log: [], chains: new Map(), all: [], rand: rng(faults.seed || 1), rates: { schema: faults.schema || 0, semantic: faults.semantic || 0, reply: faults.reply || 0 }, clean: 0, reply: { faults: 0, retries: 0, repaired: 0, again: 0, open: 0 } } : null;
  if (fs0) asked.faults = fs0;
  const srv = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", async () => {
      const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.url.startsWith("/api/version")) return send({ version: "fake" });
      if (req.url.startsWith("/api/ps") || req.url.startsWith("/api/tags")) return send({ models: [{ name: "muse-glimmer:latest", model: "muse-glimmer:latest" }] });
      if (req.url.endsWith("/models")) return send({ data: [{ id: "muse-glimmer" }] });
      let j = {};
      try { j = JSON.parse(b || "{}"); } catch { /* empty */ }
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const text = (j.messages || []).map((m) => m.content).join("\n");
      let content = "", tool_calls;
      if (j.tools?.length) { asked.turns++; tool_calls = asked.turns > stallAfter ? undefined : fs0 ? faultyTurn(j.messages || [], fs0) : autopilotTurn(j.messages || []); }
      else if (j.format?.properties?.intent) {
        asked.decisions++; asked.decisionPrompts.push(text.slice(0, 200));
        let v = { intent: "accept", date: "", start: "", works: [...new Set(text.match(/\bt\d{1,2}(?=:)/g) || [])] };
        // (faults.reply: a member's answer that fits MEMBER_REPLY but is wrong, a works id nobody listed or a counter on
        // a date that does not exist; an answer asked again after one is counted as a repair when it comes back clean)
        const R = fs0?.rates.reply ? fs0.reply : null, retry = /^That (answer was refused|does not fit)/.test(String(j.messages?.at(-1)?.content || ""));
        if (R) {
          if (retry) R.retries++;
          if (fs0.rand() < fs0.rates.reply) { v = fs0.rand() < 0.5 ? { ...v, works: [...v.works, "t77"] } : { intent: "counter", date: "2026-02-30", start: "19:00", works: v.works }; R.faults++; if (retry) R.again++; R.open++; }
          else if (retry && R.open) { R.repaired++; R.open--; }
        }
        content = JSON.stringify(v);
      } else { asked.other++; content = "Sounds good."; }
      send({ model: j.model, message: { role: "assistant", content, ...(tool_calls ? { tool_calls } : {}) }, done: true, done_reason: "stop", prompt_eval_count: Math.ceil(text.length / 4), prompt_eval_cached_count: 0, eval_count: Math.ceil((content.length + JSON.stringify(tool_calls || "").length) / 4), eval_duration: 1e6 });
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${srv.address().port}/v1`, asked, close: () => srv.close() };
}
