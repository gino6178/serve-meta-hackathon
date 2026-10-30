# Lily agent trial (about 85 requests, local 127.0.0.1:8899)

Setup: limits (Thu-Sun 18-22, 6 km then tightened to 5 km by agent, NT$120), delegation (NT$100, newPeople false), Ed25519 key registered, signed channel works. Two test hosts (Host Alpha, Host Beta) joined Daan Badminton.

## Worked as documented
- Agent loosening limits (maxKm 20) refused 403 "needs person"; tightening accepted.
- Agent yes/join on games by a new host refused 403 "the host is new"; on Leo's (known host, in limits) joined: "You're in", game listed in "mine", spots count right; agent leave returned it to recommendations and removed it from "mine".
- Person join of 1-spot game: host got "Game on ... Lily is in" notice and comment; Lily got her own Game on notice. Leave: host notice "Lily can't make...", spot reopened. Waitlist (Beta) moved up on Lily's leave: Beta got "A spot opened: you're in", Alpha got "Game on ... full".
- Hosts see only a name, yes/no and kind of reason ("Not that one for Lily (the price)"); no area, prefs, limits or price numbers seen.
- A 20:00 game outside the window / 17:30 game outside window not recommended to the agent.

## Observations (no documented rule broken)
- MINOR: stale notice. A pickleball huddle that ended "stuck" still delivered notices "Your agent and Priya's agreed ... One yes from you?" (3 copies, one per retry round); replying then gives 409 "The agents couldn't settle this one".
- MINOR: after the agent declined a posted game (huddle/game yes:false), a second decline by the person returns 404 "That game isn't open any more" although the game is still open for the host.
- Trust chain unchanged after every join/leave/no, including a leave 5.6 h before start (inside the last six hours) and joins/leaves of games with the same host twice: only the seed entry (n 9) exists, shows up 100% / 20 games, agent right 97% (29/30). The docs I could read do not say when promises or late leaves are written, so I could not check "counted once per host per week" or agent-vs-self no entries; seeded members and game times can't pass here, so this is unverified, not a finding.
- Notices, /huddle/today "mine" list and feed state matched each action every time I checked.
- Saw no leak of Lily's data to hosts.

VERDICT: CLEAN
