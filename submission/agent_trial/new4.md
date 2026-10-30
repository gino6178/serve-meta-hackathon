# Trial new4: Dora (weekday 06:30-08:00 / Sun pm, badminton/pickleball, <=3 km, Da'an)

## Path (57 requests, ~1 min of wall time, budget spent on discovery)
1. `GET /` -> `404 {"error":"not found"}`. No landing page, no links, no hint.
2. Probed 25+ discovery paths (`/api`, `/llms.txt`, `/.well-known/agent.json`, `/openapi.json`, `/docs`, `/help`, `/mcp`, `/robots.txt`, `/skill.md`...). Every one returned `404 {"error":"not found"}`. `OPTIONS /` -> `204` with no `Allow` header.
3. Guessing resource names found three live routes:
   - `GET /api/players` -> `200 []`
   - `POST /api/players {"name":"Dora","lat":25.027,"lon":121.543,"sports":[...]}` -> `200 []`. Nothing created, no error.
   - `GET /api/clubs`, `GET|POST /api/me` -> `401 {"error":"Sign in first."}`
4. Tried to find out how to sign in: `/api/signup|register|login|auth|auth/login|auth/signup|guest|session|join|onboard|users|accounts` all returned 404. A Bearer header changed nothing. No `WWW-Authenticate` header anywhere.
5. I stopped near the 60-request cap without an account.

## How well Serve captured Dora's constraints
It didn't capture them at all. I never reached a point where Serve asked a preference question or took a constraint. So I could not test the three things I was sent to check:
- Can hard constraints (time windows, max 3 km) be sent directly? **Untested.**
- Can the questions express "weekday 06:30-08:00 or Sunday afternoon"? **Untested.**
- Do proposals respect those constraints? **Nothing was proposed.**

## Problems (ranked)
1. **An outside agent can't find how to sign in (blocker).** `401 {"error":"Sign in first."}` from `/api/clubs` and `/api/me` says sign in but not where or how. All plausible auth routes return 404.
2. **The bare address gives no starting point.** `GET /` -> `404 {"error":"not found"}`. An agent given only the URL has nothing to follow. The 404 body lists no routes either.
3. **A write fails silently.** `POST /api/players` with a full profile returns `200 []`. That looks like success but stores nothing. It is probably a search or list endpoint that ignores the body. An agent could wrongly tell Dora she is registered.
4. **`OPTIONS` says nothing** (`204`, no `Allow`), so even method discovery fails.

## Fixes
1. Serve an agent entry point at `GET /` (and `/llms.txt` or `/.well-known/agent.json`). It should give a short JSON or markdown description: how to sign up or sign in (including test accounts), how to set a profile and hard constraints, and how to request games.
2. Make every 401 actionable, e.g. `{"error":"Sign in first.","signin":"POST /api/...","docs":"/llms.txt"}` plus a `WWW-Authenticate` header.
3. Make the 404 body point to the entry point (`"see": "/"`).
4. Return 405 (or 400 saying the body was ignored) for a `POST` to a read-only collection like `/api/players`, never `200 []`.
5. Once agents can get in, accept hard constraints directly as data: `availability:[{days:["mon".."fri"],from:"06:30",to:"08:00"},{days:["sun"],from:"12:00",to:"18:00"}]`, `max_km:3`, `sports:[...]`. Proposals should be filtered against these, not just ranked by them. The preference questions should also allow multiple windows per day type.

## Recommendation
Run this trial again once problem 1 is fixed. Everything Dora needs depends on getting past sign-in.
