# Trial 40: Olivia's agent on local Serve (http://localhost:8898)

Header x-tester: olivia on every request. Approx. 40 requests in total (file polls not counted).

## What was done

1. Sign-in: POST /api/auth/demo {"name":"Olivia Test"} gave member de-656ae61b6235.
2. Setup: POST /api/huddle/home {lat 25.0330, lon 121.5654} returned rounded home 25.03, 121.57 (as documented, about 1 km). POST /api/huddle/sports {"sports":["badminton"]}. POST /api/huddle/limits {windows Mon-Fri 18:00-22:00, maxKm 5, maxEach 150}: the response shows priceCap 150, limitKm 5, and the windows. POST /api/huddle/delegate {"on":true,"maxEach":150,"newPeople":false}: stored. POST /api/huddle/open {"on":false}: open false.
3. Agent key: generated Ed25519 locally (olivia_agent_key.pem, olivia_agent_pub.json in trial40). POST /api/members/agents registered ag-75ed6cdd899e, kid serve-803250a614cbe6fa.
4. Agent key checks:
   - GET /api/agent-channel/me (signed): 200, returns member and agent.
   - POST /api/agent-channel/huddle/limits, loosened to Sat-Sun 00:00-23:59, maxKm 50, maxEach 1000: 403 {"error":"Over the agent channel limits can only get tighter; loosening them needs your person's session.","needs":"person"}.
   - POST /api/agent-channel/huddle/delegate {"on":true,"maxEach":1000,"newPeople":true}: 403 {"error":"Only your person changes this, with their own session: it is their permission, not yours."}.
   Both loosening attempts were refused as documented.
5. Club: the invite code <code> (club c-58471cab, "Thursday hoops", private) was read from club_invite.txt. POST /api/clubs/join {"code":"<code>"} with Olivia's session returned asked:true (organiser must approve). About 60 s later the club list showed joined:true, members 3 (Tom, Mia, You). Organiser approval came from the club's side.
6. Game search: over the agent key, GET /api/agent-channel/huddle/today was polled 17 times over about 8 minutes. The only game card was a Daan Sports Center badminton game from Leo (Mon 2 Nov 19:30, NT$90, 2.7 km, host trust good). It is not a club game, so it was not accepted. A club card for c-58471cab was present on every poll. No game in "Thursday hoops" ever appeared, so there was no yes, no waitlist and no stay-in phase.
7. Cleanup: POST /api/members/agents/revoke {"id":"ag-75ed6cdd899e"} returned revoked:true. A later signed GET /api/agent-channel/me returned 401 "signed by a key no allow-listed peer has". POST /api/members/leave returned deleted: [de-656ae61b6235, ag-75ed6cdd899e]. GET /api/me then returned 401 "Sign in first."

## Findings

None that count as a BLOCKER or BUG.

## Not exercised

- Step 4 yes/no decision on a club game and the stay-in phase. No club game was posted during the 8-minute window, so these paths could not be tested. This is a gap in the run, not a site defect that was observed.

## Minor observations (not verdict-affecting)

- The Leo game card carries gate newOk:true, while Olivia's delegation says newPeople:false. This was not acted on, so it has no effect on her account. It may still be worth checking whether her agent's delegation should exclude games whose gate allows new people.

VERDICT: CLEAN
