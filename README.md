# Serve

**Play more. Manage less.** A self-evolving agent-to-agent (A2A) platform that removes tedious group-chat coordination:
personal AI agents negotiate times, haggle court prices, check venue reviews and settle real-world plans with each
other, so each person only has to say **one yes**. Sport is the first proving ground, not the limit.

**Meta Global AI Developer Hackathon 2026** · **Indie Developer track (solo build)** · *Build for Your World* · built
October 27 to November 4, 2026

- 🎬 **Demo video (YouTube, 2:59):** https://youtu.be/OXlW1dznFo4

  [![Serve demo video: Play more. Manage less.](docs/readme/video_cover.jpg)](https://youtu.be/OXlW1dznFo4)

- 🚀 **Try it live:** https://play.theminimallab.com (instant demo sign-in, no Facebook account needed)
- 📄 **Technical report:** [submission/technical_report.md](submission/technical_report.md)
  ([PDF](submission/pdf/serve_technical_report.pdf)) · 📊 **Slides:**
  [submission/pdf/serve_technical_report_slides.pdf](submission/pdf/serve_technical_report_slides.pdf)
- 🤖 **For outside agents (`llms.txt` and MCP):** https://play.theminimallab.com/llms.txt

### At a glance (for judges)

| What Serve solves | How agents do the work | Meta AI under the hood | Proven and stress-tested |
|---|---|---|---|
| **No back-and-forth.** Hours of group chat become agents negotiating, and **one final yes** from each person. | **A2A v1.0 and federated clubs.** Agents trade signed facts, haggle venue fees within each person's limits, and ask first in Messenger. | **15 Meta models** on my own RTX 3090s and the Meta Model API, plus **3 Llama 3.2 1B models I trained** (`0.9 s` on a CPU, `89.5%` agreement with Glimmer). | **93 of 93** red-team attacks stopped (Agents Rule of Two), **177 AI testers** over 28 rounds (17,432 requests), and **self-evolving code** behind 9 gates. |

## Contents

- **[For judges: two ways in](#for-judges-two-ways-in)**
- **[Overview: why Serve exists and what a person sees](#overview)**
- **[How it works: the architecture and 16 measured parts](#how-it-works)** (full detail: [docs/how_it_works.md](docs/how_it_works.md))
- **[How this entry meets the judging criteria](#how-this-entry-meets-the-judging-criteria)**
  - [Impact (30%)](#impact-30) · [Use of Meta AI tooling (25%)](#use-of-meta-ai-tooling-25) · [Demo (25%)](#demo-25) · [Technical depth (20%)](#technical-depth-and-execution-20)
  - [Bonus: open weight models, agentic use-case, creative build](#bonus-best-build-on-open-weight-models)
- **[Results and models: real-world use, surprises, the model table](#real-world-use)**
- **[Run it yourself and the repository map](#run-it-yourself)**
- **[Limitations, roadmap and hackathon provenance](#limitations)**

---

## For judges: two ways in

### 1. Click through it in your browser (about 3 minutes, phone or desktop)

1. Open https://play.theminimallab.com/#/join, type a first name and press **Try a demo account** (no Facebook needed).
2. On the home page, tell your agent what you want, for example *"Badminton for 4, a weekday evening, near Daan,
   Taipei, at most NT$150 each"*. Code reads your request in milliseconds, sets your area and limits, and the cards
   show games near you.
3. Open **Games** and start a game: watch the agents' talk stream in (each member's agent answering over A2A, the
   venue's agent haggling the court with signed quotes), then the agreed time, court and **a fair split of the fee**.
4. On the agreed game, press **Check this place** for the venue report: its rating, review points quoted word for
   word (reviews are screened by **Prompt Guard 2** before any model reads them), prices and what groups paid there.
5. Open the demo club (**Try the demo club too** on the home page): simulated members, so a whole week of agents runs
   in a few minutes. After a game, your agent asks how the place was.
6. Anyone can check the record: https://play.theminimallab.com/api/trust/verify replays the signed hash chain of
   every yes.

### 2. Send your own outside agent (Claude, OpenAI Codex or Meta Muse)

Serve is built for other people's agents too. Point any agent at https://play.theminimallab.com/llms.txt, or connect
it as an MCP server ([§10](docs/how_it_works.md#10-an-open-door-for-outside-agents)):
`claude mcp add --transport http serve https://play.theminimallab.com/mcp`, or a custom connector with that address in
ChatGPT, Claude Desktop or Cursor.

- **Claude** (Claude Code):
  ```bash
  claude "Read https://play.theminimallab.com/llms.txt and use Serve to get me a badminton game for 4 on a weekday evening near Daan District, Taipei, at most NT\$150 each. My name is Kai. Tell me what I need to say yes to."
  ```
- **OpenAI** (Codex CLI, with network access on):
  ```bash
  codex "Read https://play.theminimallab.com/llms.txt and use Serve to get me a badminton game for 4 on a weekday evening near Daan District, Taipei, at most NT\$150 each. My name is Kai. Tell me what I need to say yes to."
  ```
- **Meta Muse** (Muse Spark on the Meta Model API, through my 60-line client with two tools, `serve_get` and
  `serve_post`; [agent/tools/muse_agent.mjs](agent/tools/muse_agent.mjs)):
  ```bash
  META_API_KEY=<your key> node agent/tools/muse_agent.mjs "Get me a badminton game for 4 on a weekday evening near Daan District, Taipei, at most NT\$150 each. My name is Kai."
  ```
  On a test gateway Muse Spark read `/llms.txt`, signed in, set its area, sport and fee limits, checked for nearby
  players, posted an open game, started a club and reported back: 16 calls on its own.

Each outside agent registers its own **Ed25519 key**. Code makes sure an outside agent can **only tighten** its
person's fee or travel limits: an attempt to loosen one returns `403 · needs: person`, and no game is ever booked
without the person's own yes.

---

## Overview

**Serve is a self-evolving A2A platform.** People's agents never exchange raw, untrusted text with each other: they
negotiate through Serve, the intermediary that checks who is speaking, what each agent may see and say, and what it
may agree to. **Prompt Guard 2** and **Llama Guard 3** screen what comes in and goes out, code keeps every hard rule,
every yes is signed into a hash chain, and no agent holds untrusted input, private data and the power to act at once
(**Meta's Agents Rule of Two**).

**The platform also evolves itself.** Members propose ideas in chat (`/idea`), **DRAMA** groups them by meaning,
members vote (quadratic voting), and a coding agent on **Muse Wonder** (falling back to **Muse Glimmer**) writes the
change. Every change passes **nine gates** before a canary, and rolls back on its own when feedback drops
([community loop](docs/how_it_works.md#7-a-community-that-evolves-the-platform-with-automatic-rollback)).

People don't quit the sport; they quit organizing it. Serve hands every tedious step to agents, so you only say yes
once:

| The tedious step | What Serve's agents do |
|---|---|
| **Who to ask** | Ranks the people most likely to say yes from each player's own habits: the times they play, how far they go, what they pay ([§2](docs/how_it_works.md#2-ranking-by-everyones-chance-of-yes-and-the-one-question-worth-most)) |
| **When** | Every player's agent negotiates over **A2A v1.0** in one round by intersection, and code holds the overlap for **30 minutes** so nobody is double-booked ([§1](docs/how_it_works.md#1-a2a-v10-facts-only-one-round-by-intersection-30-minute-holds)) |
| **Where** | The best court between everyone, from OpenStreetMap, the rain forecast and Google reviews screened by **Prompt Guard 2** and judged with cited sources by **Muse Glimmer** |
| **How much** | Haggles with the venue's own A2A agent through signed quotes, and splits the fee so no player goes past their own limit ([§11](docs/how_it_works.md#11-a-venues-own-agent-and-a-fair-split)) |
| **Asking first** | Learns your usual times and partners, keeps what you told your agent in **DRAMA** memory, and asks in Messenger: *"Thursday 19:00: Leo is free. Want a game?"* |
| **Stalled talks** | Asks the one question worth the most (value of information), which raised games found from **40.7% to 51.9%** |
| **Games between clubs** | Connects separate club servers through **federated A2A** with pinned, rotatable keys; **Muse Image** draws the rematch posters |

### The gap

Everyone is starting to get a personal AI agent that knows their calendar and their limits. But there is no safe,
standard place where four people's agents can agree a plan without leaking private calendars or falling for prompt
injection. So group plans still fall back to group chats, and the group chat goes quiet.

**Serve is that place.** Sport is the hardest everyday test I know: four busy weeks, travel, weather, a free court and
a split price all have to line up before a deadline.

![Four friends, four agents, no place for them to talk](docs/readme/gap.png)

The need is real. In Sport New Zealand's Active NZ survey (2023), adults named what stops them playing regularly:
times that are hard to fit around other commitments (64.2%), no way to keep the habit going (21.3%) and no regular
people to play with (10.2%) ([technical report, section 1](submission/technical_report.md#1-impact)).

### What a person sees

![On the web: a sentence becomes an invite, the players' agents agree the time, one tap books it. In Messenger (right): the same booking](docs/readme/flow.png)

1. **Say it once, or let your agent ask first.** Type *"Badminton Tuesday evening, need 1"* in the app or in
   Messenger. Or let **Match** ask first: it learns your usual times and partners and messages you when your usual
   slot is open and they are free.
2. **The agents find the court and agree the price.** Your agent checks the map, the forecast and everyone's trip,
   screens venue reviews with **Prompt Guard 2**, and negotiates over **A2A** with the other players' agents and the
   venue's agent, trading signed facts only (`{date, start, venue, court, trip, fee}`).
3. **One yes from each person.** Once the agents agree and code holds the time for 30 minutes, players tap **Join**
   (or **Yes** in Messenger). A friend without an account joins from a share link.
4. **After the game, a bonus highlight reel:** from one phone clip, **RT-DETR**, **Sapiens2**, **SAM 2.1** and
   **MapAnything** find the smash, cut the player out and render a frozen-time 3D orbit, with **Muse Wonder** checking
   the 3D frames. It is a clip to share, never coaching or scoring.

Serve handles no money: players pay the venue themselves, and no-shows are handled with waitlists and confirmations,
never deposits.

![The group-chat poll against one yes from each person](docs/readme/slide_group_chat_vs_one_yes.png)

---

## How it works

One rule throughout: **code computes the facts and keeps every hard rule; the models choose only among the valid
options left.** A model's mistake can't become a double booking, a broken budget or a booking without consent.

![My own GPU server, the Meta Model API where it helps](docs/readme/architecture.png)

One Node.js gateway (`agent/src/server.js`) runs every agent and streams each step to the app. The open-weight models
run on my own GPU server (two RTX 3090s), so players' data stays there; five models on the **Meta Model API** handle
live duplex voice, posters, very long calls, the builder and 3D frame checks. Full detail in
[docs/how_it_works.md](docs/how_it_works.md):

| Part | What it does | Measured |
|---|---|---|
| [1. A2A negotiation](docs/how_it_works.md#1-a2a-v10-facts-only-one-round-by-intersection-30-minute-holds) | Agents trade signed facts over A2A v1.0; one round by intersection; 30-minute all-or-nothing holds; federated A2A between clubs | Double bookings 11 of 12 → **0 of 12**; **20 of 20** crash-recovery checks; **22 of 22** checks between two gateways |
| [2. Who gets asked](docs/how_it_works.md#2-ranking-by-everyones-chance-of-yes-and-the-one-question-worth-most) | Each member's agent answers with a band of how likely a yes is; times ranked by everyone's chance; one value-of-information question when talks stall | First proposal keeps every rule 73.9% → **89.1%**; games found 40.7% → **51.9%** |
| [3. Cache and router](docs/how_it_works.md#3-cache-and-router-a-tiered-decision-engine) | Code (`7 ms`) → a `27.6 KB` classifier (`0.06 ms`) → a distilled 1B (`0.9 s`) → Muse Glimmer → Muse Spark | Game card in **7 ms**; **88.8%** of planner prompt tokens from cache |
| [4. Decision 1B](docs/how_it_works.md#4-our-own-model-a-llama-32-1b-distilled-from-muse-glimmer) | Llama 3.2 1B distilled with LoRA from 4,868 Glimmer choices, int4 on the CPU | **89.5%** agreement with Glimmer (Glimmer with itself 88.8%), **0.9 s** instead of 40 s |
| [5. Text and pruned 1B](docs/how_it_works.md#5-a-second-1b-for-short-text-hardened-against-attacks-it-never-saw) | A second 1B trained with attacked copies; a third pruned to 12 layers for four more sites | Unseen hostile comments let through 65 → **8 of 71**; the pruned 1B **1 of 142**, a court in **0.5 s** |
| [6. Security](docs/how_it_works.md#6-security-rule-of-two-two-guards-de-identification-a-signed-consent-chain) | Rule of Two, Prompt Guard 2 then Llama Guard 3, de-identification, a disclosure budget, a signed chain of every yes | **93 of 93** attacks stopped; what a probing agent pins down of a week 97.6% → **32.4%** |
| [7. Community loop](docs/how_it_works.md#7-a-community-that-evolves-the-platform-with-automatic-rollback) | `/idea` → DRAMA grouping → quadratic vote → Muse Wonder builds → nine gates → canary, rollback by an anytime-valid test | False rollbacks 22% → **0.6%** |
| [8. Highlight reels](docs/how_it_works.md#8-social-highlight-reels-a-bonus-after-the-game) | RT-DETR, Sapiens2, SAM 2.1 (cross-checked by SAM 3.1) and MapAnything; Muse Wonder checks 3D frames | 3D frame check precision **1.00**, recall 0.79; SAM 3.1 IoU **0.974** |
| [9. Testing](docs/how_it_works.md#9-testing-177-ai-testers-in-28-rounds) | 177 AI testers over 28 rounds, on the live site and a local copy | **17,432** requests; core-flow bugs **0** by round 25 |
| [10. Outside agents](docs/how_it_works.md#10-an-open-door-for-outside-agents) | `/llms.txt`, Ed25519 request signing and three MCP servers | An agent key can only tighten its person's limits |
| [11. Venue agents](docs/how_it_works.md#11-a-venues-own-agent-and-a-fair-split) | A venue's agent signs every quote; a fair split; a report on the place before booking | No one pays past their own limit |
| [12. Memory](docs/how_it_works.md#12-memory-retrieval-augmented-generation-rag) | Retrieval over DRAMA embeddings of short notes | Right note first **60%** (BM25 35%), in the top three 75%, MRR **0.696** |
| [13. Observability](docs/how_it_works.md#13-observability-every-agent-step-traced) | OpenTelemetry GenAI spans across A2A hops, a token ledger, failure attribution | Attribution right on **14 of 14** runs |
| [14. Agents' faces](docs/how_it_works.md#14-agents-faces-designed-with-muse-image) | Muse Image draws each agent and the rematch posters | |
| [15. Scale](docs/how_it_works.md#15-built-for-100000-agents-online-compute-is-whats-short) | An agent hub: an actor per agent, a bus, admission control | **99,892** agents online, **9,893** messages/s at `4 ms` p99 |
| [16. Privacy](docs/how_it_works.md#16-privacy-by-design-encrypted-at-rest-differential-privacy-conversation-memory-a-data-lifecycle) | AES-256-GCM at rest, crypto-shredding, local differential privacy for venue ratings | DP estimates within **2%** on 30,000 ratings |

<p>
<img src="docs/readme/slide_a2a_intersection.png" width="49%" alt="A2A v1.0: facts only, settled in one round by intersection">
<img src="docs/readme/slide_decision_tiers.png" width="49%" alt="Most decisions never reach the big model">
</p>

---

## How this entry meets the judging criteria

**Where the criteria come from.** The hackathon's participant guide
(https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) sets a pass/fail first stage, then scores each entry
from 0 to 10 on **Impact (30%)**, **Use of Meta AI Tooling (25%)**, **Demo (25%)** and **Technical Depth and Execution
(20%)**.

**The pass/fail gate.** Serve fits *Build for Your World* (it comes from the real chore of organizing weekly badminton)
and runs on Meta's open-weight models (**Muse Glimmer**, **Llama 3.2**, **Llama Guard 3**, **Prompt Guard 2**,
**DRAMA**, **Sapiens2**, **SAM 2.1**, **MapAnything**, **Omnilingual ASR**) and the **Meta Model API** (**Muse Spark**,
**Muse Wonder**, **Muse Voice Transcribe**, **Muse Image**, **SAM 3.1**).

**What Serve is not.** Serve is not a fitness tracker or a coach: it gives no medical or training advice. It gets
people onto a court together without the back-and-forth.

### Impact (30%)

**Vision: a self-evolving platform where personal agents coordinate the physical world.** Group plans rarely fail for
lack of interest; they fail on the friction of polling schedules, comparing venues and splitting costs in group chats.
Serve replaces that friction with a secure, federated A2A network, while each person stays in control through one
explicit yes. Recreational sport is the hardest, most frequent test; the same signed-fact negotiation and consent
chain carries over to volunteer shifts, study groups, carpools and local community plans.

- **Who it serves:**
  1. **Casual players and organizers** tired of chasing replies in group chats.
  2. **Sports clubs** that need to fill courts, match levels and challenge neighbouring clubs without merging their
     members' data.
  3. **Agent builders and developers** whose personal agents need a safe protocol (`/llms.txt`, MCP, A2A v1.0) to
     negotiate real-world plans for their person.
- **Real use during the 9-day build:** tested with **more than 10 players from a real badminton club**; of the
  **3 game invites** sent through Serve, **2 became games played on court within 3 days** ([Real-world use](#real-world-use)).

### Use of Meta AI tooling (25%)

- **Muse Glimmer (open weights, on my RTX 3090)** runs every agent: the planner's tool loop, court judging, reading
  what a person wants and the community's specs ([architecture](docs/how_it_works.md#architecture)).
- **Three Llama 3.2 1B models I trained:**
  1. **Decision 1B:** distilled from **4,868 Muse Glimmer choices**; agrees with Glimmer on **89.5%** of 500 held-out
     cases (Glimmer agrees with itself 88.8%), in **0.9 s on a CPU** instead of 40 s
     ([§4](docs/how_it_works.md#4-our-own-model-a-llama-32-1b-distilled-from-muse-glimmer)).
  2. **Text 1B, hardened against attacks:** cut unseen hostile or injected comments let through from **65 of 71 to
     8 of 71** ([§5](docs/how_it_works.md#5-a-second-1b-for-short-text-hardened-against-attacks-it-never-saw)).
  3. **Pruned 12-layer 1B:** pruned from 16 to 12 layers and distilled across four frequent sites; lets **1 of 142**
     unseen hostile comments through, a court verdict in **0.5 s**, with a Learn-then-Test certificate (α = 2%) for
     passing comments.
- **Prompt Guard 2 (86M) and Llama Guard 3 (1B)** screen Messenger, the club feed, community ideas and scraped Google
  Maps reviews under **Meta's Agents Rule of Two** ([§6](docs/how_it_works.md#6-security-rule-of-two-two-guards-de-identification-a-signed-consent-chain)).
- **Meta's DRAMA (`drama-base`)** is the agent's memory by meaning, and groups community `/idea` proposals
  ([§12](docs/how_it_works.md#12-memory-retrieval-augmented-generation-rag)).
- **Five Meta Model API models:** **Muse Wonder** (writes the platform's own changes and judges 3D frames), **Muse
  Spark 1.3** (very long calls and a fallback), **Muse Voice Transcribe** (live full-duplex voice with barge-in),
  **Muse Image** (agents' faces and rematch posters) and **SAM 3.1** (checks SAM 2.1's masks at `0.974` IoU).
- **Vision on my GPU:** **DETR**, **Sapiens2**, **SAM 2.1** and **MapAnything** turn a phone clip into a frozen-time
  3D highlight.

### Demo (25%)

- **A 2:59 video from start to end:** one organizer (Mia), from a one-sentence request through review screening, A2A
  negotiation of time and fee, Messenger asking first, an outside agent joining through `/llms.txt`, a 3D smash
  highlight and the platform's self-evolving gates: https://youtu.be/OXlW1dznFo4
- **A live site to try:** https://play.theminimallab.com, for people in a browser and for outside AI agents.
- **Tested by 177 AI testers:** over 28 rounds and **17,432 logged requests**, AI personas found edge cases that were
  fixed, with **0 core-flow bugs** by round 25 ([§9](docs/how_it_works.md#9-testing-177-ai-testers-in-28-rounds)).

### Technical depth and execution (20%)

- **Signed A2A v1.0 and federated clubs:** Ed25519-signed Agent Cards, proposals of structured facts only (no raw text
  crosses between agents), 30-minute holds that took double bookings from `11 of 12` to `0 of 12`, and pinned keys with
  checked rotation between club servers ([§1](docs/how_it_works.md#1-a2a-v10-facts-only-one-round-by-intersection-30-minute-holds)).
- **A tiered decision engine:** code (`7 ms`) → a `27.6 KB` linear classifier (`0.06 ms`, settling 59.8% of ordinary
  choices) → the distilled Llama 3.2 1B (`0.9 s` on a CPU) → Muse Glimmer (`20–40 s`), and the prompt stays the same
  size as a club grows ([§3](docs/how_it_works.md#3-cache-and-router-a-tiered-decision-engine)).
- **A disclosure budget:** stops a probing agent from mapping a person's week through repeated offers, cutting what it
  can pin down from **97.6% to 32.4%** ([§6](docs/how_it_works.md#6-security-rule-of-two-two-guards-de-identification-a-signed-consent-chain)).
- **Safe self-evolution with anytime-valid rollback:** members' proposals are built on their own branch, pass **nine
  gates**, and run on a canary watched by a sequential e-process test that cut false rollbacks from **22% to 0.6%**
  ([§7](docs/how_it_works.md#7-a-community-that-evolves-the-platform-with-automatic-rollback)).
- **Distillation, measured both ways:** twelve students for four Glimmer sites compared on held-out templates and
  attacks; a depth-pruned 12-layer 1B resisted attacks best, while merged per-site LoRAs (TIES, DARE) and GRPO with code
  rewards did not help ([§5](docs/how_it_works.md#the-second-round-four-more-sites-on-a-12-layer-1b)).

### Bonus: Best Build on Open Weight Models

Twelve open-weight models run on my two RTX 3090s and the server's CPU: **Muse Glimmer**, **the three Llama 3.2 1B
models I trained**, **Llama Guard 3 1B**, **Prompt Guard 2 86M**, **DRAMA**, **Omnilingual ASR**, **Sapiens2**, **SAM
2.1**, **DETR** and **MapAnything**, so players' video and activity data stay on my server. Every model I trained is
published with its weights, LoRA adapters, GGUF files, sha256 and a model card in [models/README.md](models/README.md).

### Bonus: Best Agentic Use-Case

Serve is a multi-agent system, not a chatbot:
1. **The person's planner and decider agents** (`get_week`, `check_limits`, `find_partners`, `find_places`,
   `negotiate`, `request_approval`, `nudge`, `finish`): **24 of 24** runs passed (pass^3 = 1) across 8 planned weeks
   ([submission/agent_eval.md](submission/agent_eval.md)).
2. **Venue A2A agents** that sign court quotes and offer quiet-hour prices.
3. **Outside personal agents** joining on their own through `/llms.txt` and MCP, with budget limits enforced by code.
4. **The self-evolving builder agent** that changes the platform's own code behind nine gates.

### Bonus: Best Creative Build

**Federated multi-agent coordination** for sport, plus **automated 3D frozen-time highlight reels** (Sapiens2, SAM
2.1, MapAnything, with Muse Wonder checking the frames) and **Muse Image** rematch posters, turns an ordinary amateur
club into a lively community.

### Submission items

| Item | Where |
|---|---|
| **New work only** | Everything was built during the hackathon (October 27 to November 4, 2026; more than 1,200 commits). Itemised: [docs/built_during_hackathon.md](docs/built_during_hackathon.md) |
| **Models used** | [Meta models used and where each runs](#meta-models-used-and-where-each-runs) |
| **Models trained** | Published with weights, model cards and sha256: [models/README.md](models/README.md) and the release [models-2026-11-01](https://github.com/gino6178/serve-meta-hackathon/releases/tag/models-2026-11-01) |
| **Setup and run** | [Run it yourself](#run-it-yourself) |
| **Builder** | Indie Developer track, solo ([gino6178](https://github.com/gino6178)) |
| **License** | Serve's code is [MIT](LICENSE); model and library licenses in [CREDITS.md](CREDITS.md) |

---

## Real-world use

During the 9-day hackathon **more than 10 players from a local badminton club** tried Serve. Of the **3 game invites**
sent through it, **2 became games played on court within 3 days**. Two players, in their own words (translated from
Chinese):

- *"It's actually really handy. You just talk to the agent."* (Player A)
- *"I think the way it suggests games first can make people more motivated to play."* (Player B)

The badminton club is real people. The built-in demo club, the evaluation clubs and the 177 AI testers are simulated,
and labelled as such in the app and the reports.

## What surprised me running 15 Meta models

![Four things that surprised me running Meta's models in a product](docs/readme/slide_surprises.png)

- **Muse Glimmer reasons even with thinking off.** Over 2,755 logged calls, **84%** of the tokens it wrote were
  reasoning, and **9%** of calls came back empty when the token budget was tight. Every call now asks for
  `think: "low"` with 900 tokens of room, and routine time choices go to my 1B student, which writes no text.
- **My distilled 1B agrees with Glimmer as often as Glimmer agrees with itself** (**89.5%** against **88.8%** on 500
  held-out cases).
- **Glimmer can decide in one token** (`0.53 s`, no reasoning), but mostly by reading the order of the list unless
  calibrated.
- **Llama Guard 3 once refused a test club named "Serve test round 27" as a violent threat**, fixed as described in
  [security](docs/how_it_works.md#6-security-rule-of-two-two-guards-de-identification-a-signed-consent-chain).

---

## Meta models used and where each runs

| Model | Where it runs | Its job in Serve |
|---|---|---|
| **Muse Glimmer** (open weights) | My RTX 3090 (GPU 1), Ollama, 4 requests in parallel | Every agent: the planner's tool loop, court judging with cited sources, reading requests, community specs, the builder's fallback |
| **Llama 3.2 1B Instruct, decision student** *(distilled by me)* | Server CPU, int4 Q4_K_M, 0.8 GB | Settles 54 to 67% of member agents' time decisions in about 0.9 s, writing no text |
| **Llama 3.2 1B Instruct, text student** *(distilled by me)* | Glimmer's Ollama | Short replies at six checked sites, hardened against prompt injection |
| **Llama 3.2 1B Instruct, pruned to 12 layers** *(pruned and distilled by me)* | Glimmer's Ollama, 1.2 GB | Comment verdicts, court verdicts, member agents' answers and requests to play, in 0.1 to 0.5 s |
| **Llama Guard 3 1B** | Server CPU | Both ways in Messenger, posts, comments and `/idea` wishes |
| **Prompt Guard 2 86M** | Server CPU | Untrusted text before any model reads it: Google Maps reviews, posts, `/idea` wishes |
| **DRAMA** (`drama-base`, 768-d) | Server CPU | Memory by meaning; grouping community `/idea` proposals |
| **Omnilingual ASR** (CTC 1B) | Server CPU | Voice notes in Messenger |
| **Sapiens2** (0.4B) | My RTX 3090 (GPU 0) | Pose per frame, to find the moment worth sharing |
| **SAM 2.1** (Hiera-L) | My RTX 3090 (GPU 0) | Tracks and cuts out the player for reels |
| **DETR** (ResNet-50) | My RTX 3090 (GPU 0) | Fallback person detector (RT-DETR, not Meta's, is the default) |
| **MapAnything** (Apache 2.0 weights) | My RTX 3090 (GPU 0) | Metric depth and the camera for 3D frozen-time replays |
| **Muse Wonder** | Meta Model API | Writes the community loop's changes; judges rendered 3D frames (87% agreement on 84 frames) |
| **Muse Spark 1.3** | Meta Model API | Calls of 12,000 tokens or more; a fallback when the GPU server can't take a call |
| **Muse Voice Transcribe** | Meta Model API | Live full-duplex voice with barge-in |
| **Muse Image** | Meta Model API | Agents' faces and rematch posters |
| **SAM 3.1** | Meta Model API | Cross-checks SAM 2.1's player masks (`0.974` IoU on a smash frame) |

Also from Meta: the **Agents Rule of Two**, **LlamaFirewall's CodeShield rules** (community-generated code) and the
**Messenger Platform** (signed webhook, Send API, Facebook and Instagram sign-in).

---

## Run it yourself

**1. Offline tests, no GPU or model weights** (Node.js 20+):

~~~sh
cd agent && npm install && npm test
~~~

The last saved run is in `submission/results/unit.log`; a few tests need Linux tools (`flock`) and skip elsewhere.
`npm run test:crash` runs the 20-of-20 crash-recovery matrix against a stand-in model.

**2. The web app, locally:**

~~~sh
cd web && npm install
npm run dev            # http://127.0.0.1:5191
~~~

`web/.env.local` sets `VITE_AGENT_URL` (the gateway) and `VITE_AGENT_TOKEN` (its token).

**3. The full GPU server** (Linux, a 24 GB NVIDIA GPU, Node.js 20+, Python 3):

~~~sh
mkdir -p serve/ollama && cd serve
cp -r <repo>/agent <repo>/video . && cp <repo>/ops/{serve,guard}.sh ollama/ && cp <repo>/ops/{start,up,watch}.sh .
(cd agent && npm install)
./start.sh                                             # Glimmer's Ollama (:11435), Llama Guard's Ollama (:11436) and the gateway (:8790)
OLLAMA_HOST=127.0.0.1:11435 ollama pull muse-glimmer   # Meta's open-weights model
OLLAMA_HOST=127.0.0.1:11436 ollama pull llama-guard3:1b
./up.sh                                                # watchdog: keeps them running
~~~

- `agent/.env` from `agent/.env.example`: `AGENT_TOKEN`, optionally `GOOGLE_MAPS_API_KEY`, the Messenger settings,
  and `MODEL_API_KEY` for the Meta Model API. Never commit `.env`.
- Prompt Guard 2 and DRAMA run through Hugging Face Transformers on the CPU; reels need a Python with torch
  (`REEL_PYTHON`), voice notes need Omnilingual ASR (`ASR_PYTHON`).
- The decision student is served by `distill/serve.sh` (llama-cpp-python, CPU); the text and pruned students by
  `distill/Modelfile.serve-1b-text` and `distill/Modelfile.serve-1b-text-v2` on Glimmer's Ollama.
- The evaluations that need Muse Glimmer are listed in [submission/results/README.md](submission/results/README.md).

## Repository map

| Path | What it holds |
|---|---|
| `web/` | React + Three.js + Vite app for phone, tablet and desktop, light and dark |
| `agent/src/server.js` | The gateway: HTTP API, streaming, Messenger webhook, A2A endpoints |
| `agent/src/a2a/` | A2A v1.0: the talk, Ed25519 Agent Cards, 30-minute holds, federated club peering |
| `agent/src/agents/` | The planner's tool loop, Match asking first, the tiered decider, the distilled 1B clients |
| `agent/src/match/` | Ranking by everyone's chance of yes, the value-of-information question, likelihood bands |
| `agent/src/members/` | Members' agent keys, limit checks that only tighten, the fair split (`split.js`), the real planner (`plan.js`), `/llms.txt`, the trust chain |
| `agent/src/venues/` | Venue A2A agents, signed quotes, the haggle, the report on a place before booking |
| `agent/src/club/` | The club, the instant invite reader (`play.js`), courts from OpenStreetMap and the forecast |
| `agent/src/loop/` | The community loop: `/idea` signals, DRAMA grouping, quadratic voting, the Muse Wonder builder, nine gates, canary rollback |
| `agent/src/safety/` | Prompt Guard 2, Llama Guard 3, the Rule of Two, the disclosure budget, de-identification |
| `agent/src/core/` | The model router (`llm.js`), token ledger, traces, AES-256-GCM encryption (`crypt.js`), local differential privacy (`dp.js`) |
| `agent/src/hub/`, `mcp/`, `tenants/` | The hub for 100,000 agents online, three MCP servers, the public proxy with its shield and the members' own gateways |
| `agent/src/feed/`, `memory/`, `media/`, `channels/`, `voice/` | Club feed, memory, reels/photos/voice notes, Messenger, live voice |
| `agent/test/` | Unit tests, end to end, red team, crash matrix, evaluations |
| `distill/` | Training, LoRA adapters, GGUF exports and evaluations for the three Llama 3.2 1B models |
| `ops/` | Start scripts for the GPU server |
| `video/pose/` | The highlight pipeline: RT-DETR/DETR, Sapiens2, SAM 2.1, MapAnything replays |
| `docs/` | Design and measurement notes per part; `docs/readme/` holds this page's images |
| `submission/` | Technical report, slides, evaluation logs (`submission/results/`) and the 28 rounds of AI tester reports |

## Limitations

- **Most validation is simulated.** Beyond one real badminton club (10+ people, 2 games played), the evidence comes
  from 177 AI testers, simulated clubs and local copies. Timings such as the 7 ms card were measured on a local copy.
- **The slow path still exists.** When the small models are unsure, a step falls back to Muse Glimmer and takes
  `20–40 s`; the steps stream to the screen, but it is still a wait.
- **Venues are samples.** No venue has registered its own A2A key yet, so quiet-hour prices are sample rate cards.
- **The community loop has not run on real members.** An idea shows once 5 different members ask for it, so with one
  small real club it has run on a simulated club so far.
- **3D replays are short.** Single-camera MapAnything orbits look right within about `±6° to 12°`; otherwise Serve
  falls back to a zoom.
- **The guards are one layer among several,** measured on small sets of my own messages, mostly in English.
- **DRAMA's weights are CC BY-NC 4.0,** so a commercial deployment would swap in another embedder; an Apache 2.0
  Granite embedding is benchmarked beside it in the [technical report](submission/technical_report.md).
- **Compute, not connections.** The agent hub holds 100,000 agents online (measured), but one RTX 3090 runs about 8
  talks a minute, so about 80 people's agents can think at once (an estimate).
- **Privacy has edges.** The model-call and trace logs stay unencrypted (kept 30 and 14 days), and a disk image
  together with the master key opens everything, so the key must be kept apart from the backups.

## Roadmap

1. **Muse Wonder diagnoses failures:** from writing the community's changes to explaining why one failed its gates.
2. **Beyond sport:** package the core that is not about sport (A2A intersection, the signed consent chain, the
   disclosure budget, the fair split) for dinners, study groups and volunteer shifts.
3. **Real venues:** connect local courts in Taipei through `POST /api/venues/agents`, so their prices replace the
   samples.
4. **More real clubs, and the community loop on real members.**
5. **100,000 people at once:** continuous batching (vLLM or SGLang), a database instead of JSON files and stateless
   gateways ([docs/scale_100k_research.md](docs/scale_100k_research.md)).

![9 days of real-world traction, and the road to production](docs/readme/slide_traction_roadmap.png)

---

## Built during the hackathon (Oct 27 – Nov 4, 2026)

**Everything in this repository was built during the hackathon**, with more than 1,200 commits since October 27.
Nothing here predates the event. Every part, with the published method it builds on:
[docs/built_during_hackathon.md](docs/built_during_hackathon.md).

## My trained models and where the numbers come from

All three Llama 3.2 1B models I trained (**Built with Llama**, Llama 3.2 Community License) are published with model
cards and sha256 in [models/README.md](models/README.md) and the GitHub Release
[models-2026-11-01](https://github.com/gino6178/serve-meta-hackathon/releases/tag/models-2026-11-01). Every number on
this page comes from [submission/technical_report.md](submission/technical_report.md),
[submission/agent_testing.md](submission/agent_testing.md), the raw files in `submission/results/` and the notes in
`docs/`.

## Credits and license

Serve's own code is under the [MIT License](LICENSE). The models, libraries and data it uses keep their own licenses,
listed in [CREDITS.md](CREDITS.md): among them Muse Glimmer (Apache 2.0), Llama 3.2 and Llama Guard 3 (Llama 3.2
Community License), Prompt Guard 2 (Llama 4 Community License), SAM 2.1, DETR, MapAnything (Apache 2.0 weights),
Omnilingual ASR (Apache 2.0), Sapiens2 (Sapiens2 License), DRAMA (CC BY-NC 4.0), the A2A JavaScript SDK (Apache 2.0),
map data © OpenStreetMap contributors (ODbL) and forecasts from Open-Meteo (CC BY 4.0). The sample highlight clip is
from Badminton klub Ljubljana (CC BY 3.0).
