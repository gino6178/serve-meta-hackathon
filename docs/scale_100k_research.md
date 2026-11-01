# Scaling Serve to 100,000 concurrent users and agents

Research notes, November 2026. This covers what breaks first in Serve's current design, how open-source projects handle many agents and connections, what LLM serving looks like at this load, and a phased plan. Every outside number names its source. Our own estimates say they are estimates and show the arithmetic. Serve's measured numbers come from `README.md` and `docs/scale.md`.

## 1. What breaks first

Serve today runs one Node.js gateway (`agent/src/server.js`) on one home server with two RTX 3090s. State lives in JSON files (`agent/src/core/jsonfile.js`), and a tenants proxy (`agent/src/tenants/proxy.js`) starts one gateway process per invited player from port 8800. A Cloudflare tunnel sits in front. Here is the order in which things fail as load grows, worst first.

| Component | Today | Where it breaks | Why |
|---|---|---|---|
| Model throughput | Glimmer on one 3090 with 4 Ollama slots. About 8 talks a minute at most (`docs/scale.md`, "One GPU, many players"); a call takes 20 to 40 s | Around a hundred active users per GPU (estimate below) | Serving is limited by GPU tokens per second, and Ollama's fixed slots don't batch continuously |
| Per-tenant processes | One Node process per player, `TENANT_MAX` = 12 running at once, ports from 8800 | Well before 100k. A port range from 8800 up has fewer than 57,000 ports (65,535 − 8,800), and one OS process per user costs memory even when idle | A process per user is the opposite of what the actor systems below do: they keep idle agents as rows, not processes |
| JSON-file state | `writeJSON` rewrites the whole file with `fs.writeFileSync` and then renames it | Tens to hundreds of writes a second | Each write is synchronous, so it blocks the event loop, and its cost grows with file size. Separate tenant processes have no lock between them, so concurrent writers can lose updates |
| Connections | One Node process holds the browser streams (NDJSON) and the voice WebSockets | Around 10^5 sockets on one box, depending on the library (sources in section 2) | Socket.IO topped out near 120K connections on one box in Evil Martians' test, while uWebSockets.js has shown 1M |
| A2A fan-out | A doubles talk means 1 host and 3 members. Each round needs a proposal to each member, then holds, then booking (`README.md` §1) | Not first. Measured at 185 ms per cross-machine hop (`README.md` §1) | Each message is small JSON-RPC. The cost is the model call it may trigger and the signature check, which can be cached per card |
| Single site | One home server, one tunnel, one watchdog | Any outage takes the whole service down | There is nowhere to fail over to |

### Back-of-envelope load at 100k concurrent (estimate)

Assumptions (ours, not measured on real users):
- 100,000 users online at once, each with an agent that makes model calls after code and the tiny classifier have taken what they can.
- Three activity levels, measured in model calls that actually reach an LLM: light is one call per user every 5 minutes, medium every 60 s, heavy every 15 s.
- Tokens per call come from Serve's own measurements. An average call reads about 1,500 prompt tokens: 1,505 with 11 members and 1,563 with 301 (`docs/scale.md`). It writes about 500 tokens: the persona eval's code arm wrote 17,631 tokens in 31 calls, about 569 each, and Glimmer with early exit averages 420 (`README.md` §3).
- 88.8% of prompt tokens are prefix-cache hits, as measured over 302 planner calls (`README.md` §3).

| Activity | Model calls/s | Prompt tokens/s | Uncached prefill tokens/s (11.2%) | Output tokens/s |
|---|---|---|---|---|
| Light (1 per 5 min) | 100,000 / 300 = 333 | 333 × 1,500 = 0.5M | 56k | 333 × 500 = 167k |
| Medium (1 per 60 s) | 100,000 / 60 = 1,667 | 2.5M | 280k | 833k |
| Heavy (1 per 15 s) | 100,000 / 15 = 6,667 | 10M | 1.12M | 3.33M |

Negotiations, with our assumption that each online user starts one talk every 30 minutes: 100,000 / 1,800 ≈ 56 talks/s. With about 10 A2A JSON-RPC requests per doubles talk (3 proposals, 3 holds, 3 confirmations and a booking, from the flow in `README.md` §1), that comes to about 560 A2A requests/s. That load is trivial for HTTP. The model calls behind it are not: at Serve's measured 8 talks a minute per 3090, 56 talks/s is 3,360 talks a minute, which would need about 420 RTX 3090s running Ollama as it runs today (estimate: 3,360 / 8).

