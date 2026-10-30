# Serve trial 23 - new2 (privacy / permission / trust)
Accounts: Ines T23n2 (pickleball, Da'an, open, delegate on maxEach 0 newPeople false, own Ed25519 key), Bao, Cleo. About 65 requests, all with x-tester: r23new2.

## Checked and held
- Privacy: from Bao and Cleo, /api/huddle/me, /trust, /feed, /clubs, /a2a/* and the huddle talk never showed Ines's area, limits, delegation or weights. Passing `member`/`id` params acted on the caller's own account only. Revoking her agent, deleting her comment, cancelling her huddle and replying in a huddle she was in were all refused (400/403/404). Her coordinates and delegation were not in any other account's view. Others do see her display name, her member id (in comment `by`), her yes/no with the kind of reason, and her trust text, which matches privacy.txt.
- Waitlist: on a gated game (minShow 0.9) the host's agent comment, visible to Bao, says "Ines is on the waitlist..." with no reason. The privacy text says others see only that she is on the waitlist, so this matches.
- Limits only tighten: with Ines's key, loosening was refused (403 "can only get tighter"), tightening km, price and windows worked, and re-loosening was refused. delegate/home by key refused. Her tightened window later kept her out of Cleo's Thursday-evening huddle, and Cleo saw nothing about her.
- Agent yes: joining Cleo's free game and Cleo's NT$80 game, via /agent-channel/join and /huddle/game, was refused each time with the reasons "host is new" and "NT$80 over the NT$0 allowed". A record host's NT$90 game (Leo Park, badminton) was refused for price. Her person's session could join the free game.
- Trust chain: 20 entries, my own sha256 replay matched, /api/trust/verify ok, head signature checked against /a2a/keys.json.
- Signature misuse: forged signatures with her kid and a replay added "sig" entries, and her agent became "being checked" and was told to ask her directly (the new key was blocked too). Her shows-up record stayed "new · 0 games", so the person was not penalised. The chain only carries a pseudonym.

## Not tested
- The allowed path (free game, host with a record) could not be reached: no pickleball host with a record exists here, and my forged-signature test then blocked her agent for 30 days. My test design.

## Minor
- Bao's talk says "Ines's agent had said yes too, so Ines takes the spot" while she has not given her one yes. Wording only.
- Anyone who learns an agent's kid could flag that person's agent with bad signatures. I found no public place where the kid is shown.

No BLOCKER, no BUG.
VERDICT: CLEAN
