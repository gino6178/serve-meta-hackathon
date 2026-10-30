# Joy Lin (price-first) - Round 12

Setup: limits Sat/Sun 09-18 + Fri 18-22, 6 km, NT$120 (then tightened to 90 over the channel); delegation on, max 100, new people off; open; key registered. 3 extra accounts: used 2 (Hana Host, Ivy Host). About 103 requests (slightly over budget).

## Re-checks
1. PASS. Club huddle, need 4, only 3 fit: "No time suits all 4 ... suits the most of you (3); the other 1 spot will be open to the club", then "Best time so far: Saturday 31 Oct, 14:00 ... Only 3 of the 4 players fit it ... posted with 1 open spot ... or ask for fewer players." Not "Agreed".
2. PASS. Agent talk and deal: "Badminton court · 羽毛球場", "Sports centre · 大安運動中心's agent". Note (MINOR, host-typed text): a posted game with where="信義網球場" is shown raw in the fill talk ("Agreed: ... at 信義網球場") and in /today; no "<type> · <name>" there. Server-sourced courts are fine. Could not set up a non-Latin tennis court (tennis courts here are only "Test ...").
3. PASS. feed/post and agent-channel/post: each=-5 -> 400; minShow 1.5 and 2 -> 400. feed/join and agent-channel/join with on:"yes", 1, null -> 400. places?sport=curling -> 400 (both routes).
4. Earlier fixes:
 - limits only tighten over channel: PASS (price, km, window, empty windows, null all 403 needs person; 120 -> 90 OK).
 - delegated yes refusals list all reasons: PASS (one 403 listed price over 100, host new, outside limits: time, distance, price).
 - overlapping joins refused: PASS (409 with clash, both routes).
 - fill more than 7 days out: PASS (14 Nov game filled, agreed).
 - counters never repeat a turned-down option: PARTIAL. Simulated members only said yes, so no counters after a no could be provoked; the four options offered in one talk were all different.
 - invalid huddle values get 400: FAIL in part. need -2, need "two", need 99, bad sport, minShow 2 -> 400. But POST /api/huddle/start with nearby:"yes" returned 200 and created a huddle; need:1.5 returned 200 and was silently made 2.

## Price-first exploration
- Deal: venue 大安 quote each 98 (list 440, sample) flagged outside ["price"], "A quote only ... no game is agreed there."
- Huddle pinned to that venue: "Every option is outside your own limits (the courts cost more than your price limit)", status stuck. Good.
- Delegation cap 100 vs limit 90: game at 95 each, new people allowed -> agent join refused "outside their limits (costs too much)". The stricter limit wins. Good.
- Agent joined a NT$85 game, and a 40-each fill agreed within limits. No case found of the agent committing above limit or delegated price.
- Daily cap of 8 huddles blocked further tests; "cheapest fitting game" ordering not fully explored (/today showed one game).

## Findings
- BUG: /api/huddle/start accepts a non-boolean nearby ("yes") with 200, against "invalid huddle values get 400". (need 1.5 rounded silently: MINOR.)
- MINOR: host-typed non-Latin court names are not given the "<type> · <name>" form.

VERDICT: 0 BLOCKER, 1 BUG
