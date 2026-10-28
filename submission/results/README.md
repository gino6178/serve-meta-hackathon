# Raw results

What every number in the README and docs comes from: the evaluations' own output files, copied from the GPU server
by `agent/test/results_bundle.mjs` (code at a391aaa). Model: muse-glimmer (27.9B, Q4_K_M, a 16,384-token context, digest `de878ce33ad8`), Ollama 0.40.11, RTX 3090 (GPU 1), 4 requests in parallel. Simulated members: population.js seed 7. Times are UTC.

The runs were made over the last day of work, so they span several commits: a run made before the commit named
above ran on the code of its own time (`git log` dates each commit). On the final code (a391aaa): the logs (`*.log`: unit, crash matrix, attacks, Messenger end to end, crash and resume), `redteam.json` and `autopilot_eval_signed2*` (the Autopilot over A2A with signed cards and holds, each week once: 8 of 8). At 1e3ffca: `contention_eval.json` and `contention_eval_a2a.json`. The Autopilot's three-times run (`autopilot_eval_final*`, over A2A, holds on) ran at aea88fe, before signed cards and the last booking fixes. `autopilot_eval_a2a*` and `persona_eval_a2a.json` ran over A2A at 48370d2, before holds.

| File | What it is | Made by | When |
|---|---|---|---|
| `autopilot_eval.json` | the Autopilot, 8 weeks, with the stop check | `node test/autopilot_eval.mjs data/autopilot_eval.json` | 2026-10-27 17:17 |
| `autopilot_eval_summary.json` | its summary | `(the same run)` | 2026-10-27 17:17 |
| `autopilot_eval_tokens.json` | its token ledger, by call site | `(the same run)` | 2026-10-27 17:17 |
| `autopilot_eval_before_stopcheck.json` | the Autopilot, 8 weeks, before the stop check | `(the same command, before the stop check)` | 2026-10-27 17:02 |
| `autopilot_eval_before_stopcheck_summary.json` | its summary | `(the same run)` | 2026-10-27 17:02 |
| `autopilot_eval_k3.json` | the Autopilot, 8 weeks three times each (pass^3) | `EVAL_REPEAT=3 node test/autopilot_eval.mjs data/autopilot_eval_k3.json` | 2026-10-27 17:59 |
| `autopilot_eval_k3_summary.json` | its summary, with pass^3 | `(the same run)` | 2026-10-27 17:59 |
| `autopilot_eval_k3_tokens.json` | its token ledger | `(the same run)` | 2026-10-27 17:59 |
| `persona_eval.json` | the members' rules, two arms, 60 talks each, with the acceptable sets graded | `node test/persona_eval.mjs data/persona_eval.json` | 2026-10-27 18:13 |
| `scale_eval.json` | the club from 11 to 1,001 members | `node test/scale_eval.mjs data/scale_eval.json` | 2026-10-27 18:18 |
| `redteam.json` | the adversarial suite | `node test/redteam.mjs` | 2026-10-27 23:11 |
| `cascade_raw.json` | the quick pick on 120 labeled decisions, three budgets | `node test/cascade_eval.mjs (the quick pick only)` | 2026-10-27 15:11 |
| `cascade_summary.json` | its analysis: accuracy with cluster-bootstrap intervals, the budget test, calibration, conformal thresholds | `node test/cascade_analysis.mjs data/cascade_raw.json data/cascade_summary.json` | 2026-10-27 16:58 |
| `budget_probe.json` | every call site at one reasoning budget, a few cases each | `node test/budget_probe.mjs` | 2026-10-27 14:44 |
| `glimmer_in_practice.json` | Muse Glimmer per call site over the evaluations' ledgers: calls, tokens, reasoning share, empty replies, replies that did not fit their schema, bad tool arguments, seconds | `node test/glimmer_report.mjs data/*-ledger.jsonl` | 2026-10-27 22:41 |
| `load_eval.json` | throughput at 1 to 16 talks at once, and the player's wait with and without the priority scheduler | `node test/load_eval.mjs data/load_eval.json` | 2026-10-27 18:39 |
| `private_eval_week.json` | private calendars against the shared view, a usual week | `node test/private_eval.mjs` | 2026-10-27 19:10 |
| `private_eval_all_first.json` | the same with a week free every day, first run (before listing every hour) | `PRIVATE_WEEK=all node test/private_eval.mjs` | 2026-10-27 19:20 |
| `private_eval_all_fixed.json` | the private arm again, listing every hour a game fits | `PRIVATE_WEEK=all PRIVATE_ARMS=private node test/private_eval.mjs` | 2026-10-27 19:30 |
| `scale_eval_first.json` | the club from 11 to 1,001 members, first run | `(the first run of scale_eval, before the population fix)` | 2026-10-27 18:13 |
| `autopilot_eval_a2a.json` | the Autopilot, 8 weeks three times each, the members' agents answering over A2A (JSON-RPC on a local port, with the token) | `EVAL_A2A=1 EVAL_REPEAT=3 node test/autopilot_eval.mjs data/autopilot_eval_a2a.json` | 2026-10-27 20:44 |
| `autopilot_eval_a2a_summary.json` | its summary, with pass^3 | `(the same run)` | 2026-10-27 20:44 |
| `autopilot_eval_a2a_tokens.json` | its token ledger | `(the same run)` | 2026-10-27 20:44 |
| `persona_eval_a2a.json` | the members' rules, two arms, 60 talks each, over A2A | `EVAL_A2A=1 node test/persona_eval.mjs data/persona_eval_a2a.json` | 2026-10-27 20:58 |
| `contention_eval.json` | two talks at once for one member, holds off and on: double agreements and games booked | `node test/contention_eval.mjs data/contention_eval.json` | 2026-10-27 22:25 |
| `contention_eval_a2a.json` | the same over A2A: the members' agents answer and hold over JSON-RPC | `EVAL_A2A=1 node test/contention_eval.mjs data/contention_eval_a2a.json` | 2026-10-27 22:41 |
| `autopilot_eval_signed2.json` | the Autopilot on the final code with signed Agent Cards: 8 weeks once each, over A2A | `EVAL_A2A=1 node test/autopilot_eval.mjs data/autopilot_eval_signed2.json` | 2026-10-27 23:29 |
| `autopilot_eval_signed2_summary.json` | its summary | `(the same run)` | 2026-10-27 23:29 |
| `autopilot_eval_final.json` | the Autopilot on the final code: 8 weeks three times each, over A2A, holds on | `EVAL_A2A=1 EVAL_REPEAT=3 node test/autopilot_eval.mjs data/autopilot_eval_final.json` | 2026-10-27 22:04 |
| `autopilot_eval_final_summary.json` | its summary, with pass^3 | `(the same run)` | 2026-10-27 22:04 |
| `autopilot_eval_final_tokens.json` | its token ledger | `(the same run)` | 2026-10-27 22:04 |
| `e2e.log` | the Messenger end-to-end test's output | `node test/e2e.mjs` | 2026-10-27 23:17 |
| `unit.log` | the unit tests' output | `node test/unit.mjs` | 2026-10-27 23:10 |
| `crash_matrix.log` | the crash matrix's output (SIGKILL at each durable step, a stand-in model) | `node test/crash_matrix.mjs` | 2026-10-27 23:10 |
| `redteam.log` | the adversarial suite's output | `node test/redteam.mjs` | 2026-10-27 23:11 |
| `a2a_resume.log` | the crash and resume test's output (the real model) | `node test/a2a_resume.mjs` | 2026-10-27 23:17 |
| `decider_probe.json` | what Ollama gives for one pass with no reasoning: raw generate with the next token's top 20, the begin-of-text token, the templated first token, the native decision request (on an A100) | `LLM_URL=http://127.0.0.1:11445/v1 node test/decider_probe.mjs data/decider_probe.json` | 2026-10-28 04:17 |
| `decider_dev_raw.json` | the one-pass decider's dev set (seed 11, 61 cases): five prompt variants and the full answer; RTX 3090 with the lock held, but `raw:habits` on an A100 | `DECIDER_SEED=11 DECIDER_MEMBERS=300 node test/decider_eval.mjs data/decider_dev_raw.json raw,rawall,full (and per variant)` | 2026-10-28 03:49 |
| `decider_dev_summary.json` | its analysis for the chosen variant; the latencies in docs/decider.md come from its 3090 rows | `node test/decider_analysis.mjs data/decider_dev_raw.json data/decider_dev_summary.json raw:habits` | 2026-10-28 04:26 |
| `decider_raw.json` | the decider against the full answer on seed 7 (196 cases, 152 members), on an A100: five variants, the variants without code's filter, the full answer | `LLM_URL=http://127.0.0.1:11445/v1 node test/decider_eval.mjs data/decider_raw.json raw,rawall,full (and per variant)` | 2026-10-28 03:55 |
| `decider_raw_full2.json` | the full answer again on the same cases, on a second A100 with the same model | `LLM_URL=http://127.0.0.1:11446/v1 node test/decider_eval.mjs data/decider_raw_full2.json full2` | 2026-10-28 04:26 |
| `decider_summary.json` | its analysis: agreement with cluster-bootstrap intervals, declines, preference hits, calibration, conformal thresholds, the cascade on held-out members | `node test/decider_analysis.mjs data/decider_raw.json,data/decider_raw_full2.json data/decider_summary.json raw:habits` | 2026-10-28 04:26 |

`manifest.json` has the same list.
