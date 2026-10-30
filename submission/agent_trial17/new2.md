# Trial 18 new2: Ivy, pickleball near Neihu (about 115 requests, 2 demo accounts, header x-tester: r18new2)

Covered once right and once wrong: status, auth/demo, me, members/agents, agents/revoke, clubs (GET/POST/join), feed (room, post, join, delete post and comment, notices), invite, trust chain/verify/keys/huddle trust, huddle home/sports/limits/open/delegate/question/answer/places/deal/start/one/reply/cancel/game/needs/today/me, and agent-channel me/feed/comment/join/deal/limits/sports/answer/question/reply/trust. Agent card, llms.txt and OpenAPI agree on routes. Wrong values gave clear 400/404/403 with no 500s.

## BUG
1. GET /api/feed?room=c-1b3a1683 (my club "Neihu Pickle Crew", created and joined by me) returns "club":{"name":"Riverside Sports Club"}. Wrong club name for the room (seen twice, with and without posts).

## MINOR
- POST /api/feed/delete {post:<my game>, comment:"cnope"} (comment does not exist) gives 403 "Only its author can delete that comment", not 404. Deleting my own agent's comment (cmvuj643n9d929e31, posted by my key) also gives 403, so the owner cannot remove their agent's comment on their own post.
- POST /api/feed/delete {} gives 404 "not in the feed", not 400. GET /api/invite with no id gives 404 "not open any more", not 400.
- Leaving a club as its only member deletes it (join again then 404, room 404). Not in the docs.
- POST /api/huddle/reply {id, yes:true} from the host while ask:false gives 200 and changes nothing. It is not clear whether the yes counted.
- OpenAPI lists only 200/400/401 on every route; real answers also use 403 (needs delegate/person) and 404.
- A revoked or unknown key is refused as "signed by a key no allow-listed peer has" (unknown-peer): wording for peer gateways, confusing for a member's agent.
- POST /api/clubs with privacy "open" is refused ("public or private"). The OpenAPI says only "string".

## Checked and fine
- Agent-channel limits: loosening gives 403 needs:"person"; tightening is accepted.
- Agent-channel join without delegation gives 403 needs:"delegate". With delegation, joining my own invite gives 400.
- Deal NT$380 for 4 players is each 95, as stated. A 22:00 deal is refused with the venue hours.
- Revoke twice returns 200 both times. A revoked key is then refused.

## Ivy's game
Huddle h-4a9274ef (4 pickleball players, nearby): Sat 31 Oct 14:00 at Test Pickleball court C (1.4 km), free. Ivy and Mei (simulated) are yes. It stays "asking" with 2 of 4 players, so the other 2 spots open to the club. Ivy also has her own posted game pmvuj64324aa3b585 (7 Nov 10:00, 3 spots). No recommended games appeared in /today. Ivy has a game forming, not a full one.

VERDICT: 0 BLOCKER, 1 BUG
