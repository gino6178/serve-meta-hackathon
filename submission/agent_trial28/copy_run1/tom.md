# Tom trial, local Serve at http://localhost:8898

Tom Test (demo sign-in) created a private club, invited Mia Test and Olivia Test, and tried to post a Thursday 3 on 3 game in the club room. The game post was held by a safety check for its whole life and was never shown to anyone else. Nobody could join the game.

## Findings

### BLOCKER 1: a game post is held forever when the safety check does not answer
Request: `POST /api/feed/post` with `{"text":"Thursday 3 on 3, who's in?","room":"c-58471cab","invite":{"sport":"basketball","day":"2026-11-05","start":"19:00","where":"Riverside courts","spots":6,"at":{"lat":25.033,"lon":121.5654}}}`

Response (200):
`{"post":{"id":"pmvwe228x5eb71357",...,"held":true,...},"held":true,"why":"The safety check isn't answering right now. Your post shows once it is checked; only you can see it until then."}`

What followed:
- `GET /api/feed?room=c-58471cab` at 20:40 and 20:41 listed the post with `"held": true`. `notices` and `drafts` were empty. No reason or retry was given.
- Polled `GET /api/feed?room=c-58471cab` every 30 s for 10 minutes (20 polls, 20:40:22 to 20:50:33). Every poll: `held=True going=0 spots=6 names=[] waitlist=0 full=False joined=False`. The post never cleared.
- `GET /api/invite?id=pmvwe228x5eb71357` (the shareable link) returned `{"error":"That game is not open any more."}`. A held game can't be joined by anyone who has its link.
- `GET /api/status` at the same time: `{"health":true,"llm":{"ready":true}}`, so the server itself was healthy. The check failing is a separate dependency.

Effect: "getting a game" is broken for the poster. Neither Mia nor Olivia (both in the club) could see or join the game, so step 4 could not complete. The message does say the post is hidden until checked, which is honest, but the hold never resolved and nothing tells the poster when to retry or how to fail over.

I called the game off with `POST /api/feed/delete {"post":"pmvwe228x5eb71357"}`, which returned `{"deleted":true}`. Step 5's "what each joined person is told" check does not apply because nobody joined and no notices were written.

### MINOR 1: the invite response has no `code` field
`GET /api/clubs/c-58471cab/invite` returns `{"link":"/#/club?join=<code>","club":{...},"note":"..."}`. There is no top-level `code`. The code is only in the link fragment, so a client has to parse `#/club?join=...` to get it. The signed-out check `GET /api/clubs/invite?code=<code>` worked and returned the club's name, sport, about, where, and member count, with no member names. The brief expected `{link, code}`.

## Club flow (worked)
- `POST /api/clubs` (private, basketball, at 25.0330,121.5654): created `c-58471cab`.
- `GET /api/clubs?lat=25.0330&lon=121.5654`: `requests` listed `{"id":"de-760b7ffaf779","name":"Mia Test"}` and `{"id":"de-656ae61b6235","name":"Olivia Test"}`.
- `POST /api/clubs/answer` with `yes:true` for each returned 200 and both joined: `members` went 1, 2, 3, and `names` showed `["You","Mia","Olivia"]`.

## Watcher note
My club watcher's stop check compared `names` to "Mia Test", but `names` shows "Mia" and "Olivia", so it never stopped early. It was later killed by a process cleanup of mine, so the club poll stopped at poll 6. Both testers were already in, so no join was missed.

Tom's account was deleted with `POST /api/members/leave` (`{"deleted":["de-d28fac85e0dd"]}`). A follow-up `GET /api/me` returned "Sign in first."

VERDICT: 1 BLOCKER, 0 BUG
