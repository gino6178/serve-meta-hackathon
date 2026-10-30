# Trial 17 new2: route-by-route check (about 92 requests, header x-tester: r17new2)

Accounts: Dev (A, with Ed25519 agent key "devbot") and Mei Test B. Neither left.

## Checked, correct call plus one wrong value (all matched the docs)
- status, auth/providers, auth/demo (name:123 -> 400 "name is text.")
- me, agent-channel/me (wrong method in signature -> 401 wrong-request; no signature -> 401 unsigned)
- members/agents (RSA jwk -> 400 naming Ed25519)
- huddle/home (lat 125 -> 400), sports (quidditch -> 400 listing sports; "badminton" string -> 400), limits (bad window -> 400; maxKm "far" -> 400; agent loosening -> 403 needs person; tightening OK)
- question and answer (pick "c" -> 400; unknown q id -> 400), open (on:"yes" -> 400), delegate (maxEach -5 -> 400)
- places (sport curling -> 400), deal (date 2026-13-45 -> 400; unknown venue -> 404; Wed slot returns outside:["time"])
- me, today, trust, needs on both session and key channels
- clubs GET (lat "abc" -> 400), feed (unknown room -> 404), feed/post (spots 99 -> 400), feed/join (on:"maybe" -> 400; unknown post -> 404), agent-channel post/comment/join/feed (bad day -> 400; unknown post -> 404; on:"x" -> 400; too-far game -> 403 "Ask your person")
- agent-channel post under delegation without new people: gate minShow 0.6, newOk false, note says so, as documented
- invite (unknown id -> 404), huddle/start (need 40 -> 400), one, reply (yes:"sure" -> 400), cancel (unknown -> 404; own -> 200), game (why "weather" -> 400), trust/verify

## Not exercised (budget)
clubs POST and join, feed/delete, feed/notices for the host, members/agents/revoke, members/leave, huddle/reply with a valid yes, trust/chain, A2A routes.

## Findings
- BUG: none. BLOCKER: none.
- MINOR: llms.txt lists reply "no" reasons as busy|time|place|price and game reasons as time|place|price, but game accepts busy, time, place, price, quiet, none (error text). OpenAPI has no field descriptions, required lists or response schemas (all routes show the same generic 200/400/401). `hostYes` in the OpenAPI start body is not in llms.txt.
- MINOR: the day error says "Mon to Sun, or a date" but "Monday" is refused (only "Mon" works).
- MINOR: same post shows "You"/"Your agent" in agent feed but "Dev's agent" in the post reply (viewer-relative naming).

## Getting Dev a game
Dev's own post (Mon 2 Nov 19:30, Songshan Sports Centre, 3 spots) has Mei Test B joined (going 1). Seeded Test games are 5+ km away, outside Dev's 4 km limit, and the agent refused them correctly. A nearby huddle (Mon/Tue evening) came back "stuck" because Dev's own games already fill those slots.

VERDICT: CLEAN
