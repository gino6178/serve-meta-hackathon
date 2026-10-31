# Serve live read-only check: https://play.theminimallab.com

Method: GET requests only, header `x-tester: live-reader` on every request, no sign-in, no POST. 31 HTTP requests in total. Local checks (hash and signature recomputation, base64 decoding, grep of saved files) made no requests. Raw saved responses are in `.../scratchpad/trial39/raw/`.

## Against the five checks

| # | Check | Result |
|---|---|---|
| 1 | /api/status shows only "up", nothing internal | Mostly holds (no model names, hosts, ports, queue sizes, paths). Two small items, see MINOR-1 and BUG-2. |
| 2 | Every URL in the agent directory and cards is the public address | REFUTED. See BUG-1. The directory /a2a/agents is fine; the 11 member cards are not. |
| 3 | Privacy text explains every piece of data an agent shares, including the likelihood band | Band is explained. Other shared data is not, see BUG-3 and MINOR-3. |
| 4 | Signed-out visitor sees no real member, exact location, or private club/game | No violation found. Gated routes refuse anonymous readers. All names are labelled simulated. See BUG-3 for shared preference data. |
| 5 | Published rules agree with each other and with endpoints | Not all. See BUG-2 and MINOR-2 to MINOR-5. |

## BUG-1: member agent cards point at 127.0.0.1 (check 2 refuted)

Request: `GET https://play.theminimallab.com/a2a/members/hana/.well-known/agent-card.json` (same for ravi, tomas, yuki, aisha, leo, noor, sam, ines, kenji, priya; all 11 fetched, all 200).

Response excerpt:
```
"supportedInterfaces":[{"url":"http://127.0.0.1:8790/a2a/members/hana/","protocolBinding":"JSONRPC","tenant":"","protocolVersion":"1.0"}],
...
{"uri":"http://127.0.0.1:8790/a2a/ext/likely/v1","description":"Answers serve.likely ...","required":false,...}
```
The JWS protected header decodes to `{"alg":"EdDSA","kid":"serve-154b42d3033d680e","typ":"JOSE","jku":"http://127.0.0.1:8790/a2a/keys.json"}`.

All 11 cards carry the same three 127.0.0.1:8790 addresses (the JSON-RPC interface, the `likely` extension URI, and the `jku` key location). The directory is correct: `GET /a2a/agents` lists `https://play.theminimallab.com/a2a/members/<id>/.well-known/agent-card.json`, and `/llms.txt` says the A2A addresses are on the public site. A client that follows `supportedInterfaces.url` or `jku` from outside the server cannot reach them. The `likely` extension URI is also a loopback address, so a client cannot fetch that extension description either.

## BUG-2: /llms.txt says /api/status reports member count; it does not

Request: `GET https://play.theminimallab.com/api/status`

Response (verbatim):
```
{"health":true,"llm":{"ready":true},"reel":true,"reelEffects":true}
```

/llms.txt, Rules section: `- GET /api/status says how many members this server has.` The response has no member count. The OpenAPI entry for /api/status says only "Is the server up". So the published guide describes a field that does not exist. Separately, the response exposes `llm.ready` and `reel`/`reelEffects` flags. These are not in the fix's list (model names, hosts, ports, queue sizes, paths), so I count them as MINOR-1, not as a leak.

## BUG-3: anonymous club directory publishes members' level and play preferences; privacy text says preferences are used only by the member's agent

Request: `GET https://play.theminimallab.com/a2a/club.json` (no session)

Response excerpt:
```
{"kind":"serve.club","name":"Riverside-Sports-Club","title":"Riverside Sports Club",...,"members":[
{"id":"hana","name":"Hana Chen","level":"B","sports":["badminton","tennis"],"prefers":"doubles"},
{"id":"yuki","name":"Yuki Sato","level":"A","sports":["badminton","tennis"],"prefers":"singles"}, ...
```

Conflicts:
- /privacy.txt, "How you like to play": "...your limits, your answers. Only your agent uses them."
- /llms.txt: "agents also see member ids ..., never your area or preferences" (that line is about the agent channel, but the promise is the same).
- `level` (A/B/C) appears in no published text. The privacy file does not list it.

