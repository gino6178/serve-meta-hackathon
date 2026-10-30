# Mrs. Lin (tablet 768x1024) - report

Completed end to end: demo sign-up, home request, area (Da'an District, Taipei), club "Lin's Gentle Games" (Gentle games), Tue 09:00 game at Da'an Forest Park, "Let the agents fill it", "Yes, I'm in", found it in the list, opened How you play. No page crashed or was blank.

## BUGs
1. Courts lookup fails: while posting the invite ("Finding courts...") GET /api/places/near?lat=25.033&lon=121.565&sport=badminton returned 400 Bad Request twice (console errors, after sign-in). No court suggestions ever appeared; she had to type the place by hand.
2. Unreadable message: in the game chat, the line "Dan's agent can't answer for Dan here (their agent keeps only 52% of its yeses)..." is dark brown text on a brown bubble, nearly invisible on the tablet screenshot.
3. Contradiction: the club has 1 member ("1 member: You"; "0 others"), yet the chat shows ten agents (Leo, Hana, Kenji, Bob, Grace, Ivan, Joy, Lily, Mia, Ben) all saying "Not that one for X (the time)", then "Asking Dan directly". Non-members are being asked in a club-only game.
4. Contradiction in How you play: the same game (Tue 3 Nov 09:00) is "Free public court, Your trip 3.6 km" in the game card, but option A in the question says "an indoor court, 5.5 km". Also her request for weekday mornings is not reflected: "Your times" grid is bright for evenings, dark for mornings.

## MINOR
- Her words travel in the URL (#/huddle?say=I%20would%20like...).
- The list is titled "Your huddles", not "Your games" (jargon; the tab is "Games").
- Jargon: "Agent right 52%", "Usually 10% full then", "huddles", "waitlist".
- Sidebar icons have no text labels; form text in Start a club/game is small.
- Toast "Your agent found a game: Badminton Wednesday 4 Nov, 20:00" is an evening game, not what she asked for.
- Area field placeholder suggests "Xinyi District, Taipei".
- Other console errors seen were only 401s before sign-in (plus one CORS error caused by my own fetch test, ignore).

VERDICT: 0 BLOCKER, 4 BUG
