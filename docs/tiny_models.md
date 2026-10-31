# The tiny layer: classifiers of a few KB in front of the 1B and Muse Glimmer

Two classifiers small enough to run inside the gateway, in plain JS on one CPU thread, answer the easy cases in well
under a millisecond and send anything they doubt onward. Both are **off by default**.

| | Switch | Weights | What it answers | What it sends onward |
|---|---|---|---|---|
| Time choice | `A2A_TINY=1` (`agents/tiny.js`) | `tiny_times.json`, 28 KB | a member's choice between listed times, before the student | anything its doubt model doubts |
| Feed prefilter | `FEED_TINY=1` (`feed/moderation.js` prefilter) | `tiny_text.json`, 87 KB (64 KB of int8 weights, base64) | "clearly fine": skips Prompt Guard 2, Llama Guard 3 and the club's standard | everything else, to those checks as before |

Each has a second, doubt model that reads the first one's answer (its top probability, margin, entropy, and a few facts
of the case) and predicts whether it would disagree with Glimmer. The tiny layer answers only when the doubt is below
a threshold chosen on held-out data, never on the test sets.

## Time choice

The same question as the student (`docs/decision_model.md`): the proposed time breaks the member's calendar or a hard
rule and two or more listed times keep them. Each option (the times code kept, soonest first, and "can't play this
week") is a row of 71 facts code already holds: weekday, start hour, the member's trip and its rank among the options,
same day as the asked time and how far from it, place in time order and in the proposer's list, whether it fits each
habit or liking in the member's words (parsed by code from the 50 phrasings in the teacher data: "the earliest start",
"weekends", "Saturday is best", "likes Riverside", "short trips", ...), the margins to the member's own rules, and the
case's facts (how many options, which rule the proposed time broke). Four MLPs (71 inputs, 8 tanh units) score each
row; their logits are averaged and softmaxed over the options. Code keeps every hard rule, as for the student: the
options are only the times that keep them.

