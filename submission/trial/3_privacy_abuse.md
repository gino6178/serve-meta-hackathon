# Serve — privacy & abuse test (persona: Pat)

Target: http://127.0.0.1:8899 (local test copy). ~99 HTTP requests, read-only source review plus attacks through the public/member API. All test accounts are demo accounts I created.

## Finding 1 — CRITICAL: the "pseudonymous" trust chain can be fully de-anonymized

The public chain subject is `subject(id) = sha256("serve-trust:"+id).slice(0,16)` (trust.js:44) — a plain hash of the member id with no secret. Member ids are handed out freely:
- `GET /api/huddle/me` → `people()` returns `{id, name}` for every co-member of any club you are in (huddle.js:46-49).
- `GET /api/feed` → `whoView` returns `member: <id>` / `agentOf: <id>` for posts, and `openInvites` returns `hostId` (posts.js:351,371-375).

So I join the public clubs (auto-join, no approval), read the ids, hash them myself, and match against `GET /api/trust/chain`.

Request: `GET /api/huddle/me` → ids incl. `de-a6ec2c1ae099 "Leo Park"`, `de-394145c1379d "Hana Ito"`, `de-f34d4c4aa023 "Dan Lee"`, `de-05f4c640692e "Mei Chang"`.
Local: `subject("de-a6ec2c1ae099")=442d9bab6f4fd994` → chain entry n=0 `{person:{games:8,came:8},agent:{said:10,kept:10}}`. Matched 4 of 5 chain subjects to named people with their full records (games played, show-up, agent promises, and `at` timestamps).

Breaks the claim "the chain uses pseudonyms." Anyone (no sign-in needed for the chain) who learns a target's id — trivial — reads that named person's private activity history.

Fix: derive the subject with an HMAC under a server-held key that is never published (and/or rotate/salt per epoch so entries can't be correlated across time), and never expose raw member ids in member/feed views — use opaque per-viewer handles.

## Finding 2 — HIGH: self-collusion inflates the agent-trust record

Two accounts I own (`Inf2Host`, `Inf2Tgt`), a public club I created, host repeatedly starts a `need:2` club huddle inviting the target; the target's agent auto-says-yes (a promise) and the target replies yes (kept).

After 3 rounds, `GET /api/huddle/trust` for the target: `agent: "agent keeps 100% of its yeses", kept:1, newAgent:false` — its own chain entries are 3 `promise {kept:true}`. Zero real games, no third party, no cost. Crossing `NEW_UNDER=3` means it now passes an `agentMin` gate.

Breaks "inflate your own trust record (self-promises)". Fix: don't score promises between accounts that share no independent history / were recently created / keep huddling only with each other; cap a single counterparty-pair's contribution; weight trust toward attended (time-passed) games, not just yes-replies.

## Finding 3 — MEDIUM/HIGH: gate waitlist bypassed by a fresh identity

`gateOf` defaults `newOk !== false` → `true` (trust.js:187), and `check()` lets a "new" (0-game) member straight through any `minShow` gate (trust.js:190). Demo accounts are unlimited (`POST /api/auth/demo`). A low-trust or waitlisted person simply makes a new account (or `POST /api/members/leave` then rejoins) to shed the record and walk past the gate. Feed-join does enforce the gate for members with a bad record (posts.js:202-208, verified), so the weakness is the identity reset, not the check.

Breaks "gates send low-trust people to a waitlist." Fix: for gated games default `newOk:false`, or route new accounts to `confirm` (asked directly) instead of `ok`; rate-limit / verify account creation.

## Finding 4 — MEDIUM: mass enumeration with no prober flag

The prober counter only fires for *nearby* open-asks: `Tr.asked(me, near.length)` and `asked()` is a no-op when `n<=0` (huddle.js:74, trust.js:118). Joining public clubs and running club/explicit-invite huddles records nothing. One `GET /api/huddle/me` after joining the 4 public clubs returned 14 real ids+names at zero probe cost; combined with Finding 1 this maps named people to chain records in bulk, and many small accounts stay forever under `PROBE_ASKS=30`.

Breaks "a prober asking too many agents gets flagged." Fix: count club joins, roster reads and `people()` breadth toward the disclosure budget; flag accounts that join many clubs / read many rosters quickly; rate-limit club joins.

## What held
- Input validation is solid: bad sport, `need` 999999/-5, `lat/lon` 999, 5000-char lat, and `gate {minShow:0.5, agentMin:5}` are all rejected or clamped (`gateOf` only accepts minShow 0/0.75/0.9, agentMin 0 or 0.8); `sports:["<script>",42,{..}]` sanitized to `["badminton"]`; no 500s triggered.
- Access control: reading another's huddle `GET /api/huddle/one` → 404; replying to one you're not in → 404; starting a huddle in a club you're not in → 403; forged `x-serve-session` → 401; bogus `attend` key → 404; bad `answer` pick → 400.
- Home is stored rounded to 2dp (~1 km); invite coords to 4dp. No address leaks via these routes.
- The show-up (person) track resisted instant inflation: `vote` requires the game start +1h and games are ≥3h out, so same-session show-up forging is time-gated (though majority-of-co-players settlement is still collusion-forgeable over time, since all voters can be controlled).
- Chain integrity (`/api/trust/verify`) replays and hashes check out; I did not find a way to alter past entries via the API (writes are code-only).

## Potential (not fully executed)
Triangulating an *open* member's ~1 km home by running nearby huddles from different home points and watching who enters the 5 km set (names appear in huddle talk). Plausible but requires the target to be `open`; left for a follow-up.
