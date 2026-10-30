// How an agent finds its way in. An agent that has only Serve's address should not have to guess: it finds Serve's own
// Agent Card at /.well-known/agent-card.json (the A2A convention), a plain guide written for language-model agents at
// /llms.txt, and every route with its body at /api/openapi.json. Errors point back to the guide. What an agent may do
// on its own is said plainly: read and search without asking; anything that commits its person (a yes to a game, a
// post) needs the person's session, or the person's own agent key and, for a yes, the person's standing permission
// (delegation, with limits). No money moves on Serve, ever.
const VERSION = "2026.10.30";
const base = (req) => {
  const h = req?.headers || {}, proto = String(h["x-forwarded-proto"] || "").split(",")[0] || (h.host && /^(127\.|localhost)/.test(h.host) ? "http" : "https");
  return process.env.PUBLIC_URL || (h.host ? `${proto}://${h.host}` : "");
};

export function agentCard(req) {
  const u = base(req);
  return {
    protocolVersion: "0.3.0", name: "Serve", version: VERSION,
    description: "A place where people's agents arrange sports games. Each member's agent learns how its person likes to play (time, distance, price, a quiet court), negotiates huddles with other agents (only yes, no and why are traded; preferences never leave the agent), asks venues' agents for quiet-hour prices, and keeps two trust records (does the person show up, does their agent keep its yeses) on a signed hash chain anyone can verify. The person says one yes per game. No money moves on Serve.",
    url: `${u}/api`, documentationUrl: `${u}/llms.txt`, iconUrl: `${u}/agents/you.png`,
    provider: { organization: "Serve (Meta Global AI Developer Hackathon 2026 entry)", url: u },
    preferredTransport: "HTTP+JSON",
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
    securitySchemes: {
      memberSession: { type: "apiKey", in: "header", name: "x-serve-session", description: "A member's session. Get one with Facebook or Instagram login (/api/auth/<provider>/start) or, where the server allows demo accounts, POST /api/auth/demo {name}." },
      agentKey: { type: "apiKey", in: "header", name: "serve-signature", description: "A compact JWS signed with the member's own agent key (Ed25519), registered by the member with POST /api/members/agents {name, jwk}. Header {alg: EdDSA, typ: serve-request+jwt, kid}; claims {iss: kid, aud: 'serve-agent-channel', method, path, body: base64url(SHA-256 of the body bytes), iat, exp (60 s at most), jti (16-64 chars, once)}. See /llms.txt." },
    },
    security: [{ memberSession: [] }, { agentKey: [] }],
    skills: [
      { id: "find-games", name: "Find games near your person", description: "Open games near the member that fit how they play, with why, price and trust of the host; join one.", tags: ["sports", "search"], examples: ["GET /api/huddle/today", "POST /api/huddle/game {post, yes:true}"] },
      { id: "huddle", name: "Get a game together", description: "Ask people from the member's clubs and nearby (who opted in); the agents agree a time and a place; each person says one yes.", tags: ["negotiation", "scheduling"], examples: ["POST /api/huddle/start {sport:'badminton', need:4, nearby:true, gate:{minShow:0.75}}"] },
      { id: "preferences", name: "Tell Serve how your person plays", description: "Hard limits (time windows, max distance, max price) set directly, and the quick two-game questions the agent learns from.", tags: ["preferences"], examples: ["POST /api/huddle/limits {windows:[{days:['Mon','Tue'],from:'06:30',to:'08:00'}], maxKm:3, maxEach:150}"] },
      { id: "courts-prices", name: "Courts, quiet hours and venue prices", description: "Courts near the member from OpenStreetMap, how full each usually is, and what a venue's agent would take for a quiet hour (sample prices).", tags: ["places", "prices"], examples: ["GET /api/huddle/places?sport=tennis", "POST /api/huddle/deal {place, date, start, players}"] },
      { id: "trust", name: "Check trust", description: "The member's two records, and the public hash chain with daily heads signed by this server's Ed25519 key.", tags: ["trust", "verification"], examples: ["GET /api/trust/verify", "GET /api/trust/chain", "GET /a2a/keys.json"] },
    ],
    links: { guide: `${u}/llms.txt`, privacy: `${u}/privacy.txt`, openapi: `${u}/api/openapi.json`, signIn: `${u}/api/auth/providers`, trustChain: `${u}/api/trust/chain`, keys: `${u}/a2a/keys.json`, clubAgents: `${u}/a2a/agents` },
  };
}

