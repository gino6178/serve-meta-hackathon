# Olivia's agent: trial40 report (local copy, http://localhost:8898, header x-tester: olivia)

Scripts and captured responses are in trial40/olv/ (req.mjs signs agent-channel requests with Ed25519; kid serve-c8597c9ffad45f9b, now revoked and deleted).

## Timeline (local clock, 31 Oct 2026)

| Time | Step |
|---|---|
| 21:38 | GET /, GET /llms.txt read |
| 21:38 | Demo sign-in as "Olivia Test" (member de-8846f3a74f3f) |
| 21:38 | Home, sport, limits set; delegation on |
| 21:39 | Agent key registered (ag-6a917a7725be) |
| 21:39 | INVITE seen in state.txt; club joined (asked), admitted about 21:40:28 |
| 21:41 | BEN_IN seen |
| 21:42 | Game pmvwg6ikb7e1e2de4 checked over the key, then yes sent |
| 21:42 | FULL appended |
| 21:43 | Loosening attempts refused |
| 21:49 | LILY_LEFT seen |
| 21:50 | Revoked; signed request refused |
| 21:50 | Club left, account deleted |

## Step 1: setup

Request: `POST /api/huddle/home {"lat":25.0330,"lon":121.5654}`, `POST /api/huddle/sports {"sports":["badminton"]}`, `POST /api/huddle/limits {"windows":[{"days":["Mon","Tue","Wed","Thu","Fri"],"from":"18:00","to":"22:00"}],"maxKm":5,"maxEach":150}`.

Response to limits: `"limitKm":5,"limitEach":150,"priceCap":150`, learned: "Set: only Mon/Tue/Wed/Thu/Fri 18:00–22:00, within 5 km, at most NT$150 each. Nothing outside that is ever agreed."

`POST /api/huddle/delegate {"on":true,"maxEach":150,"newPeople":false}` returned `{"on":true,"maxEach":150,"newPeople":false,...}`.

Key registration: `POST /api/members/agents {"name":"Olivia's agent","jwk":{"kty":"OKP","crv":"Ed25519","x":"mxBq97..."}}` returned agent `ag-6a917a7725be`, kid `serve-c8597c9ffad45f9b`, revoked false. `GET /api/agent-channel/me` with a signed request returned the member and agent correctly.

## Step 2: club

`POST /api/clubs/join {"code":"<code>"}` returned club "Lily's Thursday doubles" (private), `asked: true`, note: "Asked. It's a private club, so the organiser says yes or no, and you'll be told." Admitted on a later poll: `GET /api/clubs` showed `joined: true`, names Lily, Ben, Mia, You.

## Step 3: the game

Agent-channel `GET /api/agent-channel/huddle/today` card for Lily's game:
`{"post":"pmvwg6ikb7e1e2de4","agentMay":{"ok":true},"host":"Lily","hostTrust":{"show":"shows up likely 87-100%","agent":"agent keeps its word","level":"good"},"gate":null,"date":"2026-11-05","start":"19:00","where":"Daan Sports Center","left":1,"km":2.3,"each":100,"club":"Lily's Thursday doubles"}`. Fits limits (Thursday, 19:00, 2.3 km, NT$100).

`POST /api/agent-channel/huddle/game {"post":"pmvwg6ikb7e1e2de4","yes":true}` returned HTTP 200, `"line":"You're in. "`, plus the taste block with delegate still on.

After the yes:
- Session `GET /api/huddle/today`: "mine" card, `"going":2,"spots":2,"host":"Lily","when":"Thursday 5 Nov, 19:00"`.
- Agent `GET /api/agent-channel/feed` notices, read once: "Lily said yes: you're in Lily's Thursday doubles." and "Game on: badminton Thu 5 Nov 19:00 at Daan Sports Center with Lily is full. You're in." Accurate at that moment.
- Session `GET /api/feed` read after that: `notices: []`. Neither notice was ever seen again on either channel.
- Trust chain length unchanged by the yes (no entry for it). `GET /api/trust/chain` has no consent record. llms.txt describes none, so none was checked for.

Times told "Game on": one (agent feed, once). The yes reply itself said "You're in." Not seen by the person's session feed at all.

## Step 4: loosening over the key

`POST /api/agent-channel/huddle/limits {"windows":[{"days":["Mon".."Sun"],"from":"08:00","to":"23:00"}],"maxKm":20,"maxEach":400}`
-> HTTP 403 `{"error":"Over the agent channel limits can only get tighter; loosening them needs your person's session.","needs":"person"}`

`POST /api/agent-channel/huddle/delegate {"on":true,"maxEach":400,"newPeople":true}`
-> HTTP 403 `{"error":"Only your person changes this, with their own session: it is their permission, not yours."}` (no "needs" field, unlike the limits refusal)

