# Tom (Songshan, laptop) - trial 18

Covered: sign-up (demo), Agent home, Games (3 tabs), Club list/room, Feed (+tabs), Messenger, More menu (Courts, Highlights, Memory, About), invite link. Actions done: home box, quick question, limits + agent yes, area, start club, post game, overlapping post, let agents fill, give yes (x2), call off (x2), join, overlapping join, comment, like, share, leave, delete post, agent key + agent invite.

Console: only 401s before sign-in, 409s from the refused overlaps, one 403 from "Join a game for me" (agent paused). No other errors.

## Findings

BUG 1 - Overlap rules disagree. With a Sun 1 Nov 20:30 agreed game, the club form accepted my own post at Sun 19:00, but "Let the agents fill it" for that post answered NO TIME FOUND: "Every time that fits clashes with a game you already have." The form refused 19:30 with a clear message (409), but allowed 19:00. After I called off the 20:30 game the fill worked. Two checks, two different clash windows.

BUG 2 - Agent ignores my note. I saved "Keep Thursday nights free for the parents' group" on Memory. Then "Add my agent" > "Post an invite" posted Thursday 19:00 ("Looking for doubles at my usual time").

BUG 3 - Feed shows other clubs. Feed lists games and comments from Daan Badminton, Riverside etc. (I am only in my own club), each labelled "Members' posts stay in the club". My join was also written there ("Tom is in", "Tom can't make it"), visible to non-members. Label and behaviour contradict.

MINOR
- "Agent chats" opens the Games "Get a game" form (URL #/chats), not a chat list; sidebar highlights Agent.
- Quick question counter: header says "2 of 5 answers" but the card says "1 of 5" after answering; the same question stays on screen.
- Messenger reply uses raw date "Sat 2026-10-31 at 18:00" and no sport name.
- Agent paused message: "Your record is agent paused ... (GET /api/huddle/trust)" shows a raw API path.
- Invite page shows "Sun 19:00" with no date.
- "Deleted." toast stays on feed when switching tabs.
- Memory: "1 entries".
- About / Highlights: heavy jargon (A2A, bf16, DETR, Sapiens2, SAM 2.1).
- Court names like "Test Sports Centre 25.04-121.56" and 4 identical "Test can do that" lines (fixtures).
- Copy text in share dialog: "This browser did not allow copying" (local copy limit).

## Worked well
Numbers agreed across pages: NT$330/4 = 83 each, 20% under list; limits (8 km, NT$200) shown back on home; join counts on feed vs Your games (1 of 4) matched; overlapping join refused with a clear message; invite link opened; like/comment/delete/leave/call off all worked.

VERDICT: 0 BLOCKER, 3 BUG
