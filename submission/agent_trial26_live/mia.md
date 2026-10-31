# Mia trial (round 27), live site https://play.theminimallab.com

Tester header on every request: `x-tester: live-mia`. Requests used: 6 of about 35.

## What Mia did

1. Opened the home page and `/llms.txt` as a stranger. Both are clear. The home page says "Serve" and gives a link to the guide. The guide explains a club link (`#/club?join=<code>`) and the `GET /api/clubs/invite?code=` lookup.
2. Waited for the club invite file (`club_invite.txt`), polling every 30 seconds for 8 minutes.
3. The file appeared after about 8 minutes, but it held only `https://play.theminimallab.com`. It had no `#/club?join=<code>` link and no club code, so there was nothing to open, join or look up.
4. Stopped there. Did not sign in, did not join a club, did not look for the club in public listings, and did not join any game.

## Requests made (all GET, all read-only)

| # | Request | Result |
|---|---|---|
| 1 | `GET /` | 200, HTML home page |
| 2 | `GET /llms.txt` | 200, plain-text guide (first 8 KB) |
| 3 | `GET /llms.txt` (tail) | 200, rest of guide |
| 4 | `GET /privacy.txt` | 200 |
| 5 | `GET /api/status` | 200 (see finding 2) |
| 6 | `GET /api/auth/providers` | 200 `{"facebook":false,"instagram":false,"demo":true}` |

## Findings

### 1. BLOCKER: no club invite link to open

- Request: none to the site. The input was the invite file.
- Response: the file `club_invite.txt` contained only `https://play.theminimallab.com`.
- Mia's view: she was sent a link to the home page, not to a club. The club name, the club code and the TEST game are all missing, so she cannot join the club or the game. The flow cannot be completed.
- What is needed to continue: a link of the form `https://play.theminimallab.com/#/club?join=<code>` for the club "Serve test round 27 (please ignore)".

### 2. BUG (leak): the public status endpoint shows internal server details

- Request: `GET https://play.theminimallab.com/api/status`
- Response (exact): `{"llm":{"url":"http://127.0.0.1:11435/v1","ready":true,"model":"muse-glimmer","device":"RTX 3090 (CUDA)","error":null},"messenger":{"enabled":true,"page":"Serve App","error":null,"lastEvent":null},"reel":true,"reelEffects":true,"places":{"map":true,"google":true,"googleLeft":90,"weather":true},"health":true,"players":1}`
- Mia's view: she does not see this, but any stranger does. It shows an internal loopback address and port for the model server, the GPU model, and the remaining quota for a Google service. None of this is needed by a visitor, and the loopback address and quota are operational details.
- Suggested fix: return only `{"health": true}` or similar to anonymous callers, and keep the rest for the owner.

### 3. Note (not a finding): demo sign-in is on

- `GET /api/auth/providers` shows `demo: true`. Facebook and Instagram are off. The guide tells the agent to use `POST /api/auth/demo {"name"}`. I did not use it, because the invite link was missing.

## Not checked

- Signed-out view of an invite link: no link.
- Sign-in as "Test Mia (round 27)", joining the club and the TEST game, the game count, leaving, and what the host and Mia are told: none of these were reached.
- Public club listing: not queried, to avoid joining a club I was not given.

## Cleanup

- No sign-in was made, so no account, session, club membership or game exists for this trial.
- Nothing was joined or left, so no `POST /api/members/leave` or game leave was needed.
- Other files in the scratchpad (`demo_signin.json`, `agent_pub.json`, `olivia_agent_key.json`) belong to another run. I did not open them, and I did not use any agent key from them.

VERDICT: 1 BLOCKER, 1 BUG
CLEANUP: nothing to remove. No account was created and no club or game was joined. The trial could not reach sign-in.
