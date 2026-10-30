# Mei (r11mei) report, ~50 requests

Done: set limits (Mon-Fri 18-22, Sat/Sun 8-18, 6 km, NT$120), delegation on (newPeople false), sports, open; registered Ed25519 key (signed channel works). Created Ann and Bo, joined Xinyi Tennis. Mei posted Tue 3 Nov 19:00 NT$100 game; huddle fill with fill:<post> agreed it, Ann/Bo (as persons) said yes, Mei's agent was refused ("someone new is in it", needs person), Mei said yes -> "Game on", feed/notices matched.

Worked as promised:
- Agent loosening limits refused; tightening (Sat/Sun 9-12, 4 km, NT$80) accepted.
- Recommended games respect limits: Ann's Sun 17:30 NT$150 and Sat 10:00 NT$95 not offered to Mei; Sat 10:00 NT$70 offered with "one of your good times", "close: 1 km".
- Agent-channel join/game refused outside limits with reasons.
- No money anywhere; privacy.txt says no payment details.

NOT TESTABLE: GET /api/huddle/places (tennis, pickleball) returned places:[] with "The map of courts isn't answering right now" (status shows no map/internet in this copy). So courts list, quiet hours, venue offers, /deal quotes, weekly deals and a quiet-court huddle pick could not be checked. Huddle without a court said honestly it can't pick one. Treated as a local-copy limit.

Findings:
- MINOR: after tightening to NT$80, agent join of a NT$150 game says "over the NT$120 your person allowed" (delegation cap) while the same reply says "outside their limits (costs too much)"; two different caps are quoted.
- MINOR: huddle/start {need:1, fill} reports "need":3 and talk "3 for tennis" for a 2-spot game (counts host plus 2), odd for tennis.
- MINOR: the pick for the Tue 19:00 game carries busy:0.94 and price/list/off all 0 beside each:100; no words mention how busy it is, though Mei prefers quiet. Not clearly wrong, but unexplained.
- Mei's seeded Mon 07:00 game is outside her new windows (her own post, not an agreement; no issue).

VERDICT: 0 BLOCKER, 0 BUG
