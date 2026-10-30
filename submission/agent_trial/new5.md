# Serve cold-agent trial (new5) — Erik's Thursday club

**Goal:** stand up a club near Nanjing Fuxing (25.052,121.544), add 6–8 colleagues,
schedule a recurring Thu-evening volleyball/badminton game, let reliable neighbours
fill empty spots. HTTP-only to http://127.0.0.1:8899, as an outside agent.

## Path taken
1. `GET /` → 404 JSON. No HTML, no landing page anywhere (`/`, `/app`, `/ui`,
   `/home`, `/signin`, `/login` all 404 `application/json`). Serve is a JSON API only.
2. Probed discovery endpoints (`/.well-known/agent.json`, `/agent-card.json`,
   `/openapi.json`, `/llms.txt`, `/.well-known/ai-plugin.json`, `/api/docs`,
   `/api/schema`, `/api/routes`) — **all 404**. No machine-readable manifest.
3. Found live routes: `GET /api/feed` (public, 200), `GET /api/players` (200, `[]`),
   `/api/me`, `/api/clubs`, `POST /api/clubs/create`, `/api/invite` — all **401
   `{"error":"Sign in first."}`** except feed/players.
4. Read `/api/feed` to learn the model (below).
5. Hunted for a way in: ~25 signup/login guesses + 5 auth-header styles. **None worked.**

## How far I got
**Step 0.** Could read the public feed; could not create a club, a game, a player,
or an identity. Every write path and `/api/me` returns "Sign in first."

## Problems, ranked (exact req/resp)
1. **No way to sign in or register over HTTP — hard blocker.**
   - `POST /api/clubs/create {"name":"Fuxing Office Club"}` → `401 {"error":"Sign in first."}`
   - `POST /api/sign-in|sign-up|register|account|players/register|agents/register|
     connect|bootstrap …` → `404 {"error":"not found"}` (every variant tried)
   - Headers `X-Api-Key`, `X-Agent-Key`, `X-Agent`, `X-Member`, `Cookie: sid=` on
     `/api/me` → all `401 "Sign in first."`
   A cold agent with only the URL **cannot create an account**. Credentials must be
   provisioned out of band (the harness has a `gw.mjs` gateway + `creds/` + `seed.mjs`,
   i.e. a human/operator seeds identities). **Needs a human.**
2. **Inviting colleagues not yet on Serve — blocked by the same gap.** No email/invite
   endpoint found; `GET /api/players?lat=..&sport=..` → `[]`. Onboarding a non-member
   needs the missing signup route too.
3. **No recurring games visible.** Feed invites carry a single `day` ("2026-10-31"),
   `start` ("18:00") — no recurrence/series field. Thursday-weekly likely means
   re-posting each week (couldn't confirm past sign-in).

## What the feed reveals (works once provisioned)
- Clubs exist ("Riverside Sports Club"). Games = **invites**: `sport, day, start,
  where, spots, at{lat,lon}, each(cost), going, waitlist, host, names, full`.
- **Reputation** present ("shows up 73% · 11 games") → supports "reliable neighbours."
- Agents act for persons (`agentOf`), auto-comment/confirm and run waitlists → gap-filling
  is native. `papers:{perWeek:3}` = weekly posting quota.
- Group size: set by `spots` per invite (Erik's 6–8 is expressible).

## Fixes (for Serve)
1. Expose `POST /api/players` (self-register) or a documented sign-in, returning a token.
2. Serve `/.well-known/agent-card.json` or `/api/docs` so a cold agent can discover auth + routes.
3. Add a recurring/series field on invites, or a club-level weekly schedule.
4. Add an "invite non-member" (email/link) flow so colleagues can be onboarded.

**Budget:** ~40 requests, well under limits. Stopped at the sign-in wall per the rule
not to read server source/creds to bypass it.
