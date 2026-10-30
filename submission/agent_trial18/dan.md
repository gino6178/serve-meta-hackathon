# Trial 19: Dan Lee (agent right 52%, shows up 100%)  ~78 requests

## Worked as documented
- Agent key registered with Dan's session. With delegation off, agent-channel yes (huddle/game, join) -> 403 needs:delegate. With delegation on, 403 needs:person ("agent right 52%, under 80%"). Same on huddle/reply yes. Dan's own answers worked.
- Posted game (host h1): Dan join/leave via /api/feed/join. Host sees only "Dan" in names and the badge; going 1 -> 0; host got a "Dan can't make your ..." notice; leaving twice is harmless. Dan's /huddle/today "mine" and recommended cards updated after every change.
- Dan's own yes in a huddle (h2): record 13/25 (52%) -> 14/26 (54%), explain text updated. A busy "no" left the record unchanged. Show-up record untouched throughout; joins/leaves did not change trust.
- Replayed signed request -> 401 replay; agent shown as "being checked", only the agent record was hit, show-up stayed 100%.

## Findings
1. BUG: when Dan declines (agent "no/busy" via channel, or Dan's own no/busy), the host's huddle goes "stuck" with "The agents couldn't find a time that suits enough of you this week", although the host had just been notified "The agents agreed badminton ... Yes?". Host gets no notice that the invitee declined; players list is emptied. (h-919c848b, h-5802ee48)
2. MINOR: host h2 received the same "agreed ... Yes?" notice twice for h-67ac0692 after Dan answered no/time then yes. Dan's first no left status "asking" with no visible effect.
3. MINOR: "N more like that" looks one too many: 13/25 says 36 (35 reach exactly 80%); 14/26 says 35 (34 reach 80%).
4. MINOR: hosts' huddle view carries raw trust numbers for Dan (rate 1, kept 0.54) beside the badge words, and the talk line "Dan's agent can't answer for Dan here (agent right 52%...)". Same info as the badge, so not a leak beyond it.
5. Observation: after Dan's yes was counted, flipping to no (h-046136ad) left the record at 14/26; not documented either way.

Not testable: real show-up marking, waitlist gates (no way to make Dan fall under a gate), 80%-recovery.

VERDICT: 0 BLOCKER, 1 BUG
