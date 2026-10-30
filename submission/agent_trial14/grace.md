# Grace Kuo agent, round 15 (x-tester r15grace)

Setup: registered Ed25519 key (channel works), home, limits (Mon-Sun 18:00-22:00, 5 km, NT$150 each), delegation on (maxEach 120, no new people), open on. Made 2 test accounts (A, "Zed"). About 85 requests.

## Re-check
1. PARTIAL PASS. Grace's club game agreed (status asking, no post). Joining a feed game at Sun 1 Nov 20:00 gave 409 "You're already in badminton Sunday 1 Nov, 19:30 (the agents agreed it), which overlaps this one. Answer no there first." with clash id. A second start overlapping it ended "stuck": "you already have a game at those times". NOT TESTABLE: an agreed game that is "on" without a post (needs other members' real yes; seeded members don't answer). The card showed in /api/huddle/today, status asking.
2. PASS. Spares named in the talk ("R15 and Kenji's agent said yes too: first in line if a spot opens"). Invited R15 tb was placed ahead of Leo/Lily (also yes). Invitees who said no (Kenji, Zed) were not placed, correct.
3. PASS. clubs/join on "yes"/1 -> 400 "on is true (join) or false (leave)". chain after/n = abc, 1.5, 2.5 -> 400. clubs lat 999, lone lat, lone lon, lat=-91, empty -> 400. (Minor: chain n=-1 and after=-3 return 200.)
4. PASS. OpenAPI lists /api/members/leave, /api/feed/delete and start fields when, fill, hostYes. A's fill huddle h-420eeaed was "asking"; after feed/delete of its post it was "cancelled", talk "R15 deleted the game, so it's off", post gone. (members/leave itself not called.)
5. Mostly PASS. Dan (agent right 52%) "can't answer for Dan here (agent right 52%; this game wants 80%)". Deal at 09:00 for 2: 200 with outside ["time","price"], "A quote only ... no game is agreed". Overlapping own post refused 409. Channel loosening of km/each/windows -> 403 "limits can only get tighter"; tightening maxKm 4 OK. Leave then rejoin on a feed game worked. NOT TESTABLE: "one no keeps a game with an open spot" (no way to force a seeded no on a real spot).

## Findings
BUG 1: Posting overlaps an agreed game. Grace's agreed game h-a9bbf4c2 (Sun 1 Nov 19:30-21:00, asking, no post). POST /api/feed/post for Sun 1 Nov 20:30 returned 200 (post pmvuhplqb127ee01e). Joining the equivalent game is refused, and a start says "you already have a game at those times", so the host is double-booked. Overlap with another posted game was refused 409.

MINOR 1: Talk names several members "R15" (name truncated to first word), so "R15, R15 and Kenji's agent said yes" can't be told apart.
MINOR 2: Hitting 4 posts per 10 minutes and 8 starts per day (429) blocked more checks; expected.

VERDICT: 0 BLOCKER, 1 BUG
