# Serve: submission text

The long description for the submission form, in the order the judges score it: impact, Meta AI tooling, technical
depth, and the demo.

## Project name

Serve

## In one line

**Play more. Manage less.** A self-evolving sports social platform: your agent does the hassle of playing (the court,
the people, the match), and what the community asks for makes the platform better.

## Track, and the theme

Indie Developer · Build for Your World

## Impact: the problem

31% of adults worldwide did not get enough physical activity in 2022 (World Health Organization, 2024). Most people
who stop playing a sport don't stop liking it. Inertia wins, because finding a court, finding people and matching up
is a hassle:

- **Playing takes organizing.** A time that suits four people, a free court, somewhere everyone can reach. The group
  chat goes quiet and nobody plays.
- **Nobody pushes you.** One missed week becomes a month. Fitness apps count steps; none of them books the next game.
- **Life gets in the way.** A sore knee, a heavy week, rain on an outdoor court: the plan doesn't bend, so it's skipped.
- **Playing is better together**, and the best part is the people and showing it off afterwards.

Serve is a self-evolving sports social platform built against that inertia, on two ideas:
- **Your agent does the hassle.** It finds the court and the people, agrees the match with the other players' agents,
  plans around the body log, and waits for the player's yes.
- **The community makes the platform better.** Members' wishes become proposals, pass a safety review, and ship behind
  flags to a canary of members, with an automatic rollback when a change does harm; anything beyond a setting waits
  for a person. So far this is measured on a simulated club, not a real one.

It is for anyone who plays a ball sport for fun (badminton, tennis, pickleball, table tennis, basketball, volleyball,
soccer) and the clubs and friends they play with.

## What Serve does

The player's agent has three helpers that do the organizing: **Body** keeps the body log and
checks in on what hurts, **Match** notices when the player could play and asks first, and **Talk** takes the player's
yes to the other players' agents.

**Want a game?** Once a day the Match helper looks at the next three days for a time the player usually plays that is
still open. It checks the body log (a sore knee makes it doubles, a sore back a short game) and finds who plays best
with the player and is free then, with a free court. Then it asks, in the app or in Messenger, before it talks to
anyone: "Thursday 19:00: Leo is free, your games with Leo ran 29% past the booking. Want to play?" Muse Glimmer words
it from the facts and code checks it. There are three buttons. "Yes" sends the Talk helper to the other players'
agents: if they agree that time, it is booked, and if they move it, the player is asked once more. "Another time"
brings the next opening, and "Not this week" keeps it quiet until Monday.

**Autopilot.** "Line up my games this week." Muse Glimmer runs the week as a tool-using agent. It checks the week and
the body log, picks the times the player usually plays (habits learned from eight weeks of games), ranks the people
they play best with (games that ran past their booking mean the two clicked), and negotiates with those players'
agents, all three at once for doubles. Before it stops, code checks the stop: if a game is still needed and an open
time still has players free who weren't asked, the agent is told so and goes on. It asks once, in the app or with
buttons in Messenger, and books on a tap. On Monday mornings it runs by itself for players who switched it on.

**Agent to agent, on the A2A protocol.**
- Every club member's agent is an A2A agent (protocol v1.0, on the official SDK) with its own Agent Card. The player's
  agent sends each proposal with `SendMessage`.
- Each member's agent answers on Muse Glimmer, from what that member shares: yes, another of the listed times, or not
  this week. It also says which listed times work, and that is binding, so a game is usually agreed in the first round.
- A member's hard rules (a day they never play, the latest they finish, the longest trip) are kept by code before the
  model decides.
- Only facts and code-made sentences cross between agents. A member's agent never sees the other side's words, and the
  player's health limit never leaves.
- Every talk is saved before each round, and a "want a game?" talk cut off by a restart is picked up within 30
  minutes, without anyone answering twice.

