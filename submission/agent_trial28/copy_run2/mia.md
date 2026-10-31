# Mia's trial, localhost:8898

Persona: Mia, 34, office worker, not technical. Friend sent a club invite link. Demo account "Mia Test" (session kept until the end). Header `x-tester: mia` on every request. Other members not touched; "open"/nearby left off.

## Path taken and what she saw

1. **Invite link (signed out).** `GET /api/clubs/invite?code=<code>` returned the club name "Thursday hoops", sport basketball, place "Riverside courts", members 1, privacy private. It did not show who is in the club. Good.
2. **Sign in and join.** `POST /api/auth/demo {"name":"Mia Test"}` returned the member and a session. `POST /api/clubs/join {"code":"<code>"}` returned the note: "Asked. It's a private club, so the organiser says yes or no, and you'll be told. To take the ask back: POST /api/clubs/join {club, on: false}." Clear.
3. **Organiser answer.** About 1 minute later the club showed `asked: false, joined: true, names: ["Tom", "You"]`. Her notice said: "Tom said yes: you're in Thursday hoops." So she was told. Good.
4. **Game in the club room.** `GET /api/feed?room=c-14edfa67` showed one post: "Thursday 3 on 3, who's in?", host Tom Test, basketball, Tue 5 Nov 19:00 at Riverside courts, 5 spots, 0 going. Her sign-in was there from the start.
5. **Join the game.** `POST /api/feed/join {"post":"pmvwfa4vtfcc4c59a","on":true}` returned 200. The post showed `going: 1`, `names: ["You"]`, `joined: true`, `full: false`. A comment from Tom's agent said "Mia is in. 4 of 5 spots left for basketball Thu 5 Nov 19:00 at Riverside courts." The count is right.
6. **Two minutes later.** The feed no longer had the post. Her notices at that point contained: "Tom called off basketball Thu 5 Nov 19:00 at Riverside courts." So she was told. I could not see the host's side, since I did not touch Tom's account.
7. **Leave the game.** `POST /api/feed/join {"post":"pmvwfa4vtfcc4c59a","on":false}` returned 404: `{"error":"That invite is not in the feed any more.","code":404}`. See MINOR 1.
8. **Huddle today.** `GET /api/huddle/today` no longer mentions the called-off game. Good.
9. **Leave club.** `POST /api/clubs/join {"club":"c-14edfa67","on":false}` returned 200, with `joined: false` and members 1. Good.
10. **Delete account.** `POST /api/members/leave` returned `{"deleted":["de-cd8ed9c857c3"]}`. `GET /api/me` with the old session then returned 401 "Sign in first." Good.

## Findings

### MINOR 1: leaving a game that was already called off gives a technical message
- Request: `POST /api/feed/join {"post":"pmvwfa4vtfcc4c59a","on":false}` (header x-serve-session set)
- Response: HTTP 404 `{"error":"That invite is not in the feed any more.","code":404}`
- From Mia's point of view: "invite" and "feed" are jargon. She was already told the game was called off, so the message should say something like "This game was called off, so you're no longer in it." Wording only.

### Not a finding, but worth knowing
- **The host called the game off about 2 minutes after Mia joined.** The post was removed from the feed. Mia was told by notice. I did not check whether the call-off was intended or what prompted it; it came from Tom's account, which I did not touch. Please check on your side whether this was a real host action or a side effect of another test.
- **The count-drop check could not be done.** The called-off post vanished entirely, so there was no count to watch fall. The feed does not keep a called-off game visible to people who had joined; the notice is the only record.
- **The host's notices were not checked.** That would have meant reading Tom's account.

## Test-script mistake (not a site finding)
My feed polling loop tested for the wrong text, so it ran all 18 checks even though the game was found on the first check. This used extra requests but did not change any result.

## Request count
About 40 requests to the site (the file polls are not counted). The account is deleted and the session is gone.

VERDICT: CLEAN
