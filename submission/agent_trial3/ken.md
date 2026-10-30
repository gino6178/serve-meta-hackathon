# Ken Hsu (basketball/volleyball; 8/11 show-ups, agent 8/12) - trial report
~50 requests. Key registered with Ken's session (POST /api/members/agents); all later calls signed, worked first time. I used his session once for POST /api/huddle/delegate (agent attempt: 403 "Only your person changes this", clear).

## Works
- GET agent-channel/huddle/trust gives show-up 73% (8 of 11), the 75% gate figure, the 80% agent cut-off and the way back ("9 more like that and it answers for you again"; "1 more game" to clear 75%). Clear and honest.
- Limits (Mon-Fri 18:30-22:00, 6 km, NT$150) echoed plainly. Weekly gated volleyball post (12 spots, repeat weekly 4), gated basketball post, club 3v3 huddle, 5v5 nearby huddle with gate 0.75, pin, cancel all return 200. Basketball courts list with quiet hours suits him.
- Delegation-off refusals (yes, join) say how to enable; a "no" still works.

## Problems (ranked)
1. Cancelled huddles revive as "stuck". POST huddle/cancel {id:"h-27f79678"} -> 200 "cancelled"; later GET huddle/one -> "stuck", with new line "I found no basketball courts near the group". Same for h-f1bf3229.
2. fill unusable for volleyball: POST huddle/start {sport:"volleyball",fill:"pmvucoct98b18f0f1",need:12 | 11 | 5 | omitted} -> 400 "Between 2 and 12 players for volleyball..." every time. Wrong message.
3. Host can set a gate he fails: Ken is 73% (75% smoothed); gate minShow 0.9 on post and huddle/start both 200, no warning.
4. POST huddle/deal {venue:"osm:way/350598918",sport:"basketball"} -> 404 "That venue isn't near you." (it is 2.3 km; it's a public court with no agent). Say so.
5. Size rules disagree: docs "volleyball 8 to 12", validator accepts 5 (error text says 2 to 12). Nearby volleyball: 400 "Nobody within about 5 km who plays volleyball has let other agents ask..." (fine, offers club/post).
6. places empty for 60 s+ ("looking":true, retryAfter 20; volleyball [] after 20 s, 5 courts after ~65 s). An agent concludes there are none.
7. Huddle talk ignores request: says "next seven days", never echoes when (weekday evenings), pin 2026-11-05 19:00 or gate; offers Fri 30 Oct (today) first, ends "couldn't find a time".
8. Club gate default 0.6, yet Ray (new) waitlisted "new, and this game wants people with a record" (newOk:false unexplained at creation). 429 "three games being worked out already" doesn't say cancel one.
9. Explain "90%: 21 more" seems off ((9+n)/(12+n)>=.9 gives ~18); show the smoothing.

## Fixes
Keep cancelled terminal; fix fill validation and message; warn when gate exceeds host's own rate; mark bookable vs public venues; align size rules with docs; return places synchronously or "loading"; echo when/pin/gate in the first talk line; add "cancel one" hint to the 429.
