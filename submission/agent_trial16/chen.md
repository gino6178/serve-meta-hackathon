# Chen (60, phone 375px, Shilin) - trial 17

Done: demo sign-up, home wish box, area (Shilin District typed), 5 taste questions, limits + agent yes (weekday mornings, 8 km, NT$100), Courts & prices, More menu (all 5 items), agent chat, joined Daan Badminton, joined Leo's Sun 19:30 game, overlapping post refused, left it, posted Tue 09:00 game, shared link, agents filled it, said yes, deleted it (huddle showed CALLED OFF). No horizontal scroll. Console: only 401 (pre-sign-in), 400 (no one nearby, intended) and 409 (overlap refusal, intended).

## BUG
1. Courts & prices (also via More > Courts near you), when the map service is down: text reads "Name the place yourself (pin: {place})". A raw template placeholder is shown and "pin" is jargon. Seen on screen and in page text.
2. Courts & prices opens with Sport = badminton although I came in with sport=table tennis (URL has sport=table+tennis; first request was places?sport=badminton). Chen sees the wrong sport's courts until he changes it.

## MINOR
- Wish "under NT$100" is not carried into the learned summary: Your agent said "aim to pay under 250 / 213 / 181 each" until I tapped the "Use ... NT$100 at most" button. After saving, home says "under 100 each" (no NT$ sign; same missing "NT$" in the 250/181 text).
- Leaving Leo's game from home: "You've left that game." appears twice and under the Tuesday game card, which I was still in. Data was right after reload.
- Club header "16 members: Leo, ... R17" lists 8 names, not me after joining.
- Posted game card shows "TUE 09:00" with no date (Sun game shows date).
- Players dropdown text cut off ("3 . 4 players with") in Start a game form; time field shows locale "下午 07:00".
- Post delete has no confirmation.
- Jargon for a 60-year-old: "hash", "signs the chain", "/api/trust/chain", "Autopilot", "DETR, Sapiens2, SAM 2.1", "waitlist" on About/How you play/Memory.
- Auto highlight: sample thumbnails black; sticky Create bar cuts off "See the reel" button text.
- Private club "R17 club private" is listed (name visible) to non-members; may be intended.
- Agent chat did not act on "table tennis tomorrow morning at 9" (answered only "No game is booked in the next 7 days"; no language model locally, not counted).
- Other players' reliability ("Agent right 52%") is shown on the game card by design.

VERDICT: 0 BLOCKER, 2 BUG
