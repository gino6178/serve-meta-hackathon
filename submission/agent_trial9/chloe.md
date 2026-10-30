# Chloe (Daan Park, badminton) - trial10

Path: demo sign-up, You page, Club > Daan Badminton, join club, join Leo's game (75%+ gate; new player got "You're in" straight away), post Sat 19:00 game, "Let the agents fill it", set area, agents agreed (Kenji, Grace asked), I said yes, share link, friend (cleared storage) joined by name, re-signed as Chloe, joined and left Leo's game. Console: only 401s, no other errors. (Screenshots were only partly usable: the pane rendered cropped/blank at times; I relied on page text.)

## Findings
BUG 1. Comment counts with nothing to read. Leo's post showed "1" comment right after I joined, and later 2, 4, 5 after more joins/leaves. Opening the comment icon showed only the empty "Add a comment" box. The count contradicts the content.

BUG 2. Invite page forgets the friend is in. After "You're in. Chloe sees it now." (still "2 spots left of 2"), reloading the same link as the same session showed "1 spot left of 2" with a "Join this game" button again. Clicking it did not double-count (still 1 left) and said "You're in" again, so it is mostly a display fault, but the person is told to join twice.

BUG 3. Possible wrong seat change. Leo's game showed "Chloe, Lily are in · 1 left". When a new second Chloe account joined it read "Chloe, You are in · 1 left" (Lily gone, count unchanged). After I left: "Chloe is in · 2 left". Lily vanished without leaving by herself, as far as I could see (could be simulated-member behaviour; unverified).

BUG 4. The game I posted stays "Nobody yet · 2 left" with "Let the agents fill it" on the club page after the agents agreed and I said yes (Kenji and Grace pending). Only after the friend joined did it show "Mei is in · 1 left". Pending/agreed players are not visible on the club card.

MINOR
- My own post shows "You" as author on my side, and "Chloe" for others. Profile page says "You · Level B · Riverside Sports Club", not Chloe/Daan.
- Club says "9 members" (then 10, 12) but lists only 8 names; the count rises with every new account including mine.
- My game card and invite page show "Sat 19:00" without a date; other cards show "SAT 31 OCT".
- Talk shows "Host's agent" yes and "Host's agent" no (two different hosts, same label). Dan's agent line exposes "keeps only 52% of its yeses" (a reliability figure of another person; the same kind of number is public on cards, so only a note).
- Court lookup said "Courts can't be looked up right now" (local limit); the place field then worked by hand.
- The "agents agreed" toast stayed on screen across pages.
- Because clearing storage lost the first Chloe session, the second Chloe could not check "Your games" for the game she hosted; the club page showed the game under Chloe but "Your games" is empty for the new account. The cross-check on one account was not possible.

Talk lines otherwise make sense; no addresses or calendars were shown. The friend's join-by-name flow worked.

VERDICT: 0 BLOCKER, 4 BUG
