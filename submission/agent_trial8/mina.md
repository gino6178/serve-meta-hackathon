# Mina (phone, 375px) - trial 9

Done: cold landing, demo sign-in, home box request, area, one quick question, huddle (agents found Wed 4 Nov 18:00, NT$113 each; I said yes), joined Leo's gated game (Daan Badminton, "75%+") after joining the club, trust page and Details, courts page, menu, agent chat, Your games. Console: only 401s before sign-in.
Not found: a screen where Mina sets her own price/distance limits or a "say yes for me up to NT$X" rule (only "Let people nearby ask my agent" checkbox, unchecked). Sent that to the agent chat; got no setting.

## BUG
1. Agent chat contradicts Your games. After joining Leo's Sun 1 Nov game ("You're in") and saying yes to Wed 4 Nov, I told the agent "Say yes for me to badminton games up to NT$150 each". Reply: "Here is what I know: No game is booked in the next 7 days." Your games lists both. The delegation request got no acknowledgement and no setting.
2. Stated preference ignored/contradicted. Home box: "weekday evenings, under NT$200". The agent profile says "aim to pay under 250 each", and offered "A game near you ... one of your good times (Sunday evenings)" (weekend). "How you play" says it assumes weekday evenings until she answers, so "Sunday evenings is your good time" contradicts it. Her NT$200 never shows up anywhere.
3. A fresh account shows someone else's data. Menu > Your memory: "On this device, 4 entries": "Right knee was sore after Sunday's session", "Plays on weeknights after 19:00 and Saturday mornings", etc. (tagged "demo"). Mina never said these, and localStorage was cleared at the start.
4. Spots left disagree. Agent tab card for Leo's game: "2 spots left". Club post, before I joined: "Nobody yet - 3 left" (post says "need 3"). After joining: "You're in - 2 left".

## MINOR
- Cold landing says only "Join your club on Serve / Play more. Manage less." Mina has no club and nothing explains what it is (About is only in the menu, after sign-in).
- Bottom-nav "You" opens Games > How you play, and the Games icon stays highlighted. Tapping "Open" on a toast landed on an answer card (layout shifted), so it answered a quick question I did not mean to.
- "Only people nearby" plus a still-ticked "Also ask people nearby" is redundant.
- Club header "10 members" lists 8 names; Mina is not among them.
- Venue says "NT$450 for that hour" for a 90-minute booking (list was NT$470/90 min).
- Wording: "Games at 90% wait-list new people; at 75% or less they let you in" is hard to follow; "Agent right 86%" is jargon.
- The venue name 松山運動中心 and 梅花球場 stay in Chinese everywhere (also in a "which would you pick" example).
- The huddle opening message ignores the NT$200 limit.
- Layout: no text clipped or overlapping buttons on the pages I saw; the send button moves down as the home box grows.

Good: the huddle prefilled from the home box; the trust page is clear ("new, 0 games", chain, no name); no money or deposits; the gated game let a new player straight in as stated.

VERDICT: 0 BLOCKER, 4 BUG
