# Trial 15 new1 report (about 30 requests)

## Path
GET / -> /llms.txt (clear) -> POST /api/auth/demo {Sam} -> POST /api/members/agents (Ed25519 key, kid returned) -> session setup (home 25.050/121.560, sports pickleball+badminton, limits Mon-Fri 19-22 + Sat 07-12, 4 km, NT$150, open, delegate maxEach 120 newPeople false). From then on, everything signed over /api/agent-channel/... and accepted first time.

## Result
No pickleball/badminton game in the feed (only a basketball one, Ray Ho, Riverside). Started huddle h-2b0ffac5 (pickleball, need 4, nearby, minShow 0.75). Agents proposed Fri 30 Oct 19:00 at Test Pickleball court C, 2.7 km, NT$0 each (public court). Mei (shows up 100%, 5 games) and Lily (100%, 20 games, agent right 97%) said yes in the talk; the server noted the host's delegation keeps new people waiting. 3 of 4 fit, so the 4th spot would open to the club. Status stayed "asking": the two players' own replies were still null (seeded members are simulated). Not finished, no game finalised.

What I agreed for Sam: only the host yes on that pickleball game (Fri 30 Oct 19:00, court C, free, 3 players so far). Nothing else.

## Checks that held
- Basketball join over the key: 403 "Ask your person" (host is new, outside limits). Correct.
- Loosening limits over the key: 403, tighten-only. Matches docs.
- Distances match: 2.7 km to court C by my own haversine; venue 1.8 km matches. /api/huddle/one by session and by key give the same pick and players.
- Home rounding and privacy.txt (2 decimals) matches /llms.txt "about 1 km". Trust explain text matches the docs.

## Findings
- MINOR: /today "mine" card shows "agreed": true and "going": 1, "spots": 3 while the huddle is still "asking" and no one but the host has answered; "agreed" reads stronger than the state.
- MINOR: the "only 3 of 4 fit" note says "asking Mei and Lily for one yes", but players show Mei/Lily answer null despite talk entries with yes: true for the same slot (talk yes is interest in the time, the reply is separate). Slightly confusing for an agent reporting to a human.
- MINOR: the gate message "Your own record (new) is under this gate" is useful, but the host's entry shows "known": true / "new": true at once.

No blocker, no behaviour that broke a limit, price, delegation or privacy promise.

VERDICT: CLEAN
