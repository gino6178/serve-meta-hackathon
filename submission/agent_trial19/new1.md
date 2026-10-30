# Trial 20 new1: Pia, tennis doubles near Zhongshan

Path (about 20 requests, all with x-tester): GET / -> /llms.txt -> POST /api/auth/demo -> huddle home/sports/limits (Mon-Fri 18:30-21:30, 4 km, NT$200) -> POST /api/members/agents (Ed25519) -> open + delegate (maxEach 160, newPeople false) -> signed GET agent-channel/me, huddle/today, huddle/start (tennis, need 4, nearby, minShow 0.75), huddle/one, feed, places, trust, reply.

Outcome: not joined or agreed yet. Huddle h-a7fce44f status "asking". Pick: Fri 30 Oct 19:00, Test Tennis court C CB, NT$0 each (free court), 1.7 km. That is inside all of Pia's limits. Mei (shows up 100%, 5 games) and Joy (75%, 4 games) both said yes to the time in the talk. Their final reply is awaited (due about 2 h out). Seeded members don't answer in real time, so this is an honest "pending". Host yes is recorded (my reply yes:true was accepted). The game would have 3 of 4 players, with 1 spot open to the club.

Things I did not do: I did not answer the taste questions, because Pia gave no preferences and the docs say to answer only from what the person said.

Checks that held up:
- Limits echo identically on /api/huddle/limits, /huddle/me and /today.
- Home was rounded as privacy.txt says (25.053,121.528 -> 25.05,121.53).
- Signed channel worked first time. Gate note correctly said new people wait.
- Trust numbers on Mei and Joy match between talk and players.
- The Pia self-record "new · 0 games" matches /huddle/trust.

Findings:
1. MINOR: the talk says "Everyone who could be asked said yes to Friday 30 Oct, 19:00", but players[].answer for Mei and Joy is null and status is "asking". "Yes to the time" and "yes to join" are not told apart for a reader.
2. MINOR: /huddle/trust says "Games at 90% wait-list new people; at 75% or less they let you in", while my gate of 0.75 plus newOk false kept new people waiting. Wording is hard to square with llms.txt.
3. MINOR: players[0].name shows "You" over the agent channel, not "Pia", while the talk uses "Pia".
4. MINOR: the pick is today (Fri 30 Oct, 19:00), so "this week" gives little lead time. The earliest time offered was also the one chosen.

No BLOCKER, no BUG observed.

VERDICT: CLEAN
