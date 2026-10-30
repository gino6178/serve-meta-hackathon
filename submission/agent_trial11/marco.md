# Marco (laptop, Xinyi) - trial 12

Visited: Feed (4 filters), Agent home, Games (3 tabs), Club, You, Messenger, Agent chats, Plan my week, Goals, Body log, Courts, Auto highlight, Memory, About. Used: post, like, comment, share, start game, fill, yes, call off, join, leave, start club, quick question, limits, agent key. Console: only 401s before sign-in. Courts search stayed on "Searching OpenStreetMap" (offline copy, not counted). Screenshots intermittently went black (pane hidden); DOM was fine.

## BUGs
1. Fill changes my game. Posted badminton "Xinyi Sports Hall" Sat 19:00, clicked "Let the agents fill it". Games page says "its time and place stay", but the result was "Test Sports Centre 25.02-121.56" (and Sat 31 Oct). Feed and Agent home still showed my game as Xinyi Sports Hall "0 of 3 joined"/"Agreed: 0 of 3 said yes" while Games showed it agreed with 3 people. Same game, two stories. The posted game had no map spot (form let me post with only a name).
2. Agent said "a free court" at Test Sports Centre, but Courts & prices lists that centre at NT$320/hour, NT$80 each.
3. Agent chats says "No agent chats yet... every message shows up here" right after a full agent exchange (Hana/Kenji/Grace agents) in the Games page and Hana's agent comments.
4. Fake history on a new account: You page says "new - 0 games", yet Goals shows "Streak 8 weeks", "Goal met 4 of 8", "Played with 7 people"; Plan my week says "you played Thu 19:00 6 of the last 8 weeks" and lists Leo/Priya/Tomas "you two often play... 4 games"; Body log shows a sore right knee I never entered.
5. Plan my week contradicts itself: Leo's and Tomas's agents "Agrees", but the report says "refused: doubles needs three members; got 1" and "nothing agreed".
6. "Get a game then" (Courts & prices) changes the URL but the page stays on Courts; the form with the chosen time only appears after a manual reload.
7. Courts page says "Near: your area (Riverside, Taipei)" though I set my area to Xinyi District.

## MINOR
- Raw coordinates in place names ("Test Sports Centre 25.02-121.56"); raw "2026-11-05 14:00".
- Same venue is 1 km, 800 m and 2.0 km away on different pages.
- "You (asked)" stays after I said yes; no confirmation on Call it off; "Ken, Ken, Ken are in" repeats names; Ken's agent posts identical waitlist lines twice.
- Squash/running exist in club and fill forms but not in Start a game.
- Plan my week shows others' trip times ("Leo 9 min").
- Jargon: "Usually 50% full", "Agent right 95%", "agent new", "open weights", "tool loop", chain hash id.
- NT$ cost per head shown on games (information only; no payment asked).

VERDICT: 0 BLOCKER, 7 BUG
