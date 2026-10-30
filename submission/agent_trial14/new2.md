# Serve route check (r15new2), about 100 requests, 2 demo accounts

Card, llms.txt and OpenAPI agree on host, auth headers, routes and JWS format. /openapi.json and /api/openapi.json are identical. The only drift is `hostYes` in the start body (OpenAPI only).

## Game for Kim
Done. Home 25.033/121.520, squash and table tennis, Mon-Fri 12:00-14:00, 5 km, NT$200. Huddle h-c56ad8a4 was agreed for Tue 3 Nov 12:00 at a Test Hall court, NT$200 each. Both players said yes and the status went to "on".

## BUGS
1. POST /api/huddle/start accepts `gate:{minShow:0.5}` with 200 and stores it. llms.txt and the agent card say minShow is 0, 0.75 or 0.9. The wrong value is kept without a word.
2. POST /api/feed/post accepts invite day "2026-13-45" with 200 and posts it, shareUrl included. A real YYYY-MM-DD is promised. By contrast, spots:0 on /api/agent-channel/post gives a 400 ("Between 1 and 12 spots.").

## MINOR
- POST /api/auth/demo with an empty body returns 200 and invents the name "Demo player".
- POST /api/huddle/reply with a bad `why` returns a message listing "busy, time, place, price, quiet, none". llms.txt lists only busy|time|place|price.
- POST /api/huddle/start {sport:squash, need:7} returns 200 and an "asking 7" huddle. llms.txt says "squash 2 or 4", and also "2 to 12 are accepted". The text conflicts.
- GET /api/feed?room=<nonexistent> returns 200 with an empty private feed rather than a 404. This looks deliberate, to avoid leaking whether a club exists.
- POST /api/huddle/home, sports, limits, open and delegate return a taste object that the docs don't describe.
- The `x` of the bad JWK was rejected with a clear 400. Fine.

## Checked OK (correct call plus one wrong value, with sensible 4xx)
- status, providers, invite (404), trust/chain (400 for a bad n), trust/verify, me (401 for a bogus session).
- members/agents (400 for a bad key), members/agents/revoke (400 for an unknown agent).
- clubs GET (400 for a bad lat), clubs POST (400 for an empty name), clubs/join (404).
- feed (GET and the post/join/delete routes), feed/notices.
- huddle: home, sports, limits, open, delegate, question, answer, me, today, places, deal, trust, needs, one, reply, cancel, game.
- agent-channel: me (a signature for the wrong path gives 401 "wrong-request"), huddle me, today, question, sports, limits (loosening gives 403), places, trust, needs, one, deal, feed, post, comment, join.

## Not called
members/leave (kept the accounts), clubs create/join success paths, huddle/start on agent-channel, reply, cancel, game, answer (success). The state-changing agent-channel huddle routes were not called with a good value.

VERDICT: 0 BLOCKER, 2 BUG
