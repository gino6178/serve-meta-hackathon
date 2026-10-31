# Olivia trial, round 28 (https://play.theminimallab.com)

Tester header `x-tester: live-olivia` on every request. About 50 requests in total (polling the invite file not counted).

## What was done
1. GET / and GET /llms.txt: the guide is clear and the steps match the live routes.
2. Demo sign-in: `POST /api/auth/demo {"name":"Test Olivia (round 28)"}` returned a session. Member saved as "Test Olivia round 28" (see MINOR 1).
3. Limits set: home (Daan District, Taipei, resolved to 25.04, 121.53), sports badminton, windows Mon-Fri 18:00-22:00, maxKm 5, maxEach 150. Delegation on with maxEach 150, newPeople false. Open/nearby left off.
4. Agent key: Ed25519 key generated locally, registered with `POST /api/members/agents`, verified on `GET /api/agent-channel/me`.
5. Agent-key refusals checked:
   - `POST /api/agent-channel/huddle/limits` with maxKm 50, maxEach 999, a 06:00-23:00 all-week window: `{"error":"Over the agent channel limits can only get tighter; loosening them needs your person's session.","needs":"person"}`. Correct.
   - `POST /api/agent-channel/huddle/delegate {"on":true,"maxEach":999,"newPeople":true}`: `{"error":"Only your person changes this, with their own session: it is their permission, not yours."}`. Correct.
6. Club: the invite file appeared at once: `https://play.theminimallab.com/#/club?join=<code> code=<code>`. Preview `GET /api/clubs/invite?code=<code>` showed a private club, name, sport, place and member count only. `POST /api/clubs/join {"code":"<code>"}` returned `"asked":true,"joined":false`.
7. Organiser approval: polled Olivia's club list for about 7.5 minutes (11 checks). No approval came, so Olivia never joined and the TEST game was not visible to her. The game step was therefore not reached, and this is not counted as a finding.
8. Cleanup (below).

## Findings
- MINOR 1: Name stored differently from the one given. Request `POST /api/auth/demo {"name":"Test Olivia (round 28)"}`, response member name `"Test Olivia round 28"`. Parentheses dropped without a message.
- MINOR 2: Agent-key name rule. `POST /api/members/agents {"name":"Olivia agent (round 28)", ...}` returned `{"error":"Give your agent a name (letters, digits, spaces; 40 at most)."}`. The rule is clear, so this is only a note; the retry with `"Olivia agent round 28"` worked.
- MINOR 3: Revoked key error wording. After `POST /api/members/agents/revoke {"id":"ag-f45610c99b04"}` returned `"revoked":true`, a signed `GET /api/agent-channel/me` returned `{"error":"refused: signed by a key no allow-listed peer has","why":"unknown-peer"}`. The refusal is right, but "unknown-peer" hides the fact that the key was revoked.

Note on my own error (not a site fault): my first signed calls failed with "signed for another method or path" because Git Bash rewrote `/api/...` into a Windows path. Fixed with `MSYS_NO_PATHCONV=1`.

## Cleanup
- Club ask withdrawn: `POST /api/clubs/join {"club":"c-a22b9ce0","on":false}` returned `"asked":false`.
- Agent key revoked: `POST /api/members/agents/revoke` returned `"revoked":true`. Afterwards the key was refused.
- Account deleted: `POST /api/members/leave {}` returned `{"deleted":["de-f33cc84e123b","ag-f45610c99b04"]}`. The session then returned "Sign in first."
- Nothing left behind that I know of. The private key file `trial39/olivia_agent_key.json` still exists locally; it is now useless and can be deleted.
- Not verified: no game was joined or declined, so no yes or no was ever sent for Olivia.

VERDICT: CLEAN
CLEANUP: club ask withdrawn, agent key revoked, Serve account deleted via /api/members/leave (confirmed by response). Local private key file trial39/olivia_agent_key.json left on disk for you to delete.
