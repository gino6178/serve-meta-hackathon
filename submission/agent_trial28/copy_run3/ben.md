# Ben (trial 40) report: Serve local copy, http://localhost:8898

Tester header: `x-tester: ben`. Account: Ben Test, id `de-714f8da91ed8` (deleted at the end). Club `c-853d1ece` "Lily's Thursday doubles" (private). Game post `pmvwg6ikb7e1e2de4` (Thu 5 Nov 2026, 19:00, Daan Sports Center, NT$100 each, 2 spots). Full request/response log: `C:/Users/Gino/AppData/Local/Temp/claude/C--Users-Gino--claude-spares-spare-fCMWy9/9d9b7fdd-92e4-44aa-bf1e-bce228a1e418/scratchpad/trial40/ben/log.txt`. Timeline: `.../trial40/ben/waits.txt`.

Setup: only home (lat 25.042, lon 121.552) and sport (badminton) were set, as the script says. No limits (windows, maxKm, maxEach) were set, so `taste.limitEach` is null.

## Step by step

1. Sign-in
   `POST /api/auth/demo {"name":"Ben Test"}` -> 200, member `de-714f8da91ed8`, session returned.
   `POST /api/huddle/home {"lat":25.042,"lon":121.552}` -> 200, home rounded to 25.04 / 121.55.
   `POST /api/huddle/sports {"sports":["badminton"]}` -> 200, sports `["badminton"]`.

2. Invite and club (INVITE code=<code> at 21:39:19)
   `GET /api/clubs/invite?code=<code>` -> 200, shows the club (name, sport, place, 1 member), no member names. Good.
   `POST /api/clubs/join {"code":"<code>"}` -> 200, `asked: true`, note "Asked. It's a private club, so the organiser says yes or no, and you'll be told."
   Polled every 30 s. Ben was let in at the second poll (about 30 s later), `joined: true`, and `names` showed Lily, You, Mia.
   Notice: `"Lily said yes: you're in Lily's Thursday doubles."` (kind club). Told. OK.

3. Game (MIA_LEFT seen, GAME post seen at 21:40:20)
   `GET /api/feed?room=c-853d1ece` shows post `pmvwg6ikb7e1e2de4`: "Thursday doubles, 2 spots", going 0, `shareUrl: "/#/invite?id=pmvwg6ikb7e1e2de4"`, `each: 100`, host Lily Wang.
   `POST /api/feed/join {"post":"pmvwg6ikb7e1e2de4","on":true}` -> 200, `joined: true`, `going: 1`, `names: ["You"]`, `full: false`. Comment from Lily's agent: "Ben is in. 1 of 2 spots left ...". Count 1 of 2, correct.
   BEN_IN appended 21:41:47.

4. Full (FULL seen by 21:43:36)
   Olivia joined about 21:42:27 (comment "Olivia is in. Full for badminton Thu 5 Nov 19:00 ...").
   Game feed: `going: 2`, `full: true`, `names: ["You","Olivia"]`, `waitlist: 1`. Comment: "Game on: all 2 spots are taken. See you Thu 5 Nov 19:00." Then "Mia is on the waitlist ...".
   Notices, checked by `GET /api/feed/notices` at 21:41:47, 21:42:20, 21:42:53 and 21:43:26 (and later): always `{"notices": []}`. The feed response's own `notices` field was also empty.
   So Ben was NOT given a "Game on" notice. The only "Game on" text is a comment in the game thread, and it does not name who plays.

