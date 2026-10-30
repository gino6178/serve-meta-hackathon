# Joy Lin (student, price first, 3/4 show-ups) - trial report

Setup: session set limits Mon-Fri 12-18, Sat/Sun 08-20, 4 km, NT$100; delegation 80, newPeople false. Key registered, signed channel worked first try. ~55 requests.

## What works
- Signed channel and tighten-only for plain loosening: maxEach 150, maxKm 6, wider windows, windows:[] and nulls all give 403 "limits can only get tighter... needs your person's session" (needs:"person").
- Pinning a time outside windows: 400 "Tuesday 3 Nov, 09:00 is outside the times you set... Change your limits, or pick another time." Clear.
- Channel yes on a game over delegation: "NT$90 each is over the NT$80 your person allowed: ask them."
- Fairness of 3-of-4: /huddle/trust says "shows up 75% (3 of 4). Gate compares 78%... To clear 75%: you do; 90%: 8 more." Transparent; passes a 0.75 gate.
- Cheapest good tennis: free public court (0.6 km, Wed 14:00, busy 0.13).

## Problems (ranked)
1. LOOSENING BYPASS on channel limits. POST /api/agent-channel/huddle/limits {"maxKm":-1} -> 200, limitKm becomes null (no distance limit). {"maxEach":"abc"} -> 200, limitEach null. Invalid values are read as "remove". Fix: validate numbers > 0; reject invalid.
2. Venue haggle and venue offers ignore limits. POST /api/agent-channel/huddle/deal {"place":"osm:way/281751127","date":"2026-11-04","start":"14:00","players":4} -> 200 NT$115 each (>100), no warning; same for 09:00 Wed (outside windows). GET /huddle/places offers: each 115 and 128, "at" slots Wed/Mon 09:00, quiet lists include 09:00 weekdays and Sat 21:00. Fix: drop or flag over-cap/out-of-window slots, and haggle toward the cap.
3. Recommendations break hard limits. GET /huddle/today shows Fri 30 Oct 20:00 badminton (outside Fri 12-18), scored up as "one of your good times (Friday evenings)". The huddle also "found" Mei's Mon 07:00 game, which agentMay itself calls "not a good time". Fix: filter cards and "found" through limits.
4. Agent can post a game above her cap: POST /api/agent-channel/post {"invite":{"sport":"tennis","day":"2026-11-04","start":"14:00","where":"Tennis court","spots":3,"each":150}} -> 200 (post pmvud8q8obf7dfff8 now live in the shared feed; please remove). Fix: apply limits to agent posts.
5. Unclear refusals. Huddle start pinned at the NT$115 venue Wed 14:00 said "doesn't work: it's too soon, or you already play then" (real cause: price, nothing else on). Refusal of Fri 20:00 badminton (NT$90, outside window) names only price, not time. "(not a good time)" never names which window to change. Fix: say the actual rule and the exact limit field.
6. Session yes (POST /api/huddle/game yes:true) on the Fri 20:00 game outside her windows succeeds with no warning, despite "nothing outside is ever agreed", and teaches "Friday evenings". Warn first. I left the game afterwards.
7. Channel tightening quietly lowers learned taste: after tightening to 3 km/NT$90 and restoring 4 km/NT$100 with the session, summary says "about 3 km... under 60 each" (was 100). Restoring limits should not leave the shrunken aim.
8. Huddle with Xinyi Tennis went stuck (Kenji waitlisted as new, Mei busy): fine. But need:1 gives 'Between 2 and 12' while docs call it need; clarify total players.