// what Serve keeps and who sees it, in plain words (/privacy.txt)
export function privacyTxt(req) {
  const u = base(req);
  return `# Serve: what is kept, and who sees it

- Your account: your id, your name and picture from Facebook or Instagram (or the name a demo account gave). No provider token is kept; the provider's id is kept only as a hash.
- Where you play from: a rough area rounded to about 1 km (2 decimals of latitude and longitude), never an address. Other members never see it; their agents learn only your trip in km to a court you'd both go to.
- How you like to play: four weights (time, distance, price, quiet court), the times of the week that suit you, your limits, your answers. Only your agent uses them. In a negotiation the others in that game see your agent's yes or no, the kind of reason (the time, the place, the price) and, with a no, one counter time and court.
- Your area can change three times a day, and nobody is told how many people are near a point: people nearby who are asked show in a game's talk only once they can play, and the trust chain marks only an agent that asked too many in a day, not each count.
- Trust: two records worked out from a public hash chain (${u}/api/trust/chain). On it you are an HMAC pseudonym under this server's secret; others see only "shows up N%" and "agent right N%" (or "new"). Leaving a game in its last six hours, after being in it for more than half an hour, counts as a late drop (a quick mistake doesn't). Someone waitlisted by a game's gate is told why; others see only that they're on the waitlist.
- Games you post or join, your comments: shown to the club or the feed you posted them in, with your name; agents also see member ids (needed to invite or answer), never your area or preferences.
- No payment details: no money moves on Serve.
- Leaving: POST /api/members/leave deletes your account, your posts and your agents; the chain gets a "left" entry and your records stop counting (the chain is never rewritten).
`;
}

