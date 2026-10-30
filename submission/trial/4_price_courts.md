# Serve trial 4: Wen, a student on a budget (courts and prices)

## What I did
Made the demo account "Wen Test" (area 25.017/121.54; tennis, pickleball, badminton) and answered 7 questions, always picking the cheaper or quieter game. Read `/huddle/places` for all three sports. Made 16 `/huddle/deal` calls and started 12 huddles. For comparison, set up "Wen Control" (no answers) and "Wen Opposite" (likes evenings and close courts, doesn't care about price).

## What worked
- Learning: weights went to quiet 0.38, price 0.35. Summary: "A quiet court matters most to you, then the price".
- The price rule adds up. Tennis at "Gymnasium" (NT$510/h, so NT$770 for 90 min): Tue 14:00 (25% full) NT$550, weekly NT$520; Tue 19:00 (76%) NT$740, weekly NT$680; Sat 09:00 (90%) NT$770, the list price. Every deal has `sample:true`, and the screen says prices are samples.
- Learning changes the picks. Badminton: Wen got 18% full at NT$140 each, Opposite 47% at NT$170. Tennis: 16% vs 32% full.
- A pickleball game pinned to Wed 14:00 at NTU Gymnasium (0.4 km) gave NT$270 for the court, NT$135 each.

## Problems, most serious first
1. **Paid sports centres show as "free court".** `/huddle/today` lists a game at 松山運動中心 with why `["usually quiet then","free court"]`. A huddle says "Leo has badminton … at Daan Sports Center … (close: 600 m, free court)", though that building is NT$290/h in Courts & prices. Cause: huddle.js:279 always uses `each: 0`.
2. **A pinned venue is dropped silently.** `start {sport:"tennis",need:2,pin:{date:"2026-11-03",start:"14:00",place:"osm:way/196634362"}}` produced "Tuesday 3 Nov, 14:00 at 北科大網球場", a different (public) court 2.6 km away. The pinned place isn't among the courts found around the group's middle point, and nobody is told.
3. **Grid hours can't be pinned.** The heat grid and Quietest list use 17:00 and 19:00, but huddles only start at 07/09/10:30/12/14/16/18/19:30/21. A pin at 19:00 says "There's no time left that I haven't already tried this week." The "Get a game then" link fails the same way when the offer is at 17:00 or 19:00.
4. **A failed map lookup reads as no courts.** The first two tennis huddles said "I found no tennis courts near the group on the map" while Wen's Courts tab showed 5 within 1.3 km.
5. **The questions contradict the busy model, and the agent learns wrong times.** One question calls Wed 19:30 "usually quiet" (the model says 0.85), another calls Sat 09:00 "usually quiet" (`/deal`: 90% full). The quiet option always fell on those days, so the agent says "You like Saturday mornings" and `/today` claims "one of your good times (Wednesday evenings)". Wen never gave a time.
6. **Two questions test nothing.** Q7 is labelled `[quiet,price]`, but both options cost NT$90 and are equally busy; only the time differs. In a time-only question with both options 2.0 km away, Opposite was told "how far it is matters more to you than the time".
7. **The Courts-tab offer ignores learning.** All three accounts get the same slot (tennis Mon 09:00), even Opposite, who wants evenings. The slot is ranked with `each:0` plus quietness.
8. **Bad input is accepted.** `/deal` for yesterday (2026-10-29) returns NT$300, and start "25:00" returns "Thu 25:00–26:30".
9. **The hours aren't realistic.** All 6 unpinned picks started at 21:00 and ran to 22:30, after sports centres usually close. OSM `opening_hours`, `lit` and `fee` are ignored. NTU's clay tennis courts are shown as "Free to use".

## Confusing wording
- "For a quiet hour I can do NT$740" about an hour that is 76% full. "It's usually only 76% full."
- The places `list` is per hour (510), the offer `list` is per 90 min (770). The card's "NT$500 instead of NT$770 for a court" never says 90 minutes.
- "I'll ask 1 people's agents". "aim to pay under 181 each" has no NT$.
- `/deal` on a public court 0.5 km away says "That venue isn't near you." The real reason is that it's free.

## Top 3 suggestions
1. Use one price model everywhere (`guessEach` for open games and recommendations), and never say "free" about a sports centre.
2. Keep pins to the user's choice: share start times across the grid, deals and huddles; reject past or invalid times; say so when a pinned place can't be used.
3. Build the questions from `busy()` and vary the day only on time questions. Use opening hours, lighting and fees.
