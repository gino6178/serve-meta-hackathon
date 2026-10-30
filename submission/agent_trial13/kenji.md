# Kenji Wu (r14kenji) report - about 80 requests

Setup: limits Fri-Sun 09-22, 8 km, NT$120; delegation on (no new people); key registered.

## Checks
1. Under-80% agent refused: NOT TESTABLE. Kenji's agent is new, not under 80%; no way to lower it or pause it. Host side: "Dan's agent can't answer for Dan here (agent right 52%...)"; accurate.
2. Over-limit deal: PARTIAL PASS. With my cap at NT$100, a 3-player badminton start stopped with "Every option is outside your own limits (the courts cost more than your price limit). Widen your limits, or ask a club nearer you." (huddle status "stuck"). Direct /huddle/deal quotes over the cap return `outside:["price"]` and "no game is agreed". Every agreed game was within my cap (NT$83, 110, 60). Another person's limit after two venue talks could not be set up here.
3. Named first: FAIL (BUG 2). Deleting a posted game: NOT TESTABLE (no documented delete route; huddle/cancel with a post id gives 404 "No such game").
4. Waitlist note hides record: NOT TESTABLE. I used up my three extra accounts by accident (see Minor) and had no seeded gate with newOk false to be waitlisted by.
5. 400s: deal players 0/-3/99/1.5/"four"/17 and sport "chess"/5 give 400. Feed n=abc/-1/0/1.5/NaN give 400. Demo name 123 or {} give 400. Clubs lat=abc and lat=NaN give 400, but see BUG 1.
6. Earlier rules: PASS. Channel loosening of price, km and windows gave 403 "can only get tighter ... needs your person's session". Tightening gave 200. Overlapping posts (session and channel) gave 409 with `clash`. A join that overlaps my own game gave 409. Leave then rejoin through the channel gave 200. "One no keeps a game": not testable (seeded members answer instantly yes or no).

## Findings
BUG 1: GET /api/clubs?lat=95&lon=121, ?lat=25&lon=200 and ?lat=25 (alone) all return 200 with clubs. Out-of-range or lone coordinates should be 400. The message says "lat and lon are numbers (or leave both out)".
BUG 2: Named picks are not first. POST /api/huddle/start {sport badminton, need 3, club Daan Badminton, invite [Grace]}: Grace, Ivan and Lily all said yes, 2 spots, but "Asking Ivan and Lily". Grace was left out. With invite [Grace, Ivan] and need 4, the ask order was "Ivan, Lily and Grace", so the unnamed Lily came ahead of a named Grace.
MINOR: POST /api/auth/demo with {} or name "" returns 200 as "Demo player". This made three accounts whose sessions I did not keep.
MINOR: POST /api/huddle/game yes:true on a game I had already joined returns 404 "That game isn't open any more".

## New member, price focus
Daan Sports Center game NT$90 each; Taipei Gymnasium Sun 20:30 quiet deal NT$83 each (list 410). Tennis (Test fixtures only) is NT$280-385 each, over any cap; weekly 09:00 quote was list price. Prices are samples.

VERDICT: 0 BLOCKER, 2 BUG
