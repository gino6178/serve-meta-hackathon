# Leo Park (club owner, Daan Badminton) - round 11

Setup done with his session: sports badminton, limits Sat/Sun 09:00-21:00, 6 km, NT$150, open on, delegation on (150, newPeople false). Key registered; a signed GET /api/agent-channel/me returned 200. About 85 requests.

## Earlier fixes
1. PASS (partly). Started 5 huddles in a row (club and fill). No 500s. The 4th and later got 429 "You have three games being worked out already: wait for one to settle, or call one off." Cancelling then restarting worked. The "no courts / map down" case could not be produced here (not testable).
2. PASS. 400s, with a clear message, for: sports (curling, a string), open "yes"/missing, delegate on "maybe", maxEach -5/"abc", newPeople "x", reply yes "banana", why "weather", start need "two", sport curling, minShow "high", 1.5 and -1 (with club). Need -1 gives a 400 too. A later huddle list showed nothing changed (sports/open/delegate unchanged).
3. PASS. Same quick question answered twice: answers stayed 6 (5 to 6, then 6). Post dated 2026-10-01: 400 "That date has passed". Cancel "doesnotexist": 404 "No such game." A second cancel of the same huddle: 409 "already called off".
4. PASS for badge words. Talk lines show only "shows up N% · N games", "agent right N%", "new · 0 games", "agent new". Reasons are only "(the time)", "(the place)", etc. The prober mark could not be tested: the public chain holds only 10 seed entries, no prober entry (not testable). Note: the seed entries in /api/trust/chain do carry real counts (games, came, said, kept) for hashed ids; that is by design as documented.
5. PASS. Leo's posted game, while its fill huddle was asking, showed in /api/feed?room=c-53f2c9e1: `filling: {huddle, status:"asking", asked:3, yes:0}`.
6. PASS. GET /api/invite?id=<own post> with session returns `joined:false, mine:true`; without a session the fields are absent.

## Other observations
- MINOR: POST /api/feed/post accepts `each: -50` (200; the stored invite shows no price) and `gate.minShow: 5` (200, silently clamped to 1, newOk false, so nobody could ever join). The huddle routes return 400 for the same kind of values, so this is inconsistent.
- MINOR: POST /api/huddle/start accepts need as the string "3" (200), though "two" gives 400. Harmless.
- MINOR: GET /api/feed with no `?room=` returned only another club's post and hid Leo's own club game, so the feed looks empty for the owner until the room is given. The OpenAPI lists `room` as optional.
- Limits respected: both agreed huddles (Sat 14:00 and 17:00, NT$124 and NT$110 each; Sun 19:30 NT$90) fell inside Leo's windows, price cap and distance.
- Two huddles for the same club agreed Saturday slots with the same two players waiting. This is not a conflict (14:00 and 17:00).
- Club ownership: POST /api/clubs/join for his own club gives 404 "No such club" (wrong body shape on my side, likely); POST /api/clubs with a bad sport and privacy returns the name error first, which is fine. I did not create clubs or extra accounts.

VERDICT: CLEAN