**"I want to play": matchmaking.** The player writes "I want to play" or "anyone for doubles Thursday?" in Messenger.
Their agent asks up to twelve members' agents at once how likely a yes is, with a new A2A message (`serve.likely`)
declared in each signed Agent Card. Each member's agent works it out from its own member's records (how they answered
lately, how often and when they play, games with this player) and answers only with a band: unlikely, maybe, likely or
very likely. The records never leave it. The player's agent talks to the likely ones first, spreads the asks so the
same few members are not asked every time, and brings the agreed game back with Book it and Drop it buttons. Nothing
is booked before the tap. A real player's agent gives no band until they say `/bands on`, and `/forget` deletes the
records and turns it off again. The Autopilot and the Match helper use the same order.

**A result from a photo.** Send a photo of the scoreboard. Muse Glimmer reads each game's score into a JSON Schema
(text in the photo is never followed). For badminton, code checks it against the rules of the game, and the player
says which side they were before it is filed.

**Voice notes.** "My right shoulder is sore after smashing, four out of five", sent as a voice note in Messenger.
Meta's Omnilingual ASR hears it on the server, the player sees "I heard: …", and it is filed as if typed.

**Body log and health app.** "My right knee is sore after jumping, 3 out of 5." Muse Glimmer files it with one tool
call (part, side, level, what set it off) and it appears on a 3D body, on the side that hurts. The player can share
their health app's export (Apple Health, Google Fit, or a GPX, TCX or CSV file from any app), read on their own
server and deleted. Workouts are linked to booked games, so a game the watch says ran 132 minutes teaches the
Autopilot who the player clicks with. Code then works out the load (minutes × effort, this week against the last four)
and what to do: doubles first and no jump sports while a knee is sore, shorter games for a sore back, one game fewer
in a week over 1.5 times the usual, a check-in two days later, and a note that it is worth seeing a physio when the
same part keeps coming back. The page shows the activity trail (weeks by sport, every session, GPS routes) and a body
report whose summary Muse Glimmer writes with every number checked. It records and plans; it never diagnoses.

**Courts near you, any sport.** "Basketball courts near me tonight." Public courts, sports centres and parks come from
OpenStreetMap, with their Google Maps rating and reviews (when the server has a key), and the forecast for that hour
from Open-Meteo. Muse Glimmer judges each place, four at once: hoops or nets, lights for an evening game, a roof if
rain is likely, crowds, something broken or locked. Every reason cites the map, a review or the weather, and a quoted
review must be in that review word for word. The Autopilot uses it to put a basketball game on a free public court.

