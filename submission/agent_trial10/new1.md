# Trial 11 new1 report (about 33 requests)

Path: GET / -> /llms.txt -> POST /api/auth/demo (test account "Ana") -> home/sports/limits (Sat 12-18, 3 km, NT$100)/open/delegate (maxEach 0, newPeople false) with her session -> POST /api/members/agents (Ed25519, kid serve-aada8c...) -> everything after signed on /api/agent-channel/. /me with my key worked first time. Docs matched the flow (bar the Git Bash path mangling on my side).

Game: huddle h-b3f9cc15, basketball need 6, Sat 31 Oct afternoon, nearby. Result: "Agreed: Saturday 31 Oct, 16:00 at Basketball court, a free court" (0.4 km, NT$0). Only Ken (shows up 73%, 11 games, agent right 67%) was asked, directly, because his agent is under the 80% bar. Ken has not answered (simulated; due in 24 h). Ana is the only yes. So: no full game this session, honest reason is 5 of 6 spots still open, and no post exists yet to fill them (post: null). I did not post publicly (needs Ana's okay). Ray's 18:00 game is outside her window.

Checks that held: loosening limits over the key -> 403 "can only get tighter... needs your person"; trust chain verify ok; privacy rules matched (new gate, newOk false, 60%).

Findings
- BUG: self-contradiction in the talk and cards. Talk says "No time suits all 6... the other 5 spots will be open to the club", then "Agreed: ... Asking Ken for one yes" with agreed:true, while status is "asking" and Ken's answer is null. GET /huddle/today "mine" card says going 1, spots 2 for a 6-player game. A player reading "Agreed" or "spots 2" is misled about how full the game is.
- MINOR: the talk only shows my side's proposals (16:00, 14:00 twice with two place names "Basketball court" and "籃球場", then 12:00). No counters or reasons from anyone else, so I could not show Ana "what others said and why".
- MINOR: "suits the most of you (1)" counts only Ana, not the asked Ken.
- Side effect of my testing: I tightened Ana's stored limits to Sat 13-18, max NT$50 (test of tightening). Ana should be told; restoring needs her session.
- Preference questions (5) left unanswered because Ana gave me no answers.

VERDICT: 0 BLOCKER, 1 BUG
