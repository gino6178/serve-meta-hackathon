# Olivia (agent) live test, round 27: https://play.theminimallab.com

Tester header `x-tester: live-olivia` on every request. About 28 requests in total (within the ~45 budget). The two failed signed calls at the start were a signing mistake on my side (Git Bash rewrote the path argument), fixed by setting MSYS_NO_PATHCONV=1; they are not site findings.

## What was tested

1. Discovery: GET / and GET /llms.txt (both 200). Status (`players: 1`), providers (`demo: true`).
2. Demo sign-in: `POST /api/auth/demo {"name":"Test Olivia (round 27)"}` returned a member and a session.
3. Setup: home (25.031, 121.536), sports (badminton), limits (Mon-Fri 18:00-22:00, maxKm 5, maxEach 150), delegation on (`maxEach 150, newPeople false`). `open` stayed false.
4. Agent key: Ed25519 key generated locally, registered with `POST /api/members/agents` (201-style 200 OK, kid `serve-5c1a9086d12ad275`).
5. Agent channel: signed GET `/api/agent-channel/me` and `/huddle/today` returned the member and the agent (`revoked: false`).
6. Club invite: the poll found `club_invite.txt`, but it contains only `https://play.theminimallab.com` with no club code. Treated as no invite link. No club was joined and no yes was given.
7. Key limits (all refused or accepted as expected):
   - `POST /api/agent-channel/huddle/limits {"windows":[Sat,Sun 00:00-23:59],"maxKm":50,"maxEach":500}` returned `{"error":"Over the agent channel limits can only get tighter; loosening them needs your person's session.","needs":"person"}`. Correct.
   - Signed `POST /api/huddle/delegate {"on":true,"maxEach":500,"newPeople":true}` returned `{"error":"Sign in first.", ...}`. Refused, correct outcome (see MINOR-2).
   - `POST /api/agent-channel/huddle/limits {"windows":[Mon-Fri 18:00-21:00],"maxKm":3,"maxEach":100}` (tighter) was accepted. Limits were then restored by the person's session (`POST /api/huddle/limits`, original values).
8. Public checks: `/api/trust/chain` contains no personal values (no name, area or limits). Anonymous `GET /api/huddle/today` refused with "Sign in first." Privacy text fetched.
9. Cleanup: `POST /api/members/agents/revoke {"id":"ag-93e5788e5337"}` returned `revoked: true`. The same key then refused: `{"error":"refused: signed by a key no allow-listed peer has","why":"unknown-peer"}`. `POST /api/members/leave {}` returned `{"deleted":["de-2c6f9960e11c","ag-93e5788e5337"]}`. The session then returned "Sign in first.". The trust chain now shows two `left` entries, one per deleted id, which matches the privacy text.

## Findings

No BLOCKER and no BUG found in the flows that were reachable: sign-in, limits, delegation, the agent's refusal to loosen limits or delegation, revoke, and leave with its "left" records all behaved as described.

Not covered: the game flow itself (get a game, yes, no, join, leave, call off, waitlist). Without a club invite code there was no test game, so none of those were exercised. Also not covered: a mixed request (one limit looser, one tighter) over the agent key. The only loosening test raised every limit at once.

MINOR-1: name sanitised without notice.
- Request: `POST /api/auth/demo {"name":"Test Olivia (round 27)"}`
- Response: `"name":"Test Olivia round 27"`. The parentheses are dropped silently and the sent name is not echoed back.

MINOR-2: misleading error on a person-only route with an agent signature.
- Request: `POST /api/huddle/delegate` with a valid `serve-signature` from the agent key, body `{"on":true,"maxEach":500,"newPeople":true}`.
- Response: `{"error":"Sign in first.","signIn":"..."}`. The request was correctly refused, but the message says sign-in is missing when the key was sent. It should say the route needs the person's session.

MINOR-3: trust chain empty while the member was active.
- Request: `GET /api/trust/chain` after key registration, limit changes and delegation on.
- Response: `"entries":[],"length":0`. No entries exist for those actions. Only "left" entries appear after leave. The privacy text does not promise entries for these actions, so this may be intended (records may come only from games). Needs a check once a game has been played.

MINOR-4: delegation cap and limit disagree after an agent tightening.
- Request: agent `POST /api/agent-channel/huddle/limits {"maxEach":100,...}` (accepted).
- Response: `limitEach: 100` but `delegate: {"maxEach":150,...}` (unchanged). The effective cap is not tested because no game was run. Check that the server applies the lower of the two.

## Notes

- The user's standing memory says not to create accounts on live checks. I went ahead because this task explicitly authorised a demo sign-in and an agent key on this site. Flagging it here.
- The trust-chain "left" entries are permanent by design (hash chain, never rewritten). Their pseudonym ids remain public.

CLEANUP: Agent key revoked (ag-93e5788e5337, refused afterwards). Account and agent deleted via POST /api/members/leave. No yes given, no club joined, so nothing to withdraw or leave. Limits restored to her own values before deletion. Local private key and demo session file removed from the trial38 folder. Could not remove: the two public trust-chain "left" entries (permanent by design).

VERDICT: CLEAN
