# Trial 10 new1 report (Tomas, lunch tennis doubles, ~48 requests)

Flow: GET / -> /llms.txt -> POST /api/auth/demo -> POST /api/members/agents (own Ed25519 key) -> home, sports tennis, limits (Mon-Fri 12:00-14:00, 2 km, NT$200), one question answered "either" (Tomas gave no tastes), open, delegate {maxEach:150,newPeople:false}. After that everything was signed over the agent channel (me, today, places, post, huddle/start, huddle/one, trust). The only session calls after setup were /api/clubs and /api/clubs/join (agent channel has no club join).

## What worked
- Limits enforced on agent posts: POST /api/agent-channel/post with start 18:00 -> 403 "outside what your person set (not a good time)"; each 250 -> 403 "costs too much"; at 25.1,121.6 -> 403 "too far". All clear and honest.
- A valid post (Mon 2 Nov 12:00, NT$120, 3 spots) was accepted, gated minShow 0.6 / newOk false, with a note saying why. Delegation note matches docs.
- Home stored rounded (25.03,121.56) as documented.

## Findings
1. BLOCKER: no game could be agreed. Every POST /api/agent-channel/huddle/start (nearby, club c-b6c556d2, with fill, with pin {date,start,place}, and the session route /api/huddle/start) ends status "stuck". Examples: h-cbf2acab, h-68d07ca7, h-06d70f19, h-d703a1e4, h-2839e6d9.
2. BUG: the talk line is "Something went wrong while the agents talked (Cannot read properties of undefined (reading 'filter'))." An internal JS error is shown to the user, and nothing says whether to retry or what to change. Reproduced 6 times, on both channels, with club and nearby; with no club members ever asked (players: [], invited 3 but no replies).
3. MINOR: first nearby huddle (h-3e3aedae, no pin) said "I found no tennis courts near the group on the map." GET /api/agent-channel/huddle/places?sport=tennis said "The map of courts isn't answering right now", so "no courts" is misleading (club "Xinyi Tennis" is 0.2 km away). The places note is fine.
4. MINOR: /api/clubs/join {"id":...} returns 404 "No such club." when the body key is wrong (it wants "club"); llms.txt never mentions clubs, /api/clubs, or joining, yet huddle/start says "Tick nearby, or join a club" and a club huddle needs membership. Joining needs a session, not the key.
5. MINOR: the post returned by /api/agent-channel/post for the host's own game shows "mine":false, "joined":false, going 0 (host not counted among the 4).
6. Note: huddle started with the session (not the key) gets gate minShow 0 / newOk true, ignoring the delegation; plausible by design since the person is the actor, but not documented.

No response broke Tomas's time, distance or price limits.

VERDICT: 1 BLOCKER, 1 BUG
