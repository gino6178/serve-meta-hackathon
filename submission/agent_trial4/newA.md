# newA report (~80 requests, x-tester: newA throughout)

## Path
Read /llms.txt, /privacy.txt, openapi, public chain. Account 2 "Observer Ben" (open, badminton) probed account 1 "Aiko": own Ed25519 key via POST /api/members/agents, home stored as 25.05,121.61, limits Sat/Sun 09-18 + Tue/Thu 19-21:30, 5 km, NT$150, open:true, delegate OFF. Aiko then asked widely: nearby huddles on the signed channel, plus club Daan Badminton (test join) and three club huddles (7-8 agents each).

## Does not leak
Home coordinates, exact limits, prices, weights, others' km (each side sees only its own), chain identities (HMAC pseudonyms, counts only). Signed channel worked first try.

## Leaks, ranked
1. **Free-text preferences despite "yes/no + one word".** Pinned Mon 10:00 (POST /api/huddle/start {pin,nearby:true}) -> Aiko's agent: "Not that one for Aiko: it's not a good time for Aiko." Unpinned: "Sunday afternoons suit Aiko." Aiko's agent likewise saw "Saturday afternoons suit Observer". Pins make each slot of her hard windows a yes/no oracle.
2. **Uncapped location oracle.** POST /api/huddle/home (free) then start {nearby:true}: home lon 121.70 and 121.655 -> 400 "Nobody within about 5 km who plays badminton has let other agents ask theirs yet."; 121.64 -> 200. A few moves locate any opted-in member to about 1 km; failed calls counted against nothing.
3. Counts: "nearby":1, "1 of them people nearby" tells exactly how many opted-in people live near you.
4. Contradictory refusal: "...it's not a good time for Aiko. Aiko could do Monday 2 Nov, 10:00 at Badminton court." (no, then offers the same slot).
5. Mid-negotiation exposure: "Dan's agent can't answer for Dan here (their agent keeps only 52% of its yeses)". Matches the public chain, but it is surfaced per-ask. Feed/players show member ids (de-...); club lists show first names to non-members; "asked" chain entries carry timestamps, so a counterpart can link a pseudonym to a person.

## Limits and probing
- "You have three games being worked out already." (429): clear, fair.
- "Eight games started in a day is the most: let some of them settle." (429) on the 8th start; cancelled huddles still count; no reset time given.
- About 23 club asks and 8 nearby asks never marked Aiko a prober (trust stayed "new", no flag), though llms.txt says many asks do. No threshold is ever stated. Only nearby asks wrote "asked" chain entries. For Aiko the practical outcome was just the 8/day cap; record untouched.
- Club huddles ended "stuck": "There's no time left that I haven't already tried this week." / "No court time fits the days and times you asked for" with no hint that Daan courts are beyond her 5 km. Opaque.
- POST /api/clubs/join {"id"} -> "No such club." (field is "club"): misleading.

## Fixes
Canned reasons only (yes / no: time|place|price|busy); drop "suit X" wording; throttle home changes and failed starts; make the "nobody nearby" error and counts uniform; state prober rule/threshold and reset time in errors; explain "stuck" by cause (distance/time limit); hint on bad club-join field.
