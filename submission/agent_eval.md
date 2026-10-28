# Autopilot evaluation

The Autopilot (`agent/src/agents/autopilot.js`) planning eight different weeks on our server. Muse Glimmer runs on one RTX
3090 (Ollama, 4 requests in parallel), and the members' agents run on the same model, answering over A2A (JSON-RPC on a local port, with the token, as behind the gateway). Each week was run 3 times.
Run with `EVAL_A2A=1 EVAL_REPEAT=3 node test/autopilot_eval.mjs`, 2026-10-28. The raw results are in `submission/results/`.

A week passes when three things hold:
- every agent agreed the games still needed, and the player was asked to approve;
- every-week checks pass: at most one game a day, inside the next seven days, nothing on a day already booked;
- the week's own oracle passes. For example: doubles while the knee is sore, the right sport, basketball on a public
  court, Kenji in a game after the game with Kenji ran long, one game in a heavy week.

| Week | Passed | Games agreed (mean) | Time (mean) | Muse Glimmer calls | Tool calls | Stops refused | Finished by | Oracle failures | An earlier run |
|---|---|---|---|---|---|---|---|---|---|
| Two games a week | 3 of 3 | 2.0 of 2 | 100 s | 12.7 | 8.7 | 0 | model | none | 1 of 1 |
| Two games, sore knee (doubles first) | 3 of 3 | 2.0 of 2 | 135 s | 16.3 | 9.3 | 0 | model | none | 1 of 1 |
| Three games a week | 3 of 3 | 3.0 of 3 | 161 s | 21.0 | 14.3 | 3 | model, rules | none | 0 of 1 |
| Thursday already booked | 3 of 3 | 1.0 of 1 | 49 s | 7.0 | 6.0 | 0 | model | none | 1 of 1 |
| Tennis, one game | 3 of 3 | 1.0 of 1 | 61 s | 9.0 | 10.0 | 0 | model | none | 1 of 1 |
| Two games, Kenji just played long | 3 of 3 | 2.0 of 2 | 150 s | 15.3 | 8.7 | 0 | model | none | 1 of 1 |
| Sore knee and a heavy week (body log + health app) | 3 of 3 | 1.0 of 1 | 64 s | 7.0 | 6.0 | 0 | model | none | 1 of 1 |
| Basketball, two on two (public courts) | 3 of 3 | 1.0 of 1 | 145 s | 22.3 | 11.3 | 0 | model | none | 1 of 1 |

**24 of 24 runs passed**, and **8 of 8 weeks passed every time (pass^3 = 1)**.
- **Who finished.** The model finished 23 of the runs itself, and 23 of those passed. Rules finished the plan in 1 of 24 (the model stopped calling tools, or ran out of steps).
- **Cost.** On average a run took 108 s, 13.8 Muse Glimmer calls and 9.3 tool calls, with up to 4 model calls at once.
- **Refused calls.** Code refused 16 tool calls (a day outside the week, someone not free, arguments that did not fit; 3 of them a stop taken too early), and the model re-planned.
- **The basketball week.** Its name says two on two, but its goal sets only the sport, so its oracle checks basketball on a public court, not the format: 1 of 3 runs agreed two on two, the others one on one.

An earlier run, before the last round of fixes (the same eight weeks, once each, graded before the per-week oracles existed), passed 7 of 8: the three-game week stopped at two after two failed talks, with an open evening untried. That led to the stop check below. The check refused 3 stops in the runs above. In 1 of the 3 three-game runs the rules finished the plan (the model stopped calling tools, or ran out of steps).

## Held-out weeks (never used for tuning)

Ten weeks made once by code (`agent/test/sim/heldout_weeks.mjs`, seed 20261028) from the demo club plus 16 simulated
members (`population.js`, seed 2611), each with a code-made oracle, run 5 times each over A2A on an A100 (Muse Glimmer,
`EVAL_A2A=1 EVAL_REPEAT=5 EVAL_WEEKS=heldout`, 2026-10-28). The prompts were not changed after the weeks were drawn.
(Two smoke runs of H03 and H05 came before a generator fix: the first draw ignored the code's one-fewer-game rule in a
heavy week, so a week could need no game and still have a partner oracle. Same draws, fixed before the eval.)