**Highlights.** Film a game on a phone, in any ball sport. On the player's own server, DETR finds them, Sapiens2 reads
their pose and SAM 2.1 cuts them out; the reel finds the moment (a racket's fastest swing, the top of a jump, a kick)
and replays it in slow motion with the player lit up. Muse Glimmer writes the caption, checked against the rallies,
and the share sheet sends it to Instagram or Facebook.

**The club.** A feed, a leaderboard (Elo) that every reported challenge moves, challenges, a random match drawn fairly
from members who are free, and the best match: fair by rating, free when the player is, and agreed agent to agent.

**In Messenger.** The same agent in the player's chats: plan the week, approve with a tap, a reminder an hour before,
a check-in after, what hurts, a health export shared into the chat, courts near a place, the body report. What the
player writes, and what a model writes for them, passes Llama Guard 3 first; a message about self-harm gets a reply
with a helpline.

**Memory.** What the player tells the agent is kept as short notes on their own server and found by meaning with
Meta's DRAMA. "Leave Tomás out for a while" still holds when the Autopilot plans a week two weeks later. `/forget`
deletes it.

**Ideas: the club improves the app.** With `/improve on`, the agent counts what works and what it could not do, with
no words. When it could not help, it offers to share the request as one sentence that code has checked, and nothing
leaves without the player's Share. Shared ideas are screened by Llama Guard 3, Prompt Guard 2 and code, grouped with
DRAMA, and voted on quadratically. Muse Glimmer drafts a spec from a group's summary; code classes it and checks it
against a never-list (no booking without a yes, no data off the server, no diagnosis, no weakening of `/forget`, no
edits to the tests). A setting inside its declared range ships to a canary of beta members and turns itself off when
the canary's thumbs down rise beyond chance or a hard rule breaks. Anything else waits for the maintainer; a coding
agent then builds it on a branch, and only a person merges it.

## The Meta AI it uses

| Meta model or product | Where it runs | What it does in Serve |
|---|---|---|
| **Muse Glimmer** (open weights) | Our GPU server: Ollama on one RTX 3090, 4 requests in parallel | Every agent: the Autopilot's tool loop (native tool calling); every member's agent deciding a proposal, in parallel, in a JSON Schema; reading a scoreboard photo (vision); reading what hurts into the body log; judging courts from map tags, reviews and the forecast; place names in English; the body report; highlight captions; reading "I want to play" into a request; the club's ideas paraphrased, summarized and drafted into specs; the coding agent that builds an approved spec on a branch |
| **Llama Guard 3 1B** (open weights) | Our GPU server's CPU, its own Ollama | What the player writes in Messenger, what a model writes for them, and every idea shared with the club |
| **Prompt Guard 2 86M** (open weights) | Our GPU server's CPU | Google reviews before the court judge reads them; every idea shared with the club |
| **DRAMA** (`drama-base`) | Our GPU server's CPU | Memory by meaning; grouping the club's ideas |
| **Omnilingual ASR** (open weights, CTC 1B) | Our GPU server's CPU | Voice notes in Messenger to text |
| **Sapiens2** (pose, 0.4B) | Our GPU server, Hugging Face Transformers | Every player's pose on every highlight frame; the reel's moment |
| **SAM 2.1** (Hiera-L) | Our GPU server, Hugging Face Transformers | Each player's outline, for the spotlight and the drawn view |
| **DETR** (ResNet-50) | Our GPU server, Hugging Face Transformers | Finds the player in their own video |
| **MapAnything** (Apache 2.0 weights) | Our GPU server; a prototype, not yet in the app | Metric depth and the camera for orbit replays of the player's moment |
| **Messenger Platform** | Signed webhook, Send API, quick replies | The agent in the player's chats |
| **Instagram, Facebook** | The phone's share sheet (no API) | The reel and its caption, shared by the player |

How it goes beyond a basic integration:

- **An agent, not a chatbot.** After code runs the first two steps (the week and the body log), Muse Glimmer picks each tool; code runs it with checked arguments and hands back the
  facts; a refused call comes back as a fact and the model re-plans. A step budget, and rules finish the plan if the
  model stalls; the trail shows which steps the model decided.
- **Many agents at once.** For doubles, three members' agents answer at the same time on four parallel slots of one GPU.
- **Checked before anyone sees it.** Numbers in model text must be in its facts (small counts excepted), a quoted
  review must be in that review, the days and times in a summary must be an agreed game's, and there is no he or she.
  A body report that fails is redrafted, then replaced by rules; other texts that fail go
  straight to a template.
- **Agents talk in facts.** Between agents go validated fields and code-made sentences, so an instruction hidden in
  another agent's message has nowhere to go. Each agent keeps to Meta's *Agents Rule of Two*: none combines untrusted
  input, private data and the power to act, and every booking needs the player's yes.
- **Code decides what the facts decide.** When a member's limits are all rules in code, the time that keeps them is
  the answer and the model is not asked. The model is left the real choices.
- **Guarded, and failing the right way.** Meta's Llama Guard 3 and Prompt Guard 2 run on the server's CPU. In chat a
  guard that is down is skipped and counted; in the community loop it holds every shared idea until it answers.
- **An app that improves from what its club says, with a person in the loop.** Code makes every decision; models write
  sentences that code checks; only a setting inside its declared range ships without a person, to a canary, with an
  automatic rollback.
- **Open weights on our own hardware.** With the default local model, video, voice, body log, health data and memory
  never go to a cloud model (what is shared in Messenger passes through Messenger).

## Technical depth

![Architecture](architecture.png)

Full details: `submission/technical_report.md` (all of it in one document), `docs/methods.md` (each pattern and what it
rests on), `docs/security.md` (the Rule of Two, the guards and the attacks), `docs/scale.md` (a simulated club of
1,000), `docs/community_loop.md` (the community loop), `docs/decider.md` (the one-pass decider, measured and left off)
and `docs/orbit_highlights.md` (the orbit prototype). The raw results behind the numbers are in `submission/results/`.

Test results on the current code (2026-10-28). Runs on a cloud A100 use the same Muse Glimmer build (the same model
digest) as our RTX 3090: `npm test` 239 of 240 with 1 skipped (seventeen offline suites, `submission/results/unit.log`); Messenger end
to end 52 of 52 checks (A100, `submission/results/e2e.log`; on the final code 46 passed and 0 failed before the run was stopped); 65 of 65 attacks stopped (A100,
`submission/results/redteam.log`), the community loop's 29 and its 5 controls among them; the crash matrix 20 of 20
(`submission/results/crash_matrix.log`); "I want to play" in Messenger 13 of 13 checks (A100,
`docs/agent_matchmaking_plan.md`).

- **One gateway.** A Node.js gateway on the GPU server runs every agent and streams each step to the app as NDJSON.
  Muse Glimmer runs on GPU 1, DETR, Sapiens2 and SAM 2.1 on GPU 0, and Omnilingual ASR, Llama Guard 3, Prompt Guard 2
  and DRAMA on the CPU. Every API call except the status check needs the gateway's token.
- **A2A, durable.** Each member's agent has an Agent Card and answers in a task that ends with a decision artifact. A
  talk is checkpointed before every round, and a repeated message is answered from the saved answer only if it carries
  the same proposal. Results go through an outbox, and booking is idempotent. Killed with SIGKILL at each of five
  durable steps of a "want a game?" talk, the gateway resumes, books the game exactly once, and no message is decided twice
  (`agent/test/crash_matrix.mjs`, which needs no GPU).
- **Security, tested.** 65 of 65 attacks stopped (`agent/test/redteam.mjs`, on a cloud A100):
  - injected instructions in a proposal's fields, and a replayed message with other times;
  - a proposer that lies about the trip, and holds meant to block a member's week;
  - an Agent Card changed after it was signed, one not signed, and one that sends its messages elsewhere;
  - hostile agents answering yours, and an agent that never answers;
  - the gateway's token sent to another server, cross-site requests, files from elsewhere;
  - ten poisoned reviews in front of the court judge: none turned its verdict to "good", and no link reached the player;
  - 29 against the community loop: an injected idea, sock-puppet votes, cluster poisoning, a required guard that is
    down or switched off, a class forged as C0, and diffs that edit the tests, add an outbound host, a dependency or
    tracking, weaken `/forget`, or book without the player's yes; plus the loop's five controls, which check that plain
    changes still get through.
- **Measured costs.** A token ledger logs every model call by call site: prompt, cached, output, reasoning, seconds and
  trace. Replies come in JSON Schemas, checked again in code; a reply that never fits is no answer, never a yes.
  OpenTelemetry traces follow the GenAI conventions, and the trace context travels inside each A2A message, so one
  negotiation across every agent is one trace.
- **Scale, simulated.** Members are found by code, and the model reads the few best.
  - An Autopilot week reads 18,063 prompt tokens with the 11 demo members and 19,543 with 290 simulated members more.
  - Putting the whole club in the prompt costs about 58 tokens a member, and stops fitting the model's context past
    about 270 members.
- **Private calendars** (`A2A_PRIVATE=1`). The members' weeks stay with their agents: your agent proposes from your
  own week, and each member's agent checks its own calendar and rules. On the same 50 talks, with a week free every
  day, both modes agreed 42 of 42 possible, and your agent saw none of the members' free hours, at 96 model calls
  against 50 (`submission/results/private_eval_exact_all.json`). Held to the exact answer, private calendars agreed the
  player's best time in 32 of 34 talks of a usual week and 35 of 42 of a week free every day (the shared view: 34 of
  34 and 39 of 42; `private_eval_exact.json`, `private_eval_exact_all.json`).
