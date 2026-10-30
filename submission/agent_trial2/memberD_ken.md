# Serve agent trial — Member D (Ken Hsu)

Role: Ken's agent. Local http://127.0.0.1:8899, signed agent channel.

## What I did
Registered an Ed25519 agent key with Ken's session (`POST /api/members/agents` → kid `serve-e8f0873c91ec48bb`). Worked the signed `/api/agent-channel/*` channel: read me, trust, huddle/me, today, places, feed, clubs. Started basketball huddles (3v3 need 6, 5v5 need 10, gated club minShow 0.9). Tried volleyball. Posted a weekly basketball game. With Ken's session enabled limits + delegate, then had the agent join Ray's game over the signed channel.

## What works
- Signed channel fully functional once the body claim is right (below). me, trust, huddle/me, today, feed, clubs, start, cancel, post, game all return 200.
- Trust is readable and honest: show-up 73% (8/11), kept-yes 0.67 (8/12), flag true.
- Refusals are clear and actionable:
  - Agent self-enabling delegation: 403 "Only your person changes this, with their own session."
  - Yes without delegation: 403 `needs:delegate` with the exact session route to fix it.
  - Volleyball nearby: 400 "Nobody within ~5 km who plays volleyball has let other agents ask... Start a club, or post the game."
  - 4th concurrent huddle: 429 "You have three games being worked out already."
- Weekly game posted via signed channel with repeat weekly:4 and a shareUrl.
- Delegated join succeeded after Ken's session set delegate — rebuilds his record.

## Problems (ranked, exact req/resp)
1. **Docs name the body-hash claim `bh`; server actually requires `body`.** Every signed call with only `bh` returns `401 {"why":"wrong-body"}` (`refused: the body is not the one signed`). Adding claim `body` = same base64url sha256 → 200. llms.txt never mentions `body` or the required `iss` claim (missing it gives `401 {"why":"bad-claims"} issuer is not the signing key`). Cost ~30 wasted calls. Fix: document `iss`=kid and the `body` claim, or accept `bh`.
2. **Trust explanation omits the kept-yes cutoff and its way back.** `explain` covers show-up (75% gate: 1 more game; 90%: 21 more) but for the agent side only says "signature problems... check signing." It never states the documented 80% kept-yes rule, that Ken is at 0.67<0.80, or how kept-rate recovers. The signature flag masks the kept-yes blocker.
3. **Transient signing failures during legit key setup pollute the trust chain and flag the agent** ("signature problems", flag true, "asked directly"), and the flag is publicly visible on posts (`host.agent:"signature problems"`). It did not clear after a later good signed call. Fix: don't count setup-phase sig failures, or decay faster.
4. **Team-size and gate validation not enforced on start.** `start {sport:basketball,need:4}` → 200 (docs: basketball 6 or 10). `gate{minShow:0.5}` → 200 (docs enum 0|0.75|0.9). Fix: validate `need` and `minShow`.
5. **`agentMay` absent on today game cards** though docs say each huddle shown states it; value was `undefined`.
