# Tom's trial, round 27 (live site, https://play.theminimallab.com)

Tom, 41, organises Thursday basketball and is tired of chasing replies. First visit, using only the site's own guide (/llms.txt), the API spec (/api/openapi.json) and the requests the web app makes. Every request carried `x-tester: live-tom`.

## What Tom did, in order

1. `GET /` and `GET /llms.txt`: the home page and guide are clear, and the guide says where to look for every route.
2. `GET /api/status`, `GET /api/auth/providers`: server up, demo sign-in on.
3. `POST /api/auth/demo {"name":"Test Tom (round 27)"}`: signed in. The member came back as **"Test Tom round 27"**, with the brackets stripped (MINOR).
4. `POST /api/huddle/home {"place":"Daan District, Taipei"}`: the reply says `"found":"National Taipei University of Technology, 1"`, so the place Tom typed is not the place the site uses (MINOR).
5. `POST /api/huddle/sports {"sports":["basketball"]}`, `POST /api/huddle/limits` (Thu 18:00 to 22:00, 3 km, NT$150), `POST /api/huddle/open {"on":false}`: all accepted, and the limits were echoed back correctly. `open` stayed false.
6. `POST /api/clubs {"name":"Serve test round 27 (please ignore)","sport":"basketball","at":{"lat":25.04,"lon":121.53},"privacy":"private"}`: **refused**. Response: `{"refused":true,"why":"Not posted: it reads as a threat of violence."}`. The same request gave the same answer on retry. Tom's name is not violent and nothing in it reads as a threat, so the reason is false (BUG).
7. Diagnostics to find the trigger:
   - Same name without parentheses, `"Serve test round 27"`, private: refused with the same message.
   - `"Tom Thursday hoops"`, private: **created** (`c-d0ccb727`, `privacy: private`).
   - `"Basketball crew"`, no privacy field: **created as public** (`c-8d1e2b7a`, `privacy: public`). This was my mistake in testing, and it is still on the site (see CLEANUP).
8. `GET /api/clubs/c-d0ccb727/invite`: returned `{"link":"/#/club?join=<code, now dead>","code":"<code, now dead>",...}`. The full link is `https://play.theminimallab.com/#/club?join=<code, now dead>`. The route is `GET /api/clubs/{id}/invite` and the field is `link` (also `code`).
9. Invite file: my first attempt at the file was wrong. The club create had failed, so the id was empty and the file got only the site origin. The coordinator's note is accurate for that window. I overwrote the file with the real link after step 8, and a read-back confirms `https://play.theminimallab.com/#/club?join=<code, now dead>`. The brief's required club name was never created, so the link is for "Tom Thursday hoops" instead.
10. `POST /api/feed/post {"room":"c-d0ccb727","text":"TEST, please ignore: 3-on-3 basketball, Thursday 5 Nov, 19:00.","invite":{"sport":"basketball","day":"2026-11-05","start":"19:00","where":"indoor court, Daan","spots":6,"at":{...},"each":90}}`: accepted. The response has `"joined":false`, `"going":0`, `"names":[]`, and `"shareUrl":"/#/invite?id=pmvwcb6sq3506ec53"`.
11. `GET /api/invite?id=pmvwcb6sq3506ec53` right after posting: **`{"error":"That game is not open any more."}`** (BUG, see findings).
12. Polling `GET /api/feed?room=c-d0ccb727` and `GET /api/feed/notices` for about 7 minutes (7 polls, 30 seconds apart): nobody joined. `going` stayed 0, `names` stayed empty, notices stayed empty. The two other testers did not join, as the coordinator reported. Whether they were blocked by my wrong invite file for part of the window is unknown (see step 9).
13. Call off: `POST /api/feed/delete {"post":"pmvwcb6sq3506ec53"}` returned `{"deleted":true}`. The room feed then shows `"posts":[]`. Nobody had joined, so nobody needed telling. Nothing was sent to anyone.
14. Account: `POST /api/members/leave {}` returned `{"deleted":["de-cffbcf711b6b"]}`. `GET /api/me` then returns "Sign in first." The private club's link `GET /api/clubs/invite?code=<code, now dead>` now returns 404 "That club link isn't valid any more."

## Findings

**BUG 1: the required club name is refused with a false reason.**
Request: `POST /api/clubs {"name":"Serve test round 27 (please ignore)","sport":"basketball","at":{"lat":25.04,"lon":121.53},"privacy":"private"}`
Response: `{"refused":true,"why":"Not posted: it reads as a threat of violence."}`
Tom wants a private basketball club named this and gets a moderation message that accuses the name of violence. The same message comes for `"Serve test round 27"`, so the trigger seems to be "round 27" or "test" in the name. A neutral name works. The site told Tom something false about his club.

**BUG 2: a club with no privacy field is public and shows its members' names.**
Request: `POST /api/clubs {"name":"Basketball crew","sport":"basketball","at":{...}}`
Response: `"privacy":"public"`, `"names":["You"]`. The public club list (`GET /api/clubs?lat=&lon=`) shows other clubs' member first names to anyone, for example `"names":["Jack","Gino"]`. The spec calls `privacy` optional without saying its default. Tom, who wanted a private club, got a public one with his name in it. Judge this as BUG (privacy default) unless the owners intend public by default.

**BUG 3: the game's share link is dead on arrival.**
Request: `GET /api/invite?id=pmvwcb6sq3506ec53`, made right after the post returned `"shareUrl":"/#/invite?id=pmvwcb6sq3506ec53"`.
Response: `{"error":"That game is not open any more."}`
The post reply promises a link that anyone can open to join ("anyone opens it and joins, no account needed"). It returns an error for a game nobody has cancelled. Possibly room posts are meant to be unshareable, but then the reply should not offer a share URL.

**BUG 4: the host is not in her own game.**
After Tom posted the game, the room shows `"going":0`, `"names":[]`, `"joined":false`. Tom was the host, but "who is in" does not list him. Tom could not confirm that anyone was in the game, so this is also a broken promise about who is in.

**MINOR**
- Name stored as "Test Tom round 27" instead of "Test Tom (round 27)" (step 3).
- Place search "Daan District, Taipei" resolved to "National Taipei University of Technology, 1" (step 4).
- The club list exposes first names of members of public clubs to a non-member (see BUG 2).
- No club delete or close route is in the spec. The only removal is account deletion, which also removes the club link. Not a bug in the usual sense, but Tom cannot close a club himself.
- My monitor re-emitted the same poll every 30 seconds (an index in the change check). Noise only, not a site issue.

## Not done / could not verify
- The required club name "Serve test round 27 (please ignore)" was never created (see BUG 1). The private club actually used is "Tom Thursday hoops" (`c-d0ccb727`).
- The public club "Basketball crew" (`c-8d1e2b7a`, created in step 7) could not be removed. There is no club delete route. Its status after account deletion could not be checked, because the check needs a signed-in session. It may still be listed publicly.
- "Who is in" was never true with a joiner, because nobody joined.
- Asked to "delete or forget" the account: done (`POST /api/members/leave`). The spec says the trust chain keeps only a "left" entry.

CLEANUP: game post pmvwcb6sq3506ec53 deleted (feed/delete, verified). Account de-cffbcf711b6b deleted (members/leave, verified; session now rejected). Private club c-d0ccb727 (invite link now 404) is gone with the account. NOT removed: public club "Basketball crew" c-8d1e2b7a (created by mistake in testing; no delete route; status unverified). Invite file holds https://play.theminimallab.com/#/club?join=<code, now dead>, which is now a dead link.

VERDICT: 0 BLOCKER, 4 BUG
