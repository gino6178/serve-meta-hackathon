# Serve A2A club — outside-agent trial (new3)

Acting as Chen's external agent (Ed25519-signing, A2A/1.0), HTTP only to `http://127.0.0.1:8899`. ~22 requests.

## What I discovered
- **Discovery works.** `GET /a2a/club.json` → "Riverside-Sports-Club", `protocol:"a2a/1.0"`, 11 members with sports/level/prefers. `GET /a2a/agents` lists each member's agent + card URL. `GET /a2a/keys.json` → one Ed25519 JWK (`kid serve-fdbc86e9a90ad8ee`).
- **Agent cards are real A2A AgentCards.** `GET /a2a/members/<id>/.well-known/agent-card.json` returns name, `supportedInterfaces` (JSONRPC at `/a2a/members/<id>/`), 3 skills (`agree-game-time`, `hold-game-time`, `estimate-yes`), a `serve.likely` extension, and a JOSE signature. `securitySchemes:{}` / `securityRequirements:[]` → **no auth required to talk to members.**
- **Members are explicitly simulated.** Every card: `provider.organization:"Serve demo club (simulated members)"`, description "A simulated member of the demo club." No sign of real, reachable humans via A2A.

## What worked
- **Proposing a game, agent-to-agent, no account.** `SendMessage` with a `data` part `{kind:"serve.proposal", from, sport, format, proposal:{date,start}, choices:[{date,start},…]}`.
  - Kenji → `TASK_STATE_COMPLETED`, artifact `decision` `{intent:"accept"}`, "Kenji can do Sat 31 Oct 10:00." Leo also accepted. Ravi declined ("can't play this week"). Basketball players (ravi, leo, kenji) are reachable and answer.
- **Likelihood estimate.** Kenji `serve.likely` (3 times) → band `"maybe"`, model `likely-lr-20261028`.
- **Hold.** In the SAME context as an accept, `{kind:"serve.hold", action:"hold", ref:<contextId>, date, start, minutes}` → `{held:true, until:…}`; `action:"release"` → `{held:false}`. So an outside agent can propose → get a yes → hold the slot. (No booking/confirm step is exposed over A2A — that is where the chain stops.)

## Problems (ranked, exact)
1. **Card signatures do not verify (trust broken).** Over the published JWK, `crypto.verify` of the JOSE sig fails under JCS, raw `JSON.stringify`, and empty-field-stripped canonicalizations, and under host-substituted variants. An outside agent **cannot authenticate any card** against `/a2a/keys.json`. No signing spec/`documentationUrl` is published to resolve the canonicalization.
2. **No protocol docs anywhere.** 404 on `/.well-known/agent.json`, `/.well-known/agent-card.json`, `/.well-known/serve.json`, `/api/docs`, `/api/a2a`, `/api/members`, `/llms.txt`, `/robots.txt`, `/a2a` (root), `/a2a/agents/<id>`, and `/` (body `{"error":"not found"}`). Schemas are discoverable only by trial-and-error from validator errors (e.g. `$.proposal.minutes: not allowed`, venue regex `^[A-Za-z0-9_:./-]{1,128}$`).
3. **Method naming is non-standard A2A.** Only TitleCase `SendMessage`/`GetTask`/`ListTasks` work; canonical `message/send` → `-32601 Invalid method`. Breaks off-the-shelf A2A clients.
4. **Hold schema is fiddly / mismatched.** Card example says "Hold … for 90 minutes" but a bare hold fails `$.action/$.ref` then `$.date/$.start/$.minutes`; `ref` must be the **contextId**, not the task id (a task-id ref → "a hold belongs to its own talk"). Hold only works as a fresh message in the context, not by modifying the completed task (`-32004` terminal state).
5. **No geo/venue use.** Chen's location (25.052,121.52, Taipei) is irrelevant: no venue endpoint (`/api/venues`,`/api/places` 404), proposals reject `venue` free-text, and members are a fixed demo club regardless of distance. `/api/status` shows `players:0`, LLM not ready, messenger disabled.

## What an interoperable agent would need
A published A2A card-signing/canonicalization spec (so sigs verify) + a `documentationUrl`, the `serve.proposal`/`serve.hold` JSON schemas, standard `message/send` method aliases, and a booking/confirm endpoint to close the loop. Real (non-simulated) members would need to be reachable, which this demo club does not offer.
