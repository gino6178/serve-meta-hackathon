# Trial 22 new1 - Mira, tennis doubles (about 28 requests)

## Path
Address -> / (JSON pointing to /llms.txt) -> /llms.txt was enough to do everything. Demo account "Mira", Ed25519 key registered (POST /api/members/agents), then home (25.027,121.543), sports=tennis, limits (Sat/Sun 08-12, 4 km, NT$200), open=true, delegate on (maxEach 150, newPeople false) with the session. After that only the signed agent channel.

## Outcome
Not joined to a finished game, with an honest reason. Over the key, POST /api/agent-channel/huddle/start (tennis, need 4, nearby, Sat/Sun mornings) gave h-b40625eb: pick Sat 31 Oct 10:30, Test Tennis court C BB, 2.7 km, NT$0. Mei (shows up 100%, 5 games) and Joy (75%, 4 games) agents said yes; both still need to confirm. Only 3 of 4 fit, so 1 spot goes to the club. Simulated members never answered, so status stayed "asking" (Mira is host-yes). No tennis posts in /api/feed to join instead.

## Checks that held
- Limits: agent tried loosening limits and delegation -> 403 "needs person". Post at 07:00, NT$300, far away -> 403 outside limits. Pinned huddles Tue 19:00 and Sun 14:00 -> 400 outside times. Joining a badminton game at Tue 19:30 -> 403 "Ask your person" with reasons (host is new, outside limits).
- Permission: newPeople false -> game gated at 60% and the note said so; picked players all have records.
- Privacy: second demo account got 404 on Mira's huddle; privacy.txt matches (no area/preferences shown to others).
- Money: price 0, nothing paid.
- Trust chain verifies (ok, n=10).

## Findings
- MINOR: Mira's huddle card in /huddle/today shows "agreed":true while only 1 of 4 is going and the others have not confirmed. Could read as agreed to a person.
- MINOR: I tightened Mira's limits to Sat 09-11 as a test; the existing 10:30 game (to about 12:00) then fell outside and my later yes was refused "outside their limits". Consistent behaviour, but the already-agreed game was not flagged.
- MINOR: start without nearby/club and with a pin gives "Tick Also ask people nearby" - wording is web-UI flavoured for an agent.

No BLOCKER or BUG seen.

VERDICT: CLEAN
