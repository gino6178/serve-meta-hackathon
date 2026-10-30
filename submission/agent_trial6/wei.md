# Wei (tennis, laptop 1280x900) - report

Done end to end: demo sign-up, Start a club (tennis, tapped map), posted Sat 09:00 (4 players), "Let the agents fill it" (gate 75%+, nearby, Xinyi District, Taipei), talk and "Waiting for Kenji, Mei, Joy", own yes, Share link, invite opened in a second tab, Call it off, Courts & prices, How you play. Console: only 401s before sign-in, plus 400s from /api/places/near ("OpenStreetMap did not answer", local limit, not counted).

## BUG
1. Player count contradicts itself. I posted "Players needed 4"; the fill form said "Players, you included: 4". The huddle then said "Tennis, 5 players", "5 for tennis ...", and "No time suits all 5 ... suits the most of you (4)". API: /api/huddle/one -> "need":5. The agent counts the host on top of the 4 the post asked for, so the group is bigger than Wei asked for and the chat tells him a spot is missing when everyone said yes.

## MINOR
1. Toast "Your agent - The agents agreed tennis Saturday 31 Oct, 09:00..." stayed on screen across pages for minutes, including after Call it off (the list then showed CALLED OFF). Stale and contradictory.
2. Share link gave no visible feedback in this browser. Console: "Uncaught (in promise) Error: prompt() is not supported at shareInvite (invite.js:11)" - the fallback is window.prompt when the clipboard is denied. With navigator.share stubbed it produced http://127.0.0.1:5190/#/invite?id=pmvudzsqb26f98592, which opened correctly in tab 2 ("Wei invited you, Tennis Sat 09:00, 4 spots left of 4"). A failed copy should say so.
3. Layout jumps right after the page loads or posts (first "Let the agents fill it" click and the first "Yes, I'm in" click landed on empty space after a shift); needed a second click.
4. "Finding courts..." under the club map never resolved when the lookup failed; no message, the field stayed usable.
5. The game card in the club feed still offers "Let the agents fill it" and shows "Nobody yet - 4 left" while a huddle with 3 agreed people was running (sensible but unexplained). After Call it off the post stays open, so the invite link still says 4 spots; consistent.
6. A seeded "Xinyi Tennis" club (3 members) already exists next to the new club; no hint that Wei may want to join it instead.

## Notes (not findings)
- The talk took about 90 s to move past the typing dots (simulated members).
- Courts & prices stayed on "Looking at the map around you" (no OpenStreetMap here; local limit).
- How you play loaded fine: 1 of 5 answers, weights 25% each, "You like Saturday mornings" after my yes.
- Waiting line after own yes: "Waiting for Kenji, Mei, Joy: they have until Sat 06:00". Good.
- Call it off updated Your huddles to CALLED OFF without reload.

VERDICT: 0 BLOCKER, 1 BUG
