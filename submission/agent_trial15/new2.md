# Trial 16 new2 - Ari, tennis near Da'an (about 95 requests, header x-tester: r16new2)

Method: read agent card, llms.txt, OpenAPI (/api/openapi.json), then called each member/agent route once correctly and once wrong (session and Ed25519-signed). Server-side outcome: Ari joined Mei's Monday 2 Nov 07:00 tennis game (POST /api/huddle/game {post:"pmvui4dzhc742aec1",yes:true} -> "You're in"; GET /api/invite then going:1, full:true). Also started a huddle (h-abde2131), Kenji and Mei agents said yes.

## BUG
1. POST /api/clubs {name:"Bad2",sport:"tennis",where:"x",at:{...},privacy:"secretive"} -> 200 and the club comes back with privacy:"public". A wrong value is silently changed (no 400).
2. GET /api/feed?room=nonexistent -> 200 {"posts":[],"private":true} instead of 404/400 for a room that does not exist (same for POST /api/feed/post room:"c-doesnotexist" -> 403 "This club is private: ask to join first", which is wrong: no such club).

## MINOR
3. POST /api/huddle/home {"place":"Da'an, Taipei"} works and llms.txt describes it, but OpenAPI lists only lat and lon for that route (llms.txt and OpenAPI disagree).
4. llms.txt says /api/huddle/game "why" is time|place|price; server accepts busy, time, place, price, quiet, none.
5. Deal text: agent says "Would you take NT$410?", venue answers NT$550 "as low as I go", agent says "NT$550 it is" (no real haggling; sample prices, so wording only).
6. Leaving a club as its only member returns {"club":null} (club vanishes). Not documented.
7. OpenAPI documents only 200/400/401 for every route; real routes also return 403 and 404, and /api/me-style errors include a "signIn" text.
8. llms.txt mentions deleting a comment (feed/delete {comment}) and posting comments; the member side has no comment route in OpenAPI (only /api/agent-channel/comment).

## Checked and fine
- Agent card, llms.txt and OpenAPI agree on base URL, auth schemes, signed JWS claims, security names.
- Wrong values refused with clear 400/401/404: demo name:123, bad JWK, lat 925, sport quidditch, window day "Funday", maxKm -3, open on:"yes", delegate maxEach -5, answer pick:"zzz", deal players 99 / unknown place / date outside 30 days, game why "weather", yes:"maybe", clubs lat=abc, clubs/join on:"maybe", unknown club, past-date invite, unknown post/huddle ids, revoke of foreign agent.
- Unknown kid on signed route -> 401 "unknown-peer" (message wording refers to peers, MINOR).
- Trust chain, verify, keys.json respond 200 and agree (n:10, same head).
- Not exercised for lack of budget: agent-channel/post, huddle/reply (valid), cancel (valid), feed/join (valid), agent-channel limits (tighten and loosen), members/leave.

VERDICT: 0 BLOCKER, 2 BUG
