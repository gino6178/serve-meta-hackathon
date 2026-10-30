# Joy Lin's agent: trial report (old3)

29 requests to 127.0.0.1:8899, using the member session only.

## What I did
1. `GET /api/huddle/me`: Serve says "The price matters most to you, then a quiet court", with weights price 0.41, quiet 0.33, time 0.19, place 0.08, sports `["tennis","badminton"]` and a price cap of NT$181. That matches "price first, tennis", so there was nothing to fix.
2. Tried to adjust it. `POST /api/huddle/taste` returns 404 `no such route`. The documented options are answering questions, `reset`, or `sports`.
3. `GET /api/huddle/places?sport=tennis`, then badminton places and a `deal` for badminton.
4. `POST /api/huddle/start` with a pin on Tue 3 Nov 09:00 at a free public court 0.6 km away (12% busy), plus Xinyi Tennis and `nearby:true`. Mei and Kenji both said yes at once. Cost: NT$0.
5. Joined Leo's gated badminton game (`minShow 0.75`) through `POST /api/huddle/game`, then left it with `POST /api/feed/join on:false`.

## What worked
- The taste view is readable, and the plain summary matches the weights.
- The pin was respected (`pick` = Tennis court, Tue 09:00, `each:0`). The talk also offered Mei's free open game first.
- The venue haggling is transparent: every line is shown, and `sample:true` is flagged.
- The trust chain verifies (`/api/trust/verify` ok, signed head).

## Problems, worst first
1. **The agent cannot answer Serve's own question.** `GET /api/huddle/question` returns `id:"q5-quiettime"`. Then `POST /api/huddle/answer {"q":"q5-quiettime","pick":"a"}` returns 400 `No such question.`, and the variants `q5`, an object, and `id` failed too. Since there is no direct edit, this was the only way to correct taste short of `reset`, which wipes everything.
2. **Her trust score is posted by name in a public feed.** After the join, Leo's agent commented "Joy is in (shows up 75% · 4 games)." That reveals her record and links her name to the "pseudonymous" chain subject.
3. **Her record is one aggregate with no way to dispute it.** The chain holds a single `seed {games:4, came:3}`, with no date or reason for the miss and no decay. She cleared Leo's gate only because 0.75 ≥ 0.75. One more miss (3/5 = 0.60) would lock her out, while someone with 0 games gets in through `newOk:true`. A new player is treated better than a mostly reliable one.
4. **Tennis places come back empty the first time.** The first three calls returned `{"looking":true,"places":[]}` with no retry hint. They filled in later.
5. **The deal error is misleading.** `POST /api/huddle/deal {"place":"osm:way/49186446",...,"sport":"tennis"}` returns 404 `That venue isn't near you.` The venue is 2.6 km away; the real problem is that it is not a tennis venue.
6. **Price fields are confusing.** In places, the top-level `list` (310) is the agreed price, while `offer.list` is 470. For Taipei Gymnasium the top-level `list` is 270, but the price is 280.
7. **Learning sticks after you withdraw.** The join taught "Sunday evenings a bit more" and nudged the Mon–Wed and Sat evenings too. Leaving didn't undo it, and only a full reset clears it.
8. **`nearby:true` found no one** (`"nearby":0`), and nothing says why.
9. **Her agent can never earn "kept promises".** Joy has no registered agent (`agents:[]`), so `agentMin 0.8` gates rely on `newOk` forever.

## Fixes
- Make `/answer` accept the id `/question` returns, or stop serving questions once the pool is done (`n:5, of:5`).
- Add `POST /api/huddle/taste {weights, priceCap, grid}` so the member can correct taste directly, logged in `learned`.
- Agent comments should say only "Joy is in" and keep trust to the host.
- Store each attendance as its own chain entry with a date, let the member add a note, decay old misses, and apply `newOk` no more generously than a near-threshold record.
- Return `retryAfter` while `looking` is true. Make the deal error say "no tennis courts there". Rename the top-level `list` to `price`. Undo learning when someone leaves.

## Cheapest good tennis this week
Free public courts. The best: "Tennis court" (0.6 km) Tue 09:00, now the huddle `h-77a82c3b`. Others: 紅土網球場 Thu 5 Nov 14:00 (7% busy), or Mei's free Mon 07:00 game (1 spot). The cheapest venue is 松山運動中心 at NT$115 each.
