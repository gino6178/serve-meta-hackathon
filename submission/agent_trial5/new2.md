# Trial new2 report (Leon, tennis, Shilin, weekend, free courts)

~40 requests, header x-tester: r6new2 on all.

## Worked as described
- Agent Card (/.well-known/agent-card.json and agent.json), llms.txt and openapi.json all served and consistent.
- POST /api/auth/demo, then home, sports, limits, open and delegate with the session all worked.
- POST /api/members/agents returned a kid. Signed requests to /api/agent-channel/... worked (me, places, today, start, one, cancel, post, feed, limits).
- Loosening limits over the channel was refused as documented. Tightening worked.

## Findings
1. BUG: gate {"minShow":0} is documented in llms.txt and the card as valid (0|0.75|0.9). The server ignores it and uses 0.6.
   POST /api/agent-channel/huddle/start {"sport":"tennis","need":2,"nearby":true,"gate":{"minShow":0},...} returned "gate":{"minShow":0.6,"agentMin":0.8,"newOk":false}. The talk says "people who show up 60%+". Neither 0.6 nor newOk is documented.
   Effect: the only nearby member (Kenji, new) was waitlisted every time, and all huddles ended "stuck" ("couldn't find a time...").
2. MINOR: GET /api/agent-channel/me is in llms.txt but missing from openapi.json (it works).
3. MINOR: openapi request schemas omit documented fields (start: when, fill, pin.place; deal: weekly). Every response is just "OK (JSON)", so no response shapes are described.
4. MINOR: nothing says public courts (kind "public", no price) are free, or how to tell. I inferred it.
5. MINOR: the "mine" flag on an agent-channel post response was false for my own post, but true in the feed.
6. MINOR: the openapi has no non-ASCII body note. My first signed POST with a Chinese string got "wrong-body". That was my shell encoding, not the server. It may still count against the agent record, since the key had already worked.

## Outcome
No huddle filled: the simulated pool had one new member, and the gate blocked him (finding 1). Fallback: posted an open invite via /api/agent-channel/post (post id pmvudo6bs60986b24).
It is a free (each:0) tennis game on a public court (網球場, 0.3 km from home), Sat 31 Oct 09:00, 1 spot, shareUrl /#/invite?id=pmvudo6bs60986b24, and the public GET /api/invite works.
Leon is not yet confirmed in a game with a second player.

VERDICT: 0 BLOCKER, 1 BUG
