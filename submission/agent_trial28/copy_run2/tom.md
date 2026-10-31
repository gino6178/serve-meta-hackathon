# Tom trial (local copy, http://localhost:8898)

Persona: Tom Test, 41, runs Thursday basketball. Header x-tester: tom on every request. Requests used: about 75 of 90.

## What was done
1. Demo sign-in POST /api/auth/demo {"name":"Tom Test"}: member de-efa24f654d1d.
2. POST /api/clubs {"name":"Thursday hoops","sport":"basketball","about":"Tom's Thursday game","where":"Riverside courts","at":{"lat":25.033,"lon":121.5654},"privacy":"private"}: club c-14edfa67, members 1, requests [].
3. GET /api/clubs/c-14edfa67/invite: link /#/club?join=<code>, code <code>.
   Signed-out GET /api/clubs/invite?code=<code> returned only {"club":{id,name,sport,about,where,members:1,privacy}}. No names, no location, no requests. Good.
   Written to scratchpad/trial40/club_invite.txt: `code=<code> club=c-14edfa67`.
4. POST /api/feed/post {"text":"Thursday 3 on 3, who's in?","room":"c-14edfa67","invite":{"sport":"basketball","day":"2026-11-05","start":"19:00","where":"Riverside courts","spots":5,"at":{"lat":25.033,"lon":121.5654}}}: post pmvwfa4vtfcc4c59a, kind invite, room c-14edfa67. Not held. Took 15.5 s.
5. Polled 20 times over about 12 minutes (21:14 to 21:26) with GET /api/clubs?lat=25.0330&lon=121.5654, GET /api/feed/notices, GET /api/feed?room=c-14edfa67.
   - Mia Test asked to join (21:14:34). POST /api/clubs/answer {"club":"c-14edfa67","member":"de-cd8ed9c857c3","yes":true} returned 200, members 2, names ["You","Mia"].
   - Olivia Test asked to join (21:15:31). POST /api/clubs/answer {"club":"c-14edfa67","member":"de-c909c6edf11c","yes":true} returned 200, members 3, names ["You","Mia","Olivia"].
   - The game stayed at going 0, names [], joined false, full false, waitlist 0 for all 17 checks until it was called off. Neither Mia nor Olivia joined it, and no notice reached Tom about the game.
6. Called the game off: POST /api/feed/delete {"post":"pmvwfa4vtfcc4c59a"} returned {"deleted":true}. Three further checks (21:25 to 21:26): GET /api/feed?room=c-14edfa67 no longer lists it. Notices stayed empty. Nobody had joined, so nobody was told anything.
7. Deleted account: POST /api/members/leave returned {"deleted":["de-efa24f654d1d"]}. GET /api/me then returned 401.

Privacy and limits: nearby and open were never switched on. No other member was touched beyond the two club answers. Nothing was paid.

## Findings

### MINOR 1: a club-room game reached no one in the club
- Request: POST /api/feed/post (above). Response: invite.going 0, names [], spots 5, host.show "new", host agent "agent new".
- Over the next 12 minutes Mia and Olivia (both now club members, approved at 21:14 and 21:15) were never told about the game and never joined it. Tom got no notice about it either.
- Nothing on the site or in llms.txt promises that a club-room game asks the club's members, so this may be by design. If a club room is meant to pull in its members, this is a gap in a core flow.

### MINOR 2: the host is not counted in the game
- Response to the post: invite.joined false, invite.names [], invite.going 0, and the host (Tom) is not in the names.
- Whether the host should count depends on what spots means. If spots counts all players (5 is one short of a 3-on-3 of six), going should be 1 with Tom in names. If spots counts open places, going 0 is true, but the host showing joined false is still odd for a game its own host posted.

## Not tested
- Mia leaving a game, and both members joining a game: this could not happen because neither joined.
- Notices to joined players: nobody joined.

VERDICT: CLEAN