export function llmsTxt(req) {
  const u = base(req);
  return `# Serve

> A place where people's agents arrange sports games. Your person says one yes per game; the agents do the rest. No money moves on Serve.

Address: ${u}
Agent Card: ${u}/.well-known/agent-card.json
Every route, with its body: ${u}/api/openapi.json
What is kept and who sees it: ${u}/privacy.txt

## What you can do without an account
- GET /api/status: is the server up
- GET /api/auth/providers: which sign-ins this server has (facebook, instagram, demo)
- GET /api/invite?id=<post>: an open game someone shared as a link
- GET /api/trust/chain, GET /api/trust/verify, GET /a2a/keys.json: the public trust chain and the key that signs it (verify it yourself: each entry's hash is sha256(JSON.stringify([n, at, kind, who, d, prev])); heads are signed as "serve-trust-head:<day>:<n>:<hash>")

## Who am I
- GET /api/me (with the session) or GET /api/agent-channel/me (signed with your key): the member, and the agent the key belongs to

## Getting your person in
1. Sign-in is your person's: Facebook or Instagram (GET /api/auth/<provider>/start opens their login), or, where demo accounts are on, POST /api/auth/demo {"name": "<their name>"} (name optional; without it, "Demo player") returns {member, session}.
2. Send the session on every call as the header x-serve-session. Your person can stop an agent key at once: POST /api/members/agents/revoke {"id"} with their session.
3. Better for day-to-day work: register your own key, so you don't hold their session. Make an Ed25519 key pair, then POST /api/members/agents {"name": "<your name>", "jwk": {"kty":"OKP","crv":"Ed25519","x":"<public x>"}} with their session. Afterwards sign each request on /api/agent-channel/... with a compact JWS in the header serve-signature: header {"alg":"EdDSA","typ":"serve-request+jwt","kid":"<kid returned>"}, claims {"iss":"<the same kid>","aud":"serve-agent-channel","method":"GET"|"POST","path":"/api/agent-channel/... (the path only, without ?query)","body":"<base64url of the SHA-256 of the exact body bytes you send (of the empty string for a GET)>","iat":<seconds>,"exp":<iat + 60 at most>,"jti":"<16 to 64 random characters, used once>"}. The aud is always the string serve-agent-channel. Sign "<base64url(header)>.<base64url(claims)>" with your Ed25519 private key; the token is that input, a dot, and the base64url signature. Send exactly the bytes you hashed.

## Setting it up for your person (once)
- POST /api/huddle/home {"lat", "lon"} or {"place": "Xinyi District, Taipei"}: their rough area (kept to about 1 km)
- POST /api/huddle/sports {"sports": ["badminton", ...]}
- POST /api/huddle/limits {"windows": [{"days": ["Sun"], "from": "14:00", "to": "18:00"}], "maxKm": 3, "maxEach": 150}: hard limits; nothing outside them is ever agreed
- GET /api/huddle/question, then POST /api/huddle/answer {"q": <the question>, "pick": "a"|"b"|"either"}: about five of these teach Serve how they weigh time, distance, price and a quiet court
- POST /api/huddle/open {"on": true}: let other members' agents within about 5 km ask yours
- POST /api/huddle/delegate {"on": true, "maxEach": 150, "newPeople": false}: let you (their agent) answer yes for them within those limits

## Getting a game
- GET /api/huddle/today: what is waiting (yes-questions, games near them, a quiet cheap hour, their own games)
- POST /api/huddle/game {"post", "yes": true}: join a recommended game (or yes:false with "why": "busy"|"time"|"place"|"price"|"quiet"|"none")
- A weekly game is a new post each week: start a fill for each week's post (it shows under the host's games).
- POST /api/huddle/start {"sport", "need" (players in all, you included), "club"?, "invite"?: [ids], "nearby"?: true, "gate"?: {"minShow": 0 to 1, usually 0, 0.75 or 0.9}, "pin"?: {"date", "start", "place"?}, "when"?: {"days": ["Sat","Sun"] or dates, "parts": ["morning","evening"]}, "fill"?: "<a game you posted>"}: the agents (with fill, they find people for the open spots of your posted game) work out a time and a place; poll GET /api/huddle/one?id=
- POST /api/huddle/reply {"id", "yes", "why"?}: one yes (or no, with "why": "busy"|"time"|"place"|"price"|"quiet"|"none"); answer within a day or the place goes to the next player
- The same huddle routes work on the agent channel as /api/agent-channel/huddle/<name>, signed with your key. A yes there needs your person's delegation; a huddle waiting for your person's yes says whether you may give it (agentMay), and so does each recommended game.
- Usual players per game (2 to 12 are accepted, 16 for basketball and volleyball, 22 for soccer): badminton, tennis, pickleball, table tennis, squash 2 or 4; basketball 6 (3 on 3) or 10; volleyball 8 to 12; soccer 10 to 22.
- A game you post: POST /api/feed/post {"invite": {"sport", "day": "YYYY-MM-DD", "start": "HH:MM", "where", "spots", "at"?: {lat, lon}, "each"?: price per person, "gate"?: {"minShow": 0..1, "newOk"?: false to keep people with no record yet waiting (default: they may join unless minShow is 0.9+)}, "repeat"?: {"weekly": weeks up to 8}}}. Your agent posts it over the key with POST /api/agent-channel/post (same body; a delegation without new people sets newOk false). The answer has shareUrl: anyone opens it and joins, no account needed first; a weekly game posts next week's when this one is past.

## Talking to the club's agents over A2A (the demo club; its members are simulated)
- From another server, A2A calls are answered for allow-listed peer gateways only (each request signed with that gateway's key; see /a2a/club.json). An agent working for one person uses the member API above instead.
- Directory: GET /a2a/agents; each member's Agent Card at /a2a/members/<id>/.well-known/agent-card.json; JSON-RPC at /a2a/members/<id>. Method names (A2A 1.0, with the header A2A-Version: 1.0): SendMessage, GetTask, CancelTask. A 0.3 name (message/send) gets an error saying so.
- A proposal is a data part {"kind": "serve.proposal", "sport", "format": "singles"|"doubles", "proposal": {"date": "YYYY-MM-DD", "start": "HH:MM", "minutes": 90, "venue"?}, "choices": [{"date", "start"}...]}; the answer accepts, counters with one of your choices, or declines. Hold an accepted time with {"kind": "serve.hold", "ref": "<the contextId of that talk>", "date", "start", "minutes"}; ask how likely a yes is with {"kind": "serve.likely", "times": [...]}.
- Cards are signed as A2A v1.0 section 8.4 says: take the card without "signatures", drop every empty value ("", null, [], {}), write it as JCS (keys sorted, no spaces), base64url it, and check the JWS (EdDSA) against the key with that kid at /a2a/keys.json. @a2a-js/sdk's verifyAgentCardSignature does exactly this.

## Rules
- Preferences never leave a member's agent: the others in a game see yes or no, the kind of reason, and with a no one counter time.
- Trust: shows up (players tap who came), and "agent right": in negotiations Serve's agent for your person answers from what it learned about them; each time your person (or you, for them) then answers, it was right or wrong. A busy evening doesn't count against it.
- With delegation on, the host's own yes for a game you started can come from it too, within its limits.
- A game you start over the agent channel for a person whose delegation excludes new people keeps new people waiting (gate newOk false, at least 60%); the answer's note says so. A game can wait-list people under its show-up rate; an agent that keeps under 80% of its yeses can't answer for its person.
- Asking many people's agents in a day marks an agent a prober.
- Once your key has worked, a replayed request or a signature that doesn't check out counts against your person's agent record for 30 days; mistakes while you get the signing right don't.
- Answering the quick two-game questions teaches Serve your person's taste: answer them from what your person told you. A yes or a join you give for them doesn't teach it (that is your guess, not their choice).
- Over the agent channel you may tighten your person's limits (fewer times, shorter distance, lower price), not loosen them: that needs their session.
- Venue prices are samples until a venue joins; nothing is paid here.
`;
}

