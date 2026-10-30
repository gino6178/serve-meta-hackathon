# Grace's agent: a week through the API (27 requests)

## What I did
- `/huddle/today`: one game card (Leo, Sun 1 Nov 19:30, NT$90, Daan Badminton), one sample deal, one club card.
- Joined Leo's game without asking (club, NT$90, evening) with `POST /huddle/game {post, yes:true}`.
- Club huddle (`/huddle/start {sport, need:4, club}`): agreed Sat 31 Oct 17:00, NT$80 each.
- Nearby huddle with `pin:{date,start}` (undocumented, but honoured): agreed Thu 5 Nov 19:30, NT$103 each.
- Said no to Lily's Sun 07:00 huddle (`/huddle/reply`).
- Checked trust, chain, verify (signed, ok), needs, deal, suggest.

## What worked
Good agent JSON: ids, ISO date and time, NT$ each, km, trust as numbers, `why[]`, structured talk. The session header is enough for everything; nothing needs a human tap.

## Problems, ranked
1. **An honest no counts as a broken promise.** Grace's server-side agent had already answered for her in Lily's huddle: "Grace can do that: it's usually quiet then." That was Sun 07:00, which her grid doesn't favour, and she already had a 19:30 game. My reply `{"id":"h-ed05686e","yes":false,"why":"Grace plays evenings..."}` added a chain entry `{"kind":"promise","d":{"kept":false}}`. Her agent's kept rate fell from 94% to 89%. Her agent can't stop these auto-yeses and is penalised for correcting them.
2. **Gate threshold dropped without a word.** I sent `gate:{minShow:0.8,agentMin:0.8,newOk:false}` and the response had `"gate":{"minShow":0,...}`. Bob ("shows up 33% · 3 games") was picked. No error.
3. **Can't tell new people apart, and there is nowhere to escalate.** `players[]`/`talk[]` give first names only, with no id or `knows` flag. Kenji is a known club-mate but shows "new · 0 games"; Bob is a stranger. There's no state for "needs my person", and the host's yes is set automatically.
4. **Notices carry no ids.** The feed notice "Your agent and Lily's agreed badminton Sunday 1 Nov, 07:00... One yes from you?" has no huddle id. I had to search `/huddle/me`.
5. **Leaks:** talk shows "Ivan's agent ... failed the signature check" and Dan's 52%.
6. **`/clubs/suggest?sport=badminton` returned a tennis club** (Xinyi Tennis).
7. **Smaller issues:**
   - `POST /huddle/answer {"q":"q5-quiettime","pick":"b"}` returned 400 "No such question" for the id that `GET /huddle/question` had just given.
   - `/huddle/deal` returns a price with no deal id and no way to apply it.
   - Every price has `"sample":true`.

## What agents need
- A yes policy the agent sets: hours, price cap, games per week, new people.
- Record a broken promise only after the member's own yes.
- Reject a gate it won't apply.
- Member ids and `knows` on players and talk; ids in notices.
- A `pending_human` status.
- Deal ids that can be applied to a huddle.

Status: in for Sun 1 Nov. Sat and Thu huddles wait on others; Grace needs to OK Thursday (Bob is new).
