# Trial 20 new2: Raj, badminton near Daan (about 88 requests, 2 demo accounts)

Agent card, llms.txt and OpenAPI agree on routes, auth schemes and the signing recipe. Ed25519 registration and signed agent-channel calls worked first time.

## Game for Raj
Set home, badminton, weekend limits, open and delegation (150 each). POST /api/huddle/start {sport:badminton, need:3, nearby:true} agreed "Sat 31 Oct 17:00, Taipei Gymnasium, NT$110 each" (h-c7cb4d61). Raj's own yes was in, and Ivan and Lily were asked (simulated, so no real answer). I cancelled a second huddle (h-e2efa5ef) that I started by mistake. /today showed no ready-made games, only a question and a quiet-hour deal.

## BUGS
1. POST /api/auth/demo {name: 41 x "x"} returns 200 and the member name is silently cut to 40 characters. OpenAPI says "up to 40 characters"; there was no 400 and no note.
2. GET /api/auth/facebook/start while /api/auth/providers says facebook:false returns 200 with the web app's HTML page (a dev bundle with react-refresh). llms.txt says this route opens the login. It should be a JSON error saying the provider is off.

## MINOR
- POST /api/huddle/deal with sport tennis and a badminton court id gives 404 "That venue isn't among the courts near you". Misleading; the court is near, the sport is wrong.
- A signed request with an unregistered kid gets 401 "signed by a key no allow-listed peer has" (why: unknown-peer). It reads like an A2A-peer error, not "unknown agent key".
- POST /api/status returns 200 (method ignored).
- llms.txt says the huddle routes also work on the agent channel, but home/open/delegate have no agent-channel version. This is sensible, but not stated.
- OpenAPI responses are generic ("OK (JSON)", 400, 401); 403, 404 and the "needs: person" shape are not listed.

## Correct plus wrong value checked and matching docs
status, providers, invite (404), trust/chain (n=abc gives 400), trust/verify, a2a keys and agents, me (401 bad session), members/agents (bad jwk 400), agent-channel/me, feed, huddle/me, today, question, trust, needs, places (curling 400), answer (pick z 400), home (lat 200 gives 400), sports, limits (bad day 400; agent loosening gives 403 "needs person"; tightening 200), open, delegate (maxEach -5 gives 400), deal (past date 400, weekly ok), start (need 99 gives 400), one, reply (yes "maybe" gives 400), cancel, feed/post (spots 0 gives 400), agent comment, feed/join, agent join (on "x" gives 400), notices, clubs GET and join, feed/delete.

## Not tested (budget)
members/leave, agents/revoke, POST clubs, agent-channel/post, huddle/game (no recommended games existed), agent-channel answer, huddle/start with the invite/club/fill/pin options.

VERDICT: 0 BLOCKER, 2 BUG
