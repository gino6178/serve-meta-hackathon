# Jun (phone 375x812, localhost:5190)

Flow: demo sign-up as Jun, home box words, area "Daan District, Taipei", How you play limits (weekday evenings, 3 km, NT$150, agent says yes up to NT$150), Get a game (only people nearby, weekday evenings), agent chat, Your games / home / You.

## What worked
- Words from the home box ("weekday evenings", "under NT$150") carried to Get a game: quoted back, When preselected to Weekday evenings.
- Limits saved ("Saved. Nothing outside these is ever agreed for you."), persisted after navigating away; summary reads "Within about 3 km, aiming under NT$150 each"; Your times shows only Mon-Fri evening cells. They agree.
- Game arranged: Fri 30 Oct 18:00, NT$100 each, trip 1.1 km, all inside limits. Home card, Games "arranging" list and game page agree (agreed, 1 of 4 said yes).
- Console: only the two pre-sign-in 401s on every page.

## Findings
1. BUG: Agent chat (#/messages) does not know about his game. "What games do I have this week?" and "Is anything waiting for my answer, like the Friday badminton game?" both answered "No game is booked in the next 7 days", while the home card and Games page show an agreed Friday game awaiting 3 yeses. Pending games are invisible to the agent.
2. BUG (words not used): his typed words on the home box are only echoed; "How you play" never shows them and the Your limits form stays empty ("Any time", no km, no NT$) despite "weekday evenings / under NT$150 / near Da'an". He must re-enter them. Also a question typed in the home box ("What games do I have...") is sent into the game form instead of being answered.
3. MINOR: Ticking "Let my agent say yes" inserts a new field ("Only games up to") that pushes Save down; my tap on Save landed in that field, so a first tap did not save. Easy to miss on a phone.
4. MINOR: "Your times" note still says "Until you answer, your agent assumes ... weekend mornings" after limits were saved; it also says "grey is outside your limits" but excluded cells are blank.
5. MINOR: You page shows "Riverside Sports Club" while Games says "Nobody else is in your clubs yet".
6. MINOR: On the game page the sticky header overlaps the "Games" title after scrolling.

VERDICT: 0 BLOCKER, 2 BUG
