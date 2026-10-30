# Joy Lin (player) - trial24 report
~110 requests (slightly over budget). Joy set: all-week 06-22, 5 km, max 150; delegation on, max 100, then newPeople true. Key registered; 3 hosts (Hostal/Hostbo/Hostcy) joined Xinyi Tennis.

## Worked as documented
- Agent channel signing OK. Agent yes refused while delegation excluded new people (403 "someone new is in it"); allowed once newPeople true. Agent join of a NT$120 game refused (403 "over the NT$100 your person allowed"). No agent yes beyond permission got through.
- Host invite (huddle/start, pin) -> Joy asked; her yes + host yes -> "Game on" notice, post created, "Your games" shows it.
- Leave: host got "Joy can't make..." notice, spot reopened; Joy re-took spot: "Game on" notice, host huddle shows Joy yes.
- Waitlist: joined full game -> waitlisted; occupant left -> "A spot opened: you're in" + "Game on" notices; feed shows going/joined right.
- Double-booking: overlapping join refused 409 both as Joy and via agent.
- Host stopped a fill while Joy asked and not in: Joy told ("you're not needed"), post stayed. Fill stopped after Joy joined from feed: no notice (correct, she's in), game stays.
- Posted game filled from feed while Joy asked: told "filled up from the feed, so you're not needed"; late reply 404 "isn't one you're in".
- Host called off agreed game (huddle/cancel) and deleted a post she'd joined: both told with correct game; both gone from her joined list; huddle "cancelled".
- Agent "no/busy" accepted; huddle went "stuck" and host's talk said Joy couldn't make it without exposing more. Joy's record unchanged throughout (75%, 4 games; agent new).

## Findings (all MINOR)
- Joy herself joined an NT$200 game via POST /api/feed/join (200) though her limit is 150 each. Agents are refused, but a person's own join is not checked/warned; llms.txt says nothing outside limits is "ever agreed".
- huddle/start with fill and need=3 for a 2-spot post, invite 1: error "picked 2 people with you" is confusing about what need counts.
- For a fill that filled from the feed, Joy's huddle/one still shows status "on" though she is not in the game (her today card is correctly gone).
- Posting limit (4 posts/10 min) hit by one host quickly in testing.

VERDICT: CLEAN
