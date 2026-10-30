# Trial 9 new1: Omar, weekly Sunday basketball (about 45 requests)

Path: /llms.txt, demo account, home/sports/limits (Sun 09:00-12:00, 4 km, maxEach 0)/open/delegate (newPeople false), 5 questions answered "either", Ed25519 key registered, then the agent channel. Game posted with the session (POST /api/feed/post, 2026-11-01 09:00, 6 spots, each 0, minShow 0.75, repeat weekly 8). Fill started over the key (huddle h-3e97c1da).

## Promises that held
- Channel loosening refused: POST /api/agent-channel/huddle/limits wider -> 403 "limits can only get tighter... needs your person's session".
- Pin on Sat 7 Nov 15:00 -> 400 "outside the times you set".
- Delegation newPeople:false: fill note says new people wait; Ray (new) waitlisted, Ken (73%, under 75%) waitlisted; gate 0 raised to 60% with a note; Ken's agent (67% kept) cannot answer, so he is asked directly. Agreed 1 Nov 09:00, free, 0.3 km.
- Ending: Ken's yes is pending (simulated); 0 of 6 spots filled.

## Findings
1. BUG: the posted game's gate is `{"minShow":0.75,"agentMin":0.8,"newOk":true}` in the POST /api/feed/post response, while the fill for the same post has newOk:false. Omar said no total strangers, but the shareUrl (/#/invite?id=pmvuf3ukyabbfbfa7) is documented as joinable by anyone, and the post gate lets new people in. The only post gate documented is minShow; I found no way to set newOk. (Not tested by joining.)
2. MINOR: POST /api/feed/post has no agent-channel route (404 "no such route" on /api/agent-channel/feed/post), so posting needs the session. The brief and llms.txt imply everything after setup runs on the key. The weekly post and each week's fill also have to be started by me. I could not check the weekly repeat, since the clock cannot be moved.
3. MINOR: GET /api/agent-channel/huddle/places?sport=basketball returned `places:[]`, `looking:true`, `retryAfter:20` on 3 polls over about 70 s. I could not find a free court from the API and used a made-up name ("Songshan public court"), which was accepted.
4. MINOR: limit maxEach 0 (free only) shows `priceCap:60` and the summary says "aim to pay under 60 each". The hard limit is stored as 0 and the agreed game was free.
5. MINOR: the first fill (h-ee01a2c0, minShow .75) ended "stuck" with only 2 candidates invited. The message "Try fewer players, or more people" does not say that Omar's gate caused it.
6. Not tested, to avoid harming the record: replayed or bad signatures.

VERDICT: 0 BLOCKER, 1 BUG
