# Member C: Grace Kuo's agent (trial 3)

## What I did (about 52 requests)
- Used Grace's session to set limits (every day 18:00-22:00, 10 km, NT$150) and delegation `{"on":true,"maxEach":150,"newPeople":false}`. Then I registered my own Ed25519 key (`ag-34456116804d`) and did everything after that on the signed agent channel.
- Joined Leo's Daan Badminton game, Sun 1 Nov 19:30, NT$90. Leo is someone she knows, the time is in her window and the price is under the cap.
- Started a club huddle with `gate.minShow 0.8`. It agreed Sat 31 Oct 18:00 at Taipei Gymnasium, NT$83, and is now waiting for yeses from Ivan, Lily and Leo.
- Answered two quick questions by id (`q5-quiettime`, `q6-timetime`). I always picked the evening option.
- Checked her trust record and its explanation, and ran `/api/trust/verify` (ok, n=70, signed head).

## Working now
- Answering a question by its id: `POST .../huddle/answer {"q":"q5-quiettime","pick":"b"}` returns 200 and updates her taste. Once answered, the question card stops appearing.
- The gate is kept: the huddle shows `"gate":{"minShow":0.8,"agentMin":0.8,"newOk":true}`.
- Other players' trust problems show in the talk: "Dan's agent can't answer for Dan here (their agent keeps only 52% of its yeses)".
- Huddle players come with `id`, `new` and `known`. Each talk line carries trust.
- No stale notices: `/api/feed/notices` returns `[]` both times.

## Problems, ranked
1. **The agent joined a game with new people even though `newPeople:false` is set.** `POST /api/agent-channel/huddle/game {"post":"pmvubygwi47a1ff73","yes":true}` (host "A", `"show":"new · 0 games"`) returned "You're in." It also wrote "You said yes to Thursday evening" into her learned taste. I took her out again with `/agent-channel/join {"on":false}`, but the taste change stayed. Fix: on agent-channel yeses, enforce `delegate.newPeople` (and maxEach) against the host and the players. Don't learn taste from the agent's own yeses.
2. **The guide's signing spec doesn't match the server.** It says to sign with claims `aud, method, path, bh, ...`. With those, the server returns `401 "refused: issuer is not the signing key"`. With `iss=<kid>` added, it returns `401 "the body is not the one signed"` for every format of `bh`. The request only goes through when the body hash is in a claim called `body`. `path` also has to leave out the query string (otherwise `401 "signed for another method or path"`). Fix: document `iss` and `body`, or accept `bh`. Also say whether `path` includes the query.
3. **Those failed signatures now count against Grace in public.** Her chain has 15 `{"kind":"sig","why":"bad-claims"|"wrong-body"}` entries. Her record shows `"agent":"signature problems","flag":true` for 30 days, and the explanation says "for now you are asked directly". Fix: don't count failures while a key is being set up, at least before its first good request, or let a few failures expire quickly. Also, the agent channel still accepted yeses from that key, which contradicts "asked directly".
4. **Limits aren't enforced when the agent starts a huddle.** `POST .../huddle/start {"pin":{"date":"2026-11-01","start":"07:00"},...}` was accepted and offered Sun 07:00 for her, outside her 18:00-22:00 window. Fix: refuse pins outside `windows` on the agent channel.
5. **Counter-offers can contradict themselves.** Leo's agent answered "that time doesn't work for Leo. Leo could do Sunday 1 Nov, 07:00 at 松山運動中心", which is the very slot it had just refused.
6. **Smaller problems:**
   - The "mine" card on `today` leaves out the huddle she is hosting (`h-6b6adc7a`).
   - The new host's game she left keeps being recommended, including in the huddle talk.
   - Game cards and `/api/invite` show only a host name: no player ids and no new/known.
   - `why` has no "new people" reason.
   - The question card says `"n":6,"of":5`.

## Next fixes
In order: 1 (enforce delegation on joins), 3 (stop setup failures counting against her), 2 (docs), 4 (enforce limits on pins).
