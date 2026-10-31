# Lily Wang tester report (local copy, http://localhost:8898)

Tester header: `x-tester: lily`. Session: `x-serve-session` from creds/lily.json (member de-75d3f4f0c9aa). No demo sign-in.
Full poll log: `.../trial40/lily_watch.log`. State: `.../trial40/state.txt`.

## 1. Private club and invite

Request: `POST /api/clubs` `{"name":"Lily's Thursday doubles","sport":"badminton","about":"Thursday doubles","where":"Daan Sports Center","at":{"lat":25.040,"lon":121.550},"privacy":"private"}`
Response 200: club `c-853d1ece`, members 1, privacy private, joined true, mine true.

Request: `GET /api/clubs/c-853d1ece/invite`
Response 200: `{"link":"/#/club?join=<code>","code":"<code>", ..., "note":"A private club: whoever opens the link asks to join, and the organiser says yes or no."}`

state.txt: `INVITE code=<code> club=c-853d1ece`

## 2. Game post

Request: `POST /api/feed/post` `{"room":"c-853d1ece","text":"Thursday doubles, 2 spots","invite":{"sport":"badminton","day":"2026-11-05","start":"19:00","where":"Daan Sports Center","spots":2,"at":{"lat":25.040,"lon":121.550},"each":100}}`
Response 200: post `pmvwg6ikb7e1e2de4`, kind invite, room c-853d1ece, going 0, waitlist 0, full false, shareUrl `/#/invite?id=pmvwg6ikb7e1e2de4`, host.show "shows up likely 87-100%".

state.txt: `GAME post=pmvwg6ikb7e1e2de4`

Note: the post's `room` is set and the game sits in the club room. Lily as host is not counted as a player (going 0 at start, spots 2). Consistent with the instructions.

## 3. Watch (about 8.5 minutes, every 30 s, 17 polls, 21:39:41 to 21:47:38)

Club requests were answered with `POST /api/clubs/answer {"club":"c-853d1ece","member":<id>,"yes":true}` for these names only:

| Time (poll) | Ask | Answer |
|---|---|---|
| ~21:39:18 (feed shows it) | Ben Test asked (de-714f8da91ed8) | not yet answered |
| 21:39:41 | Ben Test, Mia Test | both 200, members 2 then 3 |
| 21:40:20 | Olivia Test (de-8846f3a74f3f) | 200, members 4 |

Game timeline as observed (every poll reads `GET /api/feed?room=c-853d1ece`, `invite` object of the post):

| Poll | going | names | waitlist | full | notices delivered |
|---|---|---|---|---|---|
| 21:40:20 | 1 | Mia | 0 | false | "Olivia asked to join..." (club), "Mia is in your badminton Thu 5 Nov 19:00. 1 of 2 spots left..." |
| 21:41:23 | 0 | [] | 0 | false | "Mia can't make your badminton Thu 5 Nov 19:00. 2 of 2 spots left..." |
| 21:41:54 | 1 | Ben | 0 | false | "Ben is in your badminton Thu 5 Nov 19:00. 1 of 2 spots left..." |
| 21:42:57 | 2 | Ben, Olivia | 0 | true | "Game on: your badminton Thu 5 Nov 19:00 at Daan Sports Center is full. Ben and Olivia are in." |
| 21:43:28 | 2 | Ben, Olivia | 1 | true | none (waitlist appears, no notice) |

Waitlist: the game's comments (the agent's posts in the thread) say "Mia is on the waitlist: the game is full. A spot that opens is Mia's." The waitlisted player is Mia; she is not in `names`.

Notice check, each delivered once (`grep` of the watch log, 13 polls empty):
- Mia joined: correct, once.
- Mia can't make it: correct (going went to 0), once.
- Ben joined: correct, once.
- Game on: correct wording (full, Ben and Olivia), once, after Olivia took the last spot.
- Club join asks (Ben, Mia, Olivia): each once.
- No false or duplicate notices seen.

Agent comments on the game (`comments` in the post) match the state at the time: "Mia is in. 1 of 2 spots left", "Mia can't make it. 2 of 2 spots left", "Ben is in. 1 of 2 spots left", "Olivia is in. Full", "Game on: all 2 spots are taken", "Mia is on the waitlist...". All true.

state.txt at the end of the watch: `MIA_LEFT`, `BEN_IN`, `FULL`, `WAITLIST_SEEN` (written by the other agents' testers). I stopped the loop after FULL and Game on were both seen (my loop script ran to its limit, a script choice, not a finding).

## 4. Leaving

Pre-leave: club members 4 (You, Ben, Mia, Olivia), game going 2, waitlist 1 (Mia).

Request: `POST /api/members/leave` (session), body `{}`
Response 200: `{"deleted":["de-75d3f4f0c9aa"]}`
state.txt: `LILY_LEFT`

Post-leave checks:
- `GET /api/me` and `GET /api/feed?room=c-853d1ece` with the old session: 401 "Sign in first." Good.
- `GET /api/invite?id=pmvwg6ikb7e1e2de4` (public): 404 `{"error":"That game is not open any more."}`. The game post is gone with the member. Good.
- `GET /api/clubs/invite?code=<code>` (public): 200, club `c-853d1ece` "Lily's Thursday doubles", where Daan Sports Center, members 3, privacy private.
- `GET /api/clubs?lat=25.040&lon=121.550` with no session: 401 (expected).
- `GET /api/trust/chain`: entry n=11 `kind: "left"`, who 42efa84003c9e721 (same key as seed n=9, games 20, came 20), `d: {}`. Only a left entry was added, as documented. No trust counts were written for the unplayed game.

## Findings

No BLOCKER. No BUG in the flows exercised: the club and invite, joining the game, leaving, the Game on notice, the waitlist and the trust record all behaved as documented.

MINOR 1: after the organiser leaves, the private club `c-853d1ece` stays alive. Its public invite code still returns its name, place, sport and member count (3) to anyone with the code, and nothing in the leave route says what happens to clubs. The leave doc lists the member, agents, posts and taste as deleted, not the club. Worth a decision: is an ownerless private club meant to persist?

MINOR 2 (not verified): the game post was deleted on leave. Mia's waitlist comment said "A spot that opens is Mia's", and Ben and Olivia were going. I cannot see their notices from my session, so I could not confirm they were told the game was gone. Check Ben's and Olivia's and Mia's notices on their own sessions.

MINOR 3: the feed's notice list showed "Mia asked to join..." and "Olivia asked..." in the same poll where I answered them. Timing only, not wrong. Noted for completeness.

VERDICT: CLEAN
