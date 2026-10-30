# 5. Flaky Fay: fairness of trust, gates and waitlists

## What I did
Test accounts Fay (25.041/121.544, badminton, open to asks), Hugo, Ivy and Pat, in the club "Fay Trial Badminton". Hugo and Ivy hosted need-2 huddles. Fay declined with busy, time, price and place, and once said yes when asked directly. In the feed she joined and left Leo's 75% game, a one-spot game, a same-day game, and a game with a 90% gate and `newOk:false`.

## What worked
`/api/trust/verify` returned `ok:true, n:44`. The labels are clear, the taste summary reads naturally; "asked directly" works.

## Problems, worst first
1. **"Busy" counts as a broken promise, and the agent never recovers.** `reply {why:"busy"}` (h-0742fed1), then `time` and `price` in one huddle (h-140d7ed1; each re-plan is a new promise). The chain shows `promise {kept:false}` ×3. The badge went from "agent new" to "agent keeps 0% of its yeses". huddle.js:211 says "their agent was right about the rest", but trust.js counts it as broken. Every huddle has `agentMin:0.8` by default, so her agent never answers again. Direct yeses write no promise, so 0% is permanent.
2. **The waitlist is a dead end.** Joining `pmvuafkjbe4bee29b` gave `{"waitlisted":true}`, and the host's agent posted "If a spot is still open the day before, it's Fay's". No code anywhere promotes people. `join {on:false}` gives `{}` and the waitlist stays at 1 (posts.js:199 returns early). The UI has no leave button. With `newOk:false`, two people waited and nobody was going: the game can never fill.
3. **Leaving early can still count as a no-show.** Fay left `pmvuadyoc14457a49` two days ahead. `trust.json` checks still list her, because `join(off)` never removes people. The host can tap "missed" after the game. A late leaver could get `late` plus a missed `game`.
4. **A late drop ignores when you joined.** Fay joined a game starting at 14:00 that day, at 09:24, and left seconds later. That wrote a `late` entry and a public "(a late drop...)" comment, though all 3 spots were empty. Her `rate` went to 0.
5. **The public chain can be traced back to names.** The subject is an unsalted `sha256("serve-trust:"+id)`. Pat's `/api/huddle/me` lists members' ids. Hashing Fay's id matched her 3 broken promises.
6. **"New" is only hidden on screen.** `trustOf` sends `kept:0` and `rate:0` to other players while the text says "agent new" or "new · 1 game".
7. **The agent learns badly.** After "busy that Saturday evening", it said yes to the same Sat 31 Oct 21:00 slot ten minutes later. One "too far" (about 1.5 km) cut maxKm from 5 to 1.4. Asked directly, she gets offers that ignore what she said: Sat 21:00, 2.1 km, NT$150 above her 149 cap. "Busy" removed her from the whole huddle, so the host's agent bargained with no one and then said it "couldn't find a time".
8. **Smaller issues:**
   - Join and leave can be repeated without limit: 3 toggles gave 9 comments and 3 "Game on" notices.
   - The agent recommended a game she had just left, called "free court" (it was NT$165).
   - A huddle in `asking` never times out.

## Fairness concerns
- **Busy:** it is unfair. An agent can't see a calendar, and re-plans count the same no several times.
- **New people:** show-up is protected for 3 games, but 3 replies are enough to cut off the agent. "New" gets into 90% games that Bob (33%) can't. A fresh account wipes it.
- **Stuck forever:** yes. A waitlist has no promotion, no host "let in", and no way out, and a 0% agent stays gated forever.
- **Tone:** Strangers nearby see "keeps 0%" and "keeps only 52%", and the comments say "late drop" in public. Accusatory, and identifying via problem 5.

## Top 3 suggestions
1. Don't count `busy`. Count at most one promise per huddle. Let direct yeses rebuild the record.
2. Build promotion and a host "let in", make `join off` clear the waitlist, and remove leavers from the after-game check.
3. Salt the chain subjects. Send no raw rates for "new" people. Waive a late drop if the person joined under an hour ago or the game wasn't full.
