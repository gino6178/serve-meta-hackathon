# Grace regression sweep (about 95 requests; 2 extra hosts Hugo, Ivy as new members)
Setup: limits Mon-Fri 19-21 / 4 km / NT$150, delegation 150 + no new people, key registered (kid via POST /api/members/agents).

1. PASS. First signed GET /api/agent-channel/me returned 200. aud "serve" returned 401 `refused: aud must be "serve-agent-channel"`.
2. PASS (1 minor). Tighten (19:30, 3 km, 120) gave 200. Refused 403 "can only get tighter": one-day wider window with other days removed, maxKm 6, maxEach 200, maxKm null, maxEach null, windows []. -1 and "abc" gave 400. MINOR: `windows:null` returned 200 as a silent no-op (windows unchanged), not a refusal.
3. PASS. Channel delegate/open/home gave 403 "Only your person changes this". Channel game yes and join on over-price + new host + outside-window games listed all three reasons (G2, G4); new host + time (G3); new host alone (G1). Price-only and window-only could not be set up (no known non-simulated host).
4. PASS. Agent yes of G1 (newPeople temporarily on, then restored) left weights, grid, answers, pairs and learned unchanged. Answer by id ("q":"q5-quiettime") gave 200 and answers went 5 to 6. No question card in /today; GET /question serves one only when asked.
5. PASS. Gate minShow 0.8 kept exactly (feed post and huddle: {"minShow":0.8,"agentMin":0.8,"newOk":true}). Host's talk: "Dan's agent can't answer... (keeps only 52% of its yeses)". Hugo's copy: only "If a spot is left, Dan is asked directly." `invited:7` only in the host view; absent from Hugo's.
6. PASS. Talk gives "(the time)", "(the place)" only. No nearby-count or number. Non-host sees pick km null.
7. PASS. "No" with why time/place/price returned 200 for recommended games, for G5 and G8 which overlap her joined G1, and for over-limit G2. A refused yes said the real reason: "outside the limits set for you (not a good time, costs too much)"; a join of an overlapping game said "clashes with a game you're already in". MINOR: why=place on a game 200 m away answers "Too far: ... within about 2 km". After a no, the game leaves the feed and a later join gives 404 "not in the feed any more".
8. Pin: PASS. Sat 10:00 pin returned 400 at once ("outside the times you set"). Fill: FAIL, see BUG 1.
9. PASS. Cancelled huddle stays "cancelled" after a reply attempt and is absent from /today. Recommendations only within limits (G2 over price, G3/G4 outside windows never carded). MINOR: reply after cancel gives 409 "The agents are still talking, or it's settled", which is misleading.
10. PARTIAL / not testable. shareUrl is "/#/invite?id=<id>" and GET /api/invite?id= works with no account. This copy serves no web UI at "/" (JSON only), so the invite page itself could not be opened. A game 30 min from a joined one is not recommended and its join is refused as a clash; a near-but-not-overlapping game could not be set up (post rate limit 4 per 10 min).

## Findings
- BUG 1 (check 8): POST /api/huddle/start {sport:badminton, need:2, club, fill:"pmvudz5kr128e4ba3"} for Grace's own posted game (Tue 3 Nov 19:00, Daan Court, NT$100, within her limits). The huddle's talk says the time is right, then "Every option is outside your own limits (the courts cost more than your price limit)". Status is "stuck", the post is unchanged (still only Hugo going), and no yeses reach the game. It looks for new courts instead of keeping the posted time, place and price.
- MINOR: after a person-session loosening to 4 km / NT$150, taste.maxKm=3, priceCap=120 and the summary ("about 3 km... under 120") still show the earlier tightened values while limitKm=4, limitEach=150.

VERDICT: 0 BLOCKER, 1 BUG
