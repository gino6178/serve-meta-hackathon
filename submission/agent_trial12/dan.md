# Trial 13 - Dan Lee's agent (r13dan), ~80 requests

Setup: limits (Mon-Sun 17-22, 5 km, NT$150), delegation (maxEach 120, newPeople false), open on, Ed25519 key registered, signed GET and POSTs worked. Three extra demo accounts (h1-h3) in Daan Badminton. Dan's record at start: shows up 100% (6/6), agent right 52% (13/25).

## BUG 1 - agent under 80% can still say yes
Dan's agent was 52%, and /api/huddle/trust says "Under 80% it can't say yes for you". Despite that:
- POST /api/agent-channel/huddle/game {"post":"pmvugtxe15e79da6a","yes":true} returned 200 "You're in." (Leo's game, gate agentMin 0.8). Dan was added (going 1, joined true).
- The same after leaving and POST /api/agent-channel/join: 200, joined.
- GET /api/huddle/today card for that game showed agentMay {"ok":true}.
In huddles the server did ask Dan directly ("Asking Dan directly, without an agent's yes"), and agent-channel/huddle/reply was refused 403, but the refusal reasons never mention the 52% record.

## BUG 2 - agreed price above Dan's hard limit
Huddle h-1deb21e0 (host h1 invited Dan): the talk said "NT$165 each is over the limit Dan set... Looking at other courts" (limit NT$150), then the final line was "Agreed: ... NT$165 each. Asking Dan for one yes." The pick had each 165. "Nothing outside them is ever agreed" is broken.

## BUG 3 - named invitee dropped
h1 started a game (need 3, invite [h2's id], nearby true). h2 was shown as "can do that" but the final ask went to host + Ivan + Lily. h2 got no notice and is not in players, even though they were picked by name.

## MINOR
- agentMay on h-7ba2759c changed after Dan's own no to include "outside their limits (not a good time)" for Thu 19:00, which is inside his window and his best slot.
- "36 more like that" is one more than the arithmetic (35 gives exactly 80%; 14/26 then said 35, 34 is exact). Reads as needing >80% while the rule says "under 80%".
- Dan's first no on h-7ba2759c left him as "waiting" for the host; it only took effect after I sent the same no again (no double count in the record).

## Checked OK
- Agent with delegation but newPeople false: refused ("the host is new") on /agent-channel/join and /huddle/game for a minShow 0.9 game and a plain game.
- Agent loosening limits (maxEach 200): 403 "can only get tighter". Tightening: 200.
- Record: Dan's own yes 13/25 -> 14/26 (promise kept:true on chain); his no 14/26 -> 14/27 (kept:false); repeating the no did not double count. Shows-up stayed 100%/6 games: nothing penalises the person. Whether the agent "would have" said yes/no isn't visible, so only the counts could be checked.
- Others see only badge words ("shows up 100% · 6 games", "agent right 52%"); no other detail.
- One no with nobody spare: h-7ba2759c went "on", posted with 1 open spot, talk said Dan's spot stays open. Dan then rejoined via POST /api/feed/join: ok.
- Overlap: posting at 2026-11-01 20:00 or 19:00 (Dan in Leo's game 19:30) refused 409 with clash id, on both the person and agent routes.
- Gate agentMin cannot be set on start (stays 0.8); "only reliable agents" not separately testable beyond that.

Not testable: the agent-"would have said" comparison; the 30-day replay penalty (not tried to avoid harming the record).

VERDICT: 0 BLOCKER, 3 BUG
