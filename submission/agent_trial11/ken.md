# Ken Hsu agent trial (r12ken), ~84 requests

Done: limits (08-22 all days, 10 km, 100 each), delegation on (newPeople true), key registered and used on the agent channel (me, start, reply, cancel, post, today all 200). Three extra accounts joined Riverside Hoops. Huddles h-a3372fe4 (6 players, gate 75%), h-4211d370 (fill of posted game), plus huddles hosted by extras. Posted games Tue/Wed/Wed late; extras joined, left, rejoined. Not verifiable here: deadlines, replacement after the day-before, real-time Ray answers.

Worked: gate waitlist (new people to a newOk:false game; Ken at 73% waitlisted in a 75% game with the exact reason), "Game on" and "can't make it" comments and notices match the joins, 409 clash for a player in overlapping games, agent yes refused outside limits (403 "outside their limits"), call-off messages, feed/Your games agree on going/waiting.

## BUG
1. Explicit invite dropped. Extra C started a 4-player huddle inviting Ken (id) with a pinned Thu 19:00 (in Ken's window). Players were host, Ray, A, B; Ken was never a player, had no /today card, /reply gave 404 "That game isn't one you're in". The talk still said "Ken's agent can't answer... Ken is asked directly" and "Ken is asked for a yes too". With need 6 Ken was asked normally.
2. A yes contradicts the talk. A replied yes to the 17:00 pick (200); B then said no (price). Talk: "Nobody else had said yes to that time", though A and the host had. A's yes never appears in the talk and is silently discarded.
3. Leaving kills the huddle. A answering no (time) on the Sun 18:00 pick (host yes, B yes, Ray pending) made it status "stuck" ("That's 3 tries"), with Ray's ask dropped (waiting []). A's rejoin yes returned 404; rejoin is impossible in a huddle.
4. Host double-booked. Ken hosted Wed 19:00 and Wed 19:30 (both accepted, no warning), while player A got 409 for the same overlap.

## MINOR
- Fill huddle h-4211d370 waitlisted Ray, A, B, C ("goes on the waitlist"), but the post showed waitlist 2.
- A pinned time ending "agents couldn't find a time that suits enough of you" when everyone was waitlisted.
- Same agent: "can't answer (agent right 67%; wants 80%)" in one huddle, agentMay ok:true in another.
- "Your games" lists the unformed Thu huddle (going 1) beside posted games.
- A "no" for price at a free court is accepted ("costs too much"), my reason.
- Yes replies are labelled "(the time)/(the place)" like reasons.

Privacy: no home, weights or session visible to other accounts; ids only.

VERDICT: 0 BLOCKER, 4 BUG