- **Matchmaking, on simulated members** (`docs/agent_matchmaking_plan.md`). Through the real negotiation code on 300
  requests, the shipped defaults got 132 games from 534 talks where the earlier ranking got 116 from 651: 4.05
  against 5.61 talks per game, 28% fewer (section 12, `match_eval_n300_defaults.json`). The shipped model is
  calibrated (Brier 0.152, ECE 0.024, every band inside its range); the asker's reliability added little and is off by
  default. Fair exposure, a club setting, costs 8% more asks and cuts the members never asked from 18% to 7.5%. A
  member who shares the exact chance saves 3.5% to 10% of asks, at a cost in
  fairness. Retraining on consenting members' records installs a new model only past a calibration gate (section
  12). Where it did not win: with Muse Glimmer deciding every talk, on 23 requests, bands got 17 games against 19, too
  few to separate the two; and asking two members at once for a game today made 6 games against 10.
- **Routing by facts.** Over the Autopilot's eight weeks on the RTX 3090, routing cut the members' model answers from
  5.4 a week to 1.2 and 1.4, and all model calls from 13.8 and 12.9 to 8.8 and 9.8, with 8 of 8 weeks reaching the
  goal in every run. The week was only 10 to 19% faster: the answer left is the one it waits for.
- **Memory by meaning.** Over 20 planning questions, DRAMA on the CPU reached a Recall@1 of 0.60 (BM25: 0.35). A
  week in which the player had asked to leave Tomás out left him out in 3 of 3 runs with memory on, 0 of 3 with it off.
