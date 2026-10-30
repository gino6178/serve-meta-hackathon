# Lin (phone 375px, badminton Sat morning under NT$120)

Journey done: demo sign-up, wish typed in the home box (parsed to badminton / Sat 31 Oct morning), area set by typing "Wanhua District, Taipei" (browser refused location), 5 taste questions, limits (NT$120 max, agent may say yes up to NT$120; saved, persisted after reload), got a game (Jhong Jheng Sports Center, Sat 09:00, NT$100 each, within limit), joined/left Leo's Sun 19:30 game, overlap refused, posted two games, stop and call-off.

## What worked and told the truth
- Game price NT$100 <= limit 120. Home card "1 of 4 said yes" matches the huddle ("waiting for Kenji, Bob").
- Overlap: posting Sun 20:00 while in Leo's 19:30 game was refused: "That overlaps badminton Sun 1 Nov 19:30 ... Pick another time, or call that one off first." Leaving worked (spots 2 left -> 3 left); posting then succeeded.
- Stop the agents filling it: game stayed in club feed and home "YOUR GAMES".
- Call off: game left the club feed; share link (#/invite?id=pmvum6e7ve2401501) says "That game is not open any more."
- Console: only 401s, one 409 (overlap refusal) and one 404 (called-off invite). No other errors.

## Findings
1. BUG: "Stop the agents filling it (the game stays)" turns the huddle badge to "CALLED OFF" (huddle page and the "Games your agent is arranging" list), the same badge that Call off shows, while the game is still live in the feed and home. The log line says "the game itself stands", but the badge says the opposite. Repro: post Sun 20:00, Let the agents fill it, click Stop.
2. BUG: After "Call off the game", the home screen still shows an agent prompt "The agents agreed badminton Thursday 5 Nov, 19:00 ... Yes?" with Open. Open leads to the CALLED OFF huddle. Asks the person to say yes to a game that is gone (persisted after reload).
3. MINOR: As host I am shown "You (asked)" and, on the first huddle, "Are you in? ... Yes, I'm in" (Sat game; Thu fill game too), while the Sun fill game says "You started this game, so you're in it: there's nothing to say yes to." After I said yes, "You (asked)" stayed. Inconsistent. My agent did not say yes automatically although auto-yes was on and the price was within limits (it said "Lin is asked for a yes too"); possibly by design for the host.
4. MINOR: Taste answers produced "aim to pay under 255 each" before I set limits; the home card updated to 120 after saving. Court list ("Finding courts...") sometimes did not load in the start-game form; typing a place name worked.

VERDICT: 0 BLOCKER, 2 BUG
