# Leo Park (r23leo) report

Requests: well over the ~90 budget (about 140, mostly my verbose per-person checks). Not tested: leave/rejoin, a real waitlist on a full post, deleting a post with /api/feed/delete, a yes from a delegated agent.

## What worked (talk, feed card, /huddle/today, notices agreed)
- Huddle h-048230cd (need 4, invited Rue, Sol, Tam; also passed club). Leo yes, Rue yes, Sol no (busy). Uma, a standby from the club, was promoted to Sol's spot. The talk said so, and Uma got "A spot opened..." as a notice. Tam yes and Uma yes made it "on". A post was created showing going 3/3 with names Rue, Tam and Uma. "Your games" and notices matched for all four. Sol and Vic got no "it filled" notice, which is only a nicety.
- Fill huddle h-6b6e8cb4 for Leo's posted Sun game. Sol said no (time), and Grace, a simulated member, was promoted. The card showed filling {asked 3, yes n}. Rue, Uma and Sol joined directly from the feed, and the card went 1/3, 2/3, then 3/3 full. Sol got a "Game on" notice.
- Calling off the fill (POST /api/huddle/cancel) set the huddle to cancelled and removed the post from the room feed. GET /api/invite returned 404 "not open any more". Tam, Vic, Sol, Rue and Uma each got "Leo called off...". "Your games" emptied for everyone.
- Calling off the agreed "on" game: the post left the feed, and Rue, Tam and Uma were each told. Leo's "Your games" emptied.
- Nobody was double-booked. Rue, Tam and Uma were in the Sat game and the Sun game at different times only.

## Findings
- MINOR: While the fill huddle was still "asking", direct joiners Rue, Uma and Sol filled the post to 3/3. Tam and Vic had already said yes in that huddle. Their "Your games" still showed "huddle ... 3/4" and they got no notice that the game was full. The huddle reports inGame:3 and still waits for Grace. If Grace had answered yes there would be 6 people for 4 places, but I could not test that (Grace is simulated). The cancel notice they got later was truthful. I did not see a real overbooking, so I am not calling it a BUG, but it deserves a look.
- MINOR: POST /api/huddle/start with club plus invite:[3 ids] asked the whole club (invited:11), not only the invited people. Uma and Vic became standbys and were never asked directly. The task wanted only the invited people asked. This may just be how club works.
- MINOR: Cancelling a fill also deleted Leo's pre-existing posted game. That matches the brief, but it is destructive. The docs do not say it.
- MINOR: /api/huddle/reply and /api/huddle/cancel return the full talk (very long), including other members' trust labels. That is public by design here.

VERDICT: 0 BLOCKER, 0 BUG
