# Newcomer trial: Tina (Taipei 101, badminton doubles, weekend evenings)

Fri 30 Oct 2026, 09:17–09:35, on 127.0.0.1:8899. Raw responses are in `scratchpad/trial/work_tina/`.

## What I did
Signed in with the demo login, opened `today`, shared my area and set badminton. Answered 6 questions, always picking evenings. Joined Leo's Sun 19:30 game and opened myself to nearby players. Started a nearby huddle for 4, said no to its time as host, then called it off. Turned down one recommended game, checked courts and a venue price, read my trust record, and replayed and verified the chain myself.

## What worked
- The chain replays from my side and the head's Ed25519 signature checks out.
- The agents' talk reads well, and the venue haggling is believable.
- The first card was Leo's game, a real weekend-evening doubles game. Joining took one call.
- The time-conflict filter hid Ivy's Sun 21:00 game once I was in Leo's.

## Problems, most serious first
1. **The trust chain can be traced to a person.** `who = sha256("serve-trust:"+memberId)`, unsalted (trust.js:44). Feed posts show `by.member` (Leo: `de-a6ec2c1ae099`). Hashing that gives `442d9bab6f4fd994`, which owns Leo's entry (8 games). The app says "never by name". My `asked` entry is also stamped 1 ms after my huddle's `created`.
2. **The agent learns "Thursday", not "evenings".** 5 of 7 questions were the same Thu 19:30 vs Sat 09:00 pair, and no weekend evening was ever offered. After six evening picks: `Thu evening=1`, `Sat evening=0.54`, below `Sat afternoon=0.6`. `huddle/start` can't say "this weekend". It proposed Thu 21:00, then Wed 21:00. Another tester's huddle found Sat 21:00 at 18% full.
3. **The host is a yes before any time exists** (`answers:{[me]:"yes"}`). My host no (`reply {why:"time"}`) came back as "Not Thursday evenings, then.", turning one date into every Thursday. The summary still said "You like Thursday evenings", and the deal card still offered Thu 5 Nov 21:00, the slot I had just refused.
4. **"Free court" at paid sports centres.** `gamesFor` sets `each:0`, so Daan Sports Center and 松山運動中心 say "free court". The same app quotes NT$83 each at Taipei Gymnasium.
5. **Games I can't get into are recommended, and the waitlist can't be left.** Hugo's game is `newOk:false`. Joining replied "You said yes to Tuesday evening…" with no word of the waitlist. `feed/join {on:false}` left me on it (posts.js:199 returns early when `on===was`).
6. **The joined game vanishes.** It sits in a club room I'm not in: not in `/api/feed`, no `today` card, no notice. Leo's agent wrote "badminton 2026-11-01 19:30".
7. **The two join routes disagree.** `huddle/game` refused Ivy's game with 404 "That game isn't open any more" (it was open, just clashing). `feed/join` then let me double-book. I left at once.
8. **Courts took about 4 minutes in a cached area.** Until then questions said "an indoor court". Later one put 大安運動中心 at 800 m, but the courts list says 1.7 km. The same venue is also "Daan Sports Center".
9. **Minor:** "Dan will be asked directly", but he never is. Under the default "Anyone" gate, Bob (shows up 33%) was picked over Kenji, who said yes. Nothing in the code times out an `asking` huddle.

## Confusing wording
- After Q1 (time vs distance only), the summary said "then the price".
- Q4 (same 2.0 km) said "the time matters more to you than how far it is".
- "Aim to pay under 250 each" has no NT$.
- "Only 51% full… a quiet hour": 45% is "usually quiet" in one place and "a few people usually" in another.
- `/question` shows "6 of 5".

## Top 3 suggestions
1. Salt chain IDs with a server secret, round `at` to the day, and drop member IDs from posts.
2. Let `start` take when to play ("this weekend, evenings"). Vary day and part of day separately in the questions. Ask the host for a yes too.
3. Keep one truth per game: the real price, the gate result on the card, a "your games" card on `today`, the same rules on both join routes, and a working way to leave the waitlist.
