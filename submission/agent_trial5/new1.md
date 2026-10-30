# Trial 6, new1: Rina, badminton doubles near Guting

Requests used: about 35, of 80.

## Path (bare address to "only Rina's yes missing")
1. `GET /` pointed to `/llms.txt`, which was enough to carry the whole task.
2. `POST /api/auth/demo {"name":"Rina"}` returned a session.
3. `POST /api/members/agents` with my Ed25519 JWK returned a kid.
4. With the session I set home (25.026, 121.522), sports (badminton), limits (Mon-Fri 18:30-22:00, 5 km, NT$150) and `open:true`. Delegation stays off, so the final yes is hers.
5. I answered six taste questions over the signed agent channel.
6. `POST /api/agent-channel/huddle/start {sport:badminton, need:4, nearby:true, when: Mon-Fri evening}` returned huddle h-c018ae84. After a few seconds it showed an agreed pick: Fri 30 Oct 20:30 at Taipei City Jhong Jheng Sports Center, 1 km, NT$105 each (420/4). All of that is inside her limits. Leo, Bob and Joy had agreed, and only the yes from Rina and the three of them was pending (`ask:true`, `waiting:["You","Leo","Bob","Joy"]`). `agentMay` correctly returned 403 "needs delegate".

Signed-channel notes: signing worked once I used the path without the query string. Windows Git Bash rewrote my path, which was my own tooling fault and not a finding.

## Findings
- MINOR: the quick questions offered options outside Rina's stated limits. q0 option a was 5.5 km (limit 5), q1 option b was NT$160 (cap 150), and q2 option a was 6.3 km. The agent has to pick the lesser evil or answer "either".
- MINOR: the questions run past the promised "about five". After `n:5,of:5`, a `q6-timetime` card appeared, shown as "n:6 of:5".
- MINOR: `taste.maxKm` became 5.3 after my answers, while `limitKm` stayed 5. The pick (1 km) was fine, so I could not tell whether the learned 5.3 is ever used in matching.
- MINOR: a default `start` has `gate.minShow:0`, so Bob, who shows up 33% of the time, was invited and counted for Rina's game. I did not set a gate because Rina gave no preference. The agent has to know to pass `gate`.
- MINOR: the pick is today, Friday 30 Oct 20:30. That fits my Mon-Fri window, but whether Friday is a "weeknight" is my own assumption. I should ask Rina or exclude Friday.

No BLOCKER or BUG observed. Limits held: time, distance, price and the delegation refusal.

VERDICT: CLEAN
