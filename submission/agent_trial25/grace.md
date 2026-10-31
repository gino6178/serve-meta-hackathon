# Serve trial 37: Grace Kuo's agent (local copy, http://127.0.0.1:8899)

All requests were HTTP via curl with `x-tester: grace`, and `x-serve-session` from Grace's creds file. About 40 requests in total.

## What was done

1. Read /llms.txt and /api/me. Grace Kuo (de-6168a66d1ec5), demo member. Her taste already shows Thu and Fri evenings as favourites.
2. Set limits: `POST /api/huddle/limits {"windows":[{"days":["Mon".."Fri"],"from":"18:00","to":"22:00"}],"maxKm":3,"maxEach":150}`. Response OK, limitKm 3, limitEach 150.
3. Started a doubles badminton huddle: `POST /api/huddle/start {"sport":"badminton","need":4,"nearby":true,"when":{"days":["Thu","Fri"],"parts":["evening"]}}` (id h-933835aa). It reached status "asking" after about 4 seconds.
4. Called it off: `POST /api/huddle/cancel {"id":"h-933835aa"}`. Status became "cancelled", and `waiting` became []. A second cancel returned `409 "It's already called off."`.
5. Joined an open club game in Daan Badminton (post pmvwb3v8u43f5fb94, Mon 2 Nov 19:30, Daan Sports Center, NT$90 each): `POST /api/feed/join {"post":...,"on":true}` returned joined true. The club thread got "Grace is in. 1 of 3 spots left...". Then I left: `POST /api/feed/join {"post":...,"on":false}` returned joined false, and the thread got "Grace can't make it. 2 of 3 spots left...".
6. Overlap check: while Grace was joined to the Mon 19:30 game, I did two things.
   - `POST /api/huddle/start {"sport":"badminton","need":4,"nearby":true,"pin":{"date":"2026-11-02","start":"20:00"}}` (id h-6ca2582d). It went to status "stuck" with the talk line "Every time that fits clashes with a game you already have." It asked nobody. I then cancelled it.
   - `POST /api/feed/post {"invite":{"sport":"badminton","day":"2026-11-02","start":"20:00",...}}` returned `409 "That overlaps badminton Mon 2 Nov 19:30 ... Pick another time, or call that one off first."`
   Grace was never booked into two overlapping games.
7. Left the Monday game at the end. Final state: joined false, no pending cards, no stale "are you in?".

## Findings

### BUG: a false status is told to Grace about a waitlist place

Request: the huddle h-933835aa, `GET /api/huddle/one?id=h-933835aa`, while status was "asking".

The talk contains:
- `{"from":"other","who":"Kenji","text":"Kenji can do that (the time).","yes":true}`
- `{"from":"other","who":"Joy","text":"Joy can do that (the time).","yes":true}`
- `{"from":"me","who":"Grace","text":"Agreed: ... Asking Leo, Lily and Bob for one yes. Someone else's agent said yes too: first in line if a spot opens.","agreed":true}`

But the same response has `"waitlist":[]`, `"waiting":["Leo","Lily","Bob"]`, and players only Grace, Leo, Lily, Bob. Kenji and Joy are recorded nowhere as a waitlist place. Grace is told someone is "first in line", and nothing in the state supports it. The same is true after the cancel (`"waitlist":[]`).

### Not verified: that the asked people were told the game was off

After the cancel, the talk shows only `{"from":"me","who":"Grace","text":"Grace called it off."}`. The asked players (Leo, Lily, Bob, and Kenji and Joy, who had said yes) get no visible message. `GET /api/feed/notices` for Grace was `{"notices":[]}` before and after. I cannot see the other members' views, so I cannot confirm they were told once, or that they have no stale ask. The huddle's `waiting` list was cleared, and status is "cancelled". I count this as unverified, not as a finding.

### MINOR: the taste grid moved after the cancel

Between `GET /api/huddle/today` (after the limits call) and `GET /api/huddle/me` (after the cancel), `Mon evening` went 0.88 to 0.92, `Sun evening` 0.6 to 0.64, and `Thu evening` 0.98 to 0.99. Grace answered no question in between. This may be the cancel counting as a taste signal, or it may be an ordinary update. I could not tell which.

### Checked and working

- Limits were applied. The huddle proposed Thu 5 Nov 20:30 at NT$100 each (venue NT$400 / 4), which is inside the window, the 3 km limit and the NT$150 cap.
- The club join and leave both worked, and each posted a thread message.
- The overlap refusal worked for both the huddle path and the post path.
- A double cancel is refused with 409.

## Not in the findings

- The Daan Badminton club member count changed from 7 to 8, and the Monday game's free spots from 3 to 2, with no action by Grace. That is simulated membership, so I did not count it.
- Victor joined and then left the Monday game, again simulated.
- Seeded members did not answer in real time, so I did not count "waiting" or silence as a finding.

VERDICT: 0 BLOCKER, 1 BUG
