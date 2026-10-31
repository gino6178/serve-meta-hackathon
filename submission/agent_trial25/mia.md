# Mia Huang trial: casual weeknight badminton near Songshan

Server: http://127.0.0.1:8899 (local test copy). Every request sent with `x-tester: mia`. About 30 HTTP requests in total, made with curl as a person clicking would. No files read, no source opened, no other site contacted.

## What Mia did

1. Opened the home address. It returns a short JSON document with links to a guide and an API description, not a page. Mia would see raw text here.
2. Read the guide (/llms.txt). It is long and full of terms (huddle, agent channel, delegation, trust chain, gate, fill, A2A). Mia would stop reading about here.
3. Signed in with demo sign-in as "Mia". Worked.
4. Set her area (typed "Songshan District, Taipei"), sport (badminton), and limits (Mon to Fri 18:00 to 22:00, within 3 km, at most NT$150 each). All saved, and the summary repeated them back correctly.
5. Checked today's cards. Nothing was waiting, so the page said to start a game. A "which would you rather play" question was shown with sample games. Mia picked the closer one.
6. Started a game: badminton, 4 players, nearby people allowed. It said it would ask people nearby.
7. Polled the game. It stayed in "talking" with no players for about 40 seconds. The brief says the simulated members do not answer in real time, so I do not count this.
8. Later polls showed a proposed time and place: Thursday 5 Nov, 19:00, "Badminton court · 梅花球場", 2.6 km away. Mia had picked a Monday option, and the agents moved the game to Thursday without asking her. The chat said "Agreed ... a free court. Asking Lily, Joy and Kenji for one yes."
9. Mia said yes as host. The game stayed "asking" (not "on") with 0 of 3 others yes. The 24-hour deadline is shown only in a raw number.
10. Answered a second taste question (cheaper option), which changed her weights.
11. Looked at the open feed: two posts. One was a badminton game at NT$200 each (over her NT$150 limit, with no warning in the list). One was basketball. Did not join either, as a normal Mia would not.
12. Called off her own game. The status became "cancelled" and the game left her list. Calling off works.

**Outcome for Mia:** she did not get a confirmed game. She got a proposed slot at a court, said yes, and the others never answered. The site does not clearly say "waiting for the others" on her card.

## Findings

### BUG 1: "Agreed" shown before anyone else has said yes
- The game card in today's list says `agreed: true` with a day, time and place, while the detail view for the same game says `status: "talking"` (first polls), then `"asking"` (after her yes), and `on: false` throughout.
- The chat line says "Agreed: Thursday 5 Nov, 19:00 ... a free court." Only Mia had said yes at that point. Mia would reasonably believe the game is set.
- This is a false statement about the state of her game, in a core flow (getting a game).

### BUG 2: "a free court" with no venue data behind it
- The game was placed at "Badminton court · 梅花球場" with `each: 0`, `price: 0`, `sample: false`, so it is described as free.
- The venue list at GET /api/huddle/places returned empty: "The map of courts isn't answering right now." No venue quote was asked for.
- The guide says venue prices are samples until a venue joins. So the "free" price is not something the site knows. Mia, who wants cheap, was told a price the site could not check.

### MINOR
- Home page (GET /) is raw JSON, not a page a person can use. Mia would not know what to do with it.
- The guide is very long and uses jargon Mia would not follow: "huddle", "agent channel", "delegation", "A2A", "trust chain", "gate", "fill", "agent right".
- Trust wording is unclear for a normal person: "shows up likely 34-92%", "agent keeps its word", "waitlist new people at 90%", "agent new". A range like 34 to 92 percent would make her less sure, and nothing says what to do with it.
- The agents changed Monday (her preferred option) to Thursday with no explanation. She was not asked.
- After one answer the site said "how far it is matters more to you than the time" and "You like Monday evenings". Its own confidence was 0.2. Overclaiming taste from one answer; Mia would not trust that line.
- The sample questions show invented games ("Monday 2 Nov, 18:00 ... a few people usually") as if they were real options.
- The game card in her list has no price, so "not expensive" cannot be checked from the list.
- The feed lists a NT$200 game next to her NT$150 limit with no flag, so she could join it by accident.
- The court name is Chinese only, and a feed post shows "Test court Xinyi". Looks like test data to a real person.
- The Thursday time is inside her window, and the distance (2.6 km) is inside 3 km, so the limits were respected for the time and place that were agreed.
- The "waiting for the others" state is not labeled on her card. Mia would have to infer it from "asking" and a raw timestamp.

## Did the site promise anything false about her game?
Yes, in two ways: the game was called "agreed" before anyone but Mia had said yes (BUG 1), and the court was called "free" with no venue data (BUG 2). Calling off worked and removed the game cleanly. Her limits were respected for the time and place the site picked.

VERDICT: 0 BLOCKER, 2 BUG
