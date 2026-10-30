# Ken Hsu (host) - round 25 report

Requests: about 95 (all with x-tester: r25ken). Accounts: 6 test members (Amy, Ben, Cara, Dan, Eli, Fay), all in Riverside Hoops.

## Lifecycles run
1. Huddle h-649ef0a4 (basketball, need 6, 5 invited by id, host yes): all invited agents said yes at once. Four real yeses, Cara "no/busy": went to "on" with 5 players and "1 spot open in the feed". Post card (going 4 of 5 spots), "Your games", talk and players list all agreed.
2. Feed joins: Cara joined from the feed, game full. Fay joined and was waitlisted; Amy left, Fay moved up with notice "A spot opened". Amy rejoined (waitlisted), Ben left, Amy moved up. Talk, players, card names, today "mine" (going 5/5) and notices agreed every time. Nobody was over the spots or double-booked.
3. Posted game G2 (Thu 5 Nov) plus fill (h-038e7bd8): Ben yes, Cara no (time), Dan and Eli joined with /huddle/game, Fay from feed: full 4/4, Amy waitlisted. Then cancel with game:true: huddle "cancelled", post gone from the feed and from "Your games", Amy (waitlisted) and Ben both got "Ken called off ...". No stale yes-question left (Ben's unread "Game on" came before the call-off, in order).
4. Stopped fill on G3 (Fri 6 Nov): huddle status "stopped", talk says "Ken stopped the agents filling the game; the game itself stands." Post stays in feed (going 0 of 4) and in "Your games".

## Findings
- MINOR: stopped fill sent Ben "you're not needed for it after all", while the game is still open and he could still join; wording could say the game still stands.
- MINOR: the feed card and "Your games" row carry no stopped/filling flag; the stopped state is only visible in the huddle.
- MINOR: the host got no "full" notice when Cara filled the first game (notices were empty), but did get "Game on ... full" after later waitlist moves. Players got a second "Game on" notice when a waitlisted player moved up.
- MINOR: fill huddle for G2 read "on" while 3 of 4 spots were taken (one open); consistent with the post but "on" is loose.

No double-booking, over-filling, wrong counts, or false statements found.

VERDICT: CLEAN
