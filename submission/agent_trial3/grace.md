# Grace Kuo (badminton) - trial report

## Works now
- Session set limits (Mon-Fri 18:30-22:00, Sat/Sun 17:00-21:30, 5 km, NT$150) and delegation (on, 150, newPeople:false): 200, reflected in /api/huddle/me.
- Key registered (POST /api/members/agents); first signed GET /api/agent-channel/me returned 200 on the first try, following the published rules.
- Signed today cards, game join (Leo's NT$90 Sunday game: "You're in."), huddle start with club id, `when`, `fill` (Mon 2 Nov game posted via /agent-channel/post; fill huddle found Hana/Ivan/Lily/Leo), poll via /huddle/one.
- Delegation refusals work: signed /huddle/reply yes on a NT$225 pick -> 403 "NT$225 each is over the NT$150 your person allowed: ask them." (needs:"person"). Signed /huddle/game and /agent-channel/join on Ray Ho's (new host) post -> 403 "The host is new, and your person wants to decide those".
- Agent's game join did not change taste (weights, grid, answers, learned count unchanged).
- Pins at Tue 14:00 and 21:30 refused 400 "outside the times you set".

## Problems (ranked)
1. **Agent's signed answer teaches Serve** (contradicts llms.txt). GET /api/agent-channel/huddle/question, then POST /api/agent-channel/huddle/answer {"q":<question obj>,"pick":"a"} -> 200; afterwards /api/huddle/me weights went time .38/quiet .34 -> time .25/quiet .50, answers 5->6, new learned line "Noted: a quiet court matters more to you than the time." Fix: reject or ignore answers on the agent channel (or mark them non-learning).
2. **Pin is not held to the price limit, and the pin's place is ignored.** POST /agent-channel/huddle/start {sport:badminton,need:2,club:c-e6267051,pin:{date:2026-11-04,start:20:00,place:"Taoyuan Arena, Taoyuan"}} -> 200; the huddle picked 松山運動中心 at NT$230 each ("Agreed ... NT$230 each. Asking Ivan") with limitEach 150 and limitKm 5. The same happened without a place (Tue 3 Nov, NT$225). Limits text says "nothing outside is ever agreed". Fix: filter venue choices by maxEach/maxKm, and reject (400) a pin place that is unknown/outside range instead of silently substituting.
3. Trust explanation omits the agent cut-off: /huddle/trust explain says "Your agent keeps 94%... It may answer for you." but never states the 80% cut-off (agentMin 0.8 appears only in game gate). Show-up cut-offs 75%/90% are stated.
4. Misleading error: start with club name "Daan Badminton" -> 403 "You're not in that club." (club id c-e6267051 works). Accept names or say "use the club id".
5. fill with need:3 returns need:4 (badminton allows 2 or 4) although the posted game has 3 spots; fill should use the post's open spots.
6. Huddle talk shows other members proposing times outside Grace's window (Hana: "Friday 30 Oct, 18:00", before 18:30) - harmless but noisy.
7. After 3 live huddles, start returns 429 until one is cancelled; cancelled ones free the slot (OK, just undocumented in llms.txt).

## Not tested
A known host's game over NT$150 (no such post existed and I had only Grace's account); replay/bad-signature penalties (avoided to protect her record).

## Requests
About 55 requests, all with x-tester: grace.
