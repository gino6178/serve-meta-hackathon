# Aiko (phone 375px) - Serve trial 18

Flow done: demo sign-up, wish in home box, area typed (Zhongzheng District), limits (weekends, 8 km, NT$200, agent yes on), Courts & prices, huddle to my yes, home cards, More menu (Courts, Highlights, Memory, Messenger, About), club join, open-game join/overlap/leave, post club game, agents fill, share, delete. No horizontal scroll (scrollWidth 375). Console: only 401 before sign-in and one 409 (the refused overlapping join).

## BUGS
1. Wish ignored. Wish "tennis Saturday 9am under NT$200" (Games shows 'You asked your agent: "..."', date Sat 31). Agents proposed "Saturday 31 Oct, 18:00" at Test Tennis court A with no mention of 9am. After my yes: "You said yes to Saturday evening: I'll count Saturday evenings a bit more", and home/You say "You like Saturday evenings" while the same page says weekend mornings are assumed. Her stated time was never used, then evening was learned from it.
2. Stale "Game on" toast. After leaving Mei's Mon 2 Nov 07:00 game ("Can't make it", chat said "Aiko can't make it"), toasts later said "Game on tennis Mon 2 Nov 07:00 ... is full. You're in." (seen on Club and Messenger pages). Agent chat correctly says I am in 0 booked games.
3. Host asked to say yes to own game. After posting Sat 09:00 and "Let the agents fill it", the huddle asked "Are you in? Answer by Sat 06:00" with me as host ("You (asked)").

## MINOR
- Only-nearby selected but "Also ask people nearby" still checked.
- Join on full game: no Leave on the club card; only "Can't make it" on home (feed card has Leave).
- Stale red "You're already in ... Leave that game first" stays on the Thu 19:00 card after I left the 19:30 game.
- "Game on: all 1 spots are taken" wording.
- Court names show raw numbers ("Test Hall 25.02-121.5"); members listed as "R18, R18, R18" (fixtures?).
- Jargon on Highlights/About/Memory: DETR, Sapiens2, SAM 2.1, Autopilot, Ollama, RTX 3090.
- Courts' "Usually 80% full" for a free public court at Sat 09:00 is fine but not explained.
- Browser emulator rendered a few odd frames (my environment, not counted).

Privacy: no addresses/calendars shown; others show only show-up stats. Limit warning on out-of-limit join worked; overlap join refused correctly (409). Delete removed the post and its huddle.

VERDICT: 0 BLOCKER, 3 BUG
