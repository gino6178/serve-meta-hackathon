# Organizer trial: Oscar (Daan Park, badminton doubles)

## What I did
Signed in as Oscar plus friends Pia, Quinn, Rosa and Sam, all living near Daan. Trained three agents; Sam untrained. Started club c-f4a1fd3e; all joined. Huddles: club only (h-49af147f), club plus nearby at 90% (h-a50056f2), pinned court (h-e639817c), pinned time (h-d11d819f, h-e4737af1). Friends said yes, and no with each reason. Cancelled, posted a gated invite, dropped Sam from the booked game, read notices, feeds and For You.

## What worked
- Club and joining: one call each. Readable talk, believable haggling ("Would you take NT$260?" → "NT$340, as low as I go").
- h-49af147f got booked after two re-plans and was posted to the club feed.
- Gate lines are clear.

## Problems, by severity
1. **A re-plan throws away yeses instead of swapping in a player.** h-49af147f: Mon 21:00 had yeses from Oscar, Rosa, Sam, and Pia's agent. Quinn sent `{"yes":false,"why":"busy"}`; all moved to Wed elsewhere, Rosa and Sam asked a third time; each no burns one of 3 tries.
2. **No clash check.** With Wed 4 Nov 21:00 booked, pin `{"date":"2026-11-04","start":"21:00"}` agreed a second game at the same hour ("Wednesday evenings suit Rosa").
3. **A pinned place is ignored without saying so.** I pinned `place:"osm:way/194580871"` (大安運動中心, from /api/huddle/places) and got Taipei Gymnasium with no explanation (huddle searches the group middle; Courts & prices, the host).
4. **One no kills a pinned game.** In h-e4737af1, Rosa's `why:"time"` led to "There's no time left that I haven't already tried this week." One time tried; others could fill it; host not told.
5. **An untrained agent says yes, and the person pays for it.** Sam's agent had 0 answers but said "Thursday evenings suit Sam". After his one real no, his record reads "keeps only 67%". Later huddles say "Sam will be asked directly", but he never is.
6. **The gate does not deliver "reliable only".** At 90%, two of the three picks were "new · 0 games", while Hana (100%, 12 games) said yes and was left out. Picks are ranked by taste only, and the UI has no `newOk` switch.
7. **Booked games go stale.** Sam left through `/api/feed/join {on:false}`. The huddle still says `on` with "Sam:yes", Oscar got no notice, and nothing refilled the spot. `cancel` on a booked game returns 409 "It's already settled." The waitlist promise ("the day before, it's X's") has no code.
8. **A no on price makes the next pick dearer.** Pia said "Too dear: I'll aim under 90 each", and her agent then said yes to NT$98, then NT$118.
9. **A silent player blocks the game for good.** Leo (seeded) was picked in h-a50056f2 and never answers. No deadline or replacement.
10. **Duplicate and stale notices.** Every player got two "Game on" notices, one with a raw date ("2026-11-04 21:00… is full"). Old "One yes from you?" notices stay after a re-plan.

## Confusing wording
- Recommended games always say "free court", including at the Daan Sports Center and at 松山運動中心 (NT$165 each).
- "usually only 76% full… For a quiet hour I can do…"
- "the price works for Pia" before any price has been agreed.
- Suggests Hugo's game, whose gate would waitlist Oscar.
- "all 1 spots are taken".
- `/api/huddle/answer {q}` needs the whole question object; sending the id returns "No such question."

## Does it save work?
Slot and price cost almost no taps, but every no resets the group, the host hears nothing until stuck, and drop-outs need spotting by hand. About even with a group-chat poll today.

## Top 3 suggestions
1. On a no, offer the spot to the next agent who already said yes to that slot and keep everyone else's yeses. Re-plan the time only if nobody can fill it.
2. Skip times when a player is already booked, honour a pinned place or say why not, and notify the host of every no, drop-out and timeout (with an answer deadline).
3. When a gate is set, rank by reliability, add a "people with a record only" switch, and don't let an agent with no training say yes for its person or mark their record.
