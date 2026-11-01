// An outside agent on Muse Spark (Meta Model API) that uses Serve the way any person's agent would: it reads
// /llms.txt, then calls Serve's HTTP API with two tools until the task is done. Nothing here is special to Serve's own
// code: it is what Claude Code or Codex do with the same page, on Meta's model.
//   META_API_KEY=<key> node agent/tools/muse_agent.mjs "Get me a badminton game Tuesday evening near Daan, Taipei"
//   SERVE_URL (default https://play.theminimallab.com), MUSE_MODEL (default muse-spark-1.3), MUSE_URL, STEPS (default 24)
// The tools only reach SERVE_URL, and the session Serve gives back stays in this process (sent as x-serve-session).
const BASE = (process.env.SERVE_URL || "https://play.theminimallab.com").replace(/\/$/, "");
const API = (process.env.MUSE_URL || "https://api.meta.ai/v1").replace(/\/$/, ""), MODEL = process.env.MUSE_MODEL || "muse-spark-1.3", KEY = process.env.META_API_KEY;
const task = process.argv.slice(2).join(" ") || "Get me a badminton game for 4 on a weekday evening near Daan District, Taipei, at most NT$150 each.";
if (!KEY) { console.error("Set META_API_KEY (a Meta Model API key)."); process.exit(1); }
let session = null;

const tools = [
  { type: "function", function: { name: "serve_get", description: "GET a path on Serve, for example /llms.txt or /api/huddle/today. Returns the status and the body.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "serve_post", description: "POST a JSON body to a path on Serve, for example /api/auth/demo or /api/huddle/start. Returns the status and the body.", parameters: { type: "object", properties: { path: { type: "string" }, body: { type: "object" } }, required: ["path"] } } },
];
async function call(name, { path = "/", body } = {}) {
  if (!/^\/[\w\-./?=&%:@,]*$/.test(path)) return { error: "path must start with / and stay on Serve" };
  const r = await fetch(BASE + path, { method: name === "serve_post" ? "POST" : "GET", headers: { "content-type": "application/json", ...(session ? { "x-serve-session": session } : {}) }, ...(name === "serve_post" ? { body: JSON.stringify(body || {}) } : {}), signal: AbortSignal.timeout(60000) });
  const text = await r.text();
  try { const j = JSON.parse(text); if (j.session) session = j.session; return { status: r.status, body: j.session ? { ...j, session: "(kept by the tool, sent for you)" } : j }; } catch { return { status: r.status, body: text.slice(0, 12000) }; }
}

const messages = [
  { role: "system", content: `You are a person's own agent. You use Serve (${BASE}) for them through two tools. Start by reading /llms.txt and follow it. Never invent a reply from Serve. When a game is agreed or nothing more can be done, stop calling tools and tell the person in a few plain sentences what happened and what they need to do (for example, say yes).` },
  { role: "user", content: task },
];
for (let step = 0; step < +(process.env.STEPS || 24); step++) {
  const r = await fetch(`${API}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, messages, tools, reasoning_effort: "low", max_completion_tokens: 2000 }) });
  if (!r.ok) { console.error(`Meta Model API ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  const m = (await r.json()).choices?.[0]?.message || {};
  messages.push({ role: "assistant", content: m.content || "", ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) });
  if (!m.tool_calls?.length) { console.log(`\n${MODEL}: ${m.content}`); process.exit(0); }
  for (const c of m.tool_calls) {
    let args = {}; try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* empty */ }
    const out = await call(c.function.name, args).catch((e) => ({ error: String(e.message || e) }));
    console.log(`→ ${c.function.name} ${args.path}${args.body ? ` ${JSON.stringify(args.body)}` : ""}  [${out.status ?? out.error}]`);
    messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, 16000) });
  }
}
console.log("Stopped after the step limit.");
