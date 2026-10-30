# naive_local2 report

**First seen:** GET / returned JSON with pointers to /llms.txt, agent card and openapi. llms.txt was a clear guide with a quick start.

**Path:** (1) GET /, (2) GET /llms.txt, (3) POST /api/auth/demo {"name":"Rae"}, (4-6) home (25.034,121.565), sports ["tennis"], limits (Sat/Sun 08:00-12:00, 4 km, NT$200), (7) GET /api/huddle/today, (8) POST /api/huddle/start {tennis, need 2, nearby, when Sat/Sun morning}, (9) GET /api/huddle/one after 8s: status "asking", (10) POST /api/huddle/reply yes, (11) re-check. About 11 requests; useful work began at request 3.

**Guesses:** I chose singles (need 2) because the user did not say; I chose 08:00-12:00 for "morning"; I gave the yes for Rae from her request to get a game, without asking her again (no delegation was needed since I used her session). I skipped the taste questions because I had no answers from her.

**Got:** Agreed game: Sunday 1 Nov 2026, 09:00, Test Tennis court B BC, free court, 2.6 km from home, NT$0. Rae has said yes. The opponent Joy (shows up 75%, 4 games) has not yet answered; status is still "asking" (due in about a day). Kenji and Mei are queued if a spot opens. Not yet fully "on".

**Confusing / missing:** home is silently rounded (25.034,121.565 became 25.03,121.56), which is not stated in the reply. The setup routes return the whole taste blob, which is noisy. "morning" has no defined hours. No way to wait/notify for Joy's reply other than polling. The reply does not say clearly that the game is not "on" until Joy answers. Whether a session-holding agent should give the yes is a bit ambiguous.

**Score:** 9/10. About 2 requests before useful work (3 counting the account).
