# Tom round 28 - live test report (play.theminimallab.com)

Persona: Tom, 41, organises Thursday 3-on-3 basketball and is tired of chasing replies. First visit. All requests sent with `x-tester: live-tom`. About 22 requests used.

## What Tom did, and what happened

1. **Read /llms.txt.** Clear quick start and a "getting a game" section. Good.
2. **Status and providers.** `GET /api/status` returned `health: true`; providers showed `demo: true`.
3. **Demo sign-in.** Request: `POST /api/auth/demo {"name":"Test Tom (round 28)"}`. Response 200, but the stored member name is `"Test Tom round 28"`. The brackets were dropped without notice. MINOR.
4. **Set up Tom's profile.** `POST /api/huddle/home {"place":"Daan District, Taipei"}` returned lat 25.04 / lon 121.53. Sports set to basketball. Limits set to Thu 18:00-22:00, 3 km, NT$150 each. Accepted. `POST /api/huddle/open {"on":false}` accepted, `open:false`.
5. **Create the private club.** Request as specified in the brief: `POST /api/clubs {"name":"Serve test round 28 (please ignore)","sport":"basketball","about":"...","where":"Daan District, Taipei","privacy":"private"}`. Response: `{"error":"Pick where the club plays on the map.","code":400}`. Tom had only a text place name. The llms.txt says clubs take `at: {lat, lon}`. Retried with `at` added, and it succeeded (`c-a22b9ce0`, privacy private, members 1). MINOR, wording/confusion: the brief's body is refused and the error does not say a map point is needed as well as the text.
6. **Invite link.** `GET /api/clubs/c-a22b9ce0/invite` returned `link: "/#/club?join=<code>"`, `code: "C2JKmA2X"`, and the note "A private club: whoever opens the link asks to join". Correct.
7. **Signed-out invite check.** `GET /api/clubs/invite?code=<code>` returned the club name, sport, place and member count (1), and no member names. Correct.
8. **Invite file written** to `.../scratchpad/trial39/club_invite.txt` with one line: `https://play.theminimallab.com/#/club?join=<code> code=<code>`.
9. **Try to post the game first.** `POST /api/huddle/start {"sport":"basketball","need":6,"club":"c-a22b9ce0","pin":{"date":"2026-11-05","start":"19:00","place":"TEST, please ignore: Daan basketball court"}}` returned `{"error":"Nobody else is in that club yet.","code":400}`. Behaviour is consistent with the rule that a game needs another member, and the message is clear. But the brief expects the game after Mia and Olivia join, so this is where the flow stopped.
10. **Watch for join requests.** A background poll ran for 10 minutes at 60 s intervals. The poll was written by me and was BLIND. Its grep stopped at the first closing brace, so it never saw `requests` or `members`, and it only reported the first poll. I re-checked directly afterwards: `"asked":false,"requests":[],"members":1,"names":["You"]`. No join request from Mia or Olivia arrived in the window. Nothing was answered yes or no. This is my tester error for the watch; the final state is accurate.
11. **Notifications.** I tried `GET /api/notifications` to look for requests. The route does not exist (`{"error":"not found"}`). Tom has to poll the club record for requests. There is a documented route, `GET /api/feed/notices`, which I did not try. MINOR, not a product bug.
12. **Public club list.** `GET /api/clubs?lat=&lon=` lists other public clubs with member first names (for example "Jack", "Gino"). The invite endpoint says it never shows members, but the public list does. Not my test's club; noted only. MINOR, check whether it is intended.

## Not done

- Game posted inside the club room: NOT done (blocked, see step 9).
- Yes/no answers to Mia and Olivia: NOT done (no requests arrived).
- Game called off and joiners told once: NOT done (no game, no joiners).
- Money, trust records, limits-breaking and privacy leaks were not tested because the game flow never started.

## Blocker

- **BLOCKER (could not finish):** no one asked to join the private club through the invite link within 10 minutes, so no game could be posted and the core flow (join, yes, game, call off) could not be run. Either the two test people did not open the link, or the link did not reach them. The server refused the game with a correct message, so this is a test-setup block, not a server fault. Re-run once Mia and Olivia are actually opening the link.

## Other findings

- MINOR: sign-in name changed from "Test Tom (round 28)" to "Test Tom round 28".
- MINOR: club creation with a text `where` alone is refused with "Pick where the club plays on the map." The docs say `at: {lat, lon}`, which Tom only learns by reading the guide.
- MINOR: `GET /api/clubs` lists first names of members of public clubs; the invite page says it never shows members. Check whether intended.

## CLEANUP

- Posts: none created.
- Games: none created, nothing to call off.
- Club `c-a22b9ce0` ("Serve test round 28 (please ignore)"): NOT deleted. No delete or close route exists in /api/openapi.json. Tom was its only member. I did not verify whether it still appears in listings after Tom's account was deleted; it may remain as an empty private club.
- Account: deleted with `POST /api/members/leave` (response `{"deleted":["de-35d3ebafd5a4"]}`). A later `GET /api/me` with the old session returned "Sign in first.", which confirms the account is gone.
- Invite file written: `.../scratchpad/trial39/club_invite.txt` (one line, contains a club join code that now leads to the un-deleted club).

VERDICT: 1 BLOCKER, 0 BUG
CLEANUP: deleted Tom's account (de-35d3ebafd5a4) via POST /api/members/leave; no posts or games existed; the private club c-a22b9ce0 could not be deleted (no route), so it remains.
