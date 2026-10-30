# Trial 9 - Grace's agent (r9grace)

Setup (session): windows 17:00-22:00 daily, 5 km, NT$120; delegation on, maxEach 100, newPeople false. Registered an Ed25519 key (agent ag-2325bf1dfd6e). Over the channel I tightened to 4 km / NT$110, later windows to Mon 18-21. One extra test account (host, far away). About 62 requests.

## Re-checks (signed channel unless noted)
1. PASS. POST /agent-channel/post of a 90 NT$ game: 200, gate {minShow 0.6, newOk false}, note "Your person's delegation wants people with a record, so new people wait and the game is gated at 60%." Posting at NT$115 -> 403 "outside what your person set (costs too much)"; NT$105 -> 403 "NT$105 each is over the NT$100...".
2. PASS (session path). /api/feed/join on a game overlapping Leo's Sun 19:30 -> 409 "You're already in badminton Sun 1 Nov 19:30 at Daan Sports Center, which overlaps this one", with clash id. (Channel join of that overlapping game was refused only for "the host is new", so the clash path on the channel was not isolated.)
3. PASS. Posted a game for 14 Nov (15 days out) and POST /agent-channel/huddle/start with fill: 200, huddle asking, "Filling 3 open spots".
4. PASS. Far, pricey, new-host game via /agent-channel/join and /huddle/game: reasons array lists price over 100, host is new, and "outside their limits (not a good time, too far, costs too much)". Distance-only case: "(too far)".
5. PASS for inGame (0 = post going 0) and no duplicates: /huddle/today "mine" lists each post once, both channel and session. Not testable: waitlist agreement after real joins (seeded members don't answer). Observation: huddle waitlist shows ['Kenji','Bob'] while the post's waitlist is 0; likely a reserve queue, but unclear.
6. PASS. Loosening maxKm 8, maxEach 200, wider/empty/Sat windows, and null clears -> 403 "limits can only get tighter". Tightening accepted. Invalid values (-1, 0, "abc", from>to) -> 400.
7. PASS. openapi.json has GET /api/agent-channel/me, and /huddle/deal (and its channel twin) has a `sport` property. Deal with sport tennis priced differently from default, so it is honoured.

## Other findings
- MINOR: limits with window day "Funday" returns 403 "loosening" rather than a 400 validation error (valid-from<to case gives 400).
- MINOR: the 115 post refusal says only "costs too much" while the 105 one gives the numbers; inconsistent detail.
- MINOR: omitting `sport` on /huddle/deal silently prices badminton.
- Checked fine: unsigned channel call 401; delegate over the channel 403; deal outside limits is a quote only with `outside` list.

No BLOCKER or BUG found.

VERDICT: CLEAN
