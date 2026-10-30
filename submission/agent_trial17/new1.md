# Trial 18 new1 - Jae, basketball/badminton near Gongguan

Requests used: about 25. Header x-tester sent on all.

## Path
- GET / -> /llms.txt gave the whole recipe. POST /api/auth/demo {"name":"Jae"} -> session. POST /api/members/agents with my Ed25519 jwk -> kid; signed GET /api/agent-channel/me worked first try.
- Setup over the session (loosening needs it): home, sports, limits (Mon-Fri 19-22, Sat 12-18, 3 km, NT$80), open, delegate {maxEach 80, newPeople false}. Limits echoed back exactly (home rounded to 25.02/121.53, as documented).
- Over the key: GET huddle/places (Test courts 2.1-2.9 km, free public courts), feed (only Ray Ho's basketball Sat 18:00, host "new", 2.9 km; Kenji's badminton NT$100 is over budget).
- POST agent-channel/huddle/start {basketball, need 6, nearby} -> h-29a9dc29. Note said new people wait, gate 60%.
- Result: pick Sat 31 Oct 16:00, Test Basketball court C (free, 2.1 km). Jae's yes was given by delegation. The other player, Ken (shows up 73%, 11 games), is asked "directly, without an agent's yes" (his agent is 67% right, under 80%). Ken never answered (simulated member). Status stays "asking", due next day. Not joined yet; honest reason: waiting on Ken's own yes.

## Limit checks (all correct)
- Agent-channel limits loosen attempt -> 403 "can only get tighter".
- Agent join and huddle/game yes on Ray Ho's game -> 403 "host is new; outside limits". Good.

## Findings
1. BUG: numbers disagree for the same huddle.
   - GET agent-channel/huddle/today card "mine": agreed:true, going:1, spots:2, while GET huddle/one says status "asking", Ken answer null, and talk says "posted with 4 open spots".
   - Talk also contradicts itself: "Everyone who could be asked said yes ... 1 of the 6 players: the other 5 spots will be open" and then "Only 2 of the 6 players fit it: asking Ken". Ken had not said yes at the first line. (1 vs 2 players; 5 vs 4 open spots; agreed true vs asking.)
2. MINOR: huddle/start with parts ["evening","afternoon"] for Mon-Fri also tried afternoon-ish slots in the talk (Sat 12:00 etc. fine); weekday afternoon is outside limits but was not proposed, so only wording. No action.
3. MINOR: places "quiet" lists include busy 0.81 slots (Test Sports Centre Mon 19:00) labelled quiet.
4. Docs match behaviour otherwise (signing, delegation, gate, wait-list text).

VERDICT: 0 BLOCKER, 1 BUG
