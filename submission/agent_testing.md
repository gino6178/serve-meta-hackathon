# Testing Serve with AI agents

Between October 29 and October 31, 2026 we ran 28 rounds of testing in which AI agents used Serve the way its users
would: as a person's own agent arriving with nothing but the address, as a member's agent hosting and answering
games, and as a person clicking through the website on a phone or a laptop. After every round we fixed what they
found, ran the unit tests, checked the pages in a browser, deployed, and started the next round with new testers.

**177 AI testers, one report each. 17,432 requests logged.** Round 25 came back clean on every core flow; rounds 26 to 28 were harder (the live site, then a local copy with the server's own models) and found new faults, all fixed.

Every report and every round's request log is in this folder: `trial/` (round 1), `agent_trial/` (round 2) and
`agent_trialN/` (round N+1). The judging rules a tester followed are in `agent_trial20/verdict_rules.txt`.

## How a round worked

- **A fresh local copy.** Each round seeded a new local copy of the gateway (`PORT=8899`) with twelve simulated
  neighbours, three clubs and three open games, and two of them as long-standing members whose agents testers ran.
  The local copy runs the same code as the live site; it has no language model, its clock can't be moved, and its
  simulated members don't answer in real time, so testers did not count those as findings.
- **Six testers per round** (from round 6), each a fresh model with only its persona and the address:
  - two **new agents** arriving cold ("someone told me about this site") who had to find the guide, sign their person
    in, register their own Ed25519 key and get a game, or audit privacy, permissions and the API description;
  - two **member agents** with a seeded member's session, hosting and answering games with extra test accounts, and
    re-checking the previous round's fixes;
  - two **web users** in the browser, one at phone size and one on a laptop, reading the screen and clicking.
- **One verdict line.** Each report ended with `VERDICT: CLEAN` or `VERDICT: <n> BLOCKER, <m> BUG`. A blocker meant the
  task couldn't be finished; a bug meant something behaved wrongly, broke a published rule (privacy, limits,
  permission, trust, prices, times), lost data or contradicted itself.
- **Every request logged.** From round 4 the gateway logged each request (time, tester, method, path, status, a hash
  of the session, never the session itself) to the round's `requests.jsonl`.

From round 21 a bug meant a problem in a **core flow**: getting a game, saying yes or no, joining and leaving,
calling off or deleting a game, the person's limits and their agent's permission, privacy, trust records and money.
Wording, layout, docs gaps and input checks that change no outcome became minor and were still fixed when cheap. The
rounds before that found something new every time, mostly at the edges; switching to core flows let the loop end on
a clear rule.

## The rounds

| Round | Folder | Reports | Clean | Bugs reported | Requests logged |
|---|---|---|---|---|---|
| 1 | trial | 5 | | | |
| 2 | agent_trial | 10 | | | |
| 3 | agent_trial2 | 6 | | | |
| 4 | agent_trial3 | 6 | | | 381 |
| 5 | agent_trial4 | 6 | | | 694 |
| 6 | agent_trial5 | 6 | 2 of 6 | 5 (and 1 blocker) | 511 |
| 7 | agent_trial6 | 6 | 1 of 6 | 9 | 623 |
| 8 | agent_trial7 | 6 | 2 of 6 | 10 | 571 |
| 9 | agent_trial8 | 6 | 1 of 6 | 10 | 815 |
| 10 | agent_trial9 | 6 | 1 of 6 | 13 (and 1 blocker) | 809 |
| 11 | agent_trial10 | 6 | 2 of 6 | 6 | 662 |
| 12 | agent_trial11 | 6 | 1 of 6 | 19 | 698 |
| 13 | agent_trial12 | 6 | 2 of 6 | 16 | 772 |
| 14 | agent_trial13 | 6 | 2 of 6 | 11 | 809 |
| 15 | agent_trial14 | 6 | 2 of 6 | 8 | 938 |
| 16 | agent_trial15 | 6 | 2 of 6 | 9 | 848 |
| 17 | agent_trial16 | 6 | 2 of 6 | 7 | 823 |
| 18 | agent_trial17 | 6 | 1 of 6 | 10 | 842 |
| 19 | agent_trial18 | 6 | 1 of 6 | 9 | 935 |
| 20 | agent_trial19 | 6 | 2 of 6 | 9 | 891 |
| 21 | agent_trial20 | 6 | 4 of 6 | 2 | 793 |
| 22 | agent_trial21 | 6 | 4 of 6 | 2 | 808 |
| 23 | agent_trial22 | 6 | 3 of 6 | 3 | 848 |
| 24 | agent_trial23 | 6 | 4 of 6 | 4 | 855 |
| 25 | agent_trial24 | 6 | **6 of 6** | **0** | 787 |
| 26 | agent_trial25 | 6 | 2 of 6 | 8 (and 1 blocker) | 307 |
| 27 (live site) | agent_trial26_live | 4 | 1 of 4 | 9 (and 1 blocker) | not logged |
| 28 (live, read-only and first try) | agent_trial28/live | 4 | 1 of 4 | 3 (and 2 blockers) | not logged |
| 28 (copy with the real models, run 1) | agent_trial28/copy_run1 | 3 | 1 of 3 | 4 (and 2 blockers) | 161 |
| 28 (run 2) | agent_trial28/copy_run2 | 3 | 2 of 3 | 2 | not kept |
| 28 (run 3) | agent_trial28/copy_run3 | 4 | 1 of 4 | 7 | 251 |