- **Guard models** (`docs/security.md`; from `node test/guard_eval.mjs` on 2026-10-28, whose raw output stayed on the
  server and is not in `submission/results/`). On the server's CPU, Llama Guard 3 1B refused 37 of 42 unsafe test messages
  and 1 of 74 benign ones, and gave the helpline to 7 of 7 self-harm messages. Because S6 now needs a dose or a
  diagnosis that code also finds, it replaced none of 21 ordinary answers about an injury (6 of 21 before) and all 16
  diagnoses and doses. Prompt Guard 2 left out 4 of the 10 poisoned reviews and none of 20 ordinary ones.
- **The community loop, on a simulated club** (members and requests generated by code, seed 7; the pipeline, gates and
  rollback are real; `submission/results/loop_eval.json`). 60 members sent 88 messages, among them an injection, a data
  export, a booking without a yes, a sock puppet and two poisoned items; none of the hostile ones reached a spec.
  "Ask about games later in the day" shipped as a setting to 5 canary members, whose thumbs down went from 29% to 23%
  over 7 days, and was promoted. A planted bad setting went to a canary of 8; the monitor called a soft breach and
  it rolled itself back. With Llama Guard down, all 73 shared items were held: 62 waiting for the guard, 11
  stopped by code.
- **The coding agent.** On six harmless specs, on cloud A100s, it passed 18 of 18 builds by their first oracles, at a
  median of 5 steps, 27,934 tokens and 1.2 minutes. A stricter oracle for the one two-file change failed all its
  branches; rebuilt against it, that spec passed 3 of 3 within three attempts, none on the first. In 43 builds it never
  tried to write a test, a never-list file or a file outside its spec.
- **Measured and left off.** A one-pass decider reads Muse Glimmer's choice from one token with no reasoning: 0.53 s
  against 40.4 s on the RTX 3090. It agreed with the full answer 62.2% of the time, where the full answer agrees with
  itself 73.5%, and the gap's interval leaves out zero, so it stays off (`docs/decider.md`). Orbit replays with
  MapAnything look right only for short arcs, so the zoom stays the default (`docs/orbit_highlights.md`).
- **Who goes first.** One GPU tops out at about 8 talks a minute, so the gateway queues model calls itself: what a
  player is waiting on goes before background work. With 8 talks in the background, a player's own talk took 42.9 s
  at p95 instead of 111.3 s.
- **Two talks at once.** Two players' agents asking one member for the same evening at the same moment: without
  holds, 11 of 12 pairs agreed the member twice (the booking caught it, 11 games refused); with holds, none did, and
  23 of 24 games were booked at about the same cost. Over A2A: 12 of 12 without holds, none with them, all 24 booked.
- **Members' rules.** 60 simulated members' agents were each asked for a time that breaks one of their member's
  rules. With the rule only in its words, Muse Glimmer broke it once (a 21-minute trip for a member who travels 20 at
  most). Serve also keeps hard rules in code, which makes that impossible (0 of 60) and halves the model calls (31
  against 61). Run again over A2A, neither arm broke a rule (0 of 60 each), at 61 and 32 calls.
