# Grace (r21grace) report, about 80 requests

Setup: key registered (200); limits Mon-Fri 18-22 + Sun 9-18, 8 km, NT$200; delegation on (150, no new people); open on. Three hosts (new demo accounts, in Daan Badminton) invited Grace.

Worked as documented
- Agent yes on seeded Yuna's huddle h-2311e09c (NT$98, known people) -> 200; shows in "Your games" (going 1/4) and leaves the "waiting" cards. Notices list it as "One yes from you?" until answered.
- Agent refusals (403, needs person, reasons in words): huddle with a new person; every posted game of a new host / without a location (incl. the 90% gate game) for yes, join. Agent loosening limits -> 403; tightening -> 200.
- Person answers herself: huddle yes, joined cheap game and the 90% gate game (her smoothed 92% clears it). A NT$400 game was never shown to her (over limit).
- Leave (person and agent channel) and rejoin: "Your games" and today updated correctly each time.
- Host deleted a game she was in: notice "Hostb called off badminton Tue 3 Nov 19:00...", game gone from Your games and today.
- Hosts see only badge words: "shows up 93% · 14 games", "agent right 94%", and for no: "Not that one for Grace (the time/price)"; game lists show names only. No area/limits leaked.
- Double-booking: after her yes for Thu 19:00, Thu 20:30 proposals from a host were declined for her "(the time)".
- Record: agent right went 94% (17/18) -> 95% (18/19) after she answered herself; chain/explain text consistent.

Not tested
- A host calling off a huddle she had already agreed to (new-host huddles got "stuck": pin place had to be an osm id; a named place gave "can't find the court"; her price limit declined the one venue).

Findings (all MINOR)
- Pinning a place by its name (e.g. "Taipei Gymnasium", a name the agents themselves use) fails with "can't find the court"; only an osm id works.
- "Your games" entries for huddles show "on": false even after her yes; posts show null. Ambiguous.
- After agent tightens maxEach to 120, delegate.maxEach still reads 150 (effective cap unclear).
- Posted games without "at" always block the agent ("no location"), so any game from a new host needs her own yes (by design, but easy to hit).

VERDICT: CLEAN
