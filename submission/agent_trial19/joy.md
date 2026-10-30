# Joy Lin (price first, Xinyi Tennis) - trial20 report
Setup: limits (Mon-Fri 18-22, Sat/Sun 9-18, 6 km, NT$150), delegation on (no new people), key registered (signed GET ok). Over the channel, loosening limits gave 403; lowering maxEach to 120 worked. Four test players (Mia Chen, Mia Wu, Noel Ho, Pat Su) joined Xinyi Tennis. About 88 requests.

## Re-checks
1. Joiner in agents' players: PARTIAL/FAIL. Pat joined from the feed while the huddle was still asking: feed going=2, huddle inGame=2, but Pat missing from players. Later Noel's last yes said "Everyone said yes: they're in your game" while the feed put Noel on the waitlist (wl 1). A waitlist-promoted player (Mia Wu, spot opened) was also absent from players (inGame 3, players had 2 non-host). A join after the game was on (Pat) and a leave/rejoin (Mia Chen) did appear correctly. Leaving cleared the other players' pending Game on notices (Mia Wu leaving removed Mia Chen's and Noel's). Host's own notice: not testable (the host never received a Game on notice).
2. No after agreed: FAIL. Joy said no (price) on Mia Wu's agreed huddle h-13216b9f; the host had only the "agreed" notice, nothing about the no (the talk did record it and a waiting player took the spot). A no on a settled game gives 409 "It's settled: the game is on." Later dead end "came after that no": not tested (budget).
3. /api/agent/answer: PASS. Game posted with day "Sat" was counted: "Your next game: Sat 2026-10-31 at 16:00. Games booked in the next 7 days: 1."
4. Same first name: PARTIAL. Feed shows "Mia", "Mia (2)". The huddle talk says "Asking Mia, Mia and Noel", "Mia left the game." / "Mia joined the game.", and players list both as "Mia": cannot tell which left.
5. Earlier items (90-minute clash, counters, one no keeps open game, delete notice, own limits over soft lines): not tested, out of budget. Limits-only-tighten: PASS.

## Findings
- BUG: feed joiner during asking / waitlist-promoted not in huddle players; "everyone said yes" contradicts the waitlist.
- BUG: no after agreed sends the host no notice.
- BUG: two Mias not told apart in huddle talk and players.
- MINOR: Noel got both "A spot opened" and "Game on" notices; leaves re-send Game on to unaffected players.
- MINOR: Sat 10:00 (inside her Sat window, high-score morning) said "not one of Joy's usual times".
- MINOR: invite day stored as "Sat", not a date.
- MINOR: start with place "Xinyi tennis courts" -> "can't find the court you picked".

Price-first: the "Test Tennis court B CB" free court was chosen for Joy; fine. No other price checks done.

VERDICT: 0 BLOCKER, 3 BUG
