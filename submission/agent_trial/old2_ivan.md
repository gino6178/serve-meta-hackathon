# Ivan Tsai's agent on the signed agent channel

## What I did (about 32 requests, all to 127.0.0.1:8899)
- Generated an Ed25519 key and registered it with Ivan's session: `POST /api/members/agents {name:"Ivan's agent", jwk}` returned 200, with agent `ag-9a27215545e4`, kid `serve-2f5c1b4051d71838`. This worked on the first try.
- Signed `GET /api/agent-channel/feed` following `signToken` (EdDSA, typ `serve-request+jwt`, iss=kid, method, path, body SHA-256, 60 s life, jti). Set `aud` to the gateway kid from `/a2a/keys.json` (`serve-fdbc86e9a90ad8ee`).
- Every signed call was refused with `wrong-audience`. I tried 12 audience values: the gateway kid, the agent's kid, the agent id, the member id, the origin URLs, "members", "serve" and others. None worked, so I never got past auth and could not test feed, join, post, invite or comment.
- Probed the refusals and checked whether the huddle and trust routes exist on the channel.

## What works on the agent channel
- Registering the key (needs the session, as expected).
- Refusals for unsigned requests, an unknown key and a bad signature. Each comes back as a 401 with a `why` code, and `GET /api/members/refusals` shows them to Ivan.
- Nothing past auth. **No everyday task got done.**

## What's missing (going by the header docs)
The channel has only feed, post (incl. invite), comment and join. Everything new is session-only:
- huddle: today, question/answer, start, reply, one, game, places, deal
- trust: `/api/huddle/trust`
- taste: home, sports, open

So a key-only agent can't answer Ivan's yes-asks, start a huddle, read his trust record or answer his preference questions. Signed calls to `/api/huddle/me` and `/api/huddle/trust` get `401 {"error":"Sign in first."}`. The channel also has no like, no leave/not-for-me, no single-post read, no clubs (Ivan's Daan Badminton) and no way to read its own refusals.

## Problems, ranked
1. **Audience is undocumented, and the gateway's own published kid is refused (blocker).**
   `GET /api/agent-channel/feed`, aud=`serve-fdbc86e9a90ad8ee` (the same kid `/api/trust/verify` signs with)
   → `401 {"error":"refused: meant for another gateway","why":"wrong-audience"}`
   The docs say the token works "the same as between gateways". Between gateways, aud is the receiver's kid, and that is refused here.
2. **Huddle, trust and taste are session-only.** The "run on its own key" goal fails for everything newer than the feed.
3. **Refusal wording is peer-speak.** Unknown agent key gives `"signed by a key no allow-listed peer has"`, `"why":"unknown-peer"`. A member's agent isn't a peer, and the message doesn't say "register this key at POST /api/members/agents". "meant for another gateway" doesn't say which audience was expected.
4. **Signed request to a session route gives `401 "Sign in first."`.** It ignores the valid signature and doesn't say the route isn't on the agent channel.
5. **Auth runs before route lookup.** A path that doesn't exist (`/api/agent-channel/huddle/me`) returns `unsigned` or `wrong-audience`, never 404, so an agent can't find out what the channel supports.

## Fixes
- Put the expected `aud` in the registration response (`{agent:{kid, audience}}`) and in the members.js header. Accept the `/a2a/keys.json` kid, or explain what to use instead.
- Make the wrong-audience refusal name the expected value: `expected aud "<x>"`.
- Add channel routes for `huddle/today`, `question`/`answer`, `reply`, `start`, `one`, `game` and `trust`. Optionally use per-agent scopes set at registration (e.g. `feed`, `huddle`, `trust:read`) so Ivan decides what his agent may do.
- Rename the member-key refusal to `unknown-agent`: "this key isn't registered or was revoked; register it with POST /api/members/agents".
- On session routes, when a valid `serve-signature` is present, say "this route needs the member's session; the agent channel has: …". Return 404 for unknown `/api/agent-channel/*` paths after a valid signature, or list the routes.
- Add a `GET /api/agent-channel/me` (whoami plus allowed routes) so an agent can check its setup with one call.
