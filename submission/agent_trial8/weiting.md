# Wei-Ting (Nangang volleyball organiser) - trial 9

Done: demo sign-up, area set (Nangang District), 5 quick questions, club "Nangang Wednesday Volleyball", posted Wed 20:00 volleyball for 10, "Let the agents fill it", Courts & prices, Your games, share, delete. Console errors: only the 401s before sign-in, one handled 400, and the items below.

## Findings

BUG 1 - Courts & prices never loads. Games > Courts & prices (badminton default, then volleyball) stays on "Looking at the map around you (OpenStreetMap can take up to a minute)..." for 40+ s. /api/huddle/places?sport=volleyball answers 200 and is re-requested repeatedly. Console shows a CORS error on that endpoint ("Access-Control-Allow-Credentials ... is ''"). I could not see any cheaper quiet hour or what the venue offer means. (May be the offline local copy; the CORS message suggests otherwise, so I am counting it.)

BUG 2 - Fill form ignores the posted game's size. After "Let the agents fill it" the page says "Filling the open spots of the game you posted" but Players shows 4, though the game needs 10 (9 left). I had to click + six times to reach 10.

MINOR 3 - No weekly repeat. Start a game offers one Day/Time only, so "weekly Wednesday" is a single post. The card shows only "WED 20:00", no date; Your games shows "Wednesday 4 Nov".

MINOR 4 - No way to edit a posted game. The post's menu has only Delete, which acts at once with no confirmation. After delete, Your games cleared correctly.

MINOR 5 - Share link gave no on-screen feedback. It throws "prompt() is not supported" (invite.js shareInvite) in this browser.

MINOR 6 - Courts & prices sport selector doesn't follow the game (badminton by default). The game map tiles went grey after pinning a spot in club creation.

MINOR 7 - After "Try the demo club", the demo club shows "You" at rating 1505, 6-5, level B, while You > How you play says "new - 0 games".

Not testable here: no nearby volleyball players, so the fill returned "Nobody within about 5 km who plays volleyball has let other agents ask theirs yet" (a clear message, POST /api/huddle/start 400). Picking the demo club did not offer it under "With whom". So I could not open game talk, check its lines, or see the club page with other members.

VERDICT: 0 BLOCKER, 2 BUG
