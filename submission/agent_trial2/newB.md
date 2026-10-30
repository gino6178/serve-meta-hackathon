# Serve trial newB: Owen (tennis, Taipei 101)

54 HTTP requests, all to 127.0.0.1:8899. Full log: `work_newB/log.txt`.

## Verdict per claim
- **Hash chain verifies: TRUE.** I recomputed all 10 entries, then 65, with sha256(JSON.stringify([n,at,kind,who,d,prev])). Every link holds. The `today` head signature verifies against kid serve-dc16bc539fbdb862 from /a2a/keys.json. Caveats: `heads[]` is empty, so there is no history of daily heads. The head's `n` is the chain length (10), not the last index (9). Seed records are only asserted: the chain proves they were not tampered with, not that they are true.
- **Privacy terms: MOSTLY TRUE.** Home was stored as 25.03/121.56. Other agents never see it. But the public chain ties events to Owen's stable pseudonym 7e2324a0b002c7d7, with millisecond timestamps (see P2). Joining a game posts the player's name in club comments ("Grace is in").
- **"Your person says one yes; agent answers only with delegation": PARTLY.** Home, open and delegate get a 403 on the agent channel ("Only your person changes this"). That is good, but it is undocumented. The agent can still rewrite the hard **limits**, including the price cap.

## Path
1. Demo signup for Owen (#10). Registered my own Ed25519 key, kid serve-23231249a23f342b (#12). The name "Owen's agent" was rejected; the allowed characters are not in the docs.
2. Signed channel: 15 failures before it worked (P1).
3. Set sports and limits over the signed channel (#33-34), with maxEach 199. The time window 07-22 every day is my assumption; Owen gave none.
4. Delegation needed Owen's session (#37-39): home, `delegate {on, maxEach:199, newPeople:false}`, open. **Only the person can set it.** I used the session I got at signup, under Owen's chat instruction, then deleted it.
5. Joined Mei's tennis game: Mon 2 Nov 07:00, 0.7 km, NT$0, host "shows up 100% · 5 games" (#42). This is within Owen's permission. It is now full and Owen is in. My huddle h-97722040 went "stuck: no tennis courts near the group" (#52), although /places lists a tennis venue 2.3 km away.
6. Left the five preference questions for Owen. They are his taste, not mine to guess.

## Problems (ranked)
- **P1 Docs give the wrong signing claims.** With the claims exactly as llms.txt describes, #13 `GET /api/agent-channel/me` returned 401 `{"why":"bad-claims","error":"refused: issuer is not the signing key"}`. Even after adding `iss`, `bh` as the docs describe was refused: #15 got 401 `wrong-body`. What works (#31): an undocumented `iss`=kid, plus the body hash in a claim called **`body`** (not `bh`). The `path` claim must also leave out the query string (#48 got `wrong-request`; #49 worked), so the query is unsigned. Three other pseudonyms on the chain have 11-15 sig failures each, so this hits every agent.
- **P2 Failed signing is punished in public.** Each failure became a public chain entry `kind:"sig"` against Owen. His record now reads `agent:"signature problems", flag:true` ("for now you are asked directly", #44/#54) for 30 days. So the doc bug damaged a brand-new member's trust, and leaked when his agent was active.
- **P3 The flag is not enforced.** Even while flagged, `POST /api/agent-channel/huddle/game {yes:true}` succeeded (#42).
- **P4 The agent can change hard limits** (#34), but not home, open or delegate.
- **P5 `newPeople:false` is not carried into huddles.** /start returned `gate.newOk:true` (#47).
- **P6 Smaller issues:** `/api/agent-channel/me` and `/api/members/leave` are missing from OpenAPI. The agent reading /feed consumes Owen's "taken once" notices. The agent's yes is learned as Owen's taste ("You like early Mondays"). Currency (NT$) only appears in responses.

## Fixes
Document `iss` and either accept `bh` or rename the docs to `body`. Sign `path`+query. Don't publish signature failures to the chain, or not before a key has ever worked once. Enforce the flag. Make limits person-only, or let the agent only narrow them. Have huddles honour `newPeople`. Add the missing routes to OpenAPI.

**Needs Owen:** confirm the time windows, answer the taste questions, and re-check delegation once his agent record clears.
