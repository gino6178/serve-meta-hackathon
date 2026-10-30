# new1 report (Hui, badminton, ~27 requests)

Path: GET / -> /llms.txt -> POST /api/auth/demo -> POST /api/members/agents (Ed25519, kid serve-5c2b8a0c191a8aad) -> person-session setup (home, sports, limits Mon-Fri 18:30-22:00 + Sun 12-18, 3 km, NT$130; 6 questions; open; delegate maxEach 110, newPeople false) -> then only signed agent-channel calls.

Outcome: POST /api/agent-channel/huddle/start (need 4, nearby) returned at once with h-064ac444. Agreed Thu 5 Nov 20:30-22:00, Jhong Jheng Sports Center, NT$100 each (venue NT$400, list 420), 2.3 km, "usually 75% full". All inside her limits. Asked Leo (100%/8 games), Lily (100%/20), Grace (93%/14), all with records. The host yes was recorded (delegation worked). Status stays "asking": the seeded members don't answer in real time (local-copy limit), so the game is agreed but not yet confirmed full. No open feed game fit her windows (only Test Court games on Fri/Sat or earlier today).

Checks that passed:
- Tightening/loosening: agent-channel limits with wider values gave 403 "can only get tighter", and limits were unchanged afterwards.
- Counters: today card going 1 / spots 4 matches need 4 with host in.
- Price/busy matched the places route for the same venue (list 420 for 90 min, ~NT$100-103 each; busy 0.75-0.8 against the grid's 0.8 at 19:00 and 0.51 at 21:00).
- Gate note matched docs ("new people wait", 60%).

Findings:
- MINOR: venue lines say "List is NT$420 for 90 minutes. For that hour I can do NT$400" for a 90-minute slot (Thu 20:30-22:00). "Hour" is wrong.
- MINOR: the talk shows Joy (75%, 4 games, agent new) answering "can do that (the time)", but the host then asks only Leo, Lily and Grace. Nothing says why Joy was passed over (delegation excludes new agents). A reader could take it as a contradiction.
- MINOR: three different price numbers for Hui (limit 130, delegation 110, summary "aim under 111") are all consistent in behaviour but confusing in the summary text.

No BLOCKER, no BUG observed.

VERDICT: CLEAN
