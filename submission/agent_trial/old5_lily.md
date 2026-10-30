# Lily's agent: heavy hosting (old5)

Lily Wang: badminton and pickleball, Daan Badminton, 20/20 shows, agent at 29/30. I made 65 requests to 127.0.0.1:8899 in about 15 minutes. Scripts are in `work_lily/`.

## What I did
- Hosted a club badminton game (`h-ed05686e`), a nearby pickleball game (`h-7ab8a395`), a club game pinned to Thu 5 Nov 19:30 (`h-beadc058`) and a nearby game for 6 (`h-8ca0b82e`).
- Said yes to Grace's Thu 19:30 game. Declined her Sat game with a reason.
- Cancelled a game three people had agreed to. Ran 8 start/cancel cycles to test load.
- Checked needs, trust, today, nudge and feed notices.

## What worked
- **Double-booking.** The pin on Thu 19:30, a slot Lily had already said yes to, went `stuck`: "Thursday 5 Nov, 19:30 doesn't work: it's too soon, or you already play then."
- **Drop-outs.** Grace dropped out of Lily's Sunday game. Hana's earlier agent yes filled the spot ("Hana takes the spot") and Lily wasn't asked anything. Lily's decline on Grace's game was filled the same way.
- **Venue deals.** The agents haggled the venue down: Taipei Gymnasium from NT$410 to NT$290, and 840 to 580 for two courts.
- **Cap and trust chain.** More than three active games: `429 {"error":"You have three games being worked out already."}`. Cancelling twice: `409 "It's already called off."` The chain logged `promise kept:false` when Lily declined after her agent had said yes.

## Problems, ranked
1. **Live games drop out of `/api/huddle/me`.** It returns the 12 newest games, cancelled ones included. After the test cycles it showed 11 cancelled games plus `h-8ca0b82e`. Lily's live Sunday game and Grace's Thursday game (Lily said yes) were missing, though `/one?id=h-ed05686e` still shows them `asking`. An agent can't follow up on games it can't see. **Fix:** list active games first and leave out or page the cancelled ones.
2. **Start/cancel cycling has no limit or cost.** 8 cycles all returned 200. Each one asked 6 to 8 people. Cancelling a game with 3 yeses left no chain entry and no trust cost. The 3-game cap only counts active games, so it doesn't stop this. **Fix:** count recent starts per day, and log a host cancel after yeses on the chain.
3. **The probe flag doesn't stop anything.** After about 40 nearby asks, trust showed `agent:"asks too many agents", flag:true`. The next `POST /huddle/start {nearby:true}` still returned 200 and asked 8 people. Lily got no notice. Club asks never write an `asked` entry. **Fix:** a flagged agent should be throttled or need Lily's OK, and Lily should get a notice.
4. **`gate` is ignored.** Sending `{"minShow":0.8,"agentMin":0.9,"newOk":false}`, `{"show":...}` or `"confirm"` always came back `{minShow:0, agentMin:0.8}`. `newOk` flips between club and nearby games and even between two club games. Kenji (new, 0 games) got a spot over Hana (100%/95%), and Bob (33% shows) is in a game with `newOk:false`. Lily can't insist on reliable people. **Fix:** document the gate format and honour it.
5. **Picked times ignore Lily's taste.** Her best slots are Thu/Fri evening (0.98/0.95). The agents picked Sun 07:00 (0.4), Tue 16:00 (0.19) and Thu 07:00, and counted Lily as `yes` each time without asking. Her agent also said yes to Grace's Sat game when she already had 3 games.
6. **Spam skews the needs.** `agent_unsure` reads 12 "of 3", counting cancelled duplicate games. One heavy host is enough to trigger a club suggestion.
7. **Stale notices.** The feed still asks "One yes from you?" for the Sat game (declined) and the Thu game (accepted).
8. **Smaller issues.**
   - A pin that clashes is accepted (200) and only goes `stuck` later; it should be refused straight away with the clashing game named.
   - Pickleball went `stuck` ("no pickleball courts") after asking just 1 nearby person for 4 spots.
   - Trust still shows "keeps 97%" after a `kept:false`, though 30 of 32 is 94%.
   - Grace's "why" exposed her other plans ("already has Sunday 19:30 with Leo").

## Can a heavy-hosting agent run things end to end?
Mostly. Choosing a time, negotiating the price, refilling spots and the double-booking check all ran without Lily. It breaks on keeping track (problem 1), on choosing reliable players (4) and on limits that don't stop anything (2, 3). No game reached Booked during the test, because the other members' own yeses were still pending.