5. Lily leaves (LILY_LEFT seen 21:49:29)
   `GET /api/feed/notices` -> `{"notices":[{"text":"Lily left Serve, so Lily's Thursday doubles is yours to run now.","kind":"club","post":null}]}`. That is the only notice.
   `GET /api/clubs?lat=25.042&lon=121.552` -> club `c-853d1ece`: `members: 3`, `names: ["You","Mia","Olivia"]`, `mine: true`, `requests: []`. Ben is now the organiser, and he was told. The notice is true.
   `GET /api/feed?room=c-853d1ece` -> `"posts": []`. Ben's game is gone.
   `GET /api/invite?id=pmvwg6ikb7e1e2de4` -> 404 `{"error":"That game is not open any more."}`.
   `GET /api/huddle/today` -> cards: question, game (another game, pmvwg37zsfb512691, Leo's), deal, club. No "mine" card, so Ben's Thursday game is not listed.
   Nothing tells Ben or Olivia that the game they joined is cancelled or moved.

6. Leave and delete
   `POST /api/clubs/join {"club":"c-853d1ece","on":false}` -> 200, `joined: false`, `members: 2`, `mine: false`.
   `POST /api/members/leave {}` -> 200, `{"deleted":["de-714f8da91ed8"]}`.
   `GET /api/me` afterwards -> 401 "Sign in first.".

## Findings

### BUG 1: no "Game on" notice when the game filled
- Expected: when the last spot goes, Ben is told "Game on" once, naming who plays.
- Seen: no notice at all (empty `notices` at every poll after 21:42:27). The only "Game on" line is a comment in the game thread, "Game on: all 2 spots are taken. See you Thu 5 Nov 19:00.", which does not name the players. The names ("You", "Olivia") appear only on the post.
- Requests: `GET /api/feed/notices` -> `{"notices": []}` (21:42:53 and 21:43:26).

### BUG 2: Ben's game vanishes when its host leaves, and nobody is told
- Expected: a game he has joined either stays on (under the new organiser) or is called off, and he is told.
- Seen: Lily's `POST /api/members/leave` deleted her post (privacy.txt: "deletes your account, your posts and your agents"). That deleted Ben's joined game. The club feed is empty, `GET /api/invite?id=pmvwg6ikb7e1e2de4` says "not open any more", and `/api/huddle/today` has no card for it. Ben's only notice was about the club. He is not told the game is off, so he still believes he plays Thursday 19:00. Olivia is in the same position.
- This is a broken promise / false state for a joined game, so it is a BUG.

### BUG 3: the game's share link says the game is closed while the post shows it open
- Before Ben joined, `GET /api/feed?room=c-853d1ece` showed the post as open: `going: 0`, `spots: 2`, `full: false`, `shareUrl: "/#/invite?id=pmvwg6ikb7e1e2de4"`.
- `GET /api/invite?id=pmvwg6ikb7e1e2de4` at that time -> 404 `{"error":"That game is not open any more."}`.
- Someone opening the advertised link is told the game is closed. If club-only games are not meant to be shared, the post should not show a shareUrl. The judge may rate this MINOR.

### MINOR 4: "Thursday doubles, 2 spots" with a host is 3 players
- The post says "Thursday doubles, 2 spots", and the host (Lily) is not in `names`. With Lily, Ben and Olivia the game has 3 players. llms.txt lists badminton as usually 2 or 4 players. The count and the word "doubles" do not agree.

### MINOR 5: organiser passed to the wrong person (possibly)
- After Lily left, the organiser went to Ben, who had joined the club at about 21:39. Mia had been a member since before Ben (she is in `names` at 21:40:11, before Ben's join). The docs say nothing about who takes over. Ben is told, and the notice is true, so I could not confirm a wrong choice. This is a question for the owner of the rule.

### Things that worked
- The private club request: asked, then let in within 30 s, with a notice.
- The game join: count 1 of 2, correct; then 2 of 2 and "full: true".
- Mia's leave showed up as "2 of 2 spots left" in the thread.
- Club leave and account delete both worked. The session returns 401 after deletion.
- Notices are taken once, so my polls consumed them; each one was logged in `ben/log.txt`.

## Verdict

BUG 1 (no "Game on" notice, and it does not name who plays), BUG 2 (game silently deleted when the host left, and not told), BUG 3 (share link says "not open" for an open game). MINOR 4 and 5 noted.

VERDICT: 0 BLOCKER, 3 BUG
