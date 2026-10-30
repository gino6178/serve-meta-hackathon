# Kai (phone 375x812, impatient, broke) - trial 5

## What he did
Signed up by typing "Kai" (one tap, good). Looked for a game link: the feed cards have no share button on other people's games. Used "Start a game anyone can join", posted a badminton invite, tapped "Share link". Opened that link as a stranger (storage cleared), then signed in and joined. Used the home box, Huddle, joined feed games, left a game, checked "Your games".

## What worked
- Stranger on `#/invite?id=...` sees sport, time, place, spots, and the sign-in box right under it. Typing a name joins: "You're in. Kai sees it now." Very low friction.
- Feed Join is one tap, instant.
- Home box text carried into Huddle ("You asked your agent: free basketball tonight near NTU", sport and "Today, evening" prefilled). The agents found a free court game after about a minute.
- "Can't make it" is one tap with a clear "You've left that game."

## Problems, worst first
1. **The `#/i/<id>` link the brief gave does not exist.** It silently opens the home page, with no "game not found". The real link is `#/invite?id=...`, and it is copied to the clipboard with no visible confirmation. Tapping "Share link" (feed, own game) shows nothing, so Kai would not know it worked. Other people's games have no share at all (the share icon only offers Instagram/Facebook text).
2. **"Yes, I'm in" on the agent-found free basketball game (Home, "Needs your yes") makes the card vanish.** The game never appears in "Your games", and there is no confirmation. Kai would not know if he is playing.
3. **Home box is a dead end before an area is set.** Play page (`#/play`): "free basketball near NTU tonight" ends with "No court and partners fit that yet", on an invented map (Westgate/North/Midtown, "sample town"), with no NTU. The "no jump landings" health rule was applied to a new user who never said it. Via home box it first asks "Where do you usually play from?" and shows nothing until he answers.
4. **Price is not shown on feed game cards.** Kai only sees "free court" on the Home suggestion. He cannot tell which feed games are free.
5. **Waitlist could not be tested.** The gated badminton ("Joins straight in at 75%+") let new Kai straight in. No full game existed. The Leave button looked greyed out right after joining.
6. **Slow agent.** Huddle shows "..." for 60+ seconds. The result only appears as a card on Home or a toast, with no push to the Huddle screen.
7. **Wording.** "You is in", "Joy, You are in", "with Kai, 1 of 3 in" (his own game). "Kai's agreed" is odd. Dates are mixed: "THU 19:00" on his own post, "2026-10-30" on others, and "Thursday 5 Nov" in Your games.
8. **Layout.** The tiny "Leaflet" attribution on the start-a-game map is where he tapped to place a pin, and it left the app to leafletjs.com. After posting, the invite card squeezes the place name ("NTU outdoor courts") between two buttons. After the stranger join, the page showed the tab bar floating mid-screen and "3 spots left of 3" stale. The bottom tab "You" opens Huddle's "How you play". The tab labels change (Play to Games, Huddle).
9. Feed state mismatch: Ray's basketball showed "Kai is in" with a "Join" button for a fresh Kai (same name as an earlier account).

## Top 3 fixes
1. Add a share link to every game card (copy with a "Link copied" toast). Make `#/i/<id>` work, or show "game not found" instead of home.
2. After "Yes, I'm in", show confirmation and put the game in "Your games". Show the price ("Free" / NT$) on every game card.
3. Make the home box show results first and ask for the area after. Fix "You is in" and the date formats.
