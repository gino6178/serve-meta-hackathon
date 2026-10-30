# Trial 24 new2: Kai privacy/permission/trust check (about 70 requests, header x-tester: r24new2)

Accounts: Kai (basketball, home 25.036/121.566, window Sat/Sun, maxKm 5, maxEach 0, open, delegate on, newPeople false, own Ed25519 key), Ana, Bo.

## Passed
- Home stored rounded (25.04/121.57). Ana/Bo could not read Kai's area, limits, delegation or weights: /api/me?id=, /api/huddle/trust?id=, /api/huddle/me?id= all ignore the id and return the caller's own data. Ana's "people" list stayed empty; Kai's id/name never appeared in Ana's feed or notices. Host talk shows only "Kai can do that (the time)" and yes/no.
- Agent yes refused (403 "Ask your person") on every path I could reach:
  - /agent-channel/huddle/game and /agent-channel/join, free game by a new host: "the host is new".
  - The same two paths, NT$100 game: price over NT$0, host new, outside limits.
  - /agent-channel/huddle/reply on a club huddle with a new person: "someone new is in it".
  - An agent NO was accepted, which is sensible.
- Limits over the key: tightening (maxKm 5 to 3, windows narrowed) accepted. Loosening km, price, windows, and null limits got 403 "can only get tighter". Delegate and open changes over the key got 403 "only your person". Session-only auth: x-serve-session on the agent channel gives 401 unsigned.
- Outsiders: Bo got 404 reading Ana's huddle and 403 deleting her post. Kai got 403 cancelling someone else's huddle. Ana got 400 revoking Kai's agent.
- Trust chain: all 16 entries re-hashed correctly with sha256(JSON.stringify([n,at,kind,who,d,prev])). The head signature verifies against /a2a/keys.json and the head equals the last entry.
- Signature misuse: a replayed jti gave 401 replay and a corrupted signature gave 401 bad-signature. Both logged as "sig" chain entries under Kai's pseudonym. Kai's trust then showed shows-up unchanged ("new", 0 games) and only the agent record flagged ("agent being checked", asked directly). A tampered body gave 401 wrong-body and was not logged, as documented for signing mistakes. The person's record was not penalised.

## Not tested
- The allowed path (agent yes for a free game with a host who has a record). I had no way to make a host with a record on this copy.
- Invite-by-id: Ana's invite:[Kai] with nearby:true did not reach Kai. Only the club route did. That is consistent with the privacy text and not a leak.

## MINOR
- After I tightened Kai's windows to Sat 10-12, Kai's own session POST /api/huddle/game and /api/feed/join on Ana's Sunday game (still visible at GET /api/invite) returned 404 "That game isn't open any more" / "not in the feed any more". The wording is misleading, since the game is open and the limits are the cause.

VERDICT: CLEAN
