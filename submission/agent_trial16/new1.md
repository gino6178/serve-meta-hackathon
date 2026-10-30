# Trial 17 - new1 (Rina, tennis doubles, Xinyi)

Requests used: ~32 (header x-tester: r17new1 on all).

## Path
llms.txt -> POST /api/auth/demo -> own Ed25519 key via POST /api/members/agents -> home, sports, limits (Mon-Fri 18:00-21:30, 3 km, NT$180), 5 questions (answered "either": Rina gave no preference), open, delegate (maxEach 150, newPeople false). Then everything over the signed agent channel: /me, huddle/today (empty), huddle/start (tennis, need 4, nearby, minShow 0.75, weekday evenings), huddle/one, huddle/reply yes.

## Outcome
Huddle h-6b203c64: Monday 2 Nov, 7pm, Test Tennis court A (free, NT$0, 2.6 km by Serve's rounded home; about 3.0 km from her exact point, still within 3 km). Mei (shows up 100%, 5 games) and Joy (75%, 4 games) both have a record. Rina's yes given by the key under delegation ("Answered yes for your person"). Status is "asking": Mei and Joy have not confirmed (simulated, no real-time answers). Honest state: she is in and the game is proposed, not yet filled (1 of 4 going; the 4th spot goes to the club).

## Findings
- MINOR: /api/huddle/today card (and agent-channel copy) shows "agreed":true with going:1, spots:3, while /huddle/one says status "asking" and waiting ["Mei","Joy"]. "agreed" appears to mean only the host's yes; it reads as a contradiction.
- MINOR: talk shows Mei and Joy answering "can do that" (yes:true) to every slot, yet players[].answer is null and they are "waiting". Two different notions of yes; confusing.
- MINOR: times are given as "19:00"/"Monday 2 Nov, 19:00", never "7pm"; I wrote "7pm" myself for Rina.
- MINOR: stored home is 25.03/121.56 (docs say ~1 km rounding), so distances are from the rounded point; documented, but a court near the limit could look closer than it is.
- Checked and consistent: limits echoed identically on session and key routes; gate newOk false with the note about new people; reply due = created + 24h; price 0 vs cap 150/180; privacy.txt matches what was returned.

Not tested: weekly posts, A2A, join-by-card (no cards were recommended).

VERDICT: CLEAN
