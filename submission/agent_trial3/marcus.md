# Marcus (badminton host, laptop 1280x900) - trial report

## What worked
- Demo sign-up, area ("Da'an District, Taipei" + Set), club creation, and posting Thursday 19:00 (3 spots) all worked.
- The agents' talk is readable: slot proposals, "no, too far / too busy", counter-offers, venue haggling NT$410 to NT$320 (NT$80 each). The 75% gate is visible (Bob waitlisted at 33%; Dan asked directly because his agent is right only 52%). "Waiting for Leo, Joy, Dan until Sat 10:28" is clear.
- Courts & prices grids and the chain proof ("Chain verified 18 entries", "Show your 1 entry") make sense.

## Problems, worst first
1. **"Let the agents fill it" dead-ends.** Club feed card > "Let the agents fill it" > tick "Also ask people nearby", Shows up 75%+ > "Let the agents work it out": red "Give the game a date first (YYYY-MM-DD)". No date field exists on that form; the posted game only has a weekday. The headline feature fails for a normally posted game. The stale fill state also survived navigation until a hard reload.
2. **Posted game and agreed game differ.** I posted Thu 19:00 at Daan Park courts. The fallback (plain Get a game, "Thu 05") agreed Thu 5 Nov 07:00 at Taipei Gymnasium, 3.2 km. Home "Your games" still says "19:00 Daan Park courts, 0 of 3 joined" and never shows the agreed 07:00 game. He cannot tell which is real, and he would go back to the group chat. The agents opened with 14:00 and 16:00 even though his default is weekday evenings.
3. Agents ignored the free public court 1.8 km away and chose a paid centre ("sample price, nothing is paid here"). The talk says "I'll ask 9 people" but only 7 agents answer.
4. Defaults: "With whom" is "Anyone in club, 0 others" (club has only him), and "Also ask people nearby" was unticked after reload. A new host finds nobody unless he spots the tickbox.
5. Club form: "Start the club" is greyed with no reason; you must tap the map (tiny "Tap anywhere to pin the place"). Text typed into "Name the place" was swallowed while "Finding courts..." loaded, then reappeared doubled ("Daan Park courtsDaan Park courts").
6. Post card says "Nobody yet · 3 left" though the host plays; feed shows "You" twice.
7. Home offers basketball/tennis/volleyball to a badminton host; "Sports you play" is empty; taste quiz stuck at 0 of 5.
8. A "Your agent found a game: Basketball" toast overlays every page.

## Top 3 fixes
1. Fill flow must use the posted game's next-Thursday date (or show a date picker) and clear its state on leaving.
2. Keep the posted time and place fixed on fill, as the screen promises, and show the agreed huddle on Home.
3. Tick "nearby" by default for tiny clubs, explain the disabled "Start the club", prefer free nearby courts, and filter home suggestions by sports played.