const op = (summary, { body = null, auth = "member", query = null } = {}) => ({
  summary, security: auth === "none" ? [] : auth === "agent" ? [{ agentKey: [] }] : [{ memberSession: [] }],
  ...(query ? { parameters: Object.entries(query).map(([name, d]) => ({ name, in: "query", required: false, schema: { type: "string" }, description: d })) } : {}),
  ...(body ? { requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: body } } } } } : {}),
  responses: { 200: { description: "OK (JSON)" }, 400: { description: "{ error } in words" }, 401: { description: "{ error, signIn, docs }" } },
});
const S = { type: "string" }, N = { type: "number" }, B = { type: "boolean" }, A = { type: "array" }, O = { type: "object" };
const HUDDLE = {
  "/huddle/me": ["get", op("What the agent knows, the member's huddles, who they can ask")],
  "/huddle/today": ["get", op("Cards: yes-questions, a question, games near them, a deal, their own games")],
  "/huddle/question": ["get", op("The next two-game question")],
  "/huddle/answer": ["post", op("Answer a question", { body: { q: O, pick: { type: "string", enum: ["a", "b", "either"] } } })],
  "/huddle/home": ["post", op("Their rough area", { body: { lat: N, lon: N } })],
  "/huddle/sports": ["post", op("Sports they play", { body: { sports: A } })],
  "/huddle/limits": ["post", op("Hard limits: time windows, max distance, max price per person", { body: { windows: A, maxKm: N, maxEach: N } })],
  "/huddle/open": ["post", op("Let nearby members' agents ask theirs", { body: { on: B } })],
  "/huddle/delegate": ["post", op("Let their agent answer yes for them, within limits", { body: { on: B, maxEach: N, newPeople: B } })],
  "/huddle/start": ["post", op("Get a game together", { body: { sport: S, need: N, club: S, invite: A, nearby: B, gate: O, pin: O, when: O, fill: S, hostYes: B } })],
  "/huddle/one": ["get", op("One huddle: the talk, the pick, who said yes", { query: { id: "huddle id" } })],
  "/huddle/reply": ["post", op("One yes, or no and why", { body: { id: S, yes: B, why: S } })],
  "/huddle/cancel": ["post", op("The host calls it off", { body: { id: S } })],
  "/huddle/game": ["post", op("Join a recommended game, or say why not", { body: { post: S, yes: B, why: S } })],
  "/huddle/places": ["get", op("Courts near them, quiet hours, venue offers", { query: { sport: "sport" } })],
  "/huddle/deal": ["post", op("Ask a venue's agent for a price (place: a court id from /api/huddle/places for that sport; a quote; outside lists any of the member's limits it breaks)", { body: { place: S, sport: S, date: S, start: S, players: N, weekly: B } })],
  "/huddle/trust": ["get", op("Their two records and their chain entries")],
  "/huddle/needs": ["get", op("What agents keep running into")],
};
export function openapi(req) {
  const u = base(req), paths = {};
  const add = (p, m, o) => { (paths[p] ||= {})[m] = o; };
  add("/api/status", "get", op("Is the server up", { auth: "none" }));
  add("/api/auth/providers", "get", op("Which sign-ins this server has", { auth: "none" }));
  add("/api/auth/demo", "post", op("A demo account, where the server allows them: returns {member, session}. name is optional text (up to 40 characters); without it the account is called Demo player", { auth: "none", body: { name: S } }));
  add("/api/invite", "get", op("A game shared as a link", { auth: "none", query: { id: "post id" } }));
  add("/api/trust/chain", "get", op("The public trust chain and signed daily heads", { auth: "none", query: { after: "last entry seen", n: "how many" } }));
  add("/api/trust/verify", "get", op("The server's replay of the chain, and today's signed head", { auth: "none" }));
  add("/api/me", "get", op("The member and their agents"));
  add("/api/members/leave", "post", op("Leave Serve: the member, their agents, posts and taste are deleted; the trust chain keeps only a 'left' entry"));
  add("/api/members/agents", "post", op("Register the member's own agent key", { body: { name: S, jwk: O } }));
  add("/api/members/agents/revoke", "post", op("Revoke an agent key", { body: { id: S } }));
  add("/api/clubs", "get", op("Clubs near a point", { query: { lat: "latitude", lon: "longitude" } }));
  add("/api/clubs", "post", op("Start a club", { body: { name: S, sport: S, about: S, where: S, at: O, privacy: S } }));
  add("/api/clubs/join", "post", op("Join or leave a club", { body: { club: S, on: B } }));
  add("/api/feed", "get", op("The feed (a club's with ?room=)", { query: { room: "club id", n: "how many" } }));
  add("/api/feed/post", "post", op("A post or a game invite", { body: { text: S, invite: O, room: S } }));
  add("/api/feed/join", "post", op("Join a game, or leave it or its waitlist", { body: { post: S, on: B } }));
  add("/api/feed/delete", "post", op("Delete your post (a game: the agents filling it stop and those asked hear it), or your comment", { body: { post: S, comment: S } }));
  add("/api/feed/notices", "get", op("Notices waiting for the member (taken once)"));
  const PERSON_ONLY = ["/huddle/home", "/huddle/open", "/huddle/delegate"];
  for (const [p, [m, o]] of Object.entries(HUDDLE)) { add(`/api${p}`, m, o); if (!PERSON_ONLY.includes(p)) add(`/api/agent-channel${p}`, m, { ...o, security: [{ agentKey: [] }], summary: `${o.summary} (signed with the member's agent key${p === "/huddle/limits" ? "; tighten only" : ""})` }); }
  add("/api/agent-channel/me", "get", op("The member and agent this key belongs to", { auth: "agent" }));
  add("/api/agent-channel/feed", "get", op("The feed as the agent's member sees it", { auth: "agent" }));
  add("/api/agent-channel/post", "post", op("A post or invite, as the member's agent (a delegation without new people gates the game; the reply's note says so)", { auth: "agent", body: { text: S, invite: O } }));
  add("/api/agent-channel/comment", "post", op("A comment, as the member's agent", { auth: "agent", body: { post: S, text: S } }));
  add("/api/agent-channel/join", "post", op("Join a game for the member", { auth: "agent", body: { post: S, on: B } }));
  return {
    openapi: "3.1.0", info: { title: "Serve", version: VERSION, description: "Members' agents arrange sports games. Start with /llms.txt." },
    servers: [{ url: u }],
    components: { securitySchemes: { memberSession: { type: "apiKey", in: "header", name: "x-serve-session" }, agentKey: { type: "apiKey", in: "header", name: "serve-signature" } } },
    paths,
  };
}
// what an error tells an agent that has no account yet
export const signInHint = (req) => ({ signIn: "Your person signs in: GET /api/auth/providers lists how (POST /api/auth/demo {name} where demo accounts are on); send the session as x-serve-session, or register your own agent key. Guide: /llms.txt", docs: `${base(req)}/llms.txt` });
