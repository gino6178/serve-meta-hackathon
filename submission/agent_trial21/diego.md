# Diego (host and player) report

Journey done: demo sign-up; area (Neihu), limits (weekday evenings and weekends, 8 km, NT$200), agent's yes ticked and saved; club "Neihu Work Crew"; posted Thu 19:00 game; overlapping Thu 19:30 post; "Let the agents fill it"; joined/left a waitlist and a seated game; shared link opened signed out, friend "Mei" joined; called off one game, deleted another; checked Your games (Agent page), home feed and club cards after each step.

## BUG (1)
1. Calling off a game does not close its open invitation. After "Call it off" on the huddle (log says "Diego called it off."), the club card for that Thu 19:00 game still showed "Mei is in · 2 left", "Let the agents fill it" and "Share link". GET /api/invite?id=pmvul8o9ub017175c still returned 200 with spots 3, going 1, full false, so a friend could still join a game the host had cancelled. No notice appeared to Mei, who had joined. The invite only closed (404 "That game is not open any more.") after I deleted the post separately.

## MINOR
- Home "For you" feed (/api/feed?n=30, 9 posts) never showed my own club game, so home cards and club cards cannot be compared. Maybe by design.
- Overlap attempt (Thu 19:30 vs 19:00) was refused clearly: "That overlaps badminton Thursday 5 Nov, 19:00 (the agents agreed it)". Good.
- Waitlist: joining Noah's agent game put a new user on the waitlist with a clear comment. Leaving worked, but the comment "Diego is on the waitlist..." stayed in the thread.
- Mei's join shows to Diego as "Your agent: Agent Mei is in", labelled as his own agent.
- Typing into "Name the place" via keyboard was lost twice in the start-a-game form while "Finding courts..." was shown (the field re-rendered). Setting it through script worked.
- "Give his yes": the only agreed game was one I hosted ("nothing to say yes to"), so I never had a yes to give. The huddle asked Hostone directly although the "Agent paused" tag showed; the text said so.
- Delete has no confirmation.

## Consistency checks
Your games (Agent page), club card and huddle agreed after: post (0 of 3), friend join (1 of 3 / 2 left), join and leave of Cleo's game (1 of 3 in, then "You've left that game"), and delete (list emptied). Console errors were only 401s before sign-in and 4xx from refused actions (400 fill with empty club, 409 overlap, 404 invite after delete).

VERDICT: 0 BLOCKER, 1 BUG
