# Leo (club owner/host) trial, r17leo, about 97 requests
Extras: 4 demo accounts (all show as "R17" in talks), joined Daan Badminton.

## Ran
1. Club huddle h-7f8b9bc0 (3 players): Quin "no/busy" -> Grace (seeded) took spot; Pia yes then "no/time" (left) -> Lily asked; Leo yes; host cancel. Talk, /huddle/today "mine" card (dropped after cancel) agreed with each other. Pia re-yes after leaving: 404 "isn't one you're in" (reasonable).
2. Posted game pmvuirodo6d4b653d (3 spots): Pia/Quin/Rex joined directly, Sol waitlisted. Quin left -> Sol promoted. Feed card (going 3, full, waitlist 0), "mine" cards and notices agreed. Rex left, fill-huddle h-c8a4edad filled it with Rex again; everything agreed.
3. Quin hosted h-fa5fd8cb pinned Tue 3 Nov 19:00 inviting Leo, who was already booked in the post at that time. Leo never got a card or notice (no double booking). Leo reply: 404. 
4. Leo deleted the post.

## Findings
- BUG: After POST /api/feed/delete on the full game, joined players Pia and Sol got no "called off/deleted" notice. Their next notices were only the earlier "Game on ... You're in" ones; later empty. Their "mine" cards correctly dropped it.
- BUG: Fill huddle h-c8a4edad stays status "on" with post=pmvuirodo6d4b653d, talk "Everyone said yes", after that post was deleted (GET /api/huddle/one).
- MINOR: Repeated identical "Game on ... full. You're in." notices (Pia got 3, Rex 2) for one join, each time the game refilled.
- MINOR: Leo (host) got no notice when a leaver's spot was refilled from the waitlist or by the fill.
- MINOR: Huddle "mine" card shows club:null for a club huddle; every extra shows as "R17" (first word of name), so talk lines are indistinguishable.
- MINOR: Talk says "Grace takes the spot" because her agent said yes, yet Grace is still "waiting" for a yes.
- Not a finding: seeded members never answer; "Test ..." courts appeared as counters.

No private data leaked in what I saw (non-hosts see the talk without sessions or preferences).

VERDICT: 0 BLOCKER, 2 BUG
