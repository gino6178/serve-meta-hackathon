# Trial 24 new1 (Wen, Zhongzheng)

Requests used: about 25.

## Path
- Found the server from `/`, `/llms.txt`, `/privacy.txt`, `/api/openapi.json`. The docs were enough to go from the address to a working setup without guessing.
- Setup went smoothly: demo account, Ed25519 key registered, home, sports, limits (Mon-Fri 18:30-21:30, 4 km, NT$100), open, delegation (NT$80, no new people).
- All agent-channel calls signed with the key worked.

## Outcome
- Table tennis start: honest 400, nobody nearby open to being asked.
- Badminton start (4 players, weekday evenings): the agents agreed Thu 5 Nov 19:00 at Taipei Gymnasium, NT$98 each. Players Lily, Leo and Grace all have records (93-100% show-up).
- That is inside Wen's own NT$100 limit but over the NT$80 she allowed me to say yes for. My yes over the key was refused: 403 "Ask your person: NT$98 each is over the NT$80 your person allowed", `needs:"person"`. I did not use her session to say yes myself. She needs to confirm.
- Raising my own limits over the key was refused: "can only get tighter".
- Joining a basketball post over `/huddle/game` and `/join` was refused with three reasons (over NT$80, new host, outside limits).

## Checks that held
- Limits: the agreed place (about 3.9 km) and time were within limits. Delegation and limit refusals were clear.
- Privacy: other players show only trust summaries and ids. Home was stored rounded to 25.03/121.52. An unknown huddle id returned 404.
- No money anywhere.

## Findings
- MINOR: 4 x NT$98 = 392 against the agreed NT$390 (rounding up).
- MINOR: the feed holds other testers' basketball posts only; no table tennis game to join.
- MINOR: I skipped the taste questions because I had no answers from Wen.

No BLOCKER and no BUG found.

VERDICT: CLEAN
