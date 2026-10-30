# Trial 22 new2: privacy, permission and trust check (about 60 requests)

Accounts: Noah (area 25.034/121.565, window 18-22, limit NT$150, delegation maxEach 100, newPeople false, open, own Ed25519 key), Hostone and Hosttwo (new hosts).

## Privacy: no leaks found
- Hostone's /api/huddle/me, /huddle/trust and /huddle/one (with Noah's id passed as a parameter) return only Hostone's own data.
- Noah's lines in huddle talk and in the public feed and invite show no area, limits or delegation.
- The public chain shows only pseudonyms. It has no member id or name.
- A session sent to /agent-channel/ is refused (401 unsigned). A non-participant gets 404 on /huddle/one and /huddle/reply.

## Delegation, checked on every path (all as documented)
- Game from a new host, NT$50, in window: join and huddle/game via the key both refused 403, "the host is new".
- NT$120 from a new host: refused with both reasons, "over the NT$100 your person allowed" and "the host is new". /today gave the same verdict in agentMay.
- Outside the window: refused, "outside their limits".
- Huddle reply yes at NT$205 with a new person in it: refused 403 with all three reasons.
- Host with a record (seeded Leo, 100% shows up, NT$90, in limits): agentMay ok, and the agent's yes "You're in".
- Agent post with newPeople false: gate newOk false, minShow 0.6, and the note says so.

## Limits only tighten
- The agent key was refused when it tried to raise km, price or window, or widen the window ("needs your person's session").
- It was allowed to lower km, price and window.

## Trust chain
- I recomputed all 20 entry hashes, and the links between them, and found none wrong.
- The signed head verifies against /a2a/keys.json.

## Signature misuse
- Replay gave 401 replay. Two bad signatures gave 401 bad-signature. A forged signature using Noah's kid, from another key, gave 401.
- Each of these wrote a "sig" entry on the chain.
- Noah's "shows up" record stayed "new 0 games". Only the agent record went to "being checked", for 30 days, as documented.

## Observations (MINOR)
- Anyone who learns Noah's kid can sign junk and put his agent into "being checked". The kid is not shown publicly, so I did not exploit it further.
- Hostone's first huddle said "I can't find the court you picked" for a pin with a Test court name. A second huddle said "clashes with a game you already have" because of my own game at the same hour. Both were my setup, not defects.
- I could not test a person's own yes to a game outside their limits. The huddle I tried never included Noah.

VERDICT: CLEAN
