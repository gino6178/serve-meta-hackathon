# Mia's trial, round 28 (live site, https://play.theminimallab.com)

Tester: x-tester: live-mia on every request. Sign-in: demo, name "Test Mia (round 28)". About 21 requests in total, background polls included. Invite file polled every 30 s; the invite appeared after a short wait.

## What Mia does, and what she sees

1. **Opens the club invite link while signed out.**
   Request: `GET /api/clubs/invite?code=<code>`
   Response: `{"club":{"id":"c-a22b9ce0","name":"Serve test round 28 (please ignore)","sport":"basketball","about":"Thursday 3-on-3 basketball test, please ignore","where":"Daan District, Taipei","members":1,"privacy":"private"}}`
   Good: no member names, a club name, a place and a count. This matches the guide.

2. **Signs in with the demo account.**
   Request: `POST /api/auth/demo {"name":"Test Mia (round 28)"}`
   Response: member name `"Test Mia round 28"`. The parentheses were dropped.
   MINOR: the name Mia typed is not the name the site keeps. She would see a different name from the one she entered.

3. **Asks to join the private club.**
   Request: `POST /api/clubs/join {"code":"<code>"}`
   Response: `{"club":{... "asked":true,"names":[],"joined":false,"mine":false},"asked":true,"via":"link"}`
   The response says she asked, but not what happens next, who she is waiting for, or how long it takes. Nothing in the reply says "waiting for the organiser". She would not know if she is in or out.
   MINOR: the only way to find out is to read the club list again.

4. **Waits for the organiser (Test Tom) to say yes.**
   Requests: `GET /api/clubs?lat=25.04&lon=121.53`, every 45 s for 8 minutes (11 checks). Then one more check.
   Result: still `"asked":true,"joined":false,"mine":false` at the end. The organiser did not answer within 8 minutes.
   Note on my own test: the first poll's regex stopped at the first `}` in the club's `at` object, so the `joined` field was not read during those 11 checks. The final check read the full JSON and confirmed `joined: false`. The conclusion is still that she was not in the club.
   BLOCKER: Mia could not get into the club, so the TEST game could not be found, joined, checked, or left. The host and member messages for a game were not tested.

5. **Public club list shows real member names.**
   Request: `GET /api/clubs?lat=25.04&lon=121.53`
   Response: for two public clubs, `names` lists people by first name (for example "Jack", "Gino", "York", "Tiffaney", "YC", "KC"). This is a different rule from the invite view, which shows no names. The guide does not say that public club lists show member names.
   MINOR (possible privacy point): a stranger who is not in a club can see who is in it, which Mia might not expect. I did not contact any of these people.

6. **Cleanup: account deletion.**
   Request: `POST /api/members/leave {}`
   Response: `{"deleted":["de-d79213f1565b"]}`. The request deleted the account at once, with no confirmation step.
   Check: `GET /api/me` with the old session returns 401 "Sign in first."
   MINOR: the route is named "leave", but the guide says it deletes the account, posts and agents. Mia, who wanted to leave a club or game, could delete her whole account by mistake. There is no warning in the response.

## Not tested

- Joining the TEST game (blocked by item 4).
- Checking the game count and her "in" status.
- Leaving a game and the host's message.
- Whether an ask stays on the club for the organiser after the account is deleted. I could not verify this; no withdraw route is documented.

## Verdict line

VERDICT: 1 BLOCKER, 0 BUG

CLEANUP: Mia was never a member of the club, so there was nothing to leave. The account (de-d79213f1565b) was deleted through POST /api/members/leave, and GET /api/me now returns 401. The pending join ask on club c-a22b9ce0 may still be recorded for the organiser; no route is documented to withdraw it, so it could not be removed.
