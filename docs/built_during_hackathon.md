# Built during the hackathon (Oct 27 – Nov 4, 2026)

**Everything in this repository was built during the hackathon.** Building started on October 27, the hackathon's
first day; the repository was restructured into its current layout on October 28 and 29, one commit per file, and
its history holds 1,198 commits up to November 2. Nothing here predates the event.

Where a part follows a published method, the paper is named. A paper is listed only when the code, `docs/`, the
technical report or our research notes cite it; where we could not tie a method to a paper, none is given.

**Agents and negotiation**
- **The player's agent and its helpers** (`agent/src/agents/`): Match asks first, Talk negotiates, Pace turns exercise
  load into scheduling limits. Following ReAct (Yao et al., ICLR 2023), the planner is a tool loop in which the model
  picks the next tool and code runs it with checked arguments (`autopilot.js`, `planner_tools.js`).
- **A2A negotiation** (`agent/src/a2a/`). Following the Agent2Agent (A2A) Protocol v1.0 (Linux Foundation) and its
  official JavaScript SDK, every member has an A2A agent with a signed Agent Card. Following the Contract Net Protocol
  (Smith, IEEE Transactions on Computers, 1980) and distributed constraint satisfaction (Yokoo et al., IEEE TKDE, 1998),
  a talk is one call for proposals settled by intersecting each agent's set of workable times. Facts only, never prose,
  cross between agents.
- **30-minute holds** (`a2a/talk.js`). Following leases (Gray and Cheriton, SOSP 1989) and resource ordering (Havender,
  IBM Systems Journal, 1968), an agreed time is held all-or-nothing, in a fixed order, so two talks cannot book one
  person twice.
- **Signed cards and a signed consent chain.** Following JSON Web Signature (RFC 7515) over the JSON Canonicalization
  Scheme (RFC 8785), cards and every yes are signed with Ed25519; each yes carries the hash of the one before.
- **Durable talks** (`agent/src/core/`): saved before every round, a message answered once, booking idempotent,
  following durable execution and Sagas (Garcia-Molina and Salem, 1987).
- **Fair venues** (`club/`): the venue whose longest trip is shortest (minimax), with sum and Nash product as options.
- **A venue's own agent** (`venues/agent.js`): an A2A agent per sports centre with a signed Agent Card and one skill,
  quote a court; each quote is signed with the venue's Ed25519 key, the venue checks its own last quote each round,
  and an outside venue can register its own agent with the maintainer's approval.
- **Each player decides what they pay** (`members/split.js`): a limit per player and an opt-in to cover more; the
  price is split equal first, a tight limit is covered only by those who offered, never past anyone's limit, and the
  group's agent never offers past what the limits can cover.
- **Asking by habit** (`members/taste.js`, `match/ask.js`). Following the Bradley-Terry model of paired comparisons
  (Bradley and Terry, Biometrika, 1952), each member's agent fits four weights (time, distance, price, a quiet court)
  from its person's own choices; the asking agent invites by that fit and by each agent's likelihood band.
