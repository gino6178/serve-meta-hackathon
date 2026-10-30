# newA: outside agent books badminton for Nora on Serve

About 31 requests, about 6 minutes. Every request went to 127.0.0.1:8899.

## Path (the requests that mattered)
1. `GET /` returned pointers to `/llms.txt`, the agent card and the OpenAPI file. `/llms.txt` was the most useful page: it lays out sign-in, setup and getting a game in order.
2. `GET /api/auth/providers` returned `{"facebook":false,"instagram":false,"demo":true}`. Then `POST /api/auth/demo {"name":"Nora"}` returned a member and a session.
3. Setup, all 200:
   - `POST /api/huddle/home {"lat":25.04,"lon":121.56}`. I rounded the coordinates myself, so her exact location never left me.
   - `POST /api/huddle/sports ["badminton"]`
   - `POST /api/huddle/limits` with Fri/Sat/Sun 18:00–22:00, maxKm 4, maxEach 150
   - `POST /api/huddle/open {"on":true}`
   - Five `question`/`answer` rounds
   - I did not turn on delegation, because Nora wants to give the final yes herself.
4. `GET /api/huddle/today` returned one game. Host Leo (shows up 100% over 8 games), badminton, **Sun 1 Nov 19:30, Daan Sports Center, 2.5 km, NT$90 each, 3 spots left**, gate minShow 0.75 with newOk true. `GET /api/invite?id=pmvubu3h6a9abf8cb` showed `spots 3, going 0`, so four players including the host: doubles.

## How far I got
Everything is ready. The only step left is Nora's yes, which would be `POST /api/huddle/game {"post":"pmvubu3h6a9abf8cb","yes":true}`. I have not sent it.

## Problems, worst first
1. **The agent-channel signing in the docs doesn't work.** I signed exactly as `/llms.txt` describes and got `401 {"error":"refused: issuer is not the signing key","why":"bad-claims"}`. The docs never mention an `iss` claim. By trial and error, `iss` = the kid gets past that check, but then every request failed with `401 {"error":"refused: the body is not the one signed","why":"wrong-body"}`. I tried a GET with no body and a POST with `{"on":true}`, and `bh` as base64url, base64 and hex, as the hash of `""` and of `{}`, and left out. All failed. So the "better for day-to-day work" key route can't be used, and the agent has to keep holding Nora's session. *Fix:* document `iss`, publish one worked example (body, bh, a complete JWS), and make the error say what hash the server expected.
2. **The preference questions offer choices outside her hard limits** (asked after the limits were set). Examples: Sat 09:00 against Thu 19:30 at 4.4 km; NT$160 each against a morning slot; 5 km options. To answer I had to guess what Nora would want. The summary she'd be shown then says "You like Thursday evenings", but her windows are Fri–Sun only. *Fix:* build the pairs inside her limits, or label the options that break them.
3. **The learned values clash with the hard limits.** `today` shows `"priceCap":180` next to `"limitEach":150`, and `"maxKm":3.6` next to `"limitKm":4`. It isn't clear which ones the negotiation uses. *Fix:* cap learned values at the hard limits, or name them `soft*`.
4. **The limits have no dates.** "This week" can't be expressed; windows only repeat by weekday. I guessed this week runs to Sunday 1 Nov. *Fix:* add an optional `until` date.
5. **The question count is off by one.** After five answers, `GET /question` returned `"n":5,"of":5`, a sixth question. *Fix:* return none once n equals of.
6. **The deal card reads as if a deal was already agreed.** It ends with "Your agent: NT$330 it is." (it is marked `sample`). It's unclear whether anything was held or committed.
7. **The game listings leave things out.** There's no format (singles or doubles), no length, and the docs don't say whether `huddle/game yes:true` books her straight away or waits for the host. *Fix:* add `format`, `minutes` and a `confirm` field.
8. On Windows, Git Bash rewrote `/api/...` arguments into file paths. That's my own tooling, not the server.

## Needed a human
Only Nora's yes, which is what she asked for. Smaller guesses: what "this week" means, and the answers to the trade-off questions.
