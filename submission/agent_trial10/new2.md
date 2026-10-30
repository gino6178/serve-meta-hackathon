# Trial 11 new2: OpenAPI route audit (Ken-ichi, table tennis, Zhongzheng)

90 requests, two demo accounts (Ken-ichi, host Mei), one Ed25519 agent key. Header x-tester sent on all.

## Result
Ken-ichi got a game: Mei's table tennis, Tue 3 Nov 19:30, Zhongzheng Sports Hall, 300 m, NT$60. The agent's own yes was refused ("Ask your person: the host is new", agentMay card, 403); the person's session joined (joined:true).

## BUGs
1. POST /api/feed/join {"post":<id>,"on":"x"} returns 200 and acts as join (state before: left, after: joined:true). Wrong type ignored. Sibling routes (open, delegate, reply) reject non-booleans with 400.
2. GET /api/huddle/places?sport=curling returns 200 {"sport":"curling","places":[]} instead of the 400 sport-list error that POST /api/huddle/sports gives. Unknown sport accepted.
- (MINOR) GET /api/agent-channel/me with an unknown kid: 401 "signed by a key no allow-listed peer has" (why unknown-peer). Misleading for a member's agent; it describes the A2A peer check, not "unknown agent key".

## Could not verify (local copy limits, not counted)
- Places returned [] (map not answering), so a correct /deal and a correct place were not testable; bad place gave a clear 404.
- POST huddle/start with a valid body returned 400 "Nobody within about 5 km ... has let other agents ask theirs" (no open members), so one/reply/cancel success paths were not reached; bad ids gave 404/400 as described.

## MINOR
- OpenAPI start body lists no "fill" or "when", though llms.txt documents both. OpenAPI hides the 403 "needs person" status (all routes list only 200,400,401).
- Card says openapi at /api/openapi.json; /openapi.json also works. Both fine.
- Invite shows host "Mei" for member "Mei host".
- POST /api/clubs privacy:"open" stored as "public" silently.
- /api/feed?room=zzz returns 200 empty with private:true rather than 404.

## Matches
Auth failures (no session 401, no signature 401 "unsigned", wrong path 401 "wrong-request"), loosening limits over the channel (403 needs person), bad pick, bad window, negative maxKm, need 99, bad why, bad id on invite/one/cancel/reply/comment/join/clubs/revoke all behaved as described. Card skills, llms.txt and OpenAPI agree on paths and security. Trust chain/verify/keys: 200, ok:true.

Not exercised: POST /api/agent-channel/post, GET /api/agent-channel/huddle/places wrong value, POST /api/clubs/join good, revoke good (kept key live).

VERDICT: 0 BLOCKER, 2 BUG
