# Bob Lin (badminton, shows up 1 of 3) - trial13 report

Requests: about 50. Two host accounts made (HostA, HostB); games G75 (minShow .75), G90 (.9), Open, Soon (today 16:30, ~4h away).

## Worked as documented
- GET /api/huddle/trust: "shows up 33% · 3 games", "Shows up 33% (1 of 3). A game's gate compares 54% (smoothed). To clear 75%: 5 more games you turn up to; 90%: 19 more." The numbers are consistent with a smoothing prior of about 2 games at 85% (my reconstruction, not documented). Agent record: "new (needs 3 yeses from two hosts)".
- Joining G75 and G90: waitlisted, with the honest reason "shows up 33% · 3 games; this game needs 75% / 90%". Open and Soon: joined immediately.
- G75 (about 22h away): Bob was moved up on its own, with notice "A spot opened the day before: you're in..." (kind gameon). G90 (about 27h away) stayed waitlisted, which fits the day-before rule. I did not see the move-up happen at the 24h mark, since the clock can't be moved.
- Host view (GET /api/invite): only the host's own counts; the host sees "Bob" with "shows up 33% · 3 games", the published badge words. No raw 1-of-3 shown to others.
- Leaving G75 (about 22h before) and Soon (about 4h before): the host got a "Bob can't make it" notice and the spot reopened. Bob's trust record stayed unchanged (still the seed 1 of 3, no new chain entry for him).
- Agent channel: key registered. Join with delegation off: 403 "Your person hasn't let you say yes...". With delegation on (newPeople false): 403 "Ask your person: the host is new." Both consistent with the docs.

## Findings
1. MINOR: the public game comment names the badge and the waitlist reason: "Bob is on the waitlist: shows up 33% · 3 games; this game needs 75%." Everyone who can see the game reads it. This matches "others see shows up N%", but it is the closest thing to shaming. Consider showing it to the host only.
2. MINOR / possible privacy gap: GET /api/huddle/one?id=<h-...> as Bob (not invited, not a player, mine:false) returned another host's full huddle talk and details. I found no doc saying huddles are readable by any member. Worth a check, but I can't say it breaks a promise.
3. Not testable: late leaving inside six hours is not documented in the docs I could read, and leaving 4h before Soon changed nothing in Bob's record, so I have nothing to compare it against. A no-show or late-leave penalty could not be tested. Agent answering yes for Bob within limits was not reachable, because every available host was new. Gated huddles: Bob was not asked in the 75% huddle (host saw no waiting list), so it was not clear whether he should have been listed as waiting. A huddle's court-pick failure ("can't find the court you picked") is outside this scope.

No wrong state or undocumented unfair rule found.

VERDICT: 0 BLOCKER, 0 BUG
