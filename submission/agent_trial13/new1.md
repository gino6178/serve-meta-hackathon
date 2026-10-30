# Trial 14 new1: Noor, weekend tennis (about 40 requests)

## Path
Demo account (POST /api/auth/demo), Ed25519 key registered (POST /api/members/agents). Setup with the session: home 25.052/121.530, tennis, limits Sat/Sun 08-12 / 5 km / NT$200, six questions answered, open on, delegate maxEach 150 newPeople false. All later calls signed over /api/agent-channel/*; the signing worked first time.
Then POST /api/agent-channel/huddle/start {tennis, need 2, nearby, gate minShow 0.75, Sat/Sun morning} gave h-8cc13571. The talk agreed Sat 31 Oct 09:00 at Test Tennis court A (free, 1.7 km, busy 0.71), with Mei (shows up 100%, 5 games) as the one asked for a yes. The host side is yes. Mei is simulated and had not answered after three polls. The outcome is agreed on our side and waiting for Mei (due about 1 day); not yet confirmed.

## Checks that matched
- Busy levels: places grid 0.71 for court A matches the pick's busy 0.71. Quote text "usually 87% full" matches grid 0.87.
- Venue quotes (Sat Centre NT$193 each, Sun Hall NT$178 each) were refused as "outside your limits (costs too much)"; they were not booked, so no overspend.
- Public court quote gives a clear 400 ("free, no price").
- Privacy.txt matches: no area shown, only km.

## Findings
1. MINOR: the quote note says "outside your limits (costs too much)" for NT$193 and NT$178 each, but Noor's hard limit is NT$200. The block seems to use the learned priceCap 145 (set from my six answers), and the message calls it a limit.
2. MINOR: places shows "list":510 (Centre) while the deal for the same venue shows "list":770 for "90 minutes". It looks like per hour vs per 90 minutes, but the units are not labelled.
3. MINOR: deal always says "4 players", so each-price ignores singles (2 players).
4. MINOR: the places "quiet" list holds slots with busy 0.71 to 0.89 (e.g. Centre 0.87), so "quiet" is only relative to her window; the chosen court is not quiet, though she prefers quiet.
5. MINOR: the huddle shows "agreed": true and "going 1 / spots 2" on the today card while the status is "asking" and Mei has not said yes. Joy also appears in the talk as a yes but is not in the players.
6. MINOR: GET /api/huddle/question kept serving a 6th question after "of":5 ("about five" in the docs).
7. MINOR: the learned summary says "You like early Saturdays" although no answer chose a time on purpose (my picks were driven by price and quiet).

No BLOCKER and no BUG. Nothing was agreed outside her windows, distance or price, and the delegated yes was never used beyond NT$150.

VERDICT: CLEAN
