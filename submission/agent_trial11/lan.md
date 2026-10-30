# Lan (phone, Da'an, tennis + badminton, budget, quiet) - trial12

Setup: demo sign-up as Lan, phone size. The browser refused location, so I stubbed geolocation at Da'an (25.0265, 121.5436) to share the area. Console: only the 401s before sign-in. Phone layout looked fine in text/DOM; the screenshots from this pane were unreliable, so layout was not fully eyeballed.

## BUGS
1. Price limit wrongly hides an affordable court. I set Most per person = NT$120 (farthest 2 km, weekday mornings). Courts & prices (tennis) showed Test Sports Centre with its quietest hours but NO price line, and no reason given. The same court was quoted at NT$115 each (Thu 09:00) once the limit was 250. Starting the game at limit 120 said: "Every option is outside your own limits (the courts cost more than your price limit)". NT$115 and NT$113 are both under 120, so the message is false.
2. Prices disagree across screens for the same slot (Test Sports Centre, tennis, Thu 5 Nov 09:00):
   - Courts page: NT$460 instead of NT$660, NT$115 each.
   - Game talk: the venue agent opens at NT$500 for "a quiet hour", then "NT$450, and that's as low as I go for that hour".
   - Game card: NT$113 each, 32% under list.
   - Home "A quiet hour, cheaper" card (still shown after the game exists): NT$460, 30% off, NT$115 each.
   So 460 / 30% / 115 versus 450 / 32% / 113 for one hour.
3. Courts page lines read oddly or contradictory, e.g. "NT$310 instead of NT$470 for a court for 90 minutes ... List NT$310 an hour" (Sports centre 松山, badminton): the "instead of" price and the list hourly figure are the same number. Also the offer's time is often not one of the listed quietest hours: Jhong Jheng offers Sat 21:00 (22%) while Quietest lists Thu/Wed/Tue.
4. Home card for Taipei Gymnasium said "Tuesday 3 Nov, 16:00 ... 10% full", but the grid has no 16:00 column and the courts page quotes Mon 09:00 (11%) for the same NT$270.

## MINOR
- "Share my area" failure text ("The browser didn't give a location...") shows twice on the page.
- A quote link starts the game form ("At the time you picked: 2026-11-05 09:00") without naming the venue or the quoted price.
- Profile summary says "aiming under NT$120 each ... about 2.2 km" after I saved 250 / 2 km (looks like a learned soft aim, but it is confusing next to the hard limit).
- Court names such as "Test Sports Centre 25.02-121.52" look like coordinates (fixture, not judged). Home games at 信義網球場 showed "close: 0 m" and that venue is missing from Courts & prices for tennis.
- "Only 3 of the 4 players fit it" is hard to follow.
- Cancelled games ("CALLED OFF") stay in the list.

## Worked
Sign-up, area, limits saved ("Saved. Nothing outside these is ever agreed for you"). Courts page respected 2 km (public courts at 2.6 km hidden) and the weekday-mornings quiet hours. Game found, "Yes, I'm in" gave "agreed; 1 of 3 said yes" in Your games and on the game card. No money or deposit asked. No offer to ask for a quote beyond "Get a game then".

VERDICT: 0 BLOCKER, 4 BUG
