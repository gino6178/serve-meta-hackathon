# Trial 37: Tom Wei (41, Thursday basketball organiser, Riverside) on Serve

Tester header: x-tester: tom on every request. Target: http://127.0.0.1:8899 (local test copy). About 27 HTTP requests. No files read, no source opened, no other site contacted.

## What Tom did

1. Read GET / and /llms.txt, then /api/openapi.json for the route bodies.
2. Demo sign-in as Tom (POST /api/auth/demo). Session sent as x-serve-session.
3. Set his area with place "Riverside, Taipei", then fixed it with coordinates (25.028, 121.512).
4. Set sport basketball and limits: Thu 17:00 to 22:00, within 3 km, at most NT$150 each.
5. Tried to post a 3-on-3 game on Thursday evening through POST /api/feed/post. Rejected five times (see BUG 4).
6. Started a game through POST /api/huddle/start (basketball, need 6, nearby true, Thursday evening). The agents negotiated; Tom said yes to the agreed time; the second invitee (Ray) had not answered when Tom called it off.
7. Posted a game to the feed with the day/start fields (accepted), checked it anonymously (GET /api/invite), joined and then left a seeded game (Ray Ho, Sun 1 Nov), and deleted his own test post.

## Easy or hard

- Sign-in, limits and sports: easy. Limits echoed back cleanly.
- Posting a game to the feed: hard. The error text says to give a day and HH:MM, which Tom did in the text and in the invite, and it still refused. The accepted form used invite fields day and start, which the llms.txt does not document for the feed route.
- Getting people in via the huddle: easy to start, but slow; status stayed "asking" for more than 30 seconds with Ray still at null (simulated member, expected, not counted).

## Findings

BUG 1. Home place lookup put Tom about 14 km away. "Riverside, Taipei" resolved to 25.15, 121.46 (Hongshulin Station area, "Golden Riverside Cycling Path"), not the Riverside coordinates Tom meant (25.028, 121.512). Every nearby invite and venue choice works from this home. Tom only noticed because he set coordinates himself afterwards; a skimming user would not.

BUG 2. "Agreed" and "everyone said yes" were not true at the time they were shown. The agent for Ray answered "yes" to 17:00, 18:00, 19:00 and 19:30 within the same second, so its yes carried no information. Tom's talk said the agent of everyone "said yes to 17:00 (each person still confirms)". The today card then showed the game as "agreed": true with going 1 and Ray still unanswered, and on: false. Calling it "agreed" before the other player confirms is wrong for "who is in".

BUG 3. Host not counted in a feed game. Tom's own posted game showed going 0 and names [] while he was the host. When Tom joined Ray's game, names showed "You" and going 1, so joining counts but hosting does not. Who is in is therefore wrong on the game Tom posted. The spots count (4 open) is also unclear against the 6 a 3-on-3 needs, because the host is not in it.

BUG 4. Valid game post refused with a misleading error. POST /api/feed/post returned {"error":"Say the day (Mon to Sun, or a date) and the time (HH:MM)."} for five variants, including "Thu 18:30" in the text and date/start/pin/when in the invite. It accepted only the invite fields day "2026-11-05" and start "18:30" (undocumented in llms.txt, visible only in the feed's response shape). Tom would be stuck on posting with no hint of the field name.

BUG 5. A false statement about Tom's taste. After one reply (yes to the time the agent picked: Thu 5 Nov 17:00), Serve told Tom "You like Thursday evenings" and "I'll count Thursday evenings a bit more", with confidence 0.5 and no explicit preference from him. The "yes" was to an agent-chosen time, not a stated preference.

MINOR 1. Calling off gave no receipt. POST /api/huddle/cancel returned status "cancelled" and the talk line "Tom called it off." Nothing says who was told (Ray had been asked and had a pending answer). Tom's notices were empty. Whether Ray was told could not be checked from Tom's side, so it is not counted as a finding.

MINOR 2. A join outside Tom's limits was allowed without a prior warning. Joining Ray's Sunday 1 Nov game (outside Thu only) succeeded; the note after the join says it is outside the limits and "stands". Per llms.txt this is by design, but Tom was not asked first.

MINOR 3. The feed response shows the poster as "You"/"you" in by.name, which is confusing when it is a game Tom posted about himself.

Not counted (test copy): the LLM is not ready (status shows fetch failed); seeded members do not answer in real time; the venue price is a sample.

Calling off a game with joiners could not be tested in this trial: Tom's game had no joiners who confirmed, so the "everyone told" question remains unverified (see MINOR 1).

## Would Tom come back?

Possibly, once the posting error is fixed and he understands who is counted. He was impatient: the huddle took about 20 seconds to reach a time, then waited on one person. The home location error alone would make a skimming user think the nearby games are wrong.

VERDICT: 0 BLOCKER, 5 BUG
