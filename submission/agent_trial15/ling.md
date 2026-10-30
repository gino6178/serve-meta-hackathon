# Ling (phone 375x812, Beitou, weekday mornings, careful with money)

Done: demo sign-up, wish in home box (carried into Games), typed Beitou District (browser refused location), 5 quick questions, limits (mornings, 8 km, NT$150, agent yes), Courts & prices, Get a game, club join/leave, open game join/leave, chat post, agents fill, share link, delete, More menu (Courts, Highlights, Memory, Messenger, About). No horizontal scroll anywhere.

## BUGS
1. Contradictory profile text (Agent home and How you play): "You like early Mondays. You'd rather not play Monday mornings." Appeared after I answered A to every question.
2. Chat: "Badminton Tuesday morning 9:00, doubles, need 3" produced an invite for "Tue 3 Nov, 08:00" (not 9:00). Posted as is.
3. Distance limit ignored/misreported: after raising Farthest to 30 km and saving (field kept 30), "Let the agents fill it" for a Daan game still said "Every option is outside your own limits (the courts are farther than your distance limit)". Agent home also still says "You'll go about 8 km".
4. Game with "Nobody within 5 km... has let agents ask" (Get a game, nearby only) gave no visible result; only the ideas list changed ("2 of 3 huddles"). Dead end for a new user.

## MINOR
- Courts & prices shows only: "The map of courts isn't answering right now. Name the place yourself (pin: {place})": literal {place} placeholder, no courts listed (may be local no-internet).
- Invite page shows raw "2026-11-03 08:00".
- Club feed: "Ivan, You are in"; Leo's agent posts "Agent Ling is in" for my manual tap.
- Tab strip cuts "How you pla..."; "Only people nearby" plus "Also ask people nearby" both on is confusing.
- Jargon: Autopilot, DETR/Sapiens2/SAM 2.1 on Highlights/Memory pages; "Tell your agent" shown twice on Memory.
- Question page still says "One more" and "Until you answer..." after 5 answers; a 6th question appears.
- Console: 401s only before sign-in, plus one 400 (Bad Request) with unknown source after the fill/huddle steps.
- Not tested: overlapping join (no overlapping open game existed), a game reaching her yes (nobody could be matched).

Nothing private about others seen beyond published show-up/agent-right rates.

VERDICT: 0 BLOCKER, 4 BUG
