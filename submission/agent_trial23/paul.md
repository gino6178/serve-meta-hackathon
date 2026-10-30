# Paul (Da'an, tennis host) - trial 24

Done: demo sign-up; area Da'an District; limits 8 km / NT$300 / agent yes up to NT$200 (saved); club "Paul's Daan Tennis"; posted Thu 19:00; overlapping Thu 19:00 refused with a clear message (409); agents filled it (Kenji/Mei yes); 3 signed-out friends joined from the invite link (3 of 3, then 2, 1, 0 left); a 4th visitor got "This game is full."; joined Hostal's game then left ("Can't make it"; Your games updated); posted Fri and Sat games; stopped agents on Fri; called off Sat (gone from Your games, club feed, invite link says "That game is not open any more"). Console: only 401s, the expected 409, one 404; nothing else.

## BUG 1: game page roster disagrees with the counts (Thu 5 Nov game, full)
Huddle page (#/huddle?...id=h-98721561) for the full "GAME ON" game lists only "You (asked)" and "Friend3". Friend1 and Friend2 are missing (and the earlier Kenji/Mei too). Club card says "Friend1, Friend2, Friend3 are in - full", Your games says "3 of 3 joined", and the toast says "Friend1, Friend2 and...". So the game page shows 2 of 4 people for a game that is full. The agent log also reads "filled straight from the feed" before "Friend3 joined".

## BUG 2: stopping the agents labels the game CALLED OFF
On the Fri 30 Oct game I clicked "Stop the agents filling it (the game stays)". The log says "the game itself stands", and the game does stay in the club feed and Your games, but the huddle page badge and the "Games your agent is arranging" list show a red "CALLED OFF". A false status for a live game (the Sat game that was truly called off shows the same label, so the two cannot be told apart).

## MINOR
- Right after saving the agent-yes setting, a toast "Your agent found a game" appeared for a game I had not asked for.
- Feed cards show "NT$100 each" prices (no money is taken; informational).
- Club form layout jumps while courts load; typing into the place field was lost twice.
- Host counted as outside "3 left" but "4 players" in the fill (consistent, slightly confusing).

VERDICT: 0 BLOCKER, 2 BUG
