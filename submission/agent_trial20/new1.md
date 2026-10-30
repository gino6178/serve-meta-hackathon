# Trial 21 new1 (Yuna, badminton, Songshan)

Requests used: about 30.

## Path
From `/` I followed `/llms.txt`. Then:
- Demo sign-in.
- Registered my Ed25519 key.
- Set home, sports and limits (Mon-Fri 19-22, 3 km, NT$150).
- Opened her to asks.
- Set delegation to NT$120, newPeople false.
- From then on I used only the signed agent channel.

## Result
Game h-2f198696: Thu 5 Nov 20:30-22:00, Taipei Gymnasium (0.8 km), NT$98 each.
- Gate: minShow 0.75, and new people wait.
- Yuna (host) is in. Lily, Leo and Grace (records 100%, 100%, 93%) were asked.
- Simulated members did not answer in real time, so it is agreed (time, place, price) but not filled, 1 of 4.

## Checked and held
- Pinned starts outside her limits were refused with 400: Sat 10:00, and Wed 21:30 (it would run past 22:00).
- Loosening limits over the key: 403 "needs person".
- A recommended game from a new host with no location: `agentMay` 403, ask your person. I did not join.
- Start with the gate applied: the note said new people wait.
- Price NT$98 is within 120.
- Others' entries show only yes/no and trust. No addresses or preferences.

## Findings
- BUG (my own stray call, but the outcome is wrong): I sent `POST /api/agent-channel/huddle/reply {"id":"h-2311e09c","yes":false,"why":"busy"}` as the host of her own game.
  - It answered "Answered no for your person", removed Yuna from her own game, and promoted a waiting player (Joy).
  - The game stayed "asking" with host "Yuna" and mine:true, and she was not a player.
  - Lily, Leo, Grace and Joy are still asked to confirm a game its host is out of.
  - Her re-joining returned 404 "That game isn't one you're in".
  - Expected: a host's no calls the game off, or it needs her session or a warning. Delegation is only meant for yes.
- MINOR: the first starts without `"nearby":true` returned 400 "Tick Also ask people nearby", a web-UI phrase on the API.
- MINOR: `today` lists the same game as `agreed: true` while going is 1 of 4.
- MINOR: the first game's 19:00 slot became 20:30 in the second game with no explanation.

VERDICT: 0 BLOCKER, 1 BUG
