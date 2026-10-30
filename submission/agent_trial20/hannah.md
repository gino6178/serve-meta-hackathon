# Hannah (tennis, Xinyi) - core journey

No BLOCKER, no BUG found.

## What I did and saw
- Demo sign-up OK. Area set by typing "Xinyi District, Taipei" (browser location is denied here, so "Use my location" only showed a clear message).
- Limits saved: 8 km, NT$300, agent may say yes up to NT$200, new people allowed. Message "Saved. Nothing outside these is ever agreed for you." The 8 km limit showed up in the agent's summary.
- Started public tennis club "Hannah Tennis Crew" (map spot + place name). Posted Thu 19:00 game. "Let the agents fill it" went to Games with a huddle; Kenji and Mei said yes, 1 spot stays open. The talk was readable and consistent. Club card showed "Agreed: 0 of 2 said yes", matching the huddle ("Waiting for Kenji, Mei"). Home "Your games" showed "0 of 3 joined".
- Overlapping Thu 19:00 post: refused with a clear red message naming the agreed game (HTTP 409). A Saturday 19:00 post worked.
- Share link opened signed out: showed only sport, time, place, spots left, and sign-in. No private details. Joined as "Pei": "You're in. Hannah sees it now", spots 3 -> 2. Club card ("Pei is in. 2 left"), an agent comment, home ("1 of 3 joined") and member count all agreed.
- Joined Mei's Monday game from a home card: appeared in Your games as "1 of 1 in". Left via "Can't make it": removed from Your games, "You've left that game."
- Called off Thu huddle: shows CALLED OFF in Games.
- Deleted Sat post (menu > Delete): gone from club and home; invite link now says "That game is not open any more." (404).
- Console: only 401s before sign-in, plus the expected 409 and 404.

## Minor
- Thursday club post and home "Your games" still list the game as open (0 of 3) after the agent huddle was called off. Arguably fine (the post stays), but "call off" does not remove it.
- Deleting a post that has a joined player (Pei) asked for no confirmation.
- Host appears as "You (asked)" in the talk, though the page says "you're in it".
- Place-name field gets cleared when the map finishes loading courts, so typed text is lost (retype needed).
- Scrolling the page over the map zooms the map.

## Not verified
- That Pei or Kenji/Mei were notified of the call-off or delete: the demo session for Pei was not kept, and simulated members have no inbox. Messenger showed only the agent greeting.
- Giving a yes: as host there was nothing to say yes to. Joining Mei's game gave a yes-like "You said yes to Monday before 9".
- localStorage is shared with other testers, so the signed-out test briefly replaced the session; I restored it.

VERDICT: CLEAN
