# Trial 8 / new1 - Lena (badminton/TT, Tue/Thu 19:00-21:30, 3 km, NT$120)

About 30 requests, all to 127.0.0.1:8899 with x-tester: r8new1.

## Path (address to only Lena's yes missing)
1. GET / -> /llms.txt (followed the guide).
2. POST /api/auth/demo {"name":"Lena"} -> session.
3. Ed25519 key via node; POST /api/members/agents -> kid. Every later call signed on /api/agent-channel/... (all accepted).
4. home (25.026,121.543; stored as 25.03,121.54), sports, limits (Tue/Thu 19:00-21:30, 3 km, NT$120) via session.
5. Five questions answered "either" over the agent channel.
6. places, deal, today, start (nearby, Tue/Thu evening, need 4), one.
7. Result: huddle h-93115d11 agreed "Thursday 5 Nov, 19:00 at Taipei Gymnasium, NT$98 each", 2.6 km, waiting on "You, Lily, Grace, Leo". agentMay = 403 (no delegation), so I did not give her yes.

## Limits checked in every response
- Questions q0-q4: all Tue/Thu 19:00/19:30, 0.8-2.8 km, NT$40-120. OK.
- places: 5 courts, 1.2-2.6 km; offers NT$98-118 each. OK.
- deal in limits (Thu 19:00): fine. Out-of-limit (Fri 19:00; 2 players = NT$235 each; Thu 20:30-22:00) returned "outside":["time","price"] plus a note "A quote only... no game is agreed". Clearly marked, OK.
- Venue hours: Thu 22:00 start was refused with a clear 400.
- today: only game card Tue 3 Nov 19:00 Daan Sports Center, 0.8 km, NT$100. OK.
- Huddle talk and pick: only in-limit proposals; Bob's counter (Tue 3 Nov 19:00 Jhong Jheng) is in limits.

## Findings
- MINOR: places[].quiet lists "quiet" hours with busy 0.76-0.89 (e.g. 松山 Tue 3 Nov 19:00, busy 0.89), while the same response says "usually 89% full". The label contradicts the numbers; these are just the least-busy slots inside her windows.
- MINOR: Git Bash users must set MSYS_NO_PATHCONV for paths; unrelated to the server.
- deal takes the venue id (osm:way/...), not the name; the 404 error text is clear.

No limit violations, no blockers.

VERDICT: CLEAN
