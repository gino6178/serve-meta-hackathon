# Pedro (phone 375x812, English only) - trial 11

Done: cold landing, demo sign-up, home-box request, area (typed "Da'an District, Taipei"), quick question (picked B), limits (weekends, 6 km, NT$200, agent says yes up to NT$150; Saved), huddle for basketball, "Yes, I'm in", Your games card, agent chat, joined Riverside Hoops, feed, menu/About/Memory.
Console: only the two 401s from before sign-in on every page. No other errors. No crash or blank page.

## BUG
1. Venue names Pedro cannot read. Basketball game: "Sunday 1 Nov, 17:00 at 女生優先球場" (huddle page, chat, Your games card on home, "Games your agent is arranging"). Agent chat also proposed "籃球場". Quick-question example games show "松山運動中心". Only Chinese, no English. The Jhong Jheng venue has an English name, so it is inconsistent.
2. Feed (#/social) shows the same Leo Park badminton post twice (Mon 2 Nov 19:00, Daan Park, 3 left). One copy has the line "Joins straight in at shows up 100%+", the other doesn't, so the same game appears with different entry rules.

## MINOR
- Landing page (sign-in) only says "Join your club on Serve / Play more. Manage less." It never says what Serve is. Pedro has to sign up first to find out.
- Agent chat (#/messages) says "Your next game: Sun 2026-11-01 at 17:00. Games booked in the next 7 days: 1." The home card says only 1 of 3 said yes, still waiting. "Booked" is premature, and the date is in ISO format.
- Typing a question in the home box ("When and where is my game?") opens Games > Get a game as if it were a new game request, and shows it as "You asked your agent". Questions only work in the Messenger chat (paper-plane icon).
- Opening Games from the tab, without the home box, defaults the sport to badminton. My first huddle was a badminton game for a basketball player. I called it off.
- The "You" tab opens a page titled "Games" ("How you play"). I found no page called trust. The nearest is "What other agents see about you" (show-up and agent-right rates) at the bottom of it. Not obvious to a new user.
- Jargon: "huddles", "Autopilot", "gate", "Agent right 67%", "agents asked Serve to change... 1 of 3 huddles", "reading agent posts a few new papers" in a basketball club. About page: "our own RTX 3090" and "your server" are used for the same machine.
- Quick question stays at "2 of 5" with the same two examples after answering, and the first screen was short-lived (slow to update).
- Club page is empty ("Nothing in the feed yet") right after joining. The map labels are in Chinese (OSM).
- Hamburger menu looks see-through for a moment while it animates, with page text bleeding behind it.

Seeded members (Ray, Ken) did not answer, so I could not follow the game to a final "confirmed". Not counted.

VERDICT: 0 BLOCKER, 2 BUG
