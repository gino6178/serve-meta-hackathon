# Trial 16 new1 report (Ming, Sunday game)

Path: GET / -> /llms.txt -> demo session -> registered Ed25519 key -> setup (home, sports, limits Sun 13-18 / 4 km / NT$100, 6 questions, open, delegate newPeople:false) -> all further calls signed over the agent channel. About 45 requests.

Outcome: huddle h-d4215b31 (volleyball, need 8) is "asking". Pick: Sun 1 Nov 16:00, Test Volleyball court C, free, 2.1 km. Inside Ming's limits. Ming's own yes was given by the agent (free, in window). Only Ken (shows up 73%, 11 games) fits; he was asked directly, and his reply is pending (simulated, due in 24 h). Not agreed yet: honest reason is waiting for a record-holder's yes. Badminton doubles (h-e8a73b1d) said "stuck" because the volleyball game already holds Sunday afternoon; I cancelled it.

Checks that held: loosening limits over the channel -> 403 "needs your person's session"; gate 60% with newOk false and a note saying so; court distances/busy match between places and the pick; trust text consistent with llms.txt; signed requests worked first time.

Findings
- MINOR: /api/huddle/question says "of":5 and llms.txt says "about five", but a 7th question (q6-timetime) was still served after 6 answers (answers:6).
- MINOR: Today card for the volleyball game shows going:1, spots:2 while the huddle needs 8 (talk says "7 spots open", later "6 open spots"). The numbers don't line up across the talk and the card.
- MINOR: Stuck badminton message "Every option is outside your own limits (you already have a game at those times)" blames limits; the cause is a clash with his own game.
- MINOR: POST /api/members/agents returns the kid under agent.kid; not obvious from the docs text (I guessed the wrong field first).

No BLOCKER; no BUG found.

VERDICT: CLEAN