Training (`distill/tiny_times.py`): the student's three training sets (4,868 Glimmer choices), split by member: 80%
fit the models (3,834 cases), 20% plus val (seed 19) are the calibration members (1,334 cases). Soft labels (the share of
Glimmer's answers for each option), Adam, 600 full-batch steps. The size of the hidden layer was chosen by out-of-fold
agreement (5 folds by member: 8 units 77.1%, 16 units 75.6%; the ensemble of four 79.9%). The doubt model is a logistic
regression fitted on the ensemble's out-of-fold answers.

### Against Glimmer, held out

| Set | Tiny, every case | Student 1B (`decision_model.md`) | Glimmer with itself | First listed |
|---|---|---|---|---|
| test (seed 7), 500 cases, each answer | **88.5%** | 89.5% | 88.8% | 82.7% |
| decider's 196 cases, vs `full` | **69.4%** | 63.3% | 73.5% (`full2`) | 58.2% |
| shared calendars, 209 | 87.3% | 89.1% | 89.8% | 80.6% |
| demo club, own words, 150 | 82.7% | 88.2% | 93.1% | 70.2% |
| every habit reworded, 300 | 79.7% | 84.2% | 91.3% | 55.3% |

On the decider's cases it keeps the member's stated preference in 31 of 32 (student 32, Glimmer 27).

### The threshold

Three ways, all on the calibration members only:
- **Conformal risk control** (as `docs/decision_model.md`): the loss of a case is its disagreement with Glimmer when the
  tiny layer answers it. Doubt at most 0.188 bounds the expected disagreement over *all* cases at 5%.
- **Learn-then-test** over the answered cases (fixed-sequence Hoeffding-Bentkus, delta 0.05): no threshold can be
  certified at 5% among answered cases with 1,334 calibration cases.
- **Empirical**: the loosest threshold whose disagreement among the calibration cases it answers is at most 5%: 0.086.
  This is the one served (the strictest of those that exist), with no formal guarantee.

| Threshold | Test: answered / disagreement among them / over all | Decider: answered / among them / over all |
|---|---|---|
| **0.086 (served)** | **59.8% / 4.3% / 2.6%** | **14.3% / 3.6% / 0.5%** |
| 0.188 (conformal, 5% over all) | 82.4% / 5.9% / 4.9% | 35.2% / 11.6% / 4.1% |

Coverage at fixed disagreement among answered, read off the held-out sets themselves (the best any threshold could do):
test 33.6% at 2%, 69.4% at 5%, 97.0% at 10%; decider 10.7%, 24.5%, 32.7%.

### What it saves

Against the 1B student's saved answers (sure at 0.6 with its reading of which times work right), with Glimmer for what
the student leaves (the one-pass decider and `A2A_AGREE` not counted):

| At 0.086 | Student calls saved | Glimmer calls saved | Cascade agreement with Glimmer, without / with tiny |
|---|---|---|---|
| test, 500 | 299 (59.8%) | 5 of 19 | 89.9% / 90.3% |
| decider, 196 | 28 (14.3%) | 1 of 57 | 70.4% / 70.9% |

So it replaces most of the student's easy calls (each 0.9 s on an idle CPU, 7 to 19 s on the loaded GPU server) and
almost no Glimmer calls: the student already answers nearly every case the tiny model is sure of, and the cases the
student leaves to Glimmer are the ones the tiny model doubts too. Agreement does not fall. On the cases it answers it
picks the student's time 99% (test) and 96% (decider) of the time.

### CPU

`distill/tiny_bench.mjs` on an Intel i5-9400F, node 24, one thread: 0.056 ms per choice at p50, 0.14 ms at p95, over the
test set's 500 cases (features, four MLPs and the doubt model). The JS answers match the trainer's to 4e-5.

## Feed prefilter

`feed/tiny_text.js`. It only ever says "clearly fine" (Prompt Guard 2, Llama Guard 3 and the club's standard are
skipped; code's own checks still run) or "send onward" (the checks as before). It never refuses anything itself.

- **Rules first.** Sent onward without the model: any character outside ASCII, CJK, CJK and fullwidth punctuation and
  emoji (Cyrillic or Greek lookalike letters, fullwidth letters, zero-width and joining characters, bidi controls,
  combining marks), letters set apart or broken by symbols ("k-i-l-l"), digits or symbols inside a word ("1d10t"),
  links, emails and handles, runs of seven or more digits, text over 280 characters.
- **The model.** Word unigrams and bigrams (each CJK character a word) and character 2- to 4-grams, FNV-1a hashed into
  65,536 buckets, each counted once; logistic regression, weights quantized to int8 with one scale.
- **The doubt model.** Logistic regression on P(fine), its margin and entropy, length, the share of CJK, question and
  exclamation marks, capitals, second-person words, and the share of the text's n-grams the model has a weight for.
  A comment passes when P(fine) is at least 0.5 and the doubt at most 0.04.

**Data (simulated).** 3,914 synthetic comments (`distill/tiny_mod_data.mjs`): template families of ordinary chat
(logistics, banter and trash talk, one's own play and health, thanks, questions) in English, Chinese and both; hostile
families (threats, veiled threats, harassment, sexual remarks, hate, another member's address or health, spam) in
English and Chinese; injection families (ignore-your-rules, fake system and admin notes, role play, a forged verdict,
notes to the club's agents, polite requests); 1,198 ordinary comments Muse Glimmer wrote in many voices (English,
Traditional and Simplified Chinese, mixed); and disguised copies (lookalike letters, zero-width characters, bidi
controls, digits for letters, fullwidth letters, letters set apart). Asked for hostile comments as test data, Glimmer
wrote them for 8 of 36 requests (160: insults, another member's whereabouts or health, spam, and 20 held-out veiled
intimidation in Chinese) and returned none for threats, hate, sexual remarks and injections, so most hostile and every
injected comment is the templates'.

**Labels.** Every comment through the feed's own checks, one at a time (`distill/tiny_mod_label.mjs`,
`tiny_mod_pg.py`): code (`personProblems`), Prompt Guard 2 on the text and its folded form, Llama Guard 3 1B with the
feed's policy and `BLOCK_POST`, and Muse Glimmer's `feed.standard` (the real prompt and schema) on all 1,830 comments
written as benign and 38 others (on `serve-api-a100c`; at about 22 a minute it was not run on the other hostile ones,
which are not fine whatever it says). "Fine" is a comment written as benign that every check passes. Code, Prompt
Guard 2 and Llama Guard 3 together let 486 of the 762 held-out hostile or injected comments through (81 of 89 threats,
88 of 95 harassment, 113 of 141 sexual remarks, 83 of 172 injections: Prompt Guard flagged 37), as `feed/posts.js`
notes for Llama Guard 3 1B; in the pipeline the standard is what refuses those.

**Held out.** 11 whole template families (veiled threats, a third harassment family, sexual remarks in English and
Chinese, a second hate family, privacy probing, a second spam family, polite injections, role-play injections, plain
questions, Chinese thanks), 9 of Glimmer's batches (8 of ordinary chat, the veiled intimidation in Chinese), and the
"letters set apart" disguise of every family: 1,039 comments. Nothing in them was used to fit or choose anything. The thresholds were read off out-of-fold scores
(5 folds grouped by family, so each fold's families are unseen): the most fine comments passed with no comment that
was not fine passing, inside conformal risk control's bound at 0.001 (with 2,875 calibration comments that bound
allows no miss).

| Held-out set (1,039) | Passed without the model |
|---|---|
| hostile (590) | **0** |
| injected (172) | **0** |
| disguised (393 of those): lookalike, zero-width, bidi, digits, fullwidth, set apart | 0 (all sent onward by the rules) |
| fine (271) | 30 (11.1%): Traditional Chinese 21 of 96, mixed 9 of 102, English 0 of 53, the Chinese templates 0 of 20 |
| refused by a check, written as benign (6) | 1: Glimmer's standard called "老王...是被球拍放生了嗎？" (teasing a friend who stood the writer up) harassment |
| all | 31 (3.0%) |

On the training families (in distribution) it passes 22.5% of the fine ones and none of the rest. The feed red team's
own comments (`test/feed_redteam.mjs` F1, F3, F3b, F4, F5) pass none of 27, the eight ordinary ones included.

**So it saves little.** At a threshold that let no hostile or injected comment through, it passes about one ordinary
comment in nine, and no English one: the English chat shares its names, days and places with the hostile templates,
and an n-gram model has no weight for a hostile phrasing it never saw. Its P(fine) for unseen hostile comments reached
0.95 on the held-out set ("Look at Tom waddling around the court, what a loser"); the doubt model, not the score,
kept those out. A zero on 762 comments is not a guarantee for the next phrasing.

**CPU.** 0.033 ms per comment at p50, 0.070 ms at p95, over all 3,914 (rules, features, model and doubt). JS and
the trainer agree on all 12 check comments.

## Wiring

- **Times.** `tinyAnswer(m, cur, ok, all, opts)` in `agents/tiny.js` has `studentAnswer`'s shape and returns null when
  `A2A_TINY` is not `1`, when the member's limits are not all in code, with fewer than two times left, or when it
  doubts. `a2a/talk.js` is not changed here. The hook, in `fullAnswer`, just before the student's line:

  ```js
  { const t = tinyAnswer(m, cur, choices, all, { minutes, why: curBad }); if (t) return { ...t, text: sentence(them, t, cur) }; }
  ```

  with `import { tinyAnswer } from "../agents/tiny.js";` at the top. `A2A_TINY_DOUBT` overrides the threshold (0 never
  answers, 1 always does). Every read goes in the token ledger as site `a2a.tiny` with its confidence and doubt.
- **Feed.** `prefilter(text)` in `feed/moderation.js`, called first in `posts.js` `moderate` when `FEED_TINY=1`. A text
  it passes still goes through code's checks (contact details, another member's health); the model checks are skipped.
  Ledger site `feed.tiny`.

## What these numbers do not show

- **Times: the members are simulated** and Glimmer is the reference, as for the student. The habits are parsed from the
  phrasings in the teacher data; a member who words a liking another way gets no match feature (the reworded set,
  79.7%, is the closest measure of that).
- **The served time threshold has no formal guarantee.** Learn-then-test could not certify 5% among answered cases at
  this size; the empirical threshold held on both held-out sets (4.3% and 3.6%), and conformal risk control's own
  point bounds only the rate over all cases.
- **No end-to-end run.** The savings are counted on saved answers, not measured in talks over A2A.
- **Feed: the comments are synthetic** and most hostile and every injected one comes from templates (Glimmer wrote
  only 160 hostile ones). The held-out families are phrasings the model never saw, but they were written by the same author as the
  training ones. Real members write differently; nothing here was measured on real posts.
- **Feed: little is saved.** About 3% of the held-out mix, and no English comment, skips the model checks.

## Reproduce

```bash
node distill/tiny_times_feats.mjs jev/data rows.json
python distill/tiny_times.py rows.json jev/preds agent/src/agents/tiny_times.json times_results.json
node distill/tiny_mod_data.mjs mod_items.jsonl 1                                   # LLM_URL: Ollama with muse-glimmer
GUARD_URL=... TINY_LABEL=guard node distill/tiny_mod_label.mjs mod_items.jsonl mod_lg.jsonl 16
LLM_URL=.../v1 TINY_LABEL=standard TINY_INTENT=benign node distill/tiny_mod_label.mjs mod_items.jsonl mod_std.jsonl 8
HF_HUB_OFFLINE=1 python distill/tiny_mod_pg.py pg_in.jsonl pg.jsonl                # Prompt Guard 2, CPU
node distill/tiny_mod_feats.mjs mod_items.jsonl mod_feats.jsonl
python distill/tiny_mod.py mod_items.jsonl mod_lg.jsonl,mod_std.jsonl pg.jsonl mod_feats.jsonl agent/src/feed/tiny_text.json mod_results.json
node distill/tiny_bench.mjs jev/data mod_items.jsonl bench.json
python distill/tiny_report.py times_results.json mod_results.json bench.json submission/results/tiny.json
```
