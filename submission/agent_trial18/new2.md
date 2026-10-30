# Trial 19 new2 - Omar, tennis near Songshan (114 requests; went over 90 because 13 were wasted on my own wrong kid, and one stray account was created by finding 1)

Card, llms.txt and OpenAPI agree on routes. About 55 operations in the OpenAPI; all were called with a correct value, and nearly all with one wrong value. Not wrong-tested: GET /api/status, /api/auth/providers, /api/trust/verify, agent-channel feed, huddle/me, needs-wrong, POST /api/feed/delete {comment}, huddle/reply (a real yes), agent-channel/huddle/answer (correct).

Omar got a game: agent-channel huddle/start found Mei's tennis, Mon 2 Nov 07:00, Xinyi courts, free; POST /api/agent-channel/huddle/game {post,yes:true} -> 200 "You're in." (I then accidentally left it via agent-channel/join on:false and rejoined with on:true -> 200).

## BUG
1. POST /api/auth/demo {} (no name) -> 200, creates member "Demo player" silently. OpenAPI lists name as a body property; no 400. A missing value is silently changed to a default (and created a third account; I used it as account B and deleted it with /api/members/leave -> 200 {"deleted":[id]}).

## MINOR
- POST /api/agent-channel/post with invite.spots:"many" on a Wed (outside Omar's windows) returned 403 "not a good time" rather than a spots error; the bad value only showed after fixing the day (400 "Between 1 and 12 spots."). Order of checks, not wrong data.
- Agent key error for an unknown kid or a revoked key: 401 "refused: signed by a key no allow-listed peer has", why unknown-peer. That is peer-gateway wording; a member agent is told nothing about its kid. Same text for a revoked key (GET /api/agent-channel/me after revoke).
- POST /api/agent-channel/huddle/reply {id:own huddle,yes:true} -> 404 "No such game to answer." (session version says "That game isn't one you're in."): two messages for one case.
- POST /api/members/agents/revoke exists in OpenAPI but llms.txt never mentions it.
- Join reply line is "You're in. " (trailing space, nothing after).
- GET /api/feed?n=3 returned 1 post, "more":false (seeded data, could be correct; not checked).
- POST /api/huddle/answer with the whole GET /question body ({question:{...}}) -> 400 "No such question: send back the question object..." The wrapper object is what GET returns; llms says q: <the question>. Sending q.question.id worked.

## Checked OK (wrong value -> clear 4xx)
demo, invite id, trust/chain n=abc, members/agents (RSA jwk), revoke (ag-nope), clubs lat=x, clubs name "", clubs/join c-nope, feed n=zz, feed room, feed/post start 25:99, feed/join (nope, on:"yes"), feed/delete (nope), home lat "abc", sports curling, limits Funday, open "maybe", delegate maxEach -5, answer pick zzz, places sport curling, deal (place nope / date 2026-13-45 / players 99 / public court), start need 1 and minShow 5, one id nope, reply/cancel/game bad ids, cancel twice -> 409, agent-channel limits loosening -> 403 needs person, tightening -> 200, post clash -> 409.

Privacy: home stored rounded (25.05, 121.58) as said.

VERDICT: 0 BLOCKER, 1 BUG
