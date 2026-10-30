# Trial 8 – Ivan (host) report

Ran ~66 requests. Done: limits (Mon–Fri 18–22, 3 km, NT$120), delegation (NT$120, newPeople false), key registered and signed channel works (agent-channel loosening refused 403, tightening OK; I restored 3 km). Posted games (Tue 3 Nov 19:00, Wed 4 Nov 20:00, Mon 2 Nov 19:30). Two test accounts (Mia, Ben) joined Daan Badminton.

Worked as promised
- Fill huddle on a posted game: agent-channel start with delegation gave "new people wait, gated 60%", Mia/Ben wait-listed, "Dan's agent can't answer (keeps only 52%)", then "Asking Lily, Leo, Grace and Hana for one yes".
- "when" huddle (Wed/Thu evening): chose Thu 19:00 Taipei Gymnasium, 1.3 km, NT$98 each (inside limits); agentMay 403 "someone new is in it" matches delegation.
- Ben "busy" led to a renegotiation: Dan asked directly, new "Asking Kenji, Mia and Dan".
- Booking into the posted game: all yes gave "Everyone said yes: they're in your game", then "Game on" notices to host and players.
- Mia leaving: host got "Mia can't make... 1 of 2 spots left"; a simulated Kai filled in and left again, notices consistent.
- Call-off: Mia (had said yes) got "Ivan called off badminton Thursday 5 Nov, 19:00."

Findings
1. BUG – double-booking: Ben was in Mon 2 Nov 19:30 (Game on, 90 min). Ivan posted Mon 20:00; POST /api/feed/join {post:pmvuee3zj554b0116,on:true} as Ben returned 200 and Ben is going (going:1). No warning or refusal. Ivan could also host two overlapping games.
2. BUG – huddle disagrees with its posted game: in fill huddle h-449cb75e, Mia and Ben had joined post pmvueahsl5b802315 (post says going:2, comments "Mia is in") but the huddle still showed waitlist ["Kenji","Mia","Ben"], going:1 and "waiting" for others; /huddle/today listed the same game twice (huddle:h-449cb75e going 1, and the post going 2).
3. MINOR – after Mia left game pmvuedpy3d1f30946, huddle h-9b13fd58 still showed Mia:yes, status "on".
4. MINOR – Mia's first yes on h-566b06b8 shown as null after Ben's busy renegotiation (needed to re-send).
5. MINOR – cancelling the fill huddle h-449cb75e left the posted game open with Mia and Ben in, with no notice to them.

Not tested: waitlist moving up (only two extra accounts allowed; seeded members don't answer).

VERDICT: 0 BLOCKER, 2 BUG
