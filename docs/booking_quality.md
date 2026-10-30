# How good were the games Serve booked?

Every game Serve booked in the three simulated-user runs (`submission/results/sim_users_v2s2.json`, `sim_users_v2s3.json`,
`sim_users_v3s4.json`: 12 games, 5 of them played) is checked against every game the same players could have had.
**Simulated users and sample venues only**: nothing here is about real people.

    node agent/test/booking_quality.mjs        (offline, no model; writes submission/results/booking_quality.json)

## What is measured, and how

- **Candidates.** For the game's players: every half-hour start in the week from the run's first day that lies in
  everyone's free windows and keeps their rules (`endBy`, `maxTrip`), at every venue with a free court in the sample
  timetable (`test/sim_users/courts.mjs`, the same hash as `play.js`), less the run's other bookings. A 90-minute game.
  The search is exhaustive (8 to 74 candidates a game).
- **Trips** in minutes from each player's home area, as `play.js` `travelMin`.
- **Excess longest trip** and **excess total trip**: the booked game's value minus the best over all candidates (each
  minimised on its own), and the same at the booked time only (the venue choice alone).
- **Burden fairness**: the shortest trip over the longest, per game (1 = everyone travels the same).
- **Messages per booking**: the game messages and taps (request, answers, taps, bail) the run's metrics counted
  (`sim_users/metrics.mjs`), over the games booked; all messages per booking beside it.
- **Venue rules** (`a2a/talk.js` `court()`, chosen with `A2A_VENUE_RULE`): `minimax` (the default) the venue whose longest
  trip is shortest; `sum` the least total trip; `nash` the least sum of log(trip + 1). All three on the same games, and on
  every pair of the 20 simulated users at the start of each window they share (108 decisions), which is what `court()`
  decides once the time is agreed.
- **Invitation exposure**: the Gini of how often each simulated user was invited (`match/fit.js` `gini`), and the
  `giniAsks` that `test/match_eval.mjs` already measured (read from its saved results, not recomputed).

## Results

| | Value |
|---|---|
| Games | 12 (5 played) |
| Excess longest trip over the optimum | 0 min in all 12 |
| Excess total trip over the optimum | mean 2.3 min, max 11; 0 in 8 of 12 |
| The same, at the booked time only | longest 0, total mean 2.3 |
| Burden fairness (min/max trip) | mean 0.73, lowest 0.29 (a doubles four: 7 to 24 min) |
| `court()` (minimax) reproduces the booked venue | 12 of 12 |
| Game messages per booking | 4.0, 15.0, 5.8 (seeds 2, 3, 4); without Serve 12, 13, 8.5 per game |

The time never cost a trip: the best venue was free at the booked time in every game, so all the excess comes from the
venue rule. Minimax gives the shortest worst trip by construction, and pays for it in total minutes:

| Rule | Booked games: total / longest / fairness | All pairs (108): total / longest / worst / fairness |
|---|---|---|
| minimax (default) | 31.8 / 16.8 / 0.73 | 26.2 / 15.3 / 25 / 0.73 |
| sum | 29.6 / 17.3 / 0.59 | 25.7 / 15.8 / 25 / 0.67 |
| nash | 29.6 / 17.3 / 0.58 | 25.9 / 16.9 / 35 / 0.59 |

- Minimax against sum: a different venue in 4 of 12 booked games and 18 of 108 pair decisions; 27 extra total minutes
  over the 12 games (2.3 a game; 4 of them where the two tie on the longest trip and minimax took the venue listed
  first), 0.5 min a game on the all-pairs set. In return the worst trip is 0.5 min shorter on average, 4 to 5 min at most.
- Nash sits with sum on these games and is worst for the one who travels most on the pairs (a 35-minute trip, against 25).
- Minimax keeps trips the most even (0.73 against 0.59 and 0.58).

Invitation exposure is uneven in the simulated runs (Gini of invitations 0.71, 0.85, 0.88: few games, most users never
invited). `match_eval.mjs` on 300 simulated members measured `giniAsks` 0.42 for play.js's order and 0.29 to 0.41 with
bands (0.29 with two talks at once).

Twelve games is a small sample; the per-game rows and every pick are in `submission/results/booking_quality.json`.
