# Grace-Ann (Daan, badminton host), in-app browser, 127.0.0.1:5190

Note: tabs_create failed (pane gone), so I used navigate, which opened tab-25. I cleared storage there first.

Done: demo sign-up, area "Daan District, Taipei" (toast "Your agent found a game"), joined Daan Badminton, posted Thu 19:30 for 4 at Daan Sports Center (card: "Nobody yet · 3 left"), "Let the agents fill it", started it, opened the talk from the club card, said yes, checked Your games and the home cards, pressed Share link, called off the fill, then posted a second game and deleted it. Console had only the old 401s after every page.

## Findings

BUG 1: Share link gives a sighted user no feedback. I clicked "Share link" on my game card in the club feed twice. Nothing appeared and the button did not change. The DOM holds "Copy this link to share it: http://127.0.0.1:5190/#/invite?id=pmvug3vx449c25a6a", but it sits in a 1x1 px element (aria-live region). navigator.clipboard.writeText fails here (NotAllowedError), so this is the fallback path, and it is invisible. If copying fails, the person never sees the link or any message. (The clipboard denial may come from this pane, but the fallback should still be visible.)

MINOR:
- The talk is clear and nothing private shows. One line shows another member's agent reliability: "Dan's agent can't answer for Dan here (agent right 52%; this game wants 80%)".
- The talk says "Free public court" at Daan Sports Center, but Leo's game at the same venue says NT$90 each.
- After "Call it off" the only change is the "CALLED OFF" label on the talk. The ideas panel counter also moved ("no time suits the group" 1 to 2 of 3, and a new "no courts" idea appeared), although a court had been found.
- After "Call it off" the game stays under Your games on home ("0 of 3 joined"). Its club card goes back to "Let the agents fill it". This is probably intended.
- Deleting a post has no confirmation.
- The time field did not accept typed digits; arrow keys worked. This may be an automation limit.

Checked and consistent:
- The fill form (badminton, 4 players, "time and place stay", 7 others) matches the game.
- The club card read "Agreed: 0 of 3 said yes".
- After my yes the talk said "Waiting for Grace, Lily, Kenji".
- Home Your games read "0 of 3 joined".
- Delete removed the post and it stayed gone after reload.

VERDICT: 0 BLOCKER, 1 BUG
