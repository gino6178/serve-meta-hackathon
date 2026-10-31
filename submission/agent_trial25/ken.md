# Trial 37: Ken Hsu agent run (local copy, 127.0.0.1:8899)

Ken: member de-3dbe74e8eb5b (Ken Hsu), sports basketball and volleyball, home set (25.04, 121.56).
All requests sent with x-tester: ken. Session from creds/ken.json. Agent key registered as ag-f15294fb38f3 (kid serve-556772497f4be093) for the signed agent-channel calls.

## What was done

1. Limits set (session): Mon-Fri 18:00-22:00, Sat 09:00-12:00, Sun 14:00-18:00, maxKm 5, maxEach 150. Ken had no limits before this run. The limits are my choice, since the task gave none. I did not loosen them afterwards.
2. Delegation turned on (session, POST /api/huddle/delegate {on:true, maxEach:150, newPeople:false}) so the agent may answer for Ken within limits.
3. YES step: NOT COMPLETED. No game inside Ken's limits was ever offered to him (details under BLOCKER).
4. NO step: Ray Ho's basketball game pmvwb3v9899866f2b (Sun 1 Nov 18:00, Riverside courts, 5.2 km). Outside Ken's Sunday window and his 5 km. Declined over the agent channel:
   - POST /api/agent-channel/huddle/game {"post":"pmvwb3v9899866f2b","yes":false,"why":"time"} -> 200 {"line":"Passed on it for your person.", ...}
   - Re-checked GET /api/huddle/today (session) and GET /api/agent-channel/huddle/today (signed) afterwards: the game is gone from cards. GET /api/feed/notices: empty. No re-ask seen.
5. Saturdays: POST /api/huddle/limits (session) with the Saturday window removed (Mon-Fri 18-22, Sun 14-18, 5 km, NT$150). Then POST /api/huddle/start {"sport":"basketball","need":6,"nearby":true,"when":{"days":["Sat"],"parts":["morning"]}} was accepted (200, huddle h-f7549b1c), then it went to status "stuck": "No court time fits the days and times you asked for". Ask false, no players, no waiting. Cards after that show no Saturday game or ask.
6. Out-of-limit yes: POST /api/agent-channel/huddle/game {"post":"pmvwb3v9899866f2b","yes":true} -> 403 {"error":"Your record is agent right 67%: under 80% an agent can't say yes for its person, so they answer themself...","code":403,"needs":"person"}. Refused, so it needed Ken himself. See MINOR 1 for the stated reason.
7. Public view: GET /api/invite?id=pmvwb9ntf24a3385f and ?id=pmvwb3v9899866f2b with no session show only sport, day, start, where, game place, spots, going, host name. No home, no calendar, no record badges. GET /api/trust/chain shows hashed member ids only.
8. Cleanup: my test post pmvwb9ntf24a3385f deleted (200 {"deleted":true}); test huddles h-dd74932a, h-cb7f1217, h-f7549b1c cancelled (status "cancelled").

## Findings

### BLOCKER 1: no in-limit game ever reached Ken, so the yes step could not be finished
- GET /api/huddle/today before limits: one card, Ray's Sunday game (above). After limits: only the club card "Riverside Hoops".
- POST /api/huddle/start {"sport":"basketball","need":6,"nearby":true,"when":{"days":["Fri"],"parts":["evening"]}} -> huddle h-dd74932a. Ken's talk: "The map of courts isn't answering right now, so I can't pick a basketball court." Status "stuck". A retry with pin {"place":"Riverside courts"} -> h-cb7f1217, "I can't find the court you picked near the group." Also stuck.
- GET /api/huddle/places?sport=basketball -> {"note":"The map of courts isn't answering right now...","places":[]}, while GET /api/status says "places":{"map":true}. The status and the places route disagree.
- POST /api/huddle/start {"sport":"volleyball","need":8,...,"pin":{...}} -> 400 "Nobody within about 5 km who plays volleyball has let other agents ask theirs yet."
- Feed (GET /api/feed) and club feed (GET /api/feed?room=c-a2708e31): no in-limit game.
- The agent could not say yes for Ken anyway: the agent-channel yes was refused at trust 67% (under the 80% rule in /llms.txt), so the yes can only come from Ken's own session.
- Possibly environmental (court map down, simulated members do not answer). Logged as BLOCKER because the step could not be completed. If the court map comes back, rerun the yes step.

### MINOR 1: the refusal message gives the trust record as the reason, not the limit
- The out-of-limit game breaks two of Ken's limits (Sunday window 14-18 and 5 km). The 403 names only "agent right 67%" and "needs: person". Ken is refused, which is correct, but the message does not say the game is outside his limits.

### MINOR 2: a Saturday huddle was accepted after Ken's no-Saturday limit
- POST /api/huddle/start with when Sat was accepted (200) after the Saturday window was removed. It stalled on the court search, so no asks went out. Limits are only enforced once a game is found; the start itself is not checked against them.

## Not tested
- Other members' view of Ken: only anonymous views were possible. The rule to use only x-tester: ken meant no second member identity. Badges shown to other members in a feed were not checked.
- Volleyball and any Saturday game from other members: none existed.

VERDICT: 1 BLOCKER, 0 BUG