Rounds 1 to 5 used free-form reports, before the verdict line. "Bugs reported" is what the testers counted; a few
turned out to be the test setup (a member name the seed didn't have, browser tabs left open by earlier rounds, two
test courts with the same name) and are not bugs in Serve. Rounds 21 to 25 count core-flow bugs only.

**Rounds 26 to 28.** Round 26 ran six Haiku testers on a local copy as before. Round 27 went to the live site with the
owner's approval: test accounts named "Test … (round 27)", everything inside one private test club, no nearby options,
and each tester removed what it made. Its organiser could not start: Llama Guard 3 refused the club name "Serve test
round 27" as violence, so the other two never joined. In round 28 a tester declined to create accounts on the live
site, and write tests moved to a local copy that runs the same code behind the same proxy and calls the server's own
Muse Glimmer, Llama Guard 3 and Prompt Guard 2 (the earlier copies had no language model). Blockers in round 28 were
mostly the testers' own polling scripts and the copy's first set-up (Prompt Guard took longer than its timeout to
load on Windows); the faults in Serve were real: the club name (S1, after S9), a person who asked to join a private
club never told the answer, a game in one's own club hidden by the sport filter, the host not told who joined, a host
leaving Serve without their players hearing the game was off, an agent's read of the feed taking its person's notices,
a club passed on without telling the new organiser, a revoked key answered as unknown, and a share link for a private
club's game that strangers could not open. After the fixes, 12 of 12 checks over HTTP pass on the copy
(`agent_trial28/copy_run3/e2e_after_fixes.py`). "Not logged" means the live site, which keeps no request log of this
kind; run 2's log was lost when the file was moved while the gateway held it.

## What the testers found, by kind

- **Privacy.** A host could work out how many people nearby were open to being asked (from a count, then from the
  talk); another member's signature trouble showed in a stranger's talk; a waitlist note showed someone's show-up
  rate to everyone. Now nearby people appear only once they can play, the trust chain marks an over-asking agent
  without a count, and others see only the published badge words.
- **Limits and permission.** An agent's posted game ignored "no new people" and the price cap; an agent under 80% could
  still say yes; a deal over someone's limit went ahead after two venue talks; a learned soft distance overrode the
  person's own, wider limit. All now follow the person's settings, on every path.
- **Double-booking.** Joining overlapping games, posting over an agreed game, a waitlist promotion into a clash. One
  rule now (games clash when they overlap, a game is 90 minutes) for posts, joins, promotions and the agents' talk.
- **Telling people the truth.** A game said "Agreed" with too few players, "Game on" for a game that never reached the
  feed, "nobody else said yes" when others had; a deleted or called-off game left players uninformed or a stale
  "yes?" behind. Every affected person is now told what happened, once.
- **Fills of a posted game.** Stopping the agents and calling the game off are now two actions; a game that fills
  from the feed stops the agents and tells those asked; everyone in the game shows in its list.
- **Agents arriving cold.** The site's own HTML now carries a short guide for agents, `/llms.txt` opens with a six-call
  quick start, and `GET /api/huddle/today` says what to do next when there's nothing to join.

## An agent that knows nothing

After round 25 we gave three more agents only an address and a request (`agent_naive/`):

| Run | Score | Useful work from | Result |
|---|---|---|---|
| Live site, read only (no account made) | 8 of 10 | request 2 | Understood the steps and where its person must sign in and say yes |
| Local copy, before the quick start | 8 of 10 | request 6 | Thursday 20:30 badminton, NT$100 each, 2.3 km |
| Local copy, after the quick start | 9 of 10 | request 3 | Sunday 09:00 tennis, free, 2.6 km |

## The film segment

`video/shotcraft/src/serve/Swarm.tsx` replays 146 of these sessions side by side from the logs
(`video/shotcraft/public/swarm/sessions.json`, built from the `requests.jsonl` files): each tile is one tester, playing
its own requests in its own order. The numbers on screen are the ones above.

## What this does not show

- The testers were AI models, not people. They found real faults, but they are not a usability study.
- The simulated members never answered in real time, so most games stopped at "agreed, waiting for yeses"; the
  confirmations were tested with test accounts the testers controlled.
- On the live site Serve has very few real members, and only demo sign-in is on; a real agent arriving today finds
  the steps clear but few people to play with.
