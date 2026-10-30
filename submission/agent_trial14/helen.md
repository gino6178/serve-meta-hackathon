# Helen (tennis/badminton organiser, Da'an) - trial 15

Visited: Feed, Agent home, Games (Get a game, Courts & prices, How you play), Club (list, Daan Badminton, my own club), Messenger, Highlights, Memory, About, Agent chats, invite links. Used: home box, quick question, limits + agent yes, start club, post game, overlap post, let agents fill, talk, yes, join, comment, like, share, leave, call off, delete post, open invite link. Console: only 400/409 from refused actions (expected); no other errors.

## BUGS
1. Silent refusal on Join. Feed, Join Grace's Sun 20:30 game while already in my 20:00 game: POST /api/feed/join returns 409 "You're already in badminton Sunday 1 Nov, 20:00 ... Answer no there first." The message exists only in a 1x1 sr-only live region (class sr-only, clip 0). Screen shows nothing after two clicks, so the button looks dead.
2. Memory page shows "No games before 14:00 on Sundays - 30 Oct 2026 - you told your agent here". Helen never said this (only typed "Doubles badminton on Sunday evening near Da'an"). Made-up memory, wrongly credited to her.
3. Duplicate answers. Huddle h-d0048bf3 talk: "R15's agent - YES: R15 can do that" appears four times in a row (same person answering 4 times).
4. Feed shows a post with "INVALID DATE 12:00", sport Squash, place "x" (host "Kim R15new2"). Raw garbage visible to every member. Also "R15, R15 are in" / "R15, R15, R15 are in" lists the same name repeatedly (Lily's Mon and Sun 16:00 games).

## MINOR
- Called off a game with one click, no confirm.
- Posting a club game outside my own saved times (Sun 20:00 with "weekday evenings and weekends", weekends end 20:00) is allowed; only "Let the agents fill it" later refuses with "outside the times you set (or you're busy then)" (ambiguous which).
- Overlap warning for the club post named only the 20:00 game, not the 20:30 huddle game I had said yes to.
- Dates inconsistent: invite page "2026-11-01 23:30" vs own invite "Sun 20:00"; agent text shows "2026-11-01" raw.
- "Others needed: 3 - 4 players with you" confusing; link says need=4 while card says "3 left".
- Club "12 members: Leo, Hana, ..." lists 8 names.
- New club page copy: "reading agent posts a few new papers a week" (odd for a badminton club); the place name I typed is not shown on the club page.
- How you play says "you'll go about 5 km, under NT$250" before I gave any answer, while limits fields are blank.
- Jargon: Autopilot, huddles, "Meta's DETR/Sapiens2/SAM", "Reset to demo", "Tomas".
- Agent chats page keeps stale form state ("Sun 01, evening (as you said)").
- "How the agents got there" shows a negotiation for a venue that "hasn't joined Serve".
- Before sharing area, home cards say "3 km away" for Daan Sports Center; courts tab later says 1.9 km.

Numbers agreed across pages: price NT$330 / 4 = NT$83; "3 left" posts, "0 of 3 said yes", invite "3 of 3"; deleting my post called off its game; leave/join counts matched.

VERDICT: 0 BLOCKER, 4 BUG
