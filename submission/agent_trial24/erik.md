# Erik (host and player) test report

Journey done in my own tab: demo sign-up, area (Xinyi District), limits (8 km, NT$200, agent yes up to NT$150, new people allowed; "Saved. Nothing outside these is ever agreed for you."), started club "Erik Xinyi Rackets", posted badminton Thu 19:00.

## What worked
- Club-only fill refused with "Nobody else is in that club yet" (400). "Only people nearby" then agreed the slot and asked Lily/Joy/Kenji.
- Share link (#/invite?id=...) for a signed-out visitor: "3 spots left of 3". Anna, Ben and Cleo joined signed out via demo sign-up; counts went 2, 1, 0 left. A fourth visitor saw "This game is full."
- Game page: GAME ON, lists Anna, Ben, Cleo, stops waiting ("The game filled straight from the feed, so the agents stop here"). Club card: "Anna, Ben, Cleo are in · full", Game on. The games list agreed.
- Overlapping post (same Thu 19:00) refused with a clear message (409).
- Joined a feed tennis game (card showed "You're in", Leave) then left; card returned to "Nobody yet · 2 left", agent comment "Erik can't make it".
- Stop agents on Fri game: "AGENTS STOPPED · GAME STAYS", game stays in club and list, no waiting line.
- Call off Sat game: list says CALLED OFF, game page has no stop/call-off prompts, club card gone, invite link says "That game is not open any more." (404).
- Console: only 401s before sign-in and the 4xx from the refused actions above.

## Observations (MINOR)
- My club's games (Thu/Fri) never appeared in the home Feed (also not under "Games"), though other clubs' games did. Could be by design (own posts), not confirmed.
- Called-off game page still lists Anna/Ben/Cleo under the host as the asked players.
- Game page log has no line for Cleo joining (Anna and Ben only); club card does.
- Club list map looked grey/blank after returning to the clubs list with the start-club form open.
- After "Stop", the club card again offers "Let the agents fill it".
- Page text needs a wait after navigation ("Opening the club…" / "Asking your agent…").
- Click targets shift as content loads (my first Call off click missed).

I did not call the API directly (a probe was blocked); all checks were through the UI.

VERDICT: CLEAN