`POST /api/huddle/delegate` with only the agent signature (no session) -> HTTP 401 "Sign in first."

Limits and delegation after the attempts: unchanged (maxKm 5, priceCap 150, Mon-Fri 18:00-22:00, delegate on maxEach 150 newPeople false).

## Step 5: Lily leaves

LILY_LEFT seen about 21:49. Lily's account was deleted (her leave response: `{"deleted":["de-75d3f4f0c9aa"]}`), the trust chain got a "left" entry (n=11 from the seed id 42efa84...).

What Olivia sees afterwards:
- Session `GET /api/huddle/today`: the "mine" card is gone. Lily's game is no longer listed as hers or anywhere near her.
- Session `GET /api/clubs`: the club still exists, joined true, members 3, names Ben, Mia, You. Name still "Lily's Thursday doubles", no organiser left.
- Club room `GET /api/feed?room=c-853d1ece`: `posts: []`, `notices: []`, `club.name` still shown.
- `GET /api/invite?id=pmvwg6ikb7e1e2de4`: "That game is not open any more."
- Agent `GET /api/agent-channel/feed` and session `GET /api/feed`: `notices: []`. Nothing tells her the game is off or that its host left.

The game she was told was "Game on" is gone and she has not been told. Confirmed in the Lily-side capture just before the leave: the same post existed (`going: 2`, names Ben and Olivia, "full": true), so the post was removed with the host's account.

## Step 6: revoke, refusal, leave

`POST /api/members/agents/revoke {"id":"ag-6a917a7725be"}` -> `"revoked":true`.

Signed `GET /api/agent-channel/me` after revoke -> HTTP 401 `{"error":"refused: this agent key was revoked by its person","why":"revoked","docs":"/llms.txt"}`. A signed POST to the game route gave the same 401.

`POST /api/clubs/join {"club":"c-853d1ece","on":false}` -> `"joined":false`, names [].

`POST /api/members/leave` -> `{"deleted":["de-8846f3a74f3f","ag-6a917a7725be"]}`. Chain gained a "left" entry n=13 for subject 6b7f7cf3d0672bce. After this the session returns "Sign in first."

## Findings

### BUG 1: a game she was told was "Game on" disappears silently when the host leaves
After "Game on ... is full. You're in." (21:42), the host (Lily) left and her account was deleted. The game post was deleted with her (the leave doc says "your posts are deleted"). Olivia's agent and session got no notice, the room has no notice, and the mine card just vanishes. Olivia still has a Thursday at 19:00 in no list she can see, and Ben (the other player, who was also in) is in the same position. This is wrong in the core game flow: a confirmed game ends with no word to the people in it.

### BUG 2: the "Game on" notice reached only the agent channel, and the person never saw it
The two notices were returned once from `/api/agent-channel/feed`. The person's session feed read afterwards gave `notices: []`, and I never saw them there. My one session read came after the agent read, so notices may be drained by whichever channel reads first. I could not isolate the cause (I did not test a fresh notice with a session read first). Either way, the person's own feed never showed that she is in a game.

## MINOR

1. The 403 for delegation (`Only your person changes this...`) has no `needs` field, but the limits refusal has `"needs":"person"`. Inconsistent.
2. `GET /api/huddle/limits` returns `{"error":"no such route"}` (POST only). Fine by the docs, but a GET is the natural lookup.
3. A full game (2 of 2, still existing) answers its invite with "That game is not open any more." The same text is used for a deleted game, so a player cannot tell "full" from "gone".
4. `mine: false` on the game card for a game she is in (she is a player, not the host). The field name suggests she does not own it, which is true, but it reads as "not in this game".
5. After the host left, the private club still says "Lily's Thursday doubles" and lists Ben, Mia and the "You" entry. I did not check who (if anyone) now organises it, so whether private join requests still have an answerer is unverified.
6. `GET /api/members/agents` (list) returns "no such route". Not in the docs; harmless.
7. Revoked-key refusal is clear and correct (401, why "revoked").

## Confirmed working

- Demo sign-in, home, sports, limits, delegation all stored as set.
- Agent key registration and signed requests (Ed25519 JWS, body hash, audience, kid) verified by the server.
- Club join by invite code: asked, then admitted by the organiser (private club).
- Game over the agent key: `agentMay` ok true, yes accepted, "You're in.", going 2 of 2, "Game on" notice accurate at the time.
- Over-limit loosening refused over the key (403 needs person), delegation refused over the key.
- Revocation: refusal on the next signed request.
- Account deletion: session dead after leave; chain got "left" entries; nothing about her remains in the club member names.

VERDICT: 0 BLOCKER, 2 BUG