- **pass^1 0.78** (39 of 50 runs), **pass^5 0.6** (6 of 10 weeks every time).
- **Who finished:** the model finished 47 runs (36 passed); the rules finished 3 (all 3 passed). pass^5 counting only
  runs the model finished: 0.4.
- **What failed:** all 11 failures are one oracle, "the partner whose game ran long is in a game" (H04, H05, H07, H09):
  the model met the game count with other partners. Code does not check that rule.
- **Failure attribution** (`agent/src/safety/attribution.js`) on these failures and the 3 rules-finished runs, against a hand
  check (`agent/test/attribution_hand.json`, labelled from the steps without the code's answer, by the same agent that
  wrote the code): kind and step agree **14 of 14** (11 rule break missed, 2 rule break caught, 1 timeout: the model used
  its step budget on `recall`); the 15 talks that ended without a game, **15 of 15** (no option left: a member's rules
  ruled out every time). Results: `submission/results/autopilot_eval_heldout*.json`, `attribution_check.json`.

## What the evaluation caught

- **Two games on one day.** An earlier run agreed Thursday 18:00 singles and Thursday 19:00 doubles in a three-game
  week. A member's counter-offer was checked against everyone's calendar and the courts, but not against days that
  already had a game. Counters are now checked against those days too.
- **Stopping early.** A three-game week stopped at two after two failed talks, though Tuesday evening had players free
  who had not been asked. The run's stop is now checked by code: asking for approval, nudging or finishing while a game
  is still needed is refused (twice a run at most) when an open time still has players free, and the model is told
  which. A talk that failed with nobody saying no now also passes its members over for that day.
- **A summary that said "Booked".** In the basketball week, the model's closing sentence said the game was booked
  while it was still waiting for the player's yes. Its days and times were right, so it passed. A summary may no longer
  say booked; code writes it instead.

## What each run decided

