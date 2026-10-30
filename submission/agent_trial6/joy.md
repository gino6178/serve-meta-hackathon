# Joy Lin (r7joy) report, about 40 requests

Done: limits set (NT$100, 4 km, weekday 13-18, weekend 09-18), delegation (NT$80, no new people), key registered, signed channel worked. Places, huddle (club, "when" Sat/Sun), posted game plus fill huddle, delegated yes all ran.

## BUG
1. POST /api/agent-channel/huddle/deal ignores her hard limits. Asked 松山運動中心 tennis, Wed 2026-11-04 14:00, 4 players: 200 "NT$460 it is", each 115 (> NT$100). Gymnasium Thu 11-05 14:00: each 130. Sat 2026-10-31 07:00 (before her 09:00 weekend start): each 128, accepted. 2 players Wed 09:00 (outside weekday 13-18): each 230. No warning or refusal on any. The same haggle for badminton in /places offers stayed in-window, so only deal is unchecked.
2. GET /huddle/places?sport=badminton lists 羽毛球場 at 4.6 km, past her 4 km limit.

## MINOR
- Badminton venue entries contradict themselves: Taipei Gymnasium "list":270 but offer price 280 "32% off" list 410; 松山 list 310 vs offer.list 470.
- Tennis places first returns empty with looking:true for about 90 s, then fills; no tennis venue offers appear (list 460-510 per court, so no NT$100 option; sensible).
- Huddle talk says "Mei can do that (the price)" for a yes.

## Checked, correct
- Agent post outside limits (Sun 07:00, each 150): 403 "outside what your person set (not a good time, costs too much)", needs person. In-limits post (Sun 10:00, NT$50) accepted.
- Loosening limits via the channel (maxEach 150): 403, needs person.
- Joining Wei's game (new host) via /huddle/game and /join: 403 "the host is new". Matches newPeople:false.
- Huddle start note: gated at 60%, new people (Kenji) waitlisted; says nobody nearby had opened, so only the club was asked. Accurate. Pick was Sun 14:00 / 10:00 at 紅土網球場, free or NT$50, within 1.3 km; all inside limits.
- Delegated yes on huddle h-b3aac90c (NT$50, known host herself) worked.
- Trust for 3 of 4: "Shows up 75% (3 of 4)... gate compares 78% (smoothed). To clear 75%: you do; 90%: 8 more." Agent: new, needs 3 yeses from two hosts. Consistent with the raw record. The 78% and "8 more" I could not verify further.
- The fill did not complete (Mei pending; simulated members), not counted.

VERDICT: 0 BLOCKER, 2 BUG
