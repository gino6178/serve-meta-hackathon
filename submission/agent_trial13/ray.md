# Trial 14 - Ray Ho (owner/host of Riverside Hoops)

Done: limits (Sat/Sun 09-20, weekdays 18-22, 6 km, NT$100), delegation (80, no new people), Ed25519 key registered (signed calls not exercised). Four extra accounts joined the club. Club huddle (need 6) with yes / no(time) / busy; fill huddle for a posted game with yes / no(price) / busy; invite-only huddle that reached "Game on"; direct joins, leave/rejoin club, leave a game, host call-off, non-host cancel (403), and being invited by an extra account. Ken (seeded) never answers, so the 6-player club huddle could not reach Game on (local limit). Requests exceeded ~90.

## BUG
1. Double-booking via direct join. Ray and Amy both had a yes in the Sat 31 Oct 14:00 basketball huddle (h-d7ba1b9e). POST /api/feed/join {post: pmvuhcoco584f08e4, on:true} (badminton, same Sat 14:00) returned 200 for both, and a "Game on ... You're in" notice followed. Huddles refuse overlapping times ("you already have a game at those times"), but direct join does not.
2. A private "Game on" huddle is missing from "Your games". h-49620904 (invite-only, status "on", no post) sent "Game on" to all five. GET /api/huddle/today "mine" for Ray, Amy, Bo, Cy and Di never listed it. Bo and Cy had no mine card at all. Agreed-but-pending huddles are listed, so the confirmed game disappears.
3. The host's talk message says "No other agent had said yes to that time, so Tester's spot stays open" after a no/busy. The same talk shows four agents saying yes to that time. It repeated on every decline, in both huddles.

## MINOR
- All four extras display as "Tester", so talk lines, players and notices are indistinguishable.
- Mine card counts: h-d7ba1b9e showed going 3 / spots 4 for need 6, then 2 / 3 after one decline. "spots" seems to be group size rather than open spots, unlike posts (going 3 / spots 5 = 2 left).
- Talk grammar: "the other 1 stay open".
- DELETE /api/feed/post?id=... returns 200 with the post, and the post stays. No documented way to delete a post, so "deleting a post" could not be tested.
- Direct joins and leaves on a fill-huddle's post add no talk line to the host's huddle.
- A no gives only the reason, with no counter time.

## Checked OK
Messages matched no/busy reasons. Leaving a game, call-off notices, the non-host cancel refusal and the 400 for 6 players with 5 invitees were accurate. Ray's own overlapping start was refused as "stuck". The host's private line about Ken's agent right (67%) was not shown to players. Feed card, today and notices agreed after the call-off and the leave.

VERDICT: 0 BLOCKER, 3 BUG