- **Measured on our server.** The Autopilot (`submission/agent_eval.md`): eight weeks, each run three times, on the final code, with the members' agents answering over A2A (JSON-RPC with the token, `EVAL_A2A=1`) and holds on. All 24 runs passed the every-week checks and each week's own oracle, so every week passed every time (pass^3 = 1.0). A run took 108 s on average, with 13.8 Muse Glimmer calls and 9.3 tool calls. The model finished 23 runs itself; in 1, rules finished the plan after the model stopped calling tools. Over A2A before holds it also passed 24 of 24, all finished by the model. An earlier run passed 7 of 8. The Messenger end-to-end
  test: 52 checks, all passing, with Muse Glimmer on a cloud A100. It drives the real gateway against a fake Graph API,
  covering linking, "want a game?", the Autopilot with a tap that books, reminders and check-ins, what hurts (typed and
  as a voice note), a health export, a scoreboard photo, `/report`, a violent threat refused and a self-harm message
  given the helpline, the loop's `/improve on`, `/idea` and Share, feedback, `/forget` (which deletes the loop's data
  too), and the token and cross-site checks.
- Messenger is live on a real Facebook Page through a signed webhook. The webhook has its own local port, so only it
  is reachable through the tunnel.

## Limits

- **Who finished the plan.** pass^3 = 1.0 counts a run whether the model or the rules finished the plan. In 1 of the
  3 three-game runs the rules finished it. Counting only runs the model finished itself, 7 of 8 weeks passed every
  time.
- **What the attacks test.** Two of the 65 cases (the poisoned reviews) put an attack in front of Muse Glimmer, and
  three pass through the guard models as well as code. The other 60 test a layer in code (a schema, the token, a file
  check, the loop's policy), so they pass by construction once the layer is there.
- **The community loop is measured on a simulated club.** It shows that the pipeline does what it was built to do with
  these inputs, not how real members would talk, vote or react. Short sentences group imperfectly, and no full run of
  all nine gates with the GPU suites is in a results file yet.
- **The guards are one layer.** Llama Guard 3 1B let 5 of 42 unsafe test messages through, and Prompt Guard 2 missed
  6 of 10 poisoned reviews. The sets are ours, small and mostly in English.
- **Matchmaking is measured on simulated members only.** The bands come from demo and simulated members' records, and
  the model is trained on simulated logs; real players can opt in (`/bands on`), but none has yet.
- **DRAMA's weights are CC BY-NC 4.0,** so memory and the loop's grouping would need another embedder for commercial
  use.
- **Private calendars are private in the talk only.** With `A2A_PRIVATE=1` your agent proposes from your week and
  each member's agent checks its own calendar. The Match helper and the Autopilot still read the club's shared
  calendars.
- **Holds last 30 minutes.** A member's agent holds an agreed time for 30 minutes while the player decides. For a
  plan left longer, the booking checks again: nobody is booked into two games, but the player may have to pick again
  (`docs/security.md`).
- **One gateway.** Every member's agent is served by this gateway; a federated club would need a credential per
  agent.

## Demo data

The club, its members, venues, prices and free times are made up and labelled as a demo. The demo town sits on Taipei,
so courts and parks near the members are real places from OpenStreetMap. The sample health export is made up and
labelled as a sample; its runs follow a real riverside bikeway.

## What's next

- In progress, with no results yet: a small decision model (Llama 3.2 3B in int4) distilled from Muse Glimmer's full
  answers; and web views for private calendars, the guards' verdicts in traces, the server's memory, holds and
  highlight effects.
- Orbit replays in the app, for the moments where the decision allows them.
- Muse Spark and SAM 3.1 through the Meta Model API (tracking in any uploaded video, blurring bystanders before
  sharing), and Muse Image share cards.
- Real venue booking adapters, and a phone shortcut that sends health data to the agent every day.

## The team

Indie Developer track, one member.

## Where to find it

- Code: https://github.com/gino6178/serve-meta-hackathon