- **Two games a week.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Hana, Tomás. Its summary: "Two badminton doubles games are agreed for Thu 2026-10-29 19:00 and Sat 2026-10-31 09:00 at Riverside Sports Centre with Leo, Hana and Tomás, and approval is requested."
- **Two games a week.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Hana, Tomás. Its summary: "Two badminton doubles games are set for Thu 19:00 and Sat 09:00 with Leo, Hana and Tomás at Riverside Sports Centre."
- **Two games a week.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Hana, Tomás. Its summary: "Two badminton doubles games are set for Thu 19:00 and Sat 09:00 with Leo, Hana and Tomás at Riverside Sports Centre."
- **Two games, sore knee (doubles first).** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Tomás, Kenji. Its summary: "Two badminton doubles games are agreed for Thu 19:00 and Sat 09:00 with Leo, Tomás and Kenji/Hana, awaiting your approval."
- **Two games, sore knee (doubles first).** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Kenji, Tomás. Its summary: "Lined up 2 games: Doubles Saturday 09:00 at Riverside Sports Centre with Leo, Hana, Tomás; Doubles Thursday 19:00 at Riverside Sports Centre with Leo, Kenji, Tomás. They wait for your yes."
- **Two games, sore knee (doubles first).** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Kenji, Tomás. Its summary: "Lined up 2 games: Doubles Saturday 09:00 at Riverside Sports Centre with Leo, Hana, Tomás; Doubles Thursday 19:00 at Riverside Sports Centre with Leo, Kenji, Tomás. They wait for your yes."
- **Three games a week.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Tomás, Kenji; badminton singles Tue 19:30 with Noor. Its summary: "Three badminton games are set: Thu 19:00 doubles with Leo, Tomás and Kenji, Sat 09:00 doubles with Leo, Hana and Tomás, and Tue 19:30 singles with Noor."
- **Three games a week.** Passed, finished by rules. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Tomás, Kenji; badminton singles Tue 19:30 with Noor. Its summary: "Lined up 3 games for you; they wait for your yes."
- **Three games a week.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás; badminton doubles Thu 19:00 with Leo, Hana, Tomás; badminton singles Tue 19:30 with Noor. Its summary: "Three badminton games are set: doubles with Leo, Hana and Tomás on Thu 2026-10-29 19:00, doubles with Leo, Hana and Tomás on Sat 2026-10-31 09:00, and singles with Noor on Tue 2026-11-03 19:30."
- **Thursday already booked.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás. Its summary: "Lined up 1 game: Doubles Saturday 09:00 at Riverside Sports Centre with Leo, Hana, Tomás. It waits for your yes."
- **Thursday already booked.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás. Its summary: "Lined up 1 game: Doubles Saturday 09:00 at Riverside Sports Centre with Leo, Hana, Tomás. It waits for your yes."
- **Thursday already booked.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Tomás. Its summary: "Lined up 1 game: Doubles Saturday 09:00 at Riverside Sports Centre with Leo, Hana, Tomás. It waits for your yes."
- **Tennis, one game.** Passed, finished by model. Agreed: tennis singles Thu 18:00 with Hana. Its summary: "Lined up 1 game: Tennis 1 on 1 Thursday 18:00 at Riverside Sports Centre with Hana. It waits for your yes."
- **Tennis, one game.** Passed, finished by model. Agreed: tennis singles Thu 18:00 with Hana. Its summary: "Lined up 1 game: Tennis 1 on 1 Thursday 18:00 at Riverside Sports Centre with Hana. It waits for your yes."
- **Tennis, one game.** Passed, finished by model. Agreed: tennis singles Thu 18:00 with Hana. Its summary: "Lined up 1 game: Tennis 1 on 1 Thursday 18:00 at Riverside Sports Centre with Hana. It waits for your yes."
- **Two games, Kenji just played long.** Passed, finished by model. Agreed: badminton doubles Thu 19:00 with Leo, Tomás, Kenji; badminton doubles Sat 09:00 with Leo, Kenji, Hana. Its summary: "Two badminton doubles games are agreed for Thu 19:00 with Leo, Tomás and Kenji at Riverside Sports Centre and Sat 09:00 with Leo, Kenji and Hana at Midtown Community Gym, meeting your 2-game goal."
- **Two games, Kenji just played long.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Kenji; badminton doubles Thu 19:00 with Leo, Kenji, Tomás. Its summary: "Two badminton games are set: Thu 2026-10-29 19:00 with Leo, Kenji and Tomás at Riverside Sports Centre, and Sat 2026-10-31 09:00 with Leo, Hana and Kenji at Midtown Community Gym."
- **Two games, Kenji just played long.** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Hana, Kenji; badminton doubles Thu 19:00 with Leo, Kenji, Hana. Its summary: "Two badminton doubles games are agreed: Thu 2026-10-29 19:00 at Riverside Sports Centre and Sat 2026-10-31 09:00 at Midtown Community Gym."
- **Sore knee and a heavy week (body log + health app).** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Kenji, Hana. Its summary: "Your one badminton doubles game is agreed for Sat 2026-10-31 09:00 at Midtown Community Gym with Leo, Kenji and Hana."
- **Sore knee and a heavy week (body log + health app).** Passed, finished by model. Agreed: badminton doubles Sat 09:00 with Leo, Kenji, Hana. Its summary: "Agreed one badminton doubles game with Leo, Kenji and Hana on Sat 2026-10-31 09:00 at Midtown Community Gym, respecting your knee limit and 90-minute cap."
- **Sore knee and a heavy week (body log + health app).** Passed, finished by model. Agreed: badminton doubles Thu 19:00 with Leo, Kenji, Hana. Its summary: "Lined up 1 game: Doubles Thursday 19:00 at Riverside Sports Centre with Leo, Kenji, Hana. It waits for your yes."
- **Basketball, two on two (public courts).** Passed, finished by model. Agreed: basketball doubles Thu 20:00 with Leo, Kenji, Tomás. Its summary: "Your one basketball game is set for Thu 2026-10-29 20:00-21:30 at Dapeng Riverside Park with Leo, Kenji and Tomás."
- **Basketball, two on two (public courts).** Passed, finished by model. Agreed: basketball singles Sat 09:00 with Leo. Its summary: "Lined up 1 game: Basketball 1 on 1 Saturday 09:00 at Basketball court, Wanhe 1st Park (public court, free) with Leo. It waits for your yes."
- **Basketball, two on two (public courts).** Passed, finished by model. Agreed: basketball singles Thu 20:00 with Leo. Its summary: "Agreed 1 basketball singles game with Leo on Thu 2026-10-29 20:00-21:30 at Dapeng Riverside Park public court, meeting your weekly goal."