Today's ceiling, worked the same way: if each user starts a talk every 10 minutes, one 3090 at 8 talks a minute serves about 80 concurrent users (8 × 10). Both GPUs together serve about 160, plus whatever the hosted Muse Spark lane absorbs.

## 2. How open-source projects handle many agents and connections

| Project | Pattern | Scale claim (as the source states it) | Link |
|---|---|---|---|
| A2A protocol, JS SDK, samples | One request handler per transport. Task store and push-notification store are pluggable interfaces; the default store is in memory | No scale claim. Horizontal scale depends on replacing `InMemoryTaskStore` with a shared store ([Strands A2A server docs](https://strandsagents.com/docs/user-guide/sdk/multi-agent/a2a-server-configuration/)). The Elixir SDK advises SSRF allowlists for push webhooks ([a2a_ex](https://readme.hex.pm/a2a_ex/0.1.1)) | https://github.com/a2aproject/A2A, https://github.com/a2aproject/a2a-js, https://github.com/a2aproject/a2a-samples |
| LangGraph Server (now "LangSmith Deployment") | Stateless API instances. Postgres holds all durable state, Redis is the task queue and pub/sub, workers heartbeat, and a sweeper requeues runs every 2 minutes | "Each instance of the service is stateless"; any instance can serve a stream or cancel request ([docs](https://langchain-ai.github.io/langgraph/concepts/scalability_and_resilience)). No published numbers | https://github.com/langchain-ai/langgraph |
| OpenAI Agents SDK | Stateless runner. Conversation state lives in pluggable sessions (SQLite, SQLAlchemy/Postgres) | No scale claim ([sessions docs](https://openai.github.io/openai-agents-python/sessions/)) | https://github.com/openai/openai-agents-python |
| Temporal + OpenAI Agents SDK | Each agent run is a durable workflow and each model call is an activity, so it is retried and survives a crash | Durability rather than numbers ([Temporal docs](https://docs.temporal.io/develop/python/integrations/openai-agents)) | https://github.com/temporalio/sdk-python |
| Letta (MemGPT) | All agent state in Postgres (`LETTA_PG_URI`). Stateless server pods scale out | "Can also be horizontally scaled (e.g. run on multiple pods within a Kubernetes cluster)" ([docs](https://docs.letta.com/guides/selfhosting/performance)); Aurora case study ([AWS](https://aws.amazon.com/blogs/database/how-letta-builds-production-ready-ai-agents-with-amazon-aurora-postgresql)) | https://github.com/letta-ai/letta |
| AutoGen distributed runtime | gRPC host service routes messages between worker runtimes that host the agents; cross-language messages use protobuf | Marked experimental, no numbers ([docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/distributed-agent-runtime.html)) | https://github.com/microsoft/autogen |
| CrewAI Flows | Flow as the unit of work, `kickoff_async` for concurrency, `@persist` to save state and resume | No numbers ([docs](https://docs.crewai.com/en/concepts/production-architecture)) | https://github.com/crewAIInc/crewAI |
| Ray Serve | Each agent, tool and LLM is an independently autoscaling deployment; Ray actors hold state | Anyscale's template scales 1 to 20 replicas at a target of 5 in-flight requests each ([Anyscale](https://anyscale.com/blog/ai-agents-on-ray-serve-single-to-multi-agent-architecture), [Ray LLM docs](https://docs.ray.io/en/latest/serve/llm/serving-llms.html)) | https://github.com/ray-project/ray |
| Cloudflare Agents SDK | One Durable Object per agent, with its own SQLite, WebSockets and scheduler; hibernates when idle | "Tens of millions of instances" ([docs](https://developers.cloudflare.com/agents/)). One object has a soft limit of 1,000 requests/s, 10 GB SQLite on the paid plan, and 30 s of CPU per invocation by default ([limits](https://developers.cloudflare.com/durable-objects/platform/limits/)) | https://github.com/cloudflare/agents |
| Orleans (virtual actors) | An actor "always exists, virtually"; the runtime activates, places and collects it ([MSR-TR-2014-41](https://www.microsoft.com/en-us/research/publication/orleans-distributed-virtual-actors-for-programmability-and-scalability/)) | The pattern behind Durable Objects-style designs | https://github.com/dotnet/orleans |
| uWebSockets.js | C++ WebSocket server with Node bindings | 1M WebSockets on a laptop, from the author ([post](https://unetworkingab.medium.com/millions-of-active-websockets-with-node-js-7dc575746a01)) | https://github.com/uNetworking/uWebSockets.js |
| Socket.IO + Redis adapter | Sticky sessions and cross-node broadcast over Redis pub/sub | Default Socket.IO topped out near 120K connections on one box ([Evil Martians](https://evilmartians.com/chronicles/choose-your-fighter-benchmarking-5-websocket-servers-for-nodejs)). I found no reproducible benchmark of the Redis adapter at 100k | https://github.com/socketio/socket.io-redis-adapter |
| NATS JetStream / Redis Streams / Kafka | Durable subjects or streams with consumer groups for agent-to-agent messages | Only secondary blog numbers with unclear method, so none quoted here. Benchmark with your own message sizes | https://github.com/nats-io/nats-server |
| vLLM | PagedAttention plus continuous batching | 2 to 4x throughput over FasterTransformer and Orca (SOSP 2023 paper, [arXiv](https://arxiv.org/abs/2309.06180)). Anyscale measured 23x over static batching for OPT-13B on one A100 ([Anyscale](https://www.anyscale.com/blog/continuous-batching-llm-inference)). About 2.2k tokens/s per H200 for DeepSeek with wide expert parallelism, from community benchmarks ([vLLM blog](https://vllm.ai/blog/large-scale-serving)) | https://github.com/vllm-project/vllm |
| SGLang + router | RadixAttention prefix cache; the router keeps an approximate radix tree per worker and sends each request to the worker most likely to hold its prefix | Llama 3.1 8B on 8 A100s, shared-prefix workload: 82,665 tokens/s at a 20% hit rate rose to 158,596 at 75% ([LMSYS](https://lmsys.org/blog/2024-12-04-sglang-v0-4)) | https://github.com/sgl-project/sglang |
| llm-d | Kubernetes inference scheduler over vLLM, scoring prefix-cache locality and load; precise mode reads KV events from each pod | 16 H100s, Qwen 32B, 150 tenants with 6,000-token shared contexts: 8,730 output tok/s and 0.54 s p90 TTFT with precise scheduling, against 4,429 tok/s and 92.6 s with random ([llm-d](https://llm-d.ai/blog/kvcache-wins-you-can-see)). Prefix-only scoring overloaded replicas, about 55% success, while prefix plus load kept 100% ([llm-d](https://llm-d.ai/blog/intelligent-inference-scheduling-with-llm-d)) | https://github.com/llm-d/llm-d |
| vLLM production stack + LMCache | Helm reference stack: router (round-robin, session-ID; prefix-aware marked WIP in the README), LMCache KV offload to CPU | LMCache's benchmark used a 120 GB CPU offload buffer per pod ([LMCache](https://blog.lmcache.ai/2025-03-06-benchmark), [vLLM blog](https://blog.vllm.ai/production-stack)) | https://github.com/vllm-project/production-stack, https://github.com/LMCache/LMCache |
| LiteLLM | Proxy with virtual keys, per-key and per-deployment RPM/TPM limits shared across instances through Redis, and fallbacks | No throughput benchmark found at 1k RPS ([docs](https://docs.litellm.ai/docs/proxy/load_balancing)) | https://github.com/BerriAI/litellm |

The common pattern: **stateless front ends, durable state in Postgres (or per-actor SQLite), a queue or pub/sub layer (Redis or NATS) between instances, and idle agents stored as data, not running processes.** No serious project runs one OS process per user.

## 3. LLM serving at this load

- **Continuous batching.** Ollama's 4 fixed slots are where Serve's 8-talks-a-minute ceiling comes from. vLLM and SGLang schedule at the token level and pack many sequences into each forward pass. The gains reported above (2 to 4x, and 23x over static batching) come from other models and hardware, so Serve must measure its own on the 3090 with `vllm bench serve`.
- **Prefix-cache-aware routing.** Serve's 88.8% cache rate only holds on many GPUs if a request lands on the GPU that holds its prefix. A round-robin balancer spreads requests evenly and throws that locality away. The SGLang router and llm-d both route by prefix and load, and llm-d's own results show prefix-only routing overloads hot replicas.
- **KV cache offload.** LMCache keeps KV blocks in CPU RAM or on disk, so a planner prefix that falls out of GPU memory can be reloaded instead of recomputed.
- **Autoscaling.** Scale on queue depth or in-flight requests per replica, not CPU. Ray Serve's template targets 5 in-flight requests per replica (Anyscale, above).
- **Admission control and priority.** Serve already has two priority lanes, and its own measurement shows why they matter: a player's talk p50 went from 83 s to 38 s (`docs/scale.md`). At scale this becomes a priority queue in front of the router. When the queue is full, background work (judging ahead, the autopilot) is shed or deferred first, and calls a person is waiting on get a deadline. Per-key RPM/TPM caps, LiteLLM-style, stop one agent from draining the pool.

### How many GPUs for a 30B MoE (estimate)

Public measurements of a 30B-A3B-class MoE at full saturation are scarce. Treating Qwen3-30B-A3B as a stand-in for Muse Glimmer (an assumption; Glimmer's active parameters may differ), here are the data points:
- 584 tok/s peak on one H100 SXM for Qwen3-Coder-30B-A3B FP8, measured at only 1 to 6 concurrent requests with 1,024 output tokens and no caching ([Millstone AI](https://www.millstoneai.com/inference-benchmark/qwen3-coder-30b-a3b-instruct-fp8)). Treat it as a floor, since higher concurrency raises total throughput.
- Qwen3-30B-A3B on an RTX 5090 with llama.cpp and continuous batching: 192 tok/s per user with 1 user and 47 tok/s per user with 4 users ([arXiv 2512.23029](https://arxiv.org/html/2512.23029v1)). Four users at 47 each is about 188 tok/s in total.
- About 2.2k tok/s per H200 for DeepSeek with wide-EP at large batch ([vLLM blog](https://vllm.ai/blog/large-scale-serving)). That is a far larger model on multi-node InfiniBand, used here only as a rough upper reference for what tuned MoE serving reaches.

Output tokens alone, between those two H100-class references:

| Activity | Output tok/s | H100s at 584 tok/s each | at 2,200 tok/s each |
|---|---|---|---|
| Light | 167k | 286 | 76 |
| Medium | 833k | 1,426 | 379 |
| Heavy | 3.33M | 5,702 | 1,515 |

These figures exclude prefill, which is small for Serve because of the cache: 280k uncached prefill tok/s in the medium case. They also exclude headroom. The conclusion matters more than the exact count. **At 100k concurrent, the cheapest GPU is the call that never happens.** Serve's tiers already move a lot of work off the GPU: the tiny classifier settles 59.8% of ordinary choices, and routing removed 30% of a week's model calls. Shorter outputs help next, for example the one-token decider instead of a 500-token answer. A call that writes 100 tokens instead of 500 cuts the GPU count about 5x (estimate: 500 / 100). The hosted Muse Spark lane can absorb peaks, within its rate limits, which we have not checked.

## 4. A phased plan for Serve

Capacities are estimates from the arithmetic above, with one talk per user every 10 minutes. Each one must be measured before it is quoted.

| Phase | Changes | Rough capacity (estimate) |
|---|---|---|
| **0. One box, done right** | Swap Ollama for vLLM or SGLang on the 3090s, keeping the two priority lanes. Replace JSON files with SQLite in WAL mode or a local Postgres, so writes become row updates rather than whole-file rewrites. Retire per-tenant processes: one gateway, with the tenant as a column and per-tenant folders only for media. Per-key rate limits. | Today about 80 concurrent users per GPU (8 talks/min × 10 min). The aim is several times that once batching is continuous, if vLLM's batching gain holds on a 3090; to be measured |
| **1. Stateless gateways** | Postgres for durable state (talks, holds, bookings, sessions; A2A `TaskStore` in Postgres) and Redis for sessions, rate-limit counters, pub/sub and the stream fan-out, following the LangGraph and Letta pattern. N gateway replicas behind Cloudflare, with SSE and WebSocket streams relayed through Redis so any replica can serve any user. Rented GPUs running vLLM behind the SGLang router or llm-d, so the 88.8% prefix hits survive across GPUs. Interactive calls go to the API lane at peaks. | Thousands of concurrent users: gateways scale linearly, and the GPU count follows the table in section 3 |
| **2. Actor per agent, bus between them** | Each member, venue and player agent becomes a virtual actor: a Cloudflare Durable Object (with hibernating WebSockets and its own SQLite), or Orleans, Dapr or Ray actors if data must stay on our machines. Agent-to-agent traffic inside the platform travels as messages on NATS JetStream or Redis Streams, carrying the same facts-only A2A payloads with signatures verified once per card and cached. Outside agents still get HTTP A2A and `/llms.txt` at the edge. llm-d with precise prefix scheduling, LMCache offload, autoscaling on queue depth, and a priority queue that sheds background work first. Edge caching for the web app and static Agent Cards. | 100k concurrent: about 56 talks/s and 560 A2A messages/s are easy for a bus. Inference at 76 to 1,426 H100-class GPUs for light to medium activity, as estimated in section 3 |

A trade-off to decide before Phase 2: Serve's privacy claim is that players' data stays on our server. Durable Objects put agent state on Cloudflare. Self-hosted actors (Orleans, Dapr, Ray) keep the claim but leave the operations to us.

What to keep: facts-only payloads, one-round intersection, 30-minute holds with resource ordering, and idempotent bookings. These make the system easy to shard, because a talk touches a small, known set of agents, and holds already serialize the contested ones. Hold acquisition becomes a conditional update in Postgres, or a message to the member's actor, instead of an in-process call.

## 5. Security and abuse at scale

- **Rate limits per agent key.** Count at two layers. At the edge, Cloudflare rate-limiting rules can keep a separate counter per value of a header such as `x-api-key` ([Cloudflare](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)), and complexity-based counting lets the origin return a cost score per request ([Cloudflare](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/)), so a request that triggers a Glimmer call can count more than a cached GET. In the gateway, keep token-bucket RPM and TPM limits per key in Redis, as LiteLLM does, so a key that gets past the edge still can't drain the GPU pool.
- **DDoS.** Stay behind Cloudflare and never expose the origin. With several gateway replicas, a tunnel per replica removes the single home-server path.
- **Bot agents.** Outside agents should identify themselves cryptographically. Web Bot Auth signs each request with HTTP Message Signatures (RFC 9421) against a key directory the agent publishes, and Cloudflare folded it into Verified Bots in July 2025 ([Cloudflare docs](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/)). Serve already signs Agent Cards with Ed25519 and `jku`, so accepting signed requests from registered outside agents is a small step. Give unsigned agents the lowest quota. In line with Serve's no-money rule, new outside agents earn quota through the waitlist or a human confirmation, not a deposit.
- **A2A-specific risks.** Validate push-notification URLs against an allowlist to prevent SSRF, as the Elixir A2A SDK advises (above). Keep facts-only payloads, so no agent's model reads another side's text. Cap the number of talks a single agent may open per hour, which keeps one agent from flooding members with holds. Cache verified Agent Cards so signature checks don't become the hot path.
- **Model-level abuse.** Keep Llama Guard and Prompt Guard on the paths where people or outside agents type, and apply admission control first, so floods are rejected before they reach a GPU.

## Sources not otherwise linked

- Serve: `README.md` (Architecture, §1, §3) and `docs/scale.md`, in this repository.
- Cloudflare Agents, long-running agents: https://developers.cloudflare.com/agents/concepts/long-running-agents/
- llm-d precise prefix-cache routing guide: https://llm-d.ai/docs/guide/Installation/precise-prefix-cache-aware
- Qwen speed benchmark (SGLang on H20): https://qwen.readthedocs.io/en/latest/getting_started/speed_benchmark.html
- LiteLLM rate-limit enforcement test: https://git.kvant.cloud/phoenix/litellm/src/commit/a866bdb01ed1ed1b9cab4080c15d31fd5de15c2e/docs/my-website/docs/load_test_rpm.md
