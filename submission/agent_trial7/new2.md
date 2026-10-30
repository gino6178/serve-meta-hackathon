# Trial 8 report: new2 (Raj, volleyball, Xinyi) ~40 requests

Setup (demo account, own Ed25519 key, session only for person-only settings): home 25.035/121.567 stored as 25.04/121.57 (as documented, ~1 km); sports volleyball; limits Sat/Sun 08-20, 5 km, NT$0; open on; delegate {on, maxEach 0, newPeople false}. Agent key tightened to 3 km (200). Agent loosening (maxKm 10, maxEach 50, extra window) -> 403 {needs:"person"}; agent delegate -> 403. All as documented.

Game: over the key, POST /api/agent-channel/huddle/start (need 8, nearby, minShow .75) -> 200 with note about new people waiting, gate newOk:false. It ended "stuck": no volleyball courts on the map (local-copy limit, not counted). I then posted Raj's game (Sat 31 Oct 10:00, free, 0.6 km) and started a fill; it agreed, asked Ken (has a record) directly for one yes. Out-of-limit post (Tue 22:00, far, NT$300) -> 403 needs:person; out-of-window start -> 400. Join of a new host's game -> 403 "the host is new" (correct). Chain: 14 entries re-hashed OK; signed head verifies with /a2a/keys.json.

## Findings
1. BUG: POST /api/agent-channel/post for Raj (delegation newPeople:false) returns invite.gate {minShow:0.75, agentMin:0.8, newOk:true} and no note. llms.txt says a game started over the agent channel for such a person keeps new people waiting (newOk false). The huddle start does this; the post path does not, so people with no record can join Raj's posted game directly.
2. MINOR: the post answer shows mine:false / by.you:false / owner "Raj" for the agent's own post; the feed shows mine:true, owner "You".
3. MINOR: start with fill and need:7 returned need:9 ("Filling 8 open spots, with you 9"); my need is ignored. The filled game's gate was minShow .6, not the post's .75; going stays 0 though the host is counted as a player.
4. MINOR: POST /huddle/game on my own post -> 404 "That game isn't open any more" (misleading; it is open).
5. MINOR: /api/agent-channel/me (guide) and agent-channel .../delegate are not in openapi.json. 401 for unsigned agent calls has {error, why, docs} but not the documented `signIn`.
6. MINOR: fill without nearby:true -> 400 "Tick Also ask people nearby" although the guide doesn't say it is required.

Not tested: agentMay (no yes-question arrived), outside/deal (no courts to quote), replay penalty.

VERDICT: 0 BLOCKER, 1 BUG
