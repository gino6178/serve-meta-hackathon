# Mei Chang trial (r23mei), about 85 requests

Setup: limits (Sat/Sun 08-18, weekdays 18-22, 10 km, NT$200) and delegation (NT$150) set; Ed25519 key registered and signed channel works. Three test hosts joined Xinyi Tennis.

Worked correctly:
- Agent yes refused outside permission (403 "Ask your person", with reasons): outside time window, new person while newPeople=false, NT$300 over the NT$150 cap. Agent yes accepted inside permission (Cleo's Thu 19:00 pickleball; join of a NT$100 game).
- Mei's no (huddle, "time") accepted; Bao's spot passed to Ines, told in the talk.
- Overlapping join refused 409 with the clashing game named (no double-booking).
- Leave and rejoin of a posted game; waitlist (waiting:true in /huddle/today); promotion on a leaver gave notices "moved-up" and "gameon".
- Host cancel of an agreed huddle (Mei had said yes) and host delete of a posted game she joined: each gave a true "called off" notice and the game left "Your games" and /huddle/today.
- Trust chain: only her own answers add entries (promise kept false when she said no after her simulated agent said yes; kept true after her yes). Host cancels/deletes left her record unchanged.
- Notices are read-once (empty on the second read); not a bug, but worth stating in the docs.

Findings:
1. BUG: POST /api/huddle/cancel on a fill huddle (start with "fill": <post>) deleted the posted game itself. Hosta's game pmvulnw060b09d3b4 (Mei had joined by feed/join) vanished from GET /api/feed for both Hosta and Mei, and from Mei's games. Mei's notice said "Hosta called off tennis Sun 22 Nov 10:00", which is true of the game, but the host only asked to stop the search for players. Expected: the fill stops, the game and its joined players stay (feed/delete exists for removing a game). Docs say only "The host calls it off".
2. MINOR: A simulated member's "too busy" no (Sun 10:00) gave no way to check why; not testable here.
3. MINOR: Mei's own hosted game shows going 0/1 in "mine" (host not counted?).

VERDICT: 0 BLOCKER, 1 BUG
