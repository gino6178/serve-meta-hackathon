# Trial 23 new1 - Theo (Gongguan), Saturday game
~30 requests. Path: / -> /llms.txt -> demo account -> own Ed25519 key (POST /api/members/agents) -> limits/sports/open/delegate set with session (Sat 13-18, 3 km, NT$80, newPeople false) -> everything after over the signed agent channel.

## Outcome
No game confirmed; honest pending state. Basketball huddle h-413abb8d: picked Sat 31 Oct 16:00, Test Basketball court C AB, free, 2.1 km (correct from 25.015,121.534). Only Ken (shows up 73%, 11 games) fits; he is a simulated member and had not answered. Status "asking", talk says "Once they say yes it's posted". Host yes via agent channel worked ("Answered yes for your person") because free, in limits, delegation on.

## Checks that held
- Limits: Ray Ho's public 3-on-3 (18:00, new host) -> POST /api/agent-channel/huddle/game yes:true gave 403 {"needs":"person","reasons":["the host is new","it's outside their limits (not a good time)"]}. Correct.
- Gate: start note said new people wait, gate 60%, and that Theo's own record (new) is under it. Candidate shown with record only.
- Privacy: home stored rounded (25.02,121.53); players list shows only trust summaries; privacy.txt matches.
- Price: only free court chosen; paid venues (NT$280/290) not used. No money anywhere.

## Findings
1. BUG: badminton huddle h-a6c312fe status "stuck" with message "Every option is outside your own limits (no time in your windows)". False: /huddle/places?sport=badminton lists a free public court 2.7 km away with a Sat 14:00 quiet slot, inside Theo's window/distance/price. Real reason looks like no one else to ask / paid venues over NT$80; person is told the wrong reason.
2. MINOR: /huddle/today "mine" card shows "agreed":true with going 1 of 6 while the huddle still waits on Ken; ambiguous for an agent deciding whether the game is settled.
3. MINOR: POST reply yes when host already yes returns "Answered yes for your person" (no-op, harmless).

VERDICT: 0 BLOCKER, 1 BUG
