# Nadia (Da'an, volleyball/pickleball) - trial17

Covered: Feed, Agent home, Games (Get a game / Courts & prices / How you play), Club (start a club, club post), Memory, Auto highlight, Messenger, About, Agent chats link, share, invite link. Actions done once each: post, like, comment, share, start a game, overlapping game (refused), agents fill, yes, limits, quick question, join, overlapping join (refused), waitlist, leave, call off, delete posts, invite link, memory notes.
Console: only 401 before sign-in, 409 for the two overlap refusals, 404 for the deleted invite. No other errors.

## BUG
1. Pickleball game (Games page, h-5eaa26c7): Mei's and Lily's agents answered YES to every time proposed (4 rounds), yet my agent then said "No time suits all 4 this week ... suits the most of you (3)" and "Only 3 of the 4 players fit it". The fourth player does not exist (1 spot meant for the club), so the message contradicts the transcript above it.

## MINOR
- Volleyball game: "0 of the 5 open spots found people whose agents said yes" followed by "Asking Ken directly" and Ken shown as a player; confusing.
- Feed "Join" on Dev's Tue 3 Nov game put me on the waitlist (new player under the 60% rule); button still says "Join". Hint text reads "Joins straight in at shows up 60%+".
- "How you play" states preferences from one tap: "You like Saturday mornings" after one yes, "You like Wednesday evenings" after one pick.
- Invite page and feed show "Sat 10:00" with no date; Games says "Saturday 31 Oct". Invite says "5 spots left of 5" while Games says "6 players".
- "Agent chats - What your agent said to theirs" link (#/chats) opens the Games form, not a chat list.
- "You (asked)" still shown after yes was given (tick present).
- Jargon: "huddles", "Autopilot", "Reset to demo", "On this device · 1 entries".
- Map tap clears a typed place name (start game, first time).
- Enter in the home "Tell your agent" box did nothing visible; the send arrow worked.
- Private club "R17 club private" name is listed to everyone (marked Private).
- Share dialog "Copy text" says browser did not allow copying (test browser, likely not a site issue).

## OK
Limits saved ("Saved. Nothing outside these is ever agreed for you."), figures agree between Home, Games and You page; prices on Courts page add up; overlapping post and join both refused with clear messages; leave, call off, delete post all reflected across Feed, Home, Games and invite ("That game is not open any more"). No deposits or payments anywhere. No private details of others (only show-up %, games count).

VERDICT: 0 BLOCKER, 1 BUG
