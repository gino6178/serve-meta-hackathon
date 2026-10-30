# Trial 19 new1: Lea, Sunday morning badminton

Path: GET / -> /llms.txt -> demo account -> own Ed25519 key (POST /api/members/agents) -> home, sport, limits (Sun 10-13, 3 km, NT$140), 6 taste answers ("either", Lea gave no preference), open, delegate (maxEach 120, newPeople false). Then everything over the agent channel: me, today, huddle/start, one, reply. About 25 requests; signing worked first time.

Result: huddle h-dafa717e, badminton for 4, nearby, Sun 2026-11-01 morning. Agents asked Leo, Grace, Ivan, Lily (all "shows up 93-100%", records, no new people). Agreed: Sun 10:30 at Sports centre 松山運動中心, venue list NT$470, price NT$450, NT$113 each (450/4 = 112.5, rounded up), 2.4 km. All within her limits (window, 3 km, 120 delegation cap). My yes went through the key under delegation (agentMay ok:true). Ivan, Lily, Leo still unanswered after ~25 s (simulated members, not a finding). Grace's yes is held as first in line. So: joined and agreed on terms; waiting on three confirmations.

Consistency checks: start note ("new people wait, gated at 60%") matches the gate returned. Price, each, km and players identical on /api/huddle/one (session) and /api/agent-channel/huddle/one (key). Docs matched behaviour (JWS format, delegation, newOk false forced).

Findings:
- MINOR: llms.txt says "about five" taste questions; the server served 6 (q0..q5) while each said "of":5.
- MINOR: today card for my own game shows "spots":4,"going":1 though need is 4 in all (3 open); ambiguous with the llms.txt meaning of spots.
- MINOR: talk says "Agreed: ..." while status is still "asking" and 3 players unanswered; wording could say "terms agreed".
- MINOR: I created two demo accounts (first curl was a probe, second the one used); the first has no key. My own doing.

VERDICT: CLEAN
