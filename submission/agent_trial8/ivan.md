# Ivan (r9ivan) report, ~85 requests

Setup: limits (Tue/Wed/Fri 18:00-21:30, 3 km, NT$100), delegation (newPeople false), open, key registered. Two test hosts (Rhea R9, Sam R9) joined Daan Badminton.

## Worked as documented
- Delegation and limits: agent yes refused with clear reasons ("outside limits (not a good time)", "NT$113 over the NT$100", "someone new is in it", "the host is new"). Agent yes allowed only for the known host's Tue game (agentMay ok).
- Agent loosening limits (price, days, km) refused; tightening accepted; agent cannot change delegation.
- Taste: agent yes (huddle and game join) left answers at 5. Ivan's own question answer through the channel moved it to 6, and his own huddle yes moved it to 7.
- Host side: Sam saw only "Ivan can do that (the place)", yes/no, trust badge. No limits or area. Rhea saw only names, never the waitlist.
- Notices: call-off ("Sam called off ..."), waitlist moving up ("A spot opened: you're in"), Game on, host "can't make it ... 1 of 1 spot left". All matched what happened.
- Trust: person yes on Sam's huddle gave chain entry n22 `promise kept:true` and agent right 86% to 88% ("7 of 8"). Chain verifies; no raw ids in it. Show-up needs real games, which can't be tested here.

## Findings
1. BUG: Ivan's agent contradicts itself in Rhea's huddle h-391b5975 (singles, pinned Wed 11 Nov 19:00). It said no to 松山運動中心 "(the price)", then to the next venue "Not that one (the price). A counter: Wednesday 11 Nov, 19:00 at 松山運動中心", countering with the venue it had refused for price at the same time. The first no had no counter. The huddle ended "stuck".
2. MINOR: A no I gave for Ivan (Mina's huddle, "price") after the agent had predicted "Ivan can do that" left no chain entry and no "agent right" change, and my agent yes on Tue's game also left none. Only his own yes did. The guide says an answer "by you, for them" counts, so this is unclear.
3. MINOR: stuck message says "Try fewer players" when need was already 2.
4. MINOR: start with need 4 and one invite gives "You asked for 4 players but picked 2 people with you", which is confusing (host counted?).
5. MINOR: after Ivan's busy no on Grace's Saturday huddle, Hana was asked in his place while waitlisted Kenji and Bob stayed on the waitlist (unclear whether intended).

VERDICT: 0 BLOCKER, 1 BUG
