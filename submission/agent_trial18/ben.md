# Ben (phone 375x812), trial 19

Done: sign-up (demo), wish "volleyball Friday 8pm", area (typed Nangang District), 5+1 quick questions, limits (8 km, NT$200, agent yes at NT$150, saved), Courts & prices, club Daan Badminton (join), joined and left Leo's game, posted a volleyball game in the club, agents filled it, shared link, deleted. Every More item, agent chat, About, You page. Not done: following a game to a real yes (simulated members did not answer), joining two overlapping games (no overlapping pair found).

## BUG
1. You page shows "You" and "Level B · Riverside Sports Club" for Ben, who never joined that club (he joined Daan Badminton). Contradicts the name and his club.
2. Same name twice among different people: "R19, R19 are in", "R19, R19, R19 are in" in the feed, and "Lily, R19, R19, Ivan and Hana's agent said yes" in the huddle. Club header lists R19 once. Players can't tell who is in.

## MINOR
- Courts & prices says "The map of courts isn't answering right now" (and the club "Finding courts..." never lists any), while GET /api/places/near returned Test volleyball courts. Also the area looked like Xinyi (lat 25.033, lon 121.565), not the Nangang I typed. May be local-copy limit.
- Club member count (10) lists 8 names, not Ben.
- "Others needed" select is cut off ("3 · 4 players with"); sport list in club form lacks squash.
- "aim to pay under 255 each" has no NT$; "Within about 9.8 km" vs "about 10 km" in the same card.
- Jargon: "hash of the one before it", "Autopilot", "DETR/Sapiens2/SAM 2.1", "Retrain from agreed records", "Prediction in use: 20261028", "Measured on a simulated club". About page is very technical.
- Memory page says "On your server, what you told your agent" but shows nothing stored; "Reset to demo".
- Menu "Courts near you: judged from reviews and weather" opens the Courts & prices tab, which says nothing about reviews or weather.
- "How you play" keeps the previous highlight on the new question for a moment; Delete post has no confirmation.
- Leaving a game posts "Ben can't make it" publicly in comments.
- Auto highlight: sticky bar covers the "See the reel" button at the top.

## Checks that passed
No horizontal scroll (375/375). Invite link shows only game details, no host name. Agent chat answer matches the game. Delete shows "Called off" in the huddle. Console: only 401 before sign-in and one 400 for "Let the agents work it out" with nobody in clubs (refused on purpose, clear message).

VERDICT: 0 BLOCKER, 2 BUG
