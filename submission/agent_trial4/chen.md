# Mr. Chen (63, tablet) - Serve trial

## What he did
Typed his name, tapped "Try a demo account" (the name box is optional; unclear). Landed on a social feed, not the agent. Tapped the sparkle icon, typed his wish in the home box ("gentle badminton, weekday mornings, near Da'an Forest Park, short games, club for older adults"). The Huddle page understood it well: badminton, weekday mornings, 4 players, and echoed his words. Typed "Da'an District, Taipei" as his area; it worked. "Let the agents work it out" proposed Tue 3 Nov 07:00, NT$83; he tapped "Yes, I'm in". Clubs: none for older adults, so he started "Da'an Gentle Badminton" with the "Gentle games" type (good option), posted a Tuesday 09:00 game, tapped "Let the agents fill it", and opened "How you play".

## Where he got stuck
- After typing in the home box, nothing said "got it"; he was dropped on a page called Huddle.
- Second search said "NO TIME FOUND" and "Tuesday 09:00 doesn't work: too soon, or you already play then" - he did not know he'd already agreed to 07:00.
- First "Yes, I'm in" click seemed to do nothing (the page didn't change until a second tap; may be the hidden-pane test setup).

## Problems, worst first
1. Dark-brown message bubble in the agent chat (Huddle, "Dan's agent can't answer for Dan...") is dark text on dark: unreadable. 
2. Jargon throughout: "Huddle", "agent keeps 97% of its yeses", "Shows up 100%", "Agent right 97%", "wait-list", "late drop", "Chain verified... hash 8a8dd73c", "/api/trust/chain" (How you play). Scary and meaningless to him.
3. Start-a-game form defaults to 7:00 PM Thursday, and the time shows "下午 07:00", but Gentle games only allow 08:00-16:00. Day shown as "Thu"/"Tue", no date. Default 3 players.
4. Agent chat says "Chen says yes too, like everyone else" before he had said yes. Looks like it answered for him.
5. Games offered are 90 minutes (Tue 07:00-08:30) though he asked for short; offered "Friday 30 Oct 20:00" evening game repeatedly and a toast "Your agent found a game" (evening) keeps reappearing after dismissing, covering buttons (e.g. "Let the agents work it out").
6. Small text: grey explanatory lines, "1 of 3 huddles", chips, hint text under toggles. Left nav is icon-only, no labels; the sparkle (Agent) was a guess.
7. New club feed says "reading agent posts a few new papers a week" - irrelevant for badminton.
8. "What the agents asked Serve to change" block on Huddle is noise for him. Map labels cropped at the left edge on Clubs; map defaults to Xinyi, not his area.
9. Place-name box after pinning the map came up empty after re-render; typed text also appeared in the "Share with the club" box (could be test tool; recheck).

## Top 3 fixes
1. Fix the unreadable bubble colour and replace trust/agent jargon with plain words ("Usually comes: 9 of 10 times"); hide the chain/hash panel behind "Details".
2. Confirm his home-box request in words ("Looking for badminton, weekday mornings near Da'an") and, with the Gentle games club type, default the time/day to the allowed window and local 24h/AM format; show full dates.
3. Make the "agreed Tuesday 07:00" state visible when searching again, remove repeated evening toast when his wish is mornings, and add text labels to the nav icons with larger body text.
