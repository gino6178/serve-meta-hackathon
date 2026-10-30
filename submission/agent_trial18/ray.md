# Trial 19 - Ray Ho (basketball, Riverside Hoops) - about 83 requests

Setup: registered an Ed25519 key (agent-channel works); limits Mon-Sun 17:00-23:00, 8 km, 100 each; delegation on (max 100, new people allowed). Four demo accounts (P1-P4) joined Riverside Hoops as players and answered on cue.

## Results
1. Overlap (90 min): PASS. Via /agent-channel/post on 2026-11-07, 19:00 posted, 20:30 posted (200, warning only), 20:00 refused 409 "That overlaps ... 19:00". P1-P3 filled both 19:00 and 20:30 (full: true). A huddle pinned 20:00 against Ray's 19:00 game ended "stuck": "Every time that fits clashes".
2. Counters: NOT TESTABLE here. Players' "no" replies carried no counter time in the huddle talk, so no counter was made or refused. Counters apparently arise only on A2A, which needs allow-listed gateways.
3. Leave from an agreed game that is on: PASS for the case I could set up (h-e7d1ecfa, it did reach the feed): P1 left via /feed/join on:false, and Ray got "left ... 1 of 2 spots left". The "never reached the feed" variant could not be set up: every agreed game that turned "on" got a post.
4. Host filling own posted game: PASS. Fill huddle h-52bb23c1 (fill=post): host answer already yes, ask:false, Ray's /today showed only "mine" cards, no "are you in?".
5. Leave clears Game on: FAIL (BUG 1). Deleting: PASS. Leaver no longer a yes: PASS.
6. Earlier items: one no keeps game with open spot PASS (P2 no, P1 yes, posted spots 2, going 1); leaver can take it back PASS at the post (P1 rejoined, going 2); agreed games reach the feed PASS; overlap refusals PASS; channel limits loosen (price, km, windows) = 403 "can only get tighter", tightening 200 PASS.

## Findings
BUG 1 - Leaving does not clear the "Game on" notice. Game 2026-11-21 19:00 (pmvujqlol06742ada) filled, Ray hadn't taken notices; P1 left; GET /api/feed/notices returned both "Game on: ... is full. R19 and R19 are in." and "R19 can't make your ... 1 of 2 spots left". The Game-on is stale and false.

BUG 2 - Feed joins/retakes are missing from the huddle record. After P1 left and rejoined h-e7d1ecfa's game, the post says going 2 / full, notices say "R19 and R19 are in", but /huddle/one players lists only Ray + P2. Same when P2 (who answered no) took the open spot of h-f4e9ac96: post full, huddle players Ray + P1 only, status on. The two records contradict.

MINOR - For Sunday-evening ask with P2 limited to Sun 21:00-23:00 (inside Ray's window) the agents proposed only 17:00/18:00 and never 21:00; it settled for 2 of 3.


VERDICT: 0 BLOCKER, 2 BUG
