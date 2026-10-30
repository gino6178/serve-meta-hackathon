# Grace-Lee (45, Wenshan, laptop) - trial 19

Covered: sign-up (demo), Feed, Agent home, home box, Games (Get a game, Courts & prices, How you play), quick questions, limits and agent yes, club start, post game, overlapping post, post 90 min later, fill with agents, share link, invite link, join, overlapping join, comment, like, leave, delete post, Messenger, More menu (Courts, Auto highlight, Memory, About), Talk, Add my agent. Console: only 401s, plus 409/400 from refusals I caused on purpose.

## BUGS
1. Messenger agent contradicts my games. I asked "What games do I have this week?" It said "No game is booked in the next 7 days." I was hosting two Thu 5 Nov games, and the Agent page showed "YOUR GAMES Tennis Thursday 5 Nov, 19:00".
2. Auto highlight sample clip shows invented history. I picked a sample clip. The steps then said "Received your video 5.4 MB, on your own server only", "Found you... you are the nearer one", "Made earlier on our GPU ... 2026-10-29", and the title read "Your smash, from your video". None of that is mine.
3. "Agent chats" (right panel on Feed, "What your agent said to theirs") opens the Get a game form. There is no chat list or empty state.

## MINOR
- Messenger took the question "Am I hosting any tennis game on Thursday?" as an order and offered a draft invite (Thu 5 Nov 19:00, "Post it"). It would have overlapped my own game. I cancelled it.
- How you play says "time matters most, then price", but the bars read Time 28%, Price 28%, Quiet 28%, Distance 16%. After 1 pick and 3 "either is fine" answers it states "You like Thursday evenings".
- Before any answer, the page says "I don't know how you like to play yet" but already shows "aiming under NT$250".
- Saving limits gives no "Saved" message. The summary line just changes.
- The club place name I typed ("Wenshan courts") is not shown on the club page. The first typing attempt was lost when the form re-laid out.
- Jargon for a plain reader: "waitlist", "Autopilot", "huddle", "A2A", "Ollama", "bf16", "DETR/Sapiens2/SAM 2.1", "Reset to demo" with 0 entries.
- My posts show the author as "You" twice. A host card says "Nobody yet · 3 left" although I am in the game.
- Feed lists Ray's "R19, R19, R19 are in" (repeated names). The Games page shows "What the agents asked Serve to change" as already sent, though I have had no huddles.
- Highlights sport list has no squash, and the About sports list omits squash. Games has squash.
- The Talk button asks for the mic. The refusal reads "The microphone was not allowed", which is handled well (the pane blocks the mic).
- Courts prices drift between loads (Test Hall NT$490 to NT$500). This matches the "price can move a little" note.

## Worked as promised
- Overlap post refused with a clear message.
- Overlap join refused with "Leave that game first".
- Too-far join was allowed, with a note that it is outside the agent's limits.
- Leave, delete, like, comment, share link and invite page ("YOUR GAME ... 3 spots left of 3") all worked.
- Agent page figures (6 km, NT$200) match my limits.
- Add my agent registered a key.

Not tested: "give her yes" and agent proposals (no one nearby), because nobody had opted in. Call off was covered by delete only.

VERDICT: 0 BLOCKER, 3 BUG
