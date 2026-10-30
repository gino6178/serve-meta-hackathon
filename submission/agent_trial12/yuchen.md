# Yu-Chen (phone 375px, badminton, Songshan)

Done: demo sign-up, wish typed on home, area typed (Songshan District), Courts & prices, got a game (Fri 20:30 Test Hall, NT$108 each) and said yes, set limits (weekday evenings, 6 km, NT$200, agent may say yes), quiz answer, home cards, agent chat, More menu, joined Daan Badminton, posted a game, "Let the agents fill it", yes, share link. Console: only 401s.

## BUG
1. Horizontal overflow on club "Start a game" form: the "Others needed" select reaches x=388 on a 375px screen, so the whole page is 388px wide and shifts/crops (header and bottom nav get cut).
2. Agent chat says "Games booked in the next 7 days: 1" for a game the home card says is "agreed; 1 of 4 said yes, waiting for the rest" (not booked). Also shows "Fri 2026-10-30".
3. Distance contradiction: Courts & prices lists Test Badminton court C at 2.7 km; the game there says "Your trip 3.6 km" (Test Hall matched at 2.2 km).
4. On my posted game card, the chip "Agreed: 0 of 3 said yes" overlaps the court name ("Test Badminton court C" is covered) once Share link is open.
5. After I answered yes to the Thursday game, a stale toast "The agents agreed ... Yes?" still appeared later with "Open".

## MINOR
- Participants list still says "You (asked)" after I said yes.
- Limits: I saved 6 km, the home summary still says "You'll go about 5 km" (price updated to 200).
- Courts "Quietest" lists only 19:00 slots at 83-90% full, yet the game I got was at 20:30, 76% full.
- Venue names show raw coordinates ("Test Hall 25.04-121.56").
- Club says "11 members:" but names only 8 (and not me).
- Posted card shows "THU 19:00" without a date, other cards show "WED 4 NOV".
- Report dialog option "Misleading about a paper" does not fit a sports app.
- More menu is translucent; page text bleeds through. Your memory page uses "Autopilot", "Reset to demo", "Tomás" and has two "Tell your agent" labels; "Nothing yet" after I had told the agent my wish.
- "R13" appears as three different agents in one huddle with different answers.
- I was asked for a yes even though I had allowed my agent to say yes for me; no reason was shown (I am new, 0 games).
- Browser screenshots often show a zoomed crop when the page is wider than the viewport (related to the overflow in BUG 1).

Not checked: Auto highlight, About Serve, Your games list on a second device, and "join" on a card (only club join).

VERDICT: 0 BLOCKER, 5 BUG
