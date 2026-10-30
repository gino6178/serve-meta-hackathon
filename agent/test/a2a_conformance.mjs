// A local gateway for the official A2A conformance tools (not in the default test run): the club members' agents on a
// loopback port, with their own data folder, and the checks this side makes of itself first.
//   node test/a2a_conformance.mjs            serve on 127.0.0.1:8799 (A2A_CONF_PORT) until Ctrl-C
//   node test/a2a_conformance.mjs --check    the self-checks only, then exit (0 when they pass)
//
// The agent under test is one member's agent: http://127.0.0.1:8799/a2a/members/<id>/ (its card at
// .well-known/agent-card.json under it). The token is off here (AGENT_TOKEN is cleared in this process), and the agents
// answer loopback only, so nothing outside this machine reaches them.
//
// a2a-tck (github.com/a2aproject/a2a-tck), the Technology Compatibility Kit, against that URL:
//   git clone https://github.com/a2aproject/a2a-tck && cd a2a-tck
//   uv venv && uv pip install -e .            (or: python -m venv .venv && .venv/bin/pip install -e .)
//   ./run_tck.py --sut-url http://127.0.0.1:8799/a2a/members/leo/ --category mandatory
//   ./run_tck.py --sut-url http://127.0.0.1:8799/a2a/members/leo/ --category all --compliance-report report.json
// (the flags are the kit's README's at the time of writing; read it for the current ones)
//
// a2a-inspector (github.com/a2aproject/a2a-inspector), a web UI that reads the card and sends messages:
//   git clone https://github.com/a2aproject/a2a-inspector && cd a2a-inspector
//   uv sync && (cd frontend && npm install) && bash scripts/run.sh     then open http://127.0.0.1:5001
//   and connect to http://127.0.0.1:8799/a2a/members/leo/
//
// What to expect: the card is signed (JWS over JCS, EdDSA, kid and jku -> /a2a/keys.json) and declares two required
// extensions, /a2a/ext/proposal/v1 and /a2a/ext/hold/v1. A SendMessage that does not name both in A2A-Extensions is
// answered with error -32008 (ExtensionSupportRequiredError), which is what spec 4.6 asks of a required extension; a
// tool that cannot send that header will see its message tests end there. To send one by hand:
//   curl -s http://127.0.0.1:8799/a2a/members/leo/ -H 'content-type: application/json' -H 'A2A-Version: 1.0' \
//     -H 'A2A-Extensions: http://127.0.0.1:8799/a2a/ext/proposal/v1,http://127.0.0.1:8799/a2a/ext/hold/v1' \
//     -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"m1","contextId":"c1","role":"ROLE_USER",
//          "parts":[{"data":{"kind":"serve.hold","action":"hold","ref":"c1","date":"2026-11-05","start":"19:00","minutes":90},"mediaType":"application/json"}]}}}'
// A proposal (serve.proposal) asks the member's model: without LLM_URL pointing at one, its task ends FAILED.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";

const check = process.argv.includes("--check"), PORT = +(process.env.A2A_CONF_PORT || (check ? 0 : 8799));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-a2a-conf-"));
delete process.env.AGENT_TOKEN;
Object.assign(process.env, { A2A_DATA: `${tmp}/a2a`, A2A_FILE: `${tmp}/a2a.json`, BOOKINGS_FILE: `${tmp}/bookings.json`, NEGOTIATIONS_FILE: `${tmp}/neg.json`, LEDGER_FILE: `${tmp}/ledger.jsonl`, TRACE_FILE: `${tmp}/traces.jsonl`,
  MATCH_RECORDS_FILE: `${tmp}/records.json`, MATCH_AUDIT_FILE: `${tmp}/audit.json`, MATCH_DEMO_RECORDS: "0", A2A_TRANSPORT: "", A2A_PEERS_FILE: `${tmp}/peers.json`, A2A_PEER_QUIET: "1",
  ASK_FILE: `${tmp}/asks.json`, STORE_FILE: `${tmp}/players.json`, MEMORY: "off", GUARD: "off" });
const srv = await import("../src/a2a/server.js");
const ext = await import("../src/a2a/ext.js");
const client = await import("../src/a2a/client.js");
const { readClub } = await import("../src/club/club.js");
const server = await new Promise((ok) => { const x = http.createServer((q, r) => srv.handle(q, r)).listen(PORT, "127.0.0.1", () => ok(x)); });
const BASE = `http://127.0.0.1:${server.address().port}`;
process.env.A2A_BASE = process.env.A2A_SELF = BASE;
const m = readClub().members[0], url = `${BASE}/a2a/members/${m.id}/`;

// the self-checks: what the tools will look at first
const send = (h) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "A2A-Version": "1.0", ...h }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage",
  params: { message: { messageId: crypto.randomUUID(), contextId: "conf", role: "ROLE_USER", parts: [{ data: { kind: "serve.hold", action: "hold", ref: "conf", date: "2026-11-05", start: "19:00", minutes: 90 }, mediaType: "application/json" }] } } }) });
const results = [];
const ok = (cond, what) => { results.push(!!cond); console.log(`${cond ? "ok  " : "FAIL"} ${what}`); };
const card = await (await fetch(`${url}.well-known/agent-card.json`)).json();
const h = JSON.parse(Buffer.from(card.signatures?.[0]?.protected || "e30", "base64url").toString("utf8"));
ok(h.alg === "EdDSA" && h.kid && h.typ === "JOSE", "card signed: alg EdDSA, kid, typ JOSE");
ok(h.jku === `${BASE}/a2a/keys.json`, `jku names the key set (${h.jku})`);
ok(await client.verifierFor(BASE)(card).then(() => true, () => false), "the signature checks out against the key at the jku");
const req = (card.capabilities?.extensions || []).filter((e) => e.required).map((e) => e.uri);
ok([ext.PROPOSAL_PATH, ext.HOLD_PATH].every((p) => req.includes(`${BASE}${p}`)), `required extensions declared: ${req.join(", ")}`);
const bare = await (await send({})).json();
ok(bare.error?.code === -32008, `a SendMessage naming none is refused: ${bare.error?.code} ${bare.error?.message || ""}`.slice(0, 160));
const r = await send(ext.header(BASE)), named = await r.json();
ok(named.result?.task && r.headers.get("a2a-extensions") === `${BASE}${ext.HOLD_PATH}`, "naming both: answered, the hold extension activated");

// (the exit code is set and the server closed, not process.exit, which can trip libuv on Windows with sockets open)
if (check) { process.exitCode = results.every(Boolean) ? 0 : 1; server.closeAllConnections(); server.close(() => fs.rmSync(tmp, { recursive: true, force: true })); }
else {
  console.log(`\nmembers' agents at ${BASE}/a2a/agents; the agent under test: ${url}\nCtrl-C to stop.`);
  process.on("SIGINT", () => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); });
}
