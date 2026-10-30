# Rosa (host/player) report

Journey completed: demo sign-up, area (Songshan District), limits (weekday evenings and weekends, 8 km, NT$200, agent yes up to NT$150), club "Songshan Building Tennis", posted Thu 5 Nov 19:00 game, overlapping Thu 19:00 refused (409, clear message), Sat 31 Oct 19:00 posted, agents asked (Kenji, Joy), shared link opened signed out (shows host name, time, place, spots only), friends Mina/Ann/Bo joined with a name, game full, called off, other game deleted. Joined a pickleball game (waitlisted as new, per 90% rule) and left it. Called-off invite signed out says "That game is not open any more." Home "Your games" empty afterwards, club feed empty of both games. Console: only 401s, one 409 (overlap), 404s (closed game).

## Findings

BUG 1 (core: false status about a game): after Mina, Ann and Bo joined via the share link, the club card and Home "Your games" said "Game on / 3 of 3 joined / full", but the Games page (#/huddle?id=h-ad900f4e) still said "AGREED, ASKING", "Waiting for Kenji, Joy: they have until Sat 14:37", and its roster listed only You, Kenji, Joy, not Mina, Ann or Bo. The page offered "Call off" but no sign the game was full. The agents' asked players (Kenji, Joy) stay pending on a full game, which risks a fifth or sixth player.

MINOR: after leaving the pickleball waitlist, the feed still shows the agent comment "Rosa is on the waitlist" (history, not retracted).
MINOR: "Call off the game" happens at once with no confirmation.
MINOR: The area "Set" button showed "Asking..." for a few seconds with no clear done state.

VERDICT: 0 BLOCKER, 1 BUG
