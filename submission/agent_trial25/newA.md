# newA trial: Olivia Chen, badminton doubles, Saturday morning, within 3 km, max NT$150

Target: http://127.0.0.1:8899 only, header `x-tester: newA` on every request. About 19 requests in total.

## Outcome
No game. Olivia does not have a game and nothing has been agreed. The game I started (h-63df5914) is still open in her name with status "stuck". I did not cancel it.

## Flow taken
1. GET / returned {"name":"Serve", guide:/llms.txt, openapi, agentCard}.
2. GET /llms.txt read in full (two calls, the first was cut at 8000 characters).
3. GET /api/auth/providers returned {"facebook":false,"instagram":false,"demo":true}. GET /api/status showed llm ready:false and players:0.
4. POST /api/auth/demo {"name":"Olivia"}: member de-a9e22200bdac, session returned.
5. POST /api/huddle/home {"lat":25.031,"lon":121.536}, POST /api/huddle/sports {"sports":["badminton"]}, POST /api/huddle/limits {"windows":[{"days":["Sat"],"from":"08:00","to":"12:00"}],"maxKm":3,"maxEach":150}. Each returned the taste object with the values set.
6. GET /api/huddle/today: no game. It offered a quiz card (example slots, "Saturday 7 Nov 08:00 ... 2.8 km ... NT$90"). I did not answer the quiz because Olivia gave no preferences beyond the brief.
7. POST /api/huddle/start {"sport":"badminton","need":4,"nearby":true} returned id h-63df5914, status "talking", invited 0.
8. Polled GET /api/huddle/one?id=h-63df5914 several times. It stayed "talking" for about 40 s, then became "stuck" with this talk line: "Every option is outside your own limits (no time in your windows). Widen your limits, or ask a club nearer you." Nobody was invited and nobody was asked.
9. GET /api/feed?lat=&lon=: one open post, a basketball invite by Ray Ho on 2026-11-01 (not badminton, not in scope). GET /api/huddle/places?sport=badminton: six venues within 2.9 km. Their grid covers only 2026-10-31 to 2026-11-06.
10. I did not widen her limits, did not register an agent key and did not reply to any card.

## Why it stopped (observed, not a finding)
- Server clock: the Date header is Sat 31 Oct 2026 11:18 GMT, which is Saturday evening in Taipei. Today's Saturday morning window has passed.
- Olivia's only Saturday morning window inside the 7-day search horizon has passed. The next Saturday, 7 Nov, is outside the grid (it ends 6 Nov).
- No seeded members answered (players:0), so nobody was asked.
Per the brief, the clock and simulated members are limits of this copy and not findings.

## Findings
### BLOCKER
None counted. The task did not finish, but the cause is the clock and the simulated members, which the brief says not to count. The verdict below is therefore a judgement call the reader should check.

### BUG
None observed.

### MINOR
1. The quiz card from GET /api/huddle/today offers "Saturday 7 Nov, 08:00 ... 2.8 km ... NT$90" as an example slot. That date is outside the 7-day horizon that the venue grid and the game search use (grid ends 2026-11-06). The example is marked "example": true, but it reads as a real option inside the limits.
2. After the game went stuck, GET /api/huddle/today still says "No game to join or answer right now. Start one: POST /api/huddle/start ...". Olivia already has a live (stuck) game, and that line does not mention it.

## Not done
- Agent key registration: the site recommends it for day-to-day use, but it is not required to get a game, and the blocker above would remain. Not tried.
- Answers to the quiz cards: not given, since Olivia's preferences were not supplied.

VERDICT: CLEAN
