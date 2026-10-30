# Grace regression sweep (about 100 requests; extra account "R6 Host Hank")

1. PASS - First signed GET /agent-channel/me gave 200. Wrong aud: 401 `aud must be "serve-agent-channel"`.
2. FAIL (BUG A) - Loosening km/price, "-1", "abc", null: all refused. But POST /agent-channel/huddle/limits {"windows":[{"days":["Mon"],"from":"06:00","to":"23:00"}]} returned 200 over Mon-Fri 19:00-21:00, widening Monday.
3. PARTIAL (BUG B) - delegate/open/home: 403 "Only your person changes this". Delegated yes is refused for price, new host, and outside windows, each alone. Combined cases give one reason: new host + 07:00 said only "host is new"; new host + 06:30 + NT$200 said only the price. Not all reasons.
4. PASS - Agent yes left weights, grid, answers, summary, learned unchanged. Answer by id ({"q":"q5-quiettime"}) gave 200 and answers 6 to 7.
5. PASS - minShow 0.8 and 0.9 kept in gate. Grace's view: "Kenji goes on the waitlist", "Dan is asked directly", no reasons. Host view adds "new, and this game wants people with a record", "keeps only 52% of its yeses".
6. PASS - Talk gives kinds only ("the time", "the price", "too busy"); the nearby line says "some people nearby". MINOR: huddle "invited" was 7 for the club but 10 with nearby:true, so the nearby number can be worked out.
7. UNCLEAR - Host got "R6 is asked for a yes too" with a pinned time but no place and no delegation. A pin with a court got stuck on my own overlapping posts, so no clean result.
8. PARTIAL - Pin outside limits (Sat 07:00, Fri-only): 400 at once. Fill of a posted game: inconclusive (429 post rate limit; earlier fill clashed with my own posts).
9. PARTIAL PASS - Cancelled huddles stayed "cancelled". Today cards stayed inside her limits. Notices were empty, so "stop after answering" is untested.
10. PARTIAL - Posting Sun 20:00 near her Sun 19:30 game gave a warning ("within three hours"). shareUrl is "/#/invite?id=..." and GET /api/invite works without an account, but GET / with Accept text/html returns JSON, so no app page was seen (MINOR, maybe a local-copy limit).

BUG C: POST /huddle/game {"yes":false,"why":"time"} returned 409 "clashes with a game you're already in" three times while Grace was in no game. The same "no" with why "price" gave 200.

VERDICT: 0 BLOCKER, 3 BUG
