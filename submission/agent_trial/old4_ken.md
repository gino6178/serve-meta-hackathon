# Ken Hsu's agent: trust and non-badminton sports (51 requests, about 15 min)

## What I did
Read `/api/me`, `/huddle/trust`, `/huddle/me` and `/today`. Pulled `/trust/chain?n=200` and re-hashed all 31 entries locally (all valid). Joined Ray's ungated 3-on-3 game. Started four huddles: club 5-player, nearby 10-player (5v5), club 12-player volleyball (6v6), and a strictly gated club 6-player (3v3). Probed attendance, venue deals, the quick question, and leaving a game. At the end only the club 5-player huddle (waiting on Ray) and Ray's game are still open.

## What worked
- The chain is verifiable and the `how` recipe is correct. Ken's subject `7d2a5b…` shows a seed (11/8, 12/8) plus an `asked` entry.
- Ken can't mark his own attendance: `POST /huddle/attend {key, came:{ken:"came"}}` returns 404 "That game isn't one you played". Host self-yes and cancelling don't change his record.
- Waitlist reasons are spelled out: "Ray goes on the waitlist: new, and this game wants people with a record."
- Huddles find public 籃球場 and 排球場 courts. `/huddle/deal` prices basketball and volleyball at 松山運動中心.

## Problems (ranked)
1. **No thresholds, so no path to recover.** `/huddle/trust` returns `{"rate":0.73,"kept":0.67,"flag":false}` and nothing else. The agent can't tell what sets `flag`, what sends Ken to a waitlist, when it loses the right to answer for him, or how many kept games would get him past a gate.
2. **Hidden default gate that Ken himself fails.** `POST /huddle/start {"sport":"basketball","need":10,"nearby":true}` (no gate given) comes back with `"gate":{"minShow":0,"agentMin":0.8,"newOk":true}`. Ken's kept rate is 0.67, so he'd fail other hosts' default gate. Passing `agentMin:0.9` is quietly cut to 0.8. Passing `{"show":0.8}` is quietly dropped (`minShow:0`). The gate field names aren't documented.
3. **`/huddle/places` is empty for basketball and volleyball.** `GET /api/huddle/places?sport=basketball` returns `"places":[]`, same for volleyball. Badminton lists 松山運動中心 with quiet-hour data. Yet huddles and `/deal` use courts for these sports. The deal reuses the badminton busyness (0.105) for every sport.
4. **`/huddle/answer` can't be used.** `GET /huddle/question` gives `"id":"q5-quiettime"`. Then `POST /huddle/answer {"q":"q5-quiettime","pick":"a"}` returns 400 "No such question." (tried 4 shapes).
5. **Team size isn't modelled.** Ray's post says "3 on 3" with `spots:4`. The only rule is "Between 2 and 12 players" for every sport, so 11-a-side soccer is impossible and an odd 3v3 count is accepted. There's no indoor/outdoor flag on picked courts, and no warning that a 12-player volleyball huddle in a 2-member club can't fill.
6. **Misleading messages.** The gated huddle ends "Try fewer players, or more people" when the gate waitlisted everyone. The nearby huddle with no club says "the other 8 spots will be open to the club". `POST /huddle/game {post, yes:false}` on a game Ken had joined says "That game isn't open any more" while 3 spots are open.
7. **Other people's data.** `/members/refusals` shows refusals from other members' agents (Ken has no agents). Promise entries link pseudonyms (`"host":"fba6…"`). `/trust/chain` returns `"heads":[]` although the docs say it has signed daily heads.

Also: Ray's agent posts "Ken is in (shows up 73% · 11 games)" in a public comment.

## Fixes
- Add `thresholds` to `/huddle/trust` (waitlist, can't-answer, flag) and a `next` field (for example "2 kept yeses gets you to 0.71").
- Document the gate schema, reject unknown keys, return the clamp as a warning, and show the default gate.
- Feed per-sport courts (OSM pitches, centre halls) into `/places`, with an indoor/outdoor flag and busyness per sport.
- Fix the question-id lookup in `/huddle/answer`.
- Add a per-sport `format` (3v3 = 6, 5v5 = 10, 6v6 = 12, soccer up to 22) and warn when the pool is smaller than `need`.
- Name the gate when it causes a stall. Leave out "the club" when there's none. Point `/huddle/game` leave attempts to `/feed/join on:false`.
- Limit refusals to the caller's own agents and publish signed heads in `/trust/chain`.
