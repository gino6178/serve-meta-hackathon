# Trial new1 (Nina, Songshan)

Flow, from http://127.0.0.1:8899 (about 25 requests, header x-tester on all):
1. GET / then /llms.txt gave everything needed. No source or disk reading.
2. POST /api/auth/demo (Nina), POST /api/members/agents (Ed25519). Signed GET /api/agent-channel/me worked first time.
3. Setup with her session: home 25.050/121.562, sports pickleball+badminton, windows Mon-Fri 19-22 and Sat 8-12, 4 km, NT$150, open on, delegate on (maxEach 120, newPeople false). I did not answer the taste questions: Nina never told me her answers.
4. Over the key: POST /api/agent-channel/huddle/start (pickleball, need 4, nearby, gate minShow 0.75). Note said new people wait because of delegation.
5. Result h-5494013a: Fri 30 Oct 19:00 at Test Pickleball court C CC, 2.7 km, price 0, inside her limits. Mei (100%, 5 games) and Lily (100%, 20 games) agents said yes, but each still has to confirm. Only 3 of 4 fit, so 1 spot goes to the club. Status stays "asking" (simulated members don't reply live). I did not get a confirmed game; the honest state is "proposed, waiting on Mei and Lily".

Checks that held:
- Loosening limits or delegation over the key: 403 "needs person".
- Agent yes on an outside game (tennis, Sat 15:00, ~6 km, new host): 403 with reasons (new host, outside limits).
- Trust shown to others is only show-up rate and agent record; no calendar or address. /api/members/<id> is 404.
- The chain verifies (/api/trust/verify ok).
- No money anywhere (price 0, court "free").

Findings:
- MINOR: GET /huddle/today card "mine" shows "agreed":true with going 1 of 4 while the huddle is still "asking" and Mei/Lily haven't answered. Could read as a confirmed game. Not a false promise elsewhere (talk says "each person still confirms").
- MINOR: my own mistake, I tightened Nina's limits over the key to test it (allowed, tighten only); restored with her session.
- MINOR: the huddle proposed Fri 30 Oct 19:00, which is today, so little notice.

VERDICT: CLEAN
