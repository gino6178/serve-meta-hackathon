# r22ivan report (Ivan Tsai, host). About 100 requests; five test accounts Pia, Quin, Rhea, Sol, Tove (Daan Badminton).

## What I ran
1. Huddle h-f9647b66 (with club + invite ids): agreed Sat 7 Nov Taipei Gymnasium NT$100 each. Pia yes, Quin no (price), Rhea no (busy); waitlisted yeses Sol then Tove moved up with notices "A spot opened"; Sol no (busy) -> Kenji (seeded) took the spot; Ivan yes. Called off with POST /api/huddle/cancel: Pia and Tove got "Ivan called off...", Sol (had declined) rightly got nothing; Ivan's "Your games" emptied.
2. Huddle h-9242fd1d (invite ids only, no club): invited=3, only those asked. Quin said no, 3 of 4 fit; Pia, Rhea, Ivan yes -> status "on", post pmvul6r6z68e80279 with 1 open spot. Talk, feed card (going 2, spots 3), "Your games" and comments agreed.
3. Direct joins: Sol filled it ("Game on"), Tove and Quin went to the waitlist (comments correct). Sol left, Tove moved up, game full again; Ivan was told of both. Host posting an overlapping game (10:30 same day) was refused with 409 "That overlaps ... already in your games" (no double-booking).
4. Ivan deleted the post: Pia, Rhea, Tove, Quin got "called off"; huddle became cancelled with "Ivan deleted the game"; today/"Your games" cleared for all.

## Findings
- BUG: a waitlisted player who moves up is never told. After Sol left, Tove moved up (feed comment "Tove moves up from the waitlist", game full, Ivan notified, her "Your games" lists it) but GET /api/feed/notices for Tove returned empty; her only notice later was the call-off. Pia and Rhea did get "Game on ... You're in". Tove never heard she had a spot.
- MINOR: giving "club" with "invite" asks the whole club (11 invited in the first huddle) in addition to the ids; to ask only chosen people, omit club.
- MINOR: cancelling an agreed huddle adds no line to the talk (status only changes to "cancelled").
- MINOR: Quin's no reason changed between rounds of the same talk ("the time", then "the price").

Not tested for lack of budget: a waitlisted person who clashes with another game being promoted; "yes" on a huddle that already filled.

VERDICT: 0 BLOCKER, 1 BUG
