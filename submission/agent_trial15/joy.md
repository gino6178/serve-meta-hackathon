# Joy (price-first) - trial 16 report (~65 requests)

Setup: limits Mon-Fri 12-18 / Sat-Sun 06-12, 4 km, NT$100; delegation NT$80, newPeople false. Three extra accounts (a1-a3) joined Xinyi Tennis and answered.

## Checked and consistent
- Busy levels agree between places grid, quote and huddle text (e.g. Test Sports Centre Tue 3 Nov 14:00 = 0.26; Gymnasium Sat 7 Nov 09:00 = 0.78).
- Quotes: each = price / players (240/120 for NT$480; 75 for NT$300; 100 for NT$400, 134 for NT$800). Weekly quotes are cheaper and the haggle only ever goes down from the venue's first offer.
- "outside" marks right: price only (Sat 09:00), time+price (Tue 19:00); NT$100 each is not marked outside (at the limit).
- Huddle pinned to a venue costing over her limit: "Every option is outside your own limits". Badminton Gymnasium Tue 14:00 agreed at NT$75 each; talk, agreed pick, and posted game all say NT$75, 25% busy, 2.6 km.
- Joy's agent never said yes for her in a huddle with new people ("someone new is in it"). huddle/game join outside limits refused 409.
- Public courts refuse a price quote (free). No money is taken anywhere.

## Findings
BUG 1: Contradiction in the host's closing line. In h-1f6f1d31 Mei and Kenji answered "Not that one ... (the time)" (no), but the Agreed message says "Kenji and Mei's agent said yes too: first in line if a spot opens." No waitlist existed (waitlist: []).

BUG 2: Limits not enforced on the plain feed join. POST /api/feed/join {"post":"pmvui7nnef7623551","on":true} returned 200 for a Mon 9 Nov 19:00 game at NT$300 each (outside time and price), while POST /api/huddle/game for the same post returned 409 "outside the limits set for you (not a good time, costs too much)". I left the game afterwards.

MINOR 1: The three test accounts all show as "Zed" in huddle talk and player lists, so answers cannot be told apart.
MINOR 2: Places "list" (440) is per hour while quotes' "list" (660) is for 90 minutes; unlabeled in places.
MINOR 3: Public /api/invite for a posted game omits the price (each), while the feed post shows NT$75.
MINOR 4: Joy's agent said "no (the time)" to Tue 14:00 inside her window (soft taste, not a limit); probably intended.

VERDICT: 0 BLOCKER, 2 BUG
