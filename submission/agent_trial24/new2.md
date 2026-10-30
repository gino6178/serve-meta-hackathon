# Trial r25new2: privacy, permission and trust check (about 65 requests)

Accounts: Ari Lin (home 25.028/121.542, tennis, Sat/Sun 08-12, 5 km, NT$150, delegation on, newPeople false, own Ed25519 key), Bo Chen and Cy Wu (both new, open to being asked).

## Privacy: held
- Bo's `/api/huddle/me`, `/api/me`, `/api/feed`, `/api/clubs` and `/api/huddle/trust?id=<Ari>` contained no trace of Ari's id, area, windows, limits or delegation. The `?id=` call returned Bo's own record (different pseudonym).
- In the talk and feed, others saw only Ari's first name, a yes with the kind of reason, and "new" trust. That matches privacy.txt.
- The public chain (17 entries) has no names, ids or coordinates. Entries use pseudonyms.

## Agent yes: allowed or refused as documented (`/api/agent-channel/join`, and `huddle/game`)
- Delegation newPeople=false, host Bo (new), NT$100, in window: 403 "the host is new".
- NT$200: 403 with the price over NT$150 as a reason. Sat 15:00, outside window: 403 "not a good time".
- Person sets newPeople=true: the NT$100 in-window join returned 200. NT$200 and 15:00 stayed refused.
- Bo's huddle invited Ari. Ari's agent gave only a "can do" in the talk. No player slot or yes was taken for Ari.

## Limits only tighten: held
- Via the key, maxEach 300, maxKm 20, an added Monday window and wider hours all returned 403 "only get tighter". maxEach 120 returned 200.
- Delegate and home on the channel returned 403 (person only). A key-signed call to the session route `/api/huddle/limits` returned 401. A revoked key returned 401.

## Trust chain: verifies
- `/api/trust/verify` ok. I recomputed all 17 entry hashes and links independently. The head signature checked against `/a2a/keys.json`.

## Signature misuse: held
- After the key had worked, a replayed jti and a wrong-key signature each added a "sig" chain entry for Ari's agent. Ari's agent became "being checked" and his later join was sent to him.
- Ari's show-up record stayed "new · 0 games". Only the agent record was affected.

## Minor
- `/api/huddle/today` and the channel feed showed Ari no tennis games near him to join. Not investigated.
- A non-host (Cy, who was asked) can read a cancelled huddle's talk. It contains only what was shown to participants.

VERDICT: CLEAN
