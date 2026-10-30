# Ivan Tsai agent run (about 65 requests, x-tester r6ivan)

Done: limits set with session (Mon-Fri 18:00-22:00, 3 km, NT$120), delegation on (NT$120, newPeople false). Registered a key (POST /api/members/agents, 200); signed channel worked (me, today, start, one, reply, post, trust). Started huddles with "when" and with "pin"; posted Wed 4 Nov 19:30 at Taipei Gymnasium (NT$100, 3 spots) and filled it (h-8f6954e2, Leo/Lily/Dan asked, Dan asked directly because his agent is at 52%). Joined Marcus's Thu 19:00 game (1.1 km) with the session. Trust explanation read, consistent (9/9 shows, agent 7 of 8). /api/trust/verify ok.

Limits and refusals that held (accurate):
- Agent reply yes on a NT$225-each huddle: 403 "NT$225 each is over the NT$120 your person allowed" (correct: need=2 means 2 players share the court).
- Agent join/reply on games with new hosts: 403 "The host is new... ask them" (newPeople false).
- Agent POST /api/agent-channel/huddle/limits loosening: 403; tightening: 200.
- Huddles stuck with "courts cost more than your price limit" matched the price per number of players.

Findings:
1. BUG: POST /api/huddle/game {"post":"pmvudjiv94ca71f79","yes":true} (basketball Sat 31 Oct 18:00) and {"post":"pmvudo6bs60986b24"} (tennis Sat 31 Oct 09:00) both return 409 "It clashes with a game you're already in." Ivan had no game on 31 Oct (his games were 4 and 5 Nov). The refusal is inaccurate (the real reasons would be sport/window/distance), and it came in place of any limit explanation.
2. MINOR: Ivan was put in two games at the same time (Marcus's Thu 5 Nov 19:00 join, then yes to Sophie's huddle Thu 5 Nov 19:00 at Taipei Gymnasium) with no clash warning; yet item 1 shows a clash check exists.
3. MINOR: /huddle/places shows offer "each" (113, 98) computed for 4 players, while huddle with need 2 or 3 prices per 2 or 3 players (225/150), so a person sees "each 113" then "over your price limit". Wording unclear.
4. MINOR: a post made over the agent channel returns "mine": false, "you": false for the agent's own person.
5. MINOR: agent-channel start defaults to a stricter gate (minShow 0.6, newOk false) than the session start (minShow 0, newOk true); undocumented.
6. No delegated yes-question was waiting for the agent to answer (cards only had games from new hosts), so agent yes within limits could not be shown succeeding.

VERDICT: 0 BLOCKER, 1 BUG
