# Serve trial 14 - new2 (about 100 requests, header x-tester: r14new2)

Coverage: every member route in the OpenAPI and every agent-channel route was called once correctly and once with a wrong value (the exceptions are listed at the end). I made two demo accounts: the first was orphaned by my own script crash and was never used again. Leon is the second one.

## Outcome
Leon (basketball, Mon-Thu 18:30-22:00, 5 km, NT$200) has a game. I posted it for Tue 3 Nov 19:30 at Test Hall, and Test Hall is a local fixture court (1 km). The agent-channel fill huddle h-1f5301c9 agreed the time and place, then asked Ken (simulated) directly. It was waiting for Ken's yes when I stopped. The only game already in the feed was Sat 31 Oct, not a weeknight.

## BUGS
1. POST /api/clubs/join {"club":"c-8210350f","on":"maybe"} returned 200 and joined the club. Other routes reject a non-boolean "on" with 400: /api/huddle/open, /api/feed/join and /api/agent-channel/join. Here a wrong value was silently treated as true.
2. GET /api/trust/chain?n=abc returned 200 with entries:[] and ignored the bad value. GET /api/feed?n=zzz returns 400 "n is a whole number", so the two are inconsistent.
3. The OpenAPI does not match the other published text.
   - privacy.txt describes POST /api/members/leave, but it is not in the OpenAPI or llms.txt. I did not call it, as instructed.
   - llms.txt documents the start-body fields "when" and "fill" (and "invite"). The OpenAPI schema for /api/huddle/start lists only sport,need,club,invite,nearby,gate,pin, so "when" and "fill" are missing.
   - The openapi.json served at /openapi.json and /api/openapi.json is identical, and the agent card matches llms.txt on links.

## MINOR
- gate.minShow 0.5 was accepted. llms.txt says 0|0.75|0.9, and the huddle text said "50%+".
- huddle/game why accepts "quiet" and "none", but llms.txt lists time|place|price.
- /api/huddle/deal with a sport that does not match the place says "venue isn't among the courts near you" (404), which is misleading.
- After I answered "no, time" on Ray's game, then joined and left it, /api/agent-channel/join and /api/agent-channel/huddle/game returned 404 "not in the feed / not open any more", although /api/feed still listed it earlier.
- A revoked key gets 401 why:"unknown-peer" instead of "revoked".

## Verified OK
- Wrong values give clear 400/404/403 on: demo name, key JWK, home, sports, limits (day, time, km), open, delegate, answer pick, places sport, deal players, clubs sport, feed n, huddle need, reply yes, game why, cancel id, revoke id, agent loosening a limit (403), unsigned agent call (401), and a bad sport on an agent post.
- Signed calls worked, and the key was revoked at the end (verified 401).


VERDICT: 0 BLOCKER, 3 BUG
