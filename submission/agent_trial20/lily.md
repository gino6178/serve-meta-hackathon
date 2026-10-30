# Lily trial (r21lily), ~95 requests
Accounts: Rita, Sam, Tove, Uma (demo, joined Daan Badminton). Test fixtures: "Test Court Lily", "Test Court Two".

## Done
- Huddle h-2c05fa9c (club, Sat/Sun evening): agreed Sun 20:30. Lily/Rita yes, Sam no (price), Tove no (busy), Rita switched to no (time). Each decline pulled the next "first in line" in (Ivan, Uma, Hosta); talk, host notices and the cards agreed. Lily called it off: Uma got "called off"; the cancelled huddle left /huddle/today. A no cannot be undone (reply "yes" afterwards: 404 "isn't one you're in"), which is fine.
- Posted game P (2 spots): joins, waitlist (Tove, Uma, Rita), leave, rejoin, promotion, delete. Feed card, Your games and notices agreed at every step. Overlap checks worked on joins and on posting. Delete told everyone, waitlisted included.
- Fill huddle on Uma's game Q, then delete Q: Rita (in) was told; Q left the feed and Your games.

## Findings
1. BUG (join/leave, double-booking): a waitlist promotion ignores clashes. Uma was waitlisted on P (Sat 18:00-19:30) and posted Q (Sat 18:30, hosting). Tove left P; Uma was promoted into P and told "A spot opened: you're in". Uma's Your games then showed P and her hosted Q together (18:00 and 18:30). The same join was refused for Sam (409 "You're already in ... overlaps"). Same hole for Rita (waitlisted on P, in Q).
2. MINOR: the host got no notice when Rita left P and Tove moved up (Lily's notices were empty). The feed card was correct.
3. MINOR: Tove got two notices for one promotion ("A spot opened: you're in" and "Game on ... full. You're in").
4. MINOR: after Q was deleted, Uma's fill huddle stayed status "stuck" (fill still set) instead of cancelled. It was hidden from today.
5. MINOR: the huddle talk shows other members' names and agent record to everyone asked. Other testers' accounts (Hosta etc.) were pulled in as stand-ins on my huddle.
6. MINOR: /api/feed/join ignored an unknown "leave":true and acted as a join (idempotent); only "on":false leaves.

Not tested: delegation, a fill huddle that finds people (the clash blocked it), rejoin after the host's call-off. Seeded Ivan never answers (simulated).

VERDICT: 0 BLOCKER, 1 BUG