The members are simulated, so no real person is exposed. The published contract is still broken for every member: a signed-out reader sees each member's level, sports and preferred format.

## MINOR

- MINOR-1: /api/status returns `llm.ready`, `reel` and `reelEffects` to an anonymous reader. Those are feature and backend state, not gateway-up only.
- MINOR-2: Likelihood budget unit mismatch. /privacy.txt says the band is "counted against the same budget of hours". The member cards' `likely` extension says `"budget":{"perAskerDay":4,"perAskerWeek":10,"perMemberWeek":40}` and `/llms.txt` says "a few estimates a day". The card also publishes the band thresholds (unlikely 0 to 0.15, maybe 0.15 to 0.35, likely 0.35 to 0.6, very likely 0.6 to 1). Privacy gives neither the thresholds nor the budget in estimates.
- MINOR-3: Trust record naming drift. /privacy.txt: "agent keeps its word" / "agent new". /llms.txt: "agent right". The /llms.txt Rules section also says an agent under 80% of its yeses "can't answer for its person", which privacy.txt does not mention.
- MINOR-4: `GET /api/trust/chain` returns `"heads": []`, while the OpenAPI entry says it returns "signed daily heads". The head is only in the `"today"` field and in `/api/trust/verify`.
- MINOR-5: The public card's bearer scheme description names an internal variable: `"The gateway's token (AGENT_TOKEN), as Authorization: Bearer <token>."` The variable name is public; no value is shown.

## Checked and fine

- Gated routes refuse anonymous reads with a sign-in message, not data: `GET /api/feed`, `/api/clubs?lat=25.031&lon=121.536`, `/api/huddle/places?sport=tennis`, `/api/huddle/today`, `/api/me` all return 401 `{"error":"Sign in first.",...}`.
- `GET /api/invite?id=x` returns 404 `{"error":"That game is not open any more."}`. `GET /api/clubs/invite?code=x` returns 404. Neither leaks anything.
- `GET /api/auth/providers` returns `{"facebook":false,"instagram":false,"demo":true}`. The root page and /llms.txt mention Facebook and Instagram sign-in as options that are off here, so this is consistent.
- `/.well-known/agent-card.json` url, provider, and links all use https://play.theminimallab.com. `/a2a/agents` lists only public card URLs.
- No 127.0.0.1, localhost or LAN address appears in `/`, `/llms.txt`, `/privacy.txt`, `/api/openapi.json`, `/a2a/keys.json`, or `/a2a/club.json`. The only ones are in the member cards (BUG-1).
- Trust chain: I recomputed each entry hash as sha256(JSON.stringify([n, at, kind, who, d, prev])). Entries 0 to 2 match, and each `prev` links to the one before. The head `serve-trust-head:2026-10-31:3:e0d3...` verifies with the Ed25519 key from `/a2a/keys.json` (kid `serve-154b42d3033d680e`).

## Not verified

- Agent card JWS. /llms.txt says to verify it per A2A 8.4 (drop empties, JCS, check EdDSA against the key with that kid). With my canonicalization variants, the signature did not verify for any of the 11 cards, including after swapping the loopback URL for the public one. I could not tell whether this is my canonicalization or the signing, so I do not count it. Someone with a known-good verifier should check it.
- Real members, private clubs, or game posts: I had no ids for these, so I could not test them. The published member names are labelled as simulated.

## Requests (31)

1. GET / 2. GET /llms.txt 3. GET /.well-known/agent-card.json 4. GET /a2a/agents 5. GET /api/status 6. GET /llms.txt 7. GET /privacy.txt 8. GET /api/openapi.json 9. GET /a2a/keys.json 10. GET /api/auth/providers 11. GET /api/trust/verify 12. GET /api/trust/chain 13-23. GET /a2a/members/{hana,ravi,tomas,yuki,aisha,leo,noor,sam,ines,kenji,priya}/.well-known/agent-card.json 24. GET /a2a/club.json 25. GET /api/feed 26. GET /api/clubs?lat=25.031&lon=121.536 27. GET /api/huddle/places?sport=tennis 28. GET /api/huddle/today 29. GET /api/me 30. GET /api/invite?id=x 31. GET /api/clubs/invite?code=x

VERDICT: 3 BUG
