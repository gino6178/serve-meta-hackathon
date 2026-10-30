# Oscar trial report (Taipei, laptop, tennis/badminton)

Note: the browser pane was hidden, so screenshots failed. I worked from page text, the accessibility tree and DOM clicks. Layout and visual problems were not checked.

Covered: sign-up (demo), Agent home, Games (Get a game / Courts & prices / How you play), Club list and a club room, Feed (all four tabs), Highlights, Messenger, Memory, About, More menu, invite link. Actions: home box, quick question, limits + agent yes, area, start club, post game, overlapping post (refused 409, clear message), agents fill it, give yes, call off, join Ray's game, overlapping join (refused with clear message), comment, like, share link, leave (x2), delete post, invite link, leave club.

## BUG
None found that I could confirm.

## MINOR
1. Home box: "Tennis doubles near Zhongshan on Sunday morning" sent me to Games with no sign it was heard until I set an area. Then the form showed "Sun 01, morning (as you said)".
2. That "(as you said)" option stayed on a later, unrelated Saturday fill form.
3. In the first huddle, "Zed's agent: YES" appears three times in a row. Zed is not shown as a player.
4. Agent text shows raw dates ("on 2026-11-01"). Messenger also says "Sat 2026-10-31". Test fixture names like "Test Tennis court C 25.04-121.52" show coordinates in the name.
5. Posted games and the invite page show "SAT 10:00" with no date, while other posts show "SAT 31 OCT". The invite link and "Sat" could be read as any Saturday.
6. After giving my yes, my row still reads "You (asked)". The status says "Waiting for Mei, Kenji, Joy".
7. The talk header says "anyone in Zhongshan Tennis Oscar", but the three proposed players are not club members (the club had only me). A court I typed myself was called "Free public court, usually 85% full": invented data for a place I named.
8. Messenger "What games do I have this week?" said "Games booked: 0; 2 more agreed". I had 2 agreed games, so "2 more" after "next game" reads as 3.
9. "Call it off" acts at once with no confirmation. Called-off games stay in "Games your agent is arranging" (labelled CALLED OFF).
10. "Agent chats" link (#/chats) just opens the Games page.
11. Feed "Sports science" and "Highlights" tabs both show "Nothing in the feed yet ... reading agent posts papers": filler, and Highlights is not about papers.
12. More menu says Courts are "judged from reviews and weather", but that page shows only an estimate of how full a court is.
13. Jargon: "Autopilot", "hash chain", "huddles", "Reset to demo". Grammar: "all 1 spots are taken". Memory dates use two formats (30 Oct 2026 / 30/10/2026) and "1 entries". My comment shows as "You  You I'll bring the ball".
14. Home showed Xinyi tennis Mon 2 Nov 07:00 as "1 spot left", while the club feed showed the same game "full, join the waitlist". Possibly another tester joined in between.
15. A first "Let the agents work it out" on an empty club returned 400. The UI said "Nobody else is in that club yet", which is acceptable.

## Checks that agreed
Overlap refusals (post and join), limits "Saved", prices (NT$550/4 = 138, 31% off), Like 0 to 1, leave restores spots, and deleting the post called off the game and closed its invite link ("That game is not open any more"). Console: only 401s before sign-in, plus deliberate 409/400/404 from refused actions.

VERDICT: CLEAN
