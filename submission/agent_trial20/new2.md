# Trial 21 new2: privacy, permission, trust (about 58 requests, header x-tester: r21new2)

Accounts: Sora (tennis, home 25.060/121.526, Sat 09-12, 3 km, NT$100, delegation on, newPeople false, open), Bea and Cal (outsiders). One Ed25519 key for Sora's agent.

## Held (no leak, no broken promise)
- Outsider routes for Sora's data (/api/members/<id>, taste, trust/<id>, profile, huddle/one, a2a card) all 404. Bea's and Cal's games never name Sora, her id, area, windows or limits. Pinning Bea's game to Sat 10:00 and a Mon 07:00 game showed only Kenji, Mei and Joy (simulated); nothing implied Sora was or wasn't asked.
- Agent channel: loosening limits (maxKm 20, maxEach 999, all-week windows) gave 403 "needs person"; tightening (2 km, NT$80) gave 200 and took effect. Delegate, home and open changes via agent gave 403. Agent posts at NT$90 or on Sunday gave 403 "outside what your person set". A delegated post set newOk false and gated at 60%, and the note said so. Bea and Cal (new, no record) joining it gave 409 with the waitlist reason. A huddle told Bea's side "agentMay" 403 when no delegation, with the correct reason.
- Signature misuse: wrong path, wrong aud, exp over 60 s, forged signature, replay and unknown kid were all refused with clear reasons. After revoke, the key was refused. Bea cannot revoke Sora's agent ("Not one of your agents").
- Chain: /api/trust/verify ok true throughout, head signed (kid serve-b8d59a546431c805, matches /a2a/keys.json). Entries use hex pseudonyms only; no Sora id, name or coordinates in them. Only replay and bad-signature wrote "sig" entries (under the agent's pseudonym); the format mistakes wrote none, as promised.

## Observations (MINOR)
- A forged signature naming a real kid writes a "bad-signature" entry against that agent, so a third party who knew a kid could harm that agent's record. I could not find the kid exposed to outsiders, so this is not a leak.
- An unregistered or unknown kid is reported as "no allow-listed peer has that key" (why unknown-peer), which is confusing wording on the member agent channel.
- Did not confirm that the person's own show-up record was untouched, since the chain gave only pseudonyms and I could not map them. The sig entries were typed "sig" (agent side) only.

Not tested: a real delegated yes from Sora's agent (she was never asked by the simulated hosts), and a 3rd-party probe-rate limit.

VERDICT: CLEAN
