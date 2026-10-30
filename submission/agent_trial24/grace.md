# Grace Kuo (r25grace) report

About 70 requests. Setup: limits Sat/Sun/Fri 18-22, 5 km, NT$100; delegation on (maxEach 100, newPeople false); registered an Ed25519 key (signed calls worked); three host accounts joined Daan Badminton.

## Checked, all correct
- Agent yes within permission: Leo's game (known host, NT$90) -> "You're in". Refused outside it: new host / NT$150 / outside window -> 403 "Ask your person" with all three reasons listed. Same refusal on a new host's huddle reply.
- Agent "no" (yes:false, why:time) -> "Passed on it".
- Host invite: asked, notice "One yes from you?", Grace yes -> game on; host sees her. Leave -> host told "Grace left"; rejoin -> back in, never double-counted.
- Double-book: joining an overlapping game (20:00 vs 19:30) -> 409 clash; not offered the second ask.
- Waitlist: full 1-spot game -> waitlisted; filler left -> notices "A spot opened: you're in" and "Game on".
- Host stops a fill: notice "not needed after all"; later yes -> 409 "It's settled".
- Game filled from the feed while she was asked: told "filled up from the feed, so you're not needed"; the "yes?" card is gone and a late yes gets 404.
- Host calls off an agreed game (game:true): notice "called off", no stale ask in /huddle/today. Same for an asked-but-unanswered one.
- Record: shows-up stayed 93% (13/14). "Agent right" went 17/18 to 18/19 only after her own yes on an agent-predicted game (documented). The agent-channel join of Leo's game did not teach or change anything.

## Minor
- Huddle views for a host-side fill (cancelled huddle h-862fd2bc, and the "found" part of h-18d2bc2d) say "Your person hasn't let you say yes for them", although delegation was on. This is stale or misleading wording in a nearby-game suggestion, with no outcome change.
- After the agent passed on a posted game, Grace's own feed/join returned 404 "not in the feed any more". Her pass hides it, so she can't change her mind from the same session.
- A pinned Saturday game at a venue costing above NT$100 was declined by her agent "for the price" (correct), so the host got no match. Expected.

No BLOCKER or BUG found.

VERDICT: CLEAN
