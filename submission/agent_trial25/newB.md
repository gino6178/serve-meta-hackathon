# Serve audit (tester newB) against http://127.0.0.1:8899

Scope: HTTP only, header `x-tester: newB` on every request. Signed in as Victor (demo), plus two extra demo accounts (Tess, Uma) to check what another member sees. A test agent key (ag-a382d2502dae) was registered for Victor. Roughly 60 HTTP requests were made, a little over the ~50 budget.

## Sweep

- GET /, GET /llms.txt, GET /privacy.txt, GET /.well-known/agent-card.json, GET /api/openapi.json (the OpenAPI file lists 60 paths).
- Victor set home, sports, and limits (Mon-Fri 18:00-22:00, 3 km, NT$150). Then he joined an open game, Leo's Mon 2 Nov 19:30 badminton game.

## Privacy: no leak found

- Anonymous GET /api/invite?id=pmvwb3v8u43f5fb94 returns the venue's coordinates, the host's first name, and the club room id. These are venue data, not a member's home.
- Victor's home (25.03, 121.56, rounded) does not appear in any response Tess or an anonymous client receives. I searched the responses for lat/lon keys.
- Tess GET /api/huddle/one?id=h-a3ab744b (Victor's huddle) returns `{"error":"No such game."}`.
- Anonymous GET /api/huddle/one and GET /api/clubs/<id> return "Sign in first".
- Trust chain entries use pseudonyms (for example `7054654120d443ef`). Only words like "shows up likely 72-99%" are shown.

## Limits and permission: held

- Agent key, POST /api/agent-channel/huddle/limits with maxKm 10, maxEach 500, and Sat/Sun windows: refused with `"Over the agent channel limits can only get tighter; loosening them needs your person's session."` (needs: person).
- Agent key, tightening to maxKm 2 and maxEach 120: accepted, and Victor's taste reflects it.
- Agent key, POST /api/agent-channel/huddle/delegate: refused, "it is their permission, not yours."
- Agent key, join Ray's Sunday basketball game (outside window and too far): 403 needs: person.
- Agent key, join Tess's NT$200 game (Thu 5 Nov 19:00, in window): 403 `"it's outside their limits (costs too much)"`. This holds even after the person set a delegate maxEach of 500 (see MINOR 3).
- Person session, POST /api/huddle/game for the same NT$200 game: 409 "outside the limits set for you". Person session, POST /api/feed/join: allowed, with a note that says it is outside the agent's limits and "your agent wouldn't have". This matches the llms.txt description.

## Double join and double booking: held

- POST /api/huddle/game for Leo's game twice: first join succeeds, second returns "You're already in that game." `going` stays at 1. Feed join on that game twice also does not duplicate.
- Victor joined Tess's Thu 5 Nov 19:00 game. Uma posted an overlapping Thu 19:30 game:
  - Victor, via /api/huddle/game: 409 "It clashes with a game you're already in."
  - Victor, via /api/feed/join: refused with "which overlaps this one. Leave that game first."
  - Agent key, via /api/agent-channel/huddle/game: 409 clash.
- Tess cannot post an overlapping game either (refused).

## Signatures and replay: held

- Replay of an identical signed request: `"refused: a request already received"` (why: replay).
- Changed signature: `"the signature does not check out"` (why: bad-signature).
- Body swapped after signing: `"the body is not the one signed"` (why: wrong-body).
- The trust chain records these as `sig` entries against the agent's record, as llms.txt says.

## Honesty of game text: nothing false found

- "Victor is in. 2 of 3 spots left" and "Victor can't make it. 2 of 3 spots left" match the invite's `going` count.
- The Wed 4 Nov huddle: the venue quote (NT$430 for four, 108 each, busy 0.79, "usually 79% full") matches what the agent told Victor. Victor's answer stayed null until he replied yes, so the agent did not answer for him.
- Leaving with POST /api/huddle/game {yes:false, why:"price"} and POST /api/feed/join {on:false} both work as llms.txt says.
- Calling off a huddle (POST /api/huddle/cancel {id}) sets status "cancelled". I did not test `game:true` on an agreed game.

## Money: none found

- No payment, deposit, or booking route appears in the OpenAPI paths.
- POST /api/huddle/deal returns a quote only. It states the venue's list price and asks for a quote. No payment is taken.

## Findings

### MINOR 1: joining a club room's game silently makes the person a club member
- Victor had `clubs: []` in GET /api/huddle/me before. After POST /api/huddle/game {post: pmvwb3v8u43f5fb94, yes:true} (a game in room c-dad8cf02, Daan Badminton), `/api/huddle/me` shows `clubs: [{id:'c-dad8cf02', name:'Daan Badminton'}]`.
- The join reply does not mention the club. Tess's GET /api/clubs now lists "Victor" among the club's names (`names: [..., "Victor"]`).
- The llms.txt does not describe this side effect.

### MINOR 2: a one-off basketball huddle changed Victor's standing sports list
- Victor had sports `["badminton"]`. POST /api/huddle/start {"sport":"basketball","need":6,"nearby":true} then left `sports: ["badminton","basketball"]` in his taste. He never chose basketball, and it now widens which games the agent brings him.

### MINOR 3: the delegate maximum can be stored above the person's hard limit
- With Victor's limitEach at 120, POST /api/huddle/delegate {"on":true,"maxEach":500,"newPeople":true} was accepted. The response shows `delegate: {on:true, maxEach:500}`.
- Enforcement is still correct: the agent's join of a NT$200 game was refused. But the stored delegation reads as NT$500, while llms.txt says delegation works "within those limits".

### MINOR 4: small label mismatch in the feed
- Feed response: `club: {name: "Riverside Sports Club"}`. Clubs list: c-a2708e31 is named "Riverside Hoops".

### MINOR 5 (not a defect, noted): start validation
- POST /api/huddle/start {"sport":"badminton","need":3,"nearby":true} was accepted. llms.txt says badminton is usually 2 or 4 and that 2 to 12 is accepted, so this is consistent with the docs.

## Not checked
- Leaving an account (POST /api/members/leave) was not run, because it deletes data.
- Cancel with `game:true` on an agreed game was not tested.
- Full A2A JSON-RPC flows were not tested.
- The Wed 4 Nov huddle stayed "asking" because the seeded members do not answer in real time, as the brief said. Not counted.
- Test state left on the copy: Victor has a registered agent key, a delegation (maxEach 500), and a basketball sport entry. Tess and Uma exist as demo accounts. A private key file (for the test agent only) is in the scratchpad folder under trial37.

VERDICT: CLEAN
