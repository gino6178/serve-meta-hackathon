# Trial new2 report (Ravi, badminton, Zhongshan)

About 25 requests. Header x-tester: r12new2 on all.

## Path taken
1. GET / -> pointed to /llms.txt (clear, enough to proceed).
2. POST /api/auth/demo {"name":"Ravi"} -> session. Registered Ed25519 key via POST /api/members/agents (kid serve-f1930f759c1d4bce).
3. With session, set home (25.055,121.525), sports, limits (Mon-Fri 19-22, 3 km, NT$150), open on, delegate on (maxEach 120, newPeople false). Home was stored as 25.05/121.53 (documented ~1 km rounding).
4. Everything after that over the signed agent channel. GET huddle/today showed no open games nearby, only a taste question (I did not answer it for Ravi, per docs).
5. POST agent-channel/huddle/start {badminton, need 4, nearby, Mon-Thu evening} -> within seconds: "Agreed: Thursday 5 Nov, 20:30 at Taipei City Jhong Jheng Sports Center, NT$100 each" (1.7 km, ends 22:00, venue list NT$420, negotiated 400/4). Host yes came from delegation (NT$100 < 120). Invited Leo, Lily, Grace (all with records 93-100%); "Joy" (agent new) was left out, matching newPeople:false. Gate minShow 0.6, newOk false. The note honestly says my own record is new and below the gate.

## Limit and refusal checks (all correct, clear)
- Loosen limits over agent channel: 403 "can only get tighter... needs your person's session".
- Loosen delegation: 403 "Only your person changes this".
- Pin Sat 10:00: 400 "outside the times you set".
- Post at NT$200: 403 "outside what your person set (costs too much)".
- Start without nearby/club: 400 "Tick Also ask people nearby, or join a club".

## Findings
- MINOR: POST huddle/reply yes by the host on their own huddle returns 200 and echoes the huddle with no indication it was a no-op (host already yes).
- MINOR: start with need 4 reads as 4 total including host (3 invited); docs say "need" without stating whether the host counts.
- Docs matched behaviour otherwise. The three invited players' answers were still pending (simulated, as expected), so the game is agreed with Ravi but not yet confirmed by others.

Agreed for Ravi: Thu 5 Nov 20:30, Jhong Jheng Sports Center, NT$100 each, no money moves.

VERDICT: CLEAN
