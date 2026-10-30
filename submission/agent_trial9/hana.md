# Hana Ito (badminton, Daan Badminton) - round 10 re-check

Setup (Hana's session): windows Sat/Sun 09-20 + Wed/Fri 18-22, 6 km, max NT$120; delegation on, maxEach 100, newPeople false. Key registered (agent ag-921458c6d4c5). Later widened to 8 km / NT$250 (delegation 250) so nearby searches found a court. Extra accounts: Rin, Sol (club, different limits), Vic (outside club). ~90 requests.

## Re-checks
1. nearby:true count/names: PARTIAL. `invited` stayed 0, talk, notices and /huddle/one gave no count; Vic (cannot play) never named. BUT the public chain got `{"n":10,"kind":"asked","d":{"n":42}}` the moment Hana's nearby huddle ran. A number is published, against privacy.txt ("not each count"). BUG (see below).
2. Reasons beyond badge words: FAIL. In Rin's club huddle the talk says "Hana's agent can't answer for Hana here (their agent asked too many people's agents today)" and "Dan's ... keeps only 52% of its yeses". The badge is only "agent paused"; the reason is private (shown to Hana only by /huddle/trust explain). No stranger/low-record person turned up in a nearby huddle, so the pure stranger case could not be set up; the club case leaks.
3. Counters never repeat a declined option: PASS in what I saw (Hana's club huddle, 4 rounds: Ivan declined NTU, countered Songshan, later accepted; Rin's huddle: counters were new options). Not a long multi-round stress.
4. Failed court lookups end with a note: PASS. Two nearby huddles went `stuck` with "No court time fits..." and "Every option is outside your own limits (the courts cost more than your price limit)..."
5. /api/agent-channel/feed/post: PASS. Same 200 result and note as /api/agent-channel/post. gate newOk:true sent on an agent post was overridden to newOk:false with the delegation note (honoured). Note: feed/post is not listed in openapi.json; newOk is documented in llms.txt.
6. PASS. Agent post each=200 refused 403 (over delegation cap 100), each=80 ok; "no new people" kept (newOk false, minShow 0.6); overlapping join refused 409 (Vic, Sol's 16:00 and 16:30 games); fill of a game 15 days ahead (2026-11-14) accepted.

## Findings
- BUG: public chain publishes a count ("asked", n:42) for an agent that asked too many; privacy.txt says the chain marks only that, not the count. Might equal nearby people open.
- BUG: huddle talk to other members states why an agent can't answer ("asked too many people's agents today") beyond badge words (see 2).
- MINOR: nearby huddle text says "people nearby (not club members)" yet asked Daan members (Leo, Ivan, Grace) - Hana's own club mates.
- MINOR: talk shows a participant named "Host" twice with identical lines ("Host can do that (a quiet court)").
- MINOR: Hana's agent was paused as a prober after about 3 huddles in a few minutes, with no warning in the start response.
- Not testable: real multi-day agent-right tracking, real-time seeded replies.

VERDICT: 0 BLOCKER, 2 BUG