- **Ranking times by everyone's chance of yes** (`match/timerank.js`). Following *Consensus vs. Dissent* (Waterschoot,
  Tintarev and Barile, RecSys 2026, [arXiv 2607.10235](https://arxiv.org/abs/2607.10235)), the product of chances with
  a least-misery floor.
- **The question worth most** (`match/voi.js`): a value-of-information question over Beta posteriors. Following Pep
  (Bose et al., 2026, [arXiv 2602.15012](https://arxiv.org/abs/2602.15012)) and VPL (Poddar et al., NeurIPS 2024,
  [arXiv 2408.10075](https://arxiv.org/abs/2408.10075)), an answer lends part of its count to hours that go together
  across people.
- **Likelihood bands** (`match/model.json`). Following Zadrozny and Elkan (2002), logistic regression with isotonic
  calibration, each member's agent answering only with a band.
- **When to ask** (`match/gate.js`). Following Thompson (Biometrika, 1933), ProPerSim (Kim et al., 2025,
  [arXiv 2509.21730](https://arxiv.org/abs/2509.21730)) and [arXiv 2410.04596](https://arxiv.org/abs/2410.04596), a
  Thompson-sampled send gate with a burden cost, under a weekly cap.
- **Preference records** (`memory/prefs.js`). Following Mem0 ([arXiv 2504.19413](https://arxiv.org/abs/2504.19413))
  and PersonaMem ([arXiv 2504.14225](https://arxiv.org/abs/2504.14225)), typed, dated records where the newest wins.
- **Memory by meaning, retrieval-augmented generation** (`memory/`, `body/context.js`): DRAMA vectors over short
  notes, the closest put in front of the model as cited facts; `/forget` deletes them.
- **Tool calls checked after the schema** (`core/toolcheck.js`). Following JSONSchemaBench
  ([arXiv 2501.10868](https://arxiv.org/abs/2501.10868)) and ReliabilityBench
  ([arXiv 2601.06112](https://arxiv.org/abs/2601.06112)), typed semantic checks, bounded repair and read-back.
- **Courts near you, judged ahead** (`club/places.js`). Following Speculative Actions
  ([arXiv 2510.04371](https://arxiv.org/abs/2510.04371)), the next hour's courts are judged in the background.
- **A second round with stretched limits** (`a2a/stretch.js`). Following CalBench
  ([arXiv 2605.09823](https://arxiv.org/abs/2605.09823)), graded costs instead of yes or no.
- **The invite card from one sentence** (`club/play.js`, `inviteDraft`): code reads a named day; Glimmer only reads
  what code cannot date.
- **The open door for outside agents** (`members/discovery.js`): the guide in the site's HTML, `/llms.txt` with a
  six-call quick start, the Agent Card, OpenAPI, Ed25519 agent keys, and the rule that an agent key can only tighten its
  person's limits (`403`, `needs: person`).
- **Club and games**: huddles, waitlists, no-shows without money (a 60-day half-life, calling off 3 hours before, 12
  hours to confirm), skill ratings with uncertainty, club feed, invite links, Messenger channel, live voice.

**The decision engine and our models**
- **The tiered decision engine** (`agents/`, `core/llm.js`). Following FrugalGPT (Chen, Zaharia and Zou, 2023,
  [arXiv 2305.05176](https://arxiv.org/abs/2305.05176)), a cascade cheapest first: code, the tiny classifier, our 1B,
  the one-token decider, Glimmer. Thresholds following conformal risk control (Angelopoulos et al.,
  [arXiv 2208.02814](https://arxiv.org/abs/2208.02814)).
- **Early exit from Glimmer's reasoning** (`agents/early.js`). Following DEER (Yang et al., 2025,
  [arXiv 2504.15895](https://arxiv.org/abs/2504.15895)), the options are read at each break and the first sure read
  stops the answer.
- **The one-token decider** (`agents/decider.js`): Glimmer's next token read as a probability per option.
- **The 27.6 KB time classifier and the feed prefilter** (`agents/tiny.js`, `feed/tiny_text.js`; trained by
  `distill/tiny_times.py` and `distill/tiny_mod.py`): small MLPs on facts code holds, each with a doubt model; the
  prefilter follows feature hashing (Weinberger et al., ICML 2009) with int8 logistic regression.
- **The distilled decision 1B** (`distill/`). Following knowledge distillation (Hinton, Vinyals and Dean, 2015,
  [arXiv 1503.02531](https://arxiv.org/abs/1503.02531)) we trained Llama 3.2 1B on 4,868 of Glimmer's choices as hard
  labels (soft labels at T = 2 were tried and not kept); following LoRA (Hu et al., ICLR 2022) we trained adapters of
  rank 16; following TypeSafe's Jev decision models (2026) the options are scored in one pass. Calibrated following
  temperature scaling (Guo et al., ICML 2017); int4 compared with its bf16 by McNemar's test (McNemar, Psychometrika,
  1947); quantized with llama.cpp. Round 4 graded the hardest cases against the majority of Glimmer's other answers
  (no paper cited for that).
- **The text 1B** (`distill/text_*`). LoRA SFT on 1,039 of Glimmer's short answers plus attacked copies. Following StruQ
  (Chen et al., [arXiv 2402.06363](https://arxiv.org/abs/2402.06363)), outside text arrives in a message of its own.
  Following SecAlign (Chen et al., [arXiv 2410.05451](https://arxiv.org/abs/2410.05451)) and Meta SecAlign (Chen et
  al., 2025, [arXiv 2507.02735](https://arxiv.org/abs/2507.02735)), a preference-training step (DPO, Rafailov et al.,
  NeurIPS 2023) was tried and not kept.
- **Routing by length** (`core/llm.js`): short calls to the text 1B at checked sites, long ones to Glimmer, very long
  ones to Muse Spark on the Meta Model API.
- **A learned intent router** (`match/router.js`, `match/router_head.json`): a softmax head on DRAMA vectors behind
  the regular expressions.

**Safety**
- **Least power per agent.** Following Meta's *Agents Rule of Two* (October 2025), design patterns for securing agents
  against prompt injection (Beurer-Kellner et al., [arXiv 2506.08837](https://arxiv.org/abs/2506.08837)), firewalls for
  agent networks (Abdelnabi et al., [arXiv 2502.01822](https://arxiv.org/abs/2502.01822)) and CaMeL
  ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)), no agent holds untrusted input, private data and the power to
  act at once.
- **Guards as one layer** (`agent/src/safety/`). Following Llama Guard (Inan et al., 2023) and the Llama Guard 3 and
  Prompt Guard 2 model cards: Prompt Guard 2 first, then Llama Guard 3, then code, with our own rules for how each
  fails and when a category counts.
- **CodeShield rules** from LlamaFirewall ([arXiv 2505.03574](https://arxiv.org/abs/2505.03574)) on community specs and
  generated code; the never-list (`docs/never.md`).
- **The red team** (`agent/test/redteam.mjs`): 93 attack cases named by the OWASP Top 10 for LLM Applications (2025);
  the crash matrix; the privacy disclosure budget.

**The community loop** (`agent/src/loop/`)
- Signals with no words; one sentence shared only with a yes, following Clio
  ([arXiv 2412.13678](https://arxiv.org/abs/2412.13678)) for minimum cluster sizes.
- Quadratic votes, following Lalley and Weyl (AEA Papers and Proceedings, 2018).
- Specs and classes, nine gates, canaries, and rollback by an anytime-valid e-process, following Ramdas, Grünwald, Vovk
  and Shafer (Statistical Science, 2023).
- A builder agent with read-only tests, following the lesson of the Darwin Gödel Machine
  ([arXiv 2505.22954](https://arxiv.org/abs/2505.22954)), which hacked its own evaluation, and AlphaEvolve
  ([arXiv 2506.13131](https://arxiv.org/abs/2506.13131)): keep a change only when evaluators pass it.

**Highlight reels** (`video/pose/`)
- The reel pipeline: person detection, the moment worth sharing from pose, the cut-out, slow motion, a checked caption.
- 3D replays with MapAnything ([arXiv 2509.13414](https://arxiv.org/abs/2509.13414)) and SAM 2 (Ravi et al., 2024),
  with our learned invented-pixel threshold and the presence check; Muse Wonder as a second opinion.
- RT-DETR (Zhao et al., CVPR 2024) as the default person detector, measured against DETR.

**Testing**
- **The tester swarm**: 177 AI testers over 28 rounds (`submission/agent_testing.md`, every report and request log).
- **Difficult simulated people and pass^k** (`agent/test/sim_users/`). Following τ-bench (Yao et al.,
  [arXiv 2406.12045](https://arxiv.org/abs/2406.12045)) for pass^k and the Sim2Real gap of simulated users
  ([arXiv 2603.11245](https://arxiv.org/abs/2603.11245)).
- **The order of options, measured.** Following Magentic Marketplace
  ([arXiv 2510.25779](https://arxiv.org/abs/2510.25779)), which found agents favour the first proposal.
- Offline unit suites, the Messenger end-to-end test, the planner evaluation (pass^3), the crash matrix.

**The rest**
- **The web app** (`web/`): React + Three.js + Vite, phone to laptop, light and dark.
- **Operations** (`ops/`): start scripts and a watchdog for the GPU server.
- **The technical report, slides, figures and this page** (`submission/`, `video/deck/`, `docs/`).
