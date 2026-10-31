# Serve live read-only check: signed-out stranger view

Target: https://play.theminimallab.com
Method: 30 GET requests, all with `x-tester: live-reader`. No sign-in, no POST/PUT/DELETE, no other sites contacted. Real people's details were not copied; members named in the demo club are written as [name].

## What the public pages promise

- Home (`/`) and `/llms.txt`: "A place where people's agents arrange sports games. Your person says one yes per game; the agents do the rest. No money moves on Serve." Consistent with `/privacy.txt` ("No payment details: no money moves on Serve").
- `/api/openapi.json` (57 paths): every session-gated route is marked `memberSession` or `agentKey`. No payment routes. The only money-adjacent route is `POST /api/huddle/deal` ("Ask a venue's agent for a price"), which `/llms.txt` describes as sample prices.
- `/privacy.txt` says preferences "Only your agent uses them" and that others in a game see only yes or no, the kind of reason, and one counter time and court. Findings 3 and 4 test this.

## Session-gated endpoints (signed out)

All refused as expected, no data returned:

- `GET /api/me`, `/api/huddle/today`, `/api/huddle/me`, `/api/huddle/places?sport=tennis`, `/api/feed`, `/api/huddle/trust`, `/api/huddle/needs`, `/api/feed/notices`, `/api/clubs?lat=25.031&lon=121.536`, `/api/huddle/one?id=x`: HTTP 401, `{"error":"Sign in first.", ...}`.
- `GET /api/agent-channel/me`, `/api/agent-channel/huddle/me`: HTTP 401, `{"error":"refused: every agent-channel request needs its serve-signature header","why":"unsigned"}`.

Public invite endpoints with invalid ids (`/api/invite?id=x`, `/api/clubs/invite?code=x`): HTTP 404 with a generic message, no data. Valid codes were not available to test.

Trust: `/api/trust/verify` returns ok with n=0 and a signed head. `/api/trust/chain` is empty (no entries). Nothing personal.

## Findings

### BUG 1: /api/status publishes internal infrastructure to anyone

Request: `GET /api/status` (no session), HTTP 200.

Response (relevant part):
```
{"llm":{"url":"http://127.0.0.1:11435/v1","ready":true,"model":"muse-glimmer","device":"RTX 3090 (CUDA)",...},
 "messenger":{"enabled":true,"page":"Serve App",...},
 "places":{"map":true,"google":true,"googleLeft":89,"weather":true}, ... "players":1}
```

The public status endpoint shows the internal LLM host and port, the GPU model, the messenger page name, and the remaining Google quota. None of this is about a person, but it is internal detail a stranger should not see. Llms.txt only says status shows "how many members this server has" and "is the server up", so this is undocumented disclosure.

### BUG 2: Public A2A directory and agent cards point clients at a loopback address

Requests:
- `GET /a2a/agents` (HTTP 200): each entry's `card` is `http://127.0.0.1:8790/a2a/members/<id>/.well-known/agent-card.json`.
- `GET /a2a/members/hana/.well-known/agent-card.json` (HTTP 200): `supportedInterfaces[0].url` is `http://127.0.0.1:8790/a2a/members/hana/`, the provider url is `http://127.0.0.1:8790/a2a/agents`, and the `likely` extension uri is `http://127.0.0.1:8790/a2a/ext/likely/v1`.

Published endpoints that any outside A2A client would be sent to resolve to the visitor's own machine, not to Serve. Llms.txt says the directory and each member card are public, so this is a broken published promise and an internal-address leak. The required proposal and hold extensions use the https public URI; only the `likely` one and the interface URLs are wrong.

### BUG 3: Public club endpoint shows member preferences, against privacy.txt

Request: `GET /a2a/club.json` (HTTP 200). The response lists 11 members, each with `name` ([name]), a skill `level` (A/B/C), `sports`, and `prefers` (singles, doubles or any).

`/privacy.txt` says "How you like to play: ... Only your agent uses them." The page labels these members as simulated (`/llms.txt`: "the demo club; its members are simulated"), which lowers the risk. But the endpoint is public and names real-looking people with their play preferences. If any of these were real members, this would be a privacy leak. Either way, it contradicts the published rule.

### BUG 4: A2A "likely" extension gives other agents a band on a member's yes

Request: `GET /a2a/members/hana/.well-known/agent-card.json` (HTTP 200). The card advertises the `likely` extension: "how likely this member is to say yes to the best of the listed times", with bands unlikely/maybe/likely/very likely, and a per-asker budget of 4 a day.

`/privacy.txt` says that in a negotiation the others see only yes or no, the kind of reason, and one counter time and court. A likelihood band derived from a member's taste goes beyond that list, and the privacy text says preferences never leave the member's agent. Stated as a published-promise mismatch; the team should confirm which is intended.

### MINOR 1: "booking" wording against "Serve doesn't book"

`/llms.txt` says: "Serve doesn't book or pay courts." But the hold method is described as "(action hold, release or book)", and the hold extension in the member card says the hold is "released on request, given way to the booking". The hold does not seem to book a court itself, but the word invites confusion.

### MINOR 2: "The person says one yes per game" versus delegation

Home page and `/llms.txt` say the person says one yes per game, while `/llms.txt` also says delegation lets the agent answer yes for the person within limits, and that the host's own yes can come from the agent. Delegation is an opt-in the person grants, so this is a wording gap rather than a broken promise, but a stranger reading the home page would not expect it.

## Checked and clean

- No emails, phone numbers, home addresses, calendar, free times, or health notes in `/`, `/llms.txt`, `/privacy.txt`, `/api/openapi.json`, the agent card, or the public club and agent endpoints. Member areas are described only as "rounded to about 1 km" and are never shown.
- Show-up figures appear only as the published words and band ("shows up likely 72-98%" in the docs) and no counts were shown.
- Public status, providers, trust and invite endpoints behave as documented.

VERDICT: 0 BLOCKER, 4 BUG
