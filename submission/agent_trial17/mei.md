# Mei (club owner) trial, about 90 requests; stopped at the budget

Setup: 3 extra accounts (R18 Ana, Ben, Cy) joined Xinyi Tennis and were given sports, home, open and wide limits.

Checked and fine
- Quotes agree with the courts page. POST /huddle/deal: Test Sports Centre Thu 14:00 NT$440 (each 110, list 660, busy 15%); Test Hall Wed 14:00 NT$430 (list 620, 18%). Both match /huddle/places offer and grid. Haggle lines are consistent.
- Huddle h-2d9255a1 (Mei hosts, pinned Thu 5 Nov 14:00): Ana yes, Ben no "price", Cy no "busy". Talk, the card in /huddle/today, Mei's "Your games" (going 2 of 4) and notices agreed. Calling it off gave Ana "Mei called off..." and removed it from both "mine" lists. Ben and Cy (already out) got no notice, which is right.
- Ana hosted h-870f3c8b, inviting Mei (Mei's agent said "can do (a quiet court)"). After both said yes, the talk, Mei's and Ana's lists and the status all agreed. No double-booking seen. No money and no private data seen. Ana's talk view showed only yes/no and reason kinds.

Findings
1. BUG: a self-contradicting agent. In h-8ac16aa8 an invitee countered Wed 4 Nov 14:00 with "Thursday 5 Nov, 14:00 at Test Tennis court A". Mei then offered exactly that, and the same agent answered "Not that one (the time)". The huddle ended "stuck". Same pattern in h-309724d8. (The extras had no learned taste, so this may be a new-account default.)
2. BUG: no way out of a settled game. After "Everyone said yes... is on", Ana's POST /huddle/reply yes:false returned 409 "It's settled: the game is on." and POST /feed/join on:false with post "huddle:h-..." returned 404 "not in the feed any more". Cy's reply yes:true after a no returned 404 "isn't one you're in", and Ben's direct feed/join returned 404 the same way. Only the host's call-off ends it. So leave, rejoin and direct join could not be exercised on a huddle game.
3. MINOR: "It couldn't go on the feed (the feed refused it)" gives no reason. POST /feed/post with where "Test Tennis court A 25.02-121.56" returned refused: "has a phone number, an email or a home address" (the fixture name's coordinates look like a phone number). That is a local-fixture artifact, but the huddle's open spots then cannot be filled, and a manual post gives 409 "overlaps ... (the agents agreed it)".
4. MINOR: every invitee shows as "R18", so the host sees "R18, R18 and R18".
5. MINOR: refused posts count toward the 4-per-10-minute limit (429 on my retry).
6. MINOR: Ben's "no, price" was accepted and printed "costs too much" for a free court.
7. Observation: with no pin, the pick was a free public court (busy 18%), not the quiet venue court (Sports Centre 15%, NT$440). The talk never mentioned a venue haggle.

Not done (budget): posted-game fill, post deletion, "busy" on a posted game.

VERDICT: 0 BLOCKER, 2 BUG
