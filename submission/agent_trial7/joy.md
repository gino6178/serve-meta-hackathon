# Joy Lin agent sweep (limits: NT$100, 4 km, wkdy 13-18, wknd 09-18; delegation under NT$80, record only)
Setup: limits + delegation set with session; key registered; all checks over the signed channel (~87 requests). Two test hosts created (new, no record).

PASS
- Quick question: Sat 31 Oct 09:00 and 14:00, 2 km, free. PASS
- Courts list (badminton, tennis): all km <= 3.3. PASS (tennis list first returned looking:true/empty for minutes, then loaded)
- Quietest hours: only weekday 14:00 slots. PASS
- Venue offers: 14:00-15:30, each 70-78. PASS
- Deal quotes: Sat 08:00 and Wed 19:00 carry outside:[time,price]; 14:00 at 115 each outside:[price]; 75 each (Daan) not marked. PASS
- Huddle proposals: pins at Sat 07:00 / Sun 19:00 / Tue 09:00 refused 400; "evening" gives stuck "no time in your windows"; Wed 14:00 picks a free court 1.5 km. PASS
- Recommendations (today): out-of-limit games (far/pricey/19:00) not shown; in-limit ones shown with agentMay reasons. PASS
- Feed join for her: new host -> 403 needs person. PASS
- Posts by agent: 07:00, NT$150, 12 km all 403 "outside what your person set". PASS
- Delegated yes: own huddle yes within limits accepted. PASS
- Refusal lists reasons (price over 80, host new, not a good time, costs too much). PASS except distance (below)
- Tightening accepted (14-18/10-17, 3 km, 90). Loosening refused 403 for: price 120, km 6, windows null, windows [], Mon widened to 12:00, Sat/Sun widened to 08:00. PASS

FINDINGS
- BUG: refusal reasons omit distance. Game 12 km away, NT$40, Sat 11:00 (post pmvuefylq951294fd): POST /api/agent-channel/join and /huddle/game both 403 with reasons ["the host is new"] only; no "too far" (a far, pricey 07:00 game listed time and price but never distance). Agent post "far-out" does say "too far", so distance is checked there, not in join.
- BUG: fill of a posted game is unusable. POST /api/agent-channel/huddle/start {sport:tennis,need:3,invite:[Mei,Kenji],fill:<Joy's own post, Sat 11:00 and Sun 10:00>} -> status stuck, "doesn't work: ... you already play then" (the host clashes with her own game). Price of a fill therefore not testable.
- BUG: agent post at NT$90 each accepted (pmvuefo4ta9fb8c8d) though delegation is under NT$80, while a join at NT$90 is refused for that reason (inconsistent: the agent commits her to 90 without her yes).
- MINOR: /huddle/deal ignores badminton venues unless "sport" is passed (404 "isn't among the courts near you"); "sport" is not in the openapi body. Id returned 404 then 200 while the tennis list was still loading.
- MINOR: Mei's agent answers "(the time)" then counters the identical slot.
- Not testable: positive delegated join (no host with a record can be created), posted-game fill price, game fill of waitlist.

VERDICT: 0 BLOCKER, 3 BUG
