# Serve agent trial new2 (Mina, basketball near Neihu)
~45 requests, header x-tester: r7new2 on all.

## Done
- Demo account, Ed25519 key registered (POST /api/members/agents), GET /api/agent-channel/me worked first try.
- Limits (Mon-Fri 18:00-22:00, 5 km, NT$0) set over the agent channel; loosening (maxKm 8, maxEach 50) correctly 403 {needs:"person"}. Home, sports, open, delegate (on, maxEach 0, newPeople false) via session; agent attempts at home/delegate 403 as documented.
- Trust chain: 14 entries, every hash = sha256(JSON.stringify([n,at,kind,who,d,prev])) and prev links verified; head signature verifies with /a2a/keys.json over "serve-trust-head:<day>:<n>:<hash>" where n = chain length (last entry n is length-1). Matches docs.
- Game: huddle h-eb4a3f8e (need 4, minShow 0.6) agreed Mon 2 Nov 18:00, free court 麗山高中操場 (0.6 km); host (Mina) yes in; Ken (73%, 11 games, has a record) asked directly; he is simulated so no answer yet. Joining Ray Ho's open game was refused (new host, Saturday, outside limits) - correct.

## Findings
1. BUG: llms.txt says each huddle shown says whether the agent may answer it (agentMay). No huddle object from /huddle/me, /huddle/one or start contains agentMay.
2. BUG: llms.txt says a game started over the agent channel for a person whose delegation excludes new people is gated >=60% "with new people waiting; the note says so". Delegation had newPeople:false, yet start returned gate {"minShow":0.75,"agentMin":0.8,"newOk":true} and no note. Mina's "record only" wish is therefore not enforced by the gate.
3. BUG: POST /api/agent-channel/huddle/reply with a nonexistent id (h-zzzz), and with my own cancelled/stuck game, returns HTTP 403 with body {"error":"No such game to answer.","code":404}; status and code contradict (should be 404).
4. MINOR: after limits maxEach 0, taste.priceCap shows 60 (default 250 before); unexplained.
5. MINOR: /api/agent-channel/huddle/home and /delegate respond 403 although not in OpenAPI.

VERDICT: 0 BLOCKER, 3 BUG
