# Mia's trial of Serve (local copy, http://localhost:8898)

Mia Test, 34, office worker. Got a club invite from a friend. Not technical; reads the screens. Every request sent with `x-tester: mia`. About 50 requests in total.

Club: "Thursday hoops" (c-58471cab), basketball, Riverside courts, private. Invite code <code>.

## What worked

- Signed-out invite lookup (`GET /api/clubs/invite?code=<code>`) shows the club name, sport, place and size, and no members' names. Good.
- Demo sign-in works and gives a session.
- Join by code worked. The club was shown as hers (`joined: true`) within about a minute, without any action from her.
- Setting home, sport and limits (`/api/huddle/home`, `/sports`, `/limits`) all answer clearly, and the limits are read back in plain words.
- Leaving the club and deleting the account both worked. After the delete, `GET /api/me` returns 401.

## Findings

### 1. BLOCKER: no game in the club room, so she could not get a game

- `GET /api/feed?room=c-58471cab` polled every 30 s for 8 minutes (16 polls): `posts: []` every time.
- The main feed (`GET /api/feed`) has one public game, "3 on 3" by Ray Ho, Riverside courts, 2026-11-01 18:00. It is not in the club room, and it is another member's game, so I did not join it (rule: do not touch other members).
- To make progress, Mia started a game for the club herself: `POST /api/huddle/start {"sport":"basketball","need":4,"club":"c-58471cab"}` (response `huddle.id` h-19cc8b9e, status `talking`).
- It reached `status: "asking"` with a proposed time (Wed 4 Nov, 19:00, Basketball court, 象山公園籃球場). It never reached `post` (no game was posted). Polled the room feed for 5 more minutes: still no post.
- Result: she could not join a game in the club room, could not see her count, and could not leave one. Those steps are not done.

### 2. BUG: a non-member was asked to play in the club's game

- The club object before she left (`GET /api/clubs?lat=25.0330&lon=121.5654`, club c-58471cab): `"members": 2, "names": ["Tom", "You"]`.
- The huddle reply from `POST /api/huddle/start` says `"invited": 2`. Its talk and players then show `Olivia` answering: `{"from":"other","who":"Olivia","text":"Olivia can do that (the time).","agent":true,"yes":true}`, and `"waiting": ["Tom", "Olivia"]`.
- Olivia is not named in the club's members. A "club" game should only ask the club's members. Either Olivia is in the club without being listed, or an outsider's agent was asked. Either way, Mia cannot tell, and a non-member's agent answered for a club game.

### 3. BUG: the game's players dropped out without telling Mia, and the talk still says otherwise

- `GET /api/huddle/one?id=h-19cc8b9e` a few minutes later: `status: "asking"`, `"waiting": []`, `"players": [{"name":"You","answer":"yes"}]`. Tom and Olivia have gone from the players list, with no message.
- The talk still ends with Mia's message: `"Only 3 of the 4 players fit it: asking Tom and Olivia for one yes. Once they say yes it's posted with 1 open spot for others to join"`.
- That is false to Mia: nobody is being asked, and nothing will be posted. She has no sign that the game is dead, and there is a `due` time about a day ahead.

### 4. BUG: "you'll be told" was not kept

- The join reply: `"note": "Asked. It's a private club, so the organiser says yes or no, and you'll be told. ..."`.
- Mia was let in (`joined: true`, `asked: false`) within about a minute.
- `GET /api/feed/notices` after she was in: `{"notices": []}`. Read again later: still `{"notices": []}`. She was never told she got in.

### 5. BUG: the club's organiser changed to Mia without notice, and the club vanished when she left

- At join: `"members": 2, "names": ["Tom","You"], "mine": false`.
- Later (`GET /api/clubs`): `"members": 1, "names": ["You"], "mine": true, "requests": []`. Tom is gone and Mia is now the only member and the organiser. Nothing told her.
- She left (`POST /api/clubs/join {"club":"c-58471cab","on":false}`): response `{"club":null}`, and the club is gone from `GET /api/clubs`. The club disappeared with no word to her that it was ending.
- I can't tell from here whether Tom left, was removed, or the seed changed. Mia was not told in any case.

### 6. MINOR: words she would trip on

- The join note: "To take the ask back: POST /api/clubs/join {club, on: false}". That is API talk, not a screen word.
- The game talk: "agent new", "trust show new", "Tom can do that (the time)", "The agent of everyone who could be asked said yes ... each person still confirms". Mia cannot tell what "agent new" means or whether she is being told that Tom is confirmed.
- The talk says "3 of the 4 players" and "1 open spot" in the same sentence. Confusing.
- Venue name mixes English and Chinese: "Basketball court · 象山公園籃球場".
- Talk says "a free court" but the pick shows `"each": 0` and `"price": 0` with no note that the venue is not verified.

## Not done

- Join the game in the club room, wait about 2 minutes, leave it, and check the count and what the host is told. Blocked by finding 1.
- The game h-19cc8b9e is still `asking` on the server. Deleting the account did not clear it (I did not check).

## Process note (my script, not a site finding)

- My first demo call created an extra account, `de-b7a8e2667e20`, while I was saving the session. I did not keep its session, so I could not delete it. The account Mia used is `de-760b7ffaf779`, deleted with `POST /api/members/leave` -> `{"deleted":["de-760b7ffaf779"]}`.

VERDICT: 1 BLOCKER, 4 BUG
