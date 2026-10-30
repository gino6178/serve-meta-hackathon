# Hana (r17hana) report

Setup: key registered (agent hana-agent); limits all week 06-23, delegation on (newPeople true); 4 test accounts (p1-p4) in Daan Badminton. About 85 requests.

## Re-check
1. PASS. Hana's agent posted 3 games, then started a huddle (pin 7 Nov 10:00) with p1-p3. After all three replied yes, the talk said "Everyone said yes ... is on" and the post appeared in /api/feed (full, 3 going).
2. FAIL (BUG-1). Limits set to maxKm 20. /api/huddle/me still shows learned maxKm 3.1. Games posted by p1 at about 5, 9, 12 and 30 km:
   - Channel POST /api/agent-channel/huddle/game and /api/agent-channel/join on the 5, 9 and 12 km games: 403 "Ask your person: it's outside their limits (too far)".
   - Session POST /api/huddle/game on the 12 km game: 409 "outside the limits set for you (too far)".
   - Yet the summary says "You'll go up to 20 km (your limit)", and a plain session /api/feed/join of the 12 km game succeeded with no note. The learned 3.1 km still overrides the person's 20 km.
3. PASS for the times. /api/agent/invite-draft kept 9:00 (09:00), 7pm (19:00), 8點 (08:00), 19:30.
4. PARTIAL. Session /api/feed/join of the 30 km game returned 200 plus note "outside the limits you set for your agent (too far). You joined it yourself, so it stands". Not testable: whether spares asked directly are labelled agent yeses. Invitees' "can do that (the time)" lines carry agent:true, and the players' "direct" stayed false even after p1 answered personally. I could not tell which of these is the intended behaviour.
5. PASS. Club privacy "secret" gives 400 "privacy is public or private"; "private" is accepted. GET /api/feed?room=c-nope and POST /api/feed/post with room c-nope both give 404 "No such club."
6. Overlaps PASS: posts (channel and session, 409), feed/join, channel join and huddle/game against an overlapping game (409), and a post overlapping an agreed, unposted game (409 "the agents agreed it"). One no (p2 busy) with p3 yes: the game went on with the spot open (going 2/3). Deleting a game with a pending fill: huddle "cancelled", the late yes got 409 "It was called off". Channel limits: loosening maxKm 30 and maxEach 400 gave 403, and tightening to 15 gave 200. Not testable: an agent under 80% (Hana's is 95%).

## Findings
- BUG-1: the learned distance cap beats the person's limit (see 2).
- BUG-2: a leaver is not taken back. After p3 left the posted game via /api/feed/join on:false, the post shows going 1, but GET /api/huddle/one?id=h-29ab00c6 still lists p3 as "yes", status "on", and the talk says nothing. p3 still sees the huddle as on.
- MINOR: invite-draft for "squash 2026-11-12 19:30 Test Hall" returned sport badminton, day 2026-10-31, and where "Near me". The explicit date, the sport and the place were ignored.
- MINOR: deleting an already-on posted game leaves its huddle "on" with fill still set, and the talk has no line saying so.

VERDICT: 0 BLOCKER, 2 BUG
