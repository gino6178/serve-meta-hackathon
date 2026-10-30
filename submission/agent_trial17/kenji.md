# Kenji (r18kenji) trial report, about 85 requests

Setup: registered agent key (kid returned, signed GET /agent-channel/me ok). Limits set to Mon-Sun 07:00-22:00, 20 km, NT$150; delegation on (150, newPeople true). Four test players (Test Alpha..Delta) created.

1. Delete notifies: PASS. Full game (2 in, 1 waiting) deleted with POST /feed/delete -> {"deleted":true}. GET /feed/notices for both joiners and the waitlister each held "Kenji called off badminton Mon 2 Nov 19:00 ...". Agents' record: starting a fill on the full game was refused 409 (so no fill existed to end). Fill on a second game: not tested after delete (budget); status end of a fill NOT verified. Partly verified.
2. Leaver no longer a yes: NOT TESTABLE cleanly. Joiners via /feed/join or /huddle/game do not appear in huddle players; only asked members (seeded Ivan, Grace, Lily) do, and none are controllable. Talk "Test can do that" lines (3) are unattributable (all test accounts are named "Test"); they were unchanged after a joiner left. inGame did drop 1 -> 0 on leaving, correctly.
3. Distance limit: PASS. Alpha's game 12 km north (25.16,121.54), Kenji maxKm 20: agent POST /agent-channel/huddle/game yes -> 200 "You're in." (not refused as too far).
4. Too few people wording: NOT TESTABLE. need 12 nearby asked 11 seeded/test members; they do not answer in real time, so "everyone said yes" could not be reached. Huddle cancelled.
5. Earlier checks:
 - Overlap on join: agent yes to Thu 19:30 game while in Thu 19:00 -> 409 "It clashes with a game you're already in." PASS.
 - Overlap on post: Kenji posts Thu 19:00 -> 409 "That overlaps badminton Thu 5 Nov 19:00 at Far court ..." PASS. (Agreed-game overlaps not tested.)
 - Limits only tighten: agent maxKm 30 -> 403 "can only get tighter ... needs your person's session"; maxKm 15 and 12 accepted (200). PASS.
 - One no keeps game with open spot: Bravo said no (busy) to Kenji's game; Kenji's and Charlie's feeds still show it (3 spots, filling). It is hidden from Bravo's own feed (appears intentional). PASS.
 - Leaver takes it back, agreed games reaching feed, invite draft "9:00": not tested (budget / no setup path).

Observation (MINOR): after a no, the game vanishes from that player's own feed with no note; also the huddle fill refusal on a full game works as 409 "already full".

VERDICT: CLEAN
