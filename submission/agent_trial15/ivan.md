# Trial 16 - Ivan Tsai's agent (about 90 requests)

Setup: registered an Ed25519 key (kid serve-8368c050b5d72a3f). Limits set to every day 09:00-22:00, 3 km, NT$150. Delegation on (maxEach 150, no new people). Four extra accounts (Zed Alpha, Beta, Gamma, Delta) joined Daan Badminton and acted as players.

## Re-checks
1. PASS. Huddle h-4303dcb6 (Sun 8 Nov 10:00, status asking). POST /api/feed/post at 10:30, and over the agent channel at 11:00, gave 409 "That overlaps badminton Sunday 8 Nov, 10:00 (the agents agreed it)..." with clash:h-4303dcb6. A 12:00 post was accepted. After Ivan's yes the huddle went to "on" and its game was posted automatically (pmvui7al5c843c0eb). My explicit post attempt in that state hit 429 (see Finding 1), so I could not test it by hand.
2. PASS. 2026-13-45 and 2026-02-30 gave 400 "That date doesn't exist". minShow 1.5 and -0.1 on /feed/post, and 2 and -1 on /huddle/start, gave 400 "from 0 to 1". llms.txt documents 0 to 1.
3. PARTIAL. A refused feed join explains itself: the session join gave 409 naming the clashing game, and the agent join gave 403 with reasons (over NT$150, new host, not a good time, too far). I never saw the word "proposed" in the API. Home cards show status "asking". If the wording is only in the UI, it is not testable here.
4. Mostly PASS.
   - One no (Gamma "busy") with the others yes: the game went "on" with "1 spot is open". See Finding 1: it was never posted.
   - A leaver can take it back: Beta left (going 1) and rejoined (going 2), both 200.
   - Calling off notifies: Alpha got "Ivan called off badminton Sunday 15 Nov...".
   - Deleting a posted game: INCONCLUSIVE. The fill huddle h-622c3f8d was already "stuck" when I deleted, so I could not show that the delete stopped it or told those asked. I ran out of budget.
5. PASS where tested:
   - Seeded Dan's agent (52%) "can't answer for Dan", against the 80% bar.
   - Agent yes on a huddle with someone new: 403 "Ask your person".
   - Agent join of a NT$300, a 23:00 and a far game: 403 each.
   - Overlapping join: 409.
   - Loosening limits over the channel (maxEach 400): 403 "can only get tighter".
   - Not tested: over-limit deal stops.

## Findings
1. BUG: a game said to be posted that is not. Huddle h-9b2aa62d (Sun 15 Nov) went "on" with Gamma's no. Its talk says "1 spot is open in the feed" and Alpha got a "Game on" notice, but huddle.post is null and GET /api/feed has no 15 Nov game. Earlier, a direct post got 429 "4 posts in 10 minutes", so the automatic post probably hit the same limit and failed silently. Refused attempts (400/409) may also count toward the limit. I did not confirm that.
2. MINOR: a "Game on" notice was delivered twice to Alpha for post pmvui7al5c843c0eb.
3. MINOR: two players named Zed show as "Zed" and "Zed" in the talk, so they cannot be told apart.
4. MINOR: a fill started for a posted game at 12:00 said "Every option is outside your own limits (you already have a game at those times)". The only other game that day was 10:00-11:30.

Cleanup: cancelled the stuck huddle h-285b3e81, h-9b2aa62d, and deleted the 12:00 test post. Test posts by Zeds remain.

VERDICT: 0 BLOCKER, 1 BUG
