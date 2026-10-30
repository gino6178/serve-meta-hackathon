# Serve trial9 new2 (tester r9new2) - Sora, tennis near Zhongshan
About 75 requests, 3 demo accounts (Sora, Obs One, Obs Two). Sora: home 25.060/121.526, Sat 07:13-09:41, 2.7 km, NT$137, open, delegation on (newPeople false).

## Held up
- Home shows as 25.06/121.53 to Sora only. Feed, invite, places, huddle talk, /a2a, errors never showed Sora's area, windows, limits or delegation. Court coordinates seen were courts.
- Trust chain: 11 entries, every sha256 hash and prev link recomputed OK. The "today" head signature verifies with /a2a/keys.json (serve-c860e3672727395c). Chain has no member id, name or coordinates. (The `heads` array was empty; only `today` was signed.)
- Signature refusals, each 401 with a clear reason: replay, expired, exp too far (bad-claims), wrong path, wrong method (wrong-request), wrong body hash (wrong-body), wrong aud, short jti, tampered signature, unsigned, session sent to the channel. Checked on Obs One's key: wrong-path, expired and wrong-body did not set the flag. Only replay did, as documented ("agent being checked").

## BUG 1: counts of nearby people leak
`POST /api/huddle/start {sport:tennis,need:2,nearby:true}` returns `huddle.invited`, the number of open nearby players. Obs Two got invited=4 while Sora was open and invited=3 after Sora set open=false (`POST /api/huddle/open`). A stranger can see that someone new is open nearby, and when Sora toggles it. The public `GET /api/trust/chain` also carries `kind:"asked"` entries with `d:{n:4}`, needing no account. Privacy.txt says "nobody is told how many people are near a point".

## BUG 2: huddle talk exposes Sora's key failure to a stranger
Obs One started a huddle with `invite:[<Sora id>]`. Its talk (`GET /api/huddle/one`) contained: "Sora's agent can't answer for Sora here (requests with their agent's key failed the signature check)". That tells another member that Sora has an agent key and that it failed checks. Privacy.txt promises others see only "shows up N%", "agent keeps N%" or "new". (Sora's key failing came from my own replay test, which is documented to count.)

## MINOR
- The chain `asked` entry (at 1793331122873) lands 2 ms after Sora's huddle start, 23 ms after Sora's public feed post (at 1793331122850). Timing can link pseudonym 9e7643b6f5d2db50 to Sora.
- Feed and invite are readable with no session, with real member ids (de-...) and names. This is covered by "agents also see member ids", but note it.
- `GET /api/huddle/trust?id=<other>` ignores id and returns the caller's own record (safe).

VERDICT: 0 BLOCKER, 2 BUG
