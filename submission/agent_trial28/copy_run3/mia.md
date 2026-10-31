# Mia Test (badminton, 34, back to the sport) on the local copy, http://localhost:8898

All calls sent with `x-tester: mia`. Times are local (UTC+8).

## Steps

**1. Sign-in and setup (21:36)**
- A session saved earlier in the scratch folder (`mia_session.txt`) was rejected ("Sign in first."), so I signed in once.
- `POST /api/auth/demo {"name":"Mia Test"}` -> 200, member `de-13b940f7693d`, session issued.
- `POST /api/huddle/home {"lat":25.035,"lon":121.545}` -> 200; the taste block returns home `{"lat":25.04,"lon":121.55}` (rounded to about 1 km, as /llms.txt says).
- `POST /api/huddle/sports {"sports":["badminton"]}` -> 200, `sports: ["badminton"]`.

**2. Club (INVITE line seen: code <code>, club c-853d1ece)**
- `GET /api/clubs/invite?code=<code>` -> club "Lily's Thursday doubles", badminton, Daan Sports Center, 1 member, private.
- `POST /api/clubs/join {"code":"<code>"}` -> 200, `asked: true`, "Asked. It's a private club, so the organiser says yes or no, and you'll be told."
- Polled `GET /api/clubs?lat=25.035&lon=121.545` every 30 s. First poll (about 15 s later): `joined: true`, members 3 (Lily, Ben, You). Notice in `GET /api/feed/notices`: "Lily said yes: you're in Lily's Thursday doubles." Told, correctly.

**3. Game (GAME post=pmvwg6ikb7e1e2de4)**
- `GET /api/feed?room=c-853d1ece`: "Thursday doubles, 2 spots", Thu 5 Nov 19:00, Daan Sports Center, NT$100 each, host Lily Wang, going 0.
- `POST /api/feed/join {"post":"pmvwg6ikb7e1e2de4","on":true}` -> 200, `going: 1`, `names: ["You"]`, `joined: true`, `spots: 2`. Count is 1 of 2. Club comment by Lily's agent: "Mia is in. 1 of 2 spots left ...".

**4. Leave (after 60 s)**
- `POST /api/feed/join {"post":"pmvwg6ikb7e1e2de4","on":false}` -> 200, `going: 0`, `joined: false`. The response has no note or confirmation. Count is back to 0.
- Notices: `[]`. Public comment by Lily's agent: "Mia can't make it. 2 of 2 spots left ...". Acceptable.
- Appended `MIA_LEFT`.

**5. Full and waitlist (FULL seen after BEN_IN)**
- `GET /api/feed?room=c-853d1ece`: `going: 2`, `names: ["Ben","Olivia"]`, `full: true`.
- `POST /api/feed/join {"post":"pmvwg6ikb7e1e2de4","on":true}` -> 200, `waitlisted: true`, `why: "the game is full"`, `waiting: true`, `waitlist: 1`, `joined: false`. The reason is true. Club comment: "Mia is on the waitlist: the game is full. A spot that opens is Mia's."
- Appended `WAITLIST_SEEN`.

**6. Lily leaves (LILY_LEFT seen about 21:49)**
What Mia is told and what the server now holds:
- `GET /api/feed/notices` -> `{"notices":[]}`, checked immediately and again about 30 s later. Nothing about the game, the waitlist place, Lily leaving, or the club.
- `GET /api/invite?id=pmvwg6ikb7e1e2de4` -> `{"error":"That game is not open any more."}`. The game is gone from the club feed (`posts: []`) and from the main feed. Mia's waitlist place went with it, and nothing says so. The promise "A spot that opens is Mia's" was never resolved, and she was not told the game was called off.
- `GET /api/clubs?lat=25.035&lon=121.545` at about 21:53: the club now shows `members: 1`, `names: ["You"]`, `mine: true`, `requests: []`. Before Lily left it showed Ben and Olivia as members and `mine: false`. Data check (`data/clubs.json`): `"owner": "de-13b940f7693d"` (Mia), members `[Mia Test]`, name still "Lily's Thursday doubles", code <code> still live.
- So the club was handed to Mia silently. Ben and Olivia left it without a trace for her, and she was never told she is now its organiser. Its name still belongs to Lily.
- Trust chain (`/api/trust/chain`): game check `pmvwg6ikb7e1e2de4` now has `players: []` (it had Ben and Olivia).

**7. Leave club and delete account**
- `POST /api/clubs/join {"club":"c-853d1ece","on":false}` -> 200, `{"club":null}`. The club is deleted (`GET /api/clubs` -> `[]`). No message says so.
- `POST /api/members/leave {}` -> 200, `{"deleted":["de-13b940f7693d"]}`. `GET /api/me` -> 401 "Sign in first." Trust chain holds a `left` entry for her with no details, as documented.

## Findings

**BUG 1: A game is called off silently and the waitlisted player is not told.**
When the host (Lily) left the club, her game was removed. The waitlisted Mia got no notice (`/api/feed/notices` empty both times), and the game-comment promise "A spot that opens is Mia's" was dropped with no word to her. The game just says "That game is not open any more." to anyone who opens the link.

**BUG 2: Club ownership changes and a club is deleted without telling Mia.**
After Lily left, the club's owner became Mia with no notice, the club kept Lily's name, and Ben and Olivia were removed without a trace. When Mia left, the club was deleted with `{"club":null}` and no message. She was told nothing at any point in this flow.

## Minor (not counted)
- `POST /api/feed/join {"on":false}` returns the post with no note saying she left. Lily's agent's public comment "Mia can't make it" is shown to the group.
- `POST /api/clubs/join {"club":..,"on":false}` returns `{"club":null}` with no words.
- Home was rounded to 25.04 / 121.55 from the 25.035 / 121.545 sent. This follows the documented ~1 km rounding, so it is not a finding.

## Script notes
- My own trust-chain check script had a Python slicing error (`KeyError: slice`) on the first attempt. Not a finding; the second attempt worked.
- No BLOCKERs: every step ran.

VERDICT: 0 BLOCKER, 2 BUG
