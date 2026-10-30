# Ken Hsu agent trial (r20ken)

Setup: five extra demo accounts ("Kx Aaron/Bella/Carl/Dina/Eli", all joined Riverside Hoops). About 135 requests, so I went over the ~90 budget.

## Worked and agreed across talk, feed card, /huddle/today, notices
- Club huddle h-478f2a4c (need 6): yes, no with reasons (time, busy, price), leave (busy), rejoin ("back in"). Talk, player lists and the "mine" card (going 4 -> 3 -> 5) matched.
- Posted game pmvuk9idiae30b643 plus fill huddle h-f485cbc0: the game was posted once all had answered. Direct join, leave and rejoin kept feed names, going count and full flag in line with the huddle roster.
- Double-booking refused with 409 for Ken's own overlapping post, and for joins at an overlapping time (Aaron and Ken, both with a clash id).
- Call-off and post deletion reached the huddle members' notices, and the deleted post vanished from the feed.
- A 75% gate with Ken at 73%: Ken was put on the waitlist (wait=["Ken"]).
- No private leak seen: others see only names, show-up rate and the reason category.

## Findings
1. BUG: Carl joined post pmvuk9idiae30b643 directly through /api/feed/join. Ken then deleted it with /api/feed/delete. Aaron, Bella, Dina and Eli (huddle members) got "Ken called off ...". Carl's /api/feed/notices was empty. The docs say "those asked hear it", but a direct joiner who was in the game heard nothing.
2. MINOR: Deleting a game produces the notice "Ken called off ..." rather than saying it was deleted.
3. MINOR: Ray (a seeded club member, not one of my accounts) got a spot. The talk says "Ray takes the spot", but his player answer stays null and he is not counted in "going".
4. MINOR: The huddle "mine" card counts the host in going/spots (5/6). The posted game's card does not (4/5, host excluded). The two bases differ.
5. MINOR: pin.place given as a court name returned "I can't find the court you picked"; the docs do not say a court id is needed. A declined player (Bella) who tried to say yes later got 404 "isn't one you're in", though the game was full.
6. MINOR: Ken's /huddle/today showed no card or notice that he was waitlisted for Aaron's gated huddle h-db83690f. Not fully checked.

Not done: replying to the gated invite as a player, because Ken stayed waitlisted.

VERDICT: 0 BLOCKER, 1 BUG
