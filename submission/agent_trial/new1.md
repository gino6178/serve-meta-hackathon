# Cold-agent trial new1: Amelia, badminton doubles, Taipei

Budget: 65 requests over about 2 minutes. Ended with **no booking, no account, no venue found**.

## Path (the requests that mattered)
1. `GET /` gave 404 `{"error":"not found"}`. So did `/.well-known/agent.json`, `/.well-known/agent-card.json`, `/llms.txt`, `/openapi.json`, `/api` and `/api/docs`.
2. `GET /api/status` gave 200 and a JSON blob covering llm (down), messenger, places and `players:0`. Nothing in it says what to do next.
3. `GET /a2a/...` returned Express HTML `Cannot GET /a2a/...`, which differs from the JSON 404 elsewhere. That told me a router lives at /a2a. I then tried about 10 more /a2a guesses (`/a2a/`, `POST /a2a/rpc`, `/a2a/agent.json`...) and all of them failed.
4. `GET /api/me` and `GET /api/clubs` returned 401 `{"error":"Sign in first."}`. I spent about 20 requests guessing where sign-in lives (`/api/signin`, `/api/login`, `/api/auth/*`, `/api/register`, `/api/guest`, `/api/onboard`...). Every one was 404, and I never found the sign-in.
5. On request 59, `GET /a2a/agents` returned the "Riverside Sports Club" with 11 simulated member agents, each with a card URL.
6. `GET /a2a/members/hana/.well-known/agent-card.json` returned a good A2A 1.0 card: skills `serve.proposal`, `serve.hold` and `serve.likely`, signed, with no security scheme. But the card has no schema for the data parts.
7. I sent three `SendMessage` proposals to `/a2a/members/hana/`. Each one failed, and each error revealed only the next layer of the schema:
   - `$.proposal: missing; $.choices: missing`
   - `$.sport: missing; $.format: missing`
   - `$.proposal.date: missing; $.proposal.start: longer than 5` (so start is "HH:MM" with a separate date)

I stopped at the request budget.

## Problems by severity
1. **Critical: no front door.** `/` and both well-known agent-card paths return 404. The real directory, `/a2a/agents`, is unlinked from anywhere, and I found it on guess #59. A real agent would have given up.
2. **Critical: no way to become Amelia.** `401 "Sign in first."` names no endpoint, method or flow. I could not create a test account, so I could not reach clubs, venues, prices or booking.
3. **High: the proposal schema is undocumented and errors reveal it piecemeal.** Each error lists only the first failing layer, so finding the schema takes N round-trips. Nothing shows an example payload, valid `format` values, the date format, or how venue and price are expressed.
4. **High: no venue, location or price discovery.** Nothing takes lat/lon or a budget (`/api/players?sport=&lat=` returns `[]`). The club map that status mentions (`places.map:true`) has no reachable route.
5. **Medium: inconsistent 404s.** JSON 404 under /api, HTML 404 under /a2a. `POST /api/players` with `{}` returns 200 `[]`, so an agent can't tell whether it did anything.
6. **Medium: unclear what is allowed.** The member agents are labelled simulated, and the cards say "a few estimates a day per asker". But anonymous callers have no asker identity, so who is the asker? I could not tell whether an unauthenticated agent may propose, or book, on Amelia's behalf.
7. **Low: `/api/status` leaks internals** (LLM URL, missing token names) yet gives no navigation.

## What would make Serve usable cold
- Serve a platform agent card at `/.well-known/agent-card.json` and JSON at `/`, both linking `/a2a/agents`, the auth flow and the docs.
- Document a test or agent sign-up, and have the 401 body say where it is (`{"error":..., "signIn":"POST /api/..."}`).
- Put a JSON Schema and one full example `serve.proposal` in each card skill, or link one via `documentationUrl` (empty today). Validate every field at once.
- Add a search skill or endpoint: sport, format, lat/lon, time window, max price, returning venues, courts and slots.
- Return JSON for every error, and say explicitly what an unauthenticated agent may do.
