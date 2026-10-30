# Naive agent trial: play.theminimallab.com (read-only)

## 1. First view
GET / returned an HTML page titled "Serve - Play more. Manage less." Inside #root was a no-JS block for agents: "A place where people's agents arrange sports games. The person says one yes per game." It had an "If you are an AI agent" list: read /llms.txt, the agent card, openapi, sign-in, register a key, then set up area/sports/limits. Yes, it told me what to do. The `<head>` also had link rels to llms.txt, agent-card and openapi.

## 2. Path (8 GETs)
1. / 
2. /llms.txt (the complete guide; understood here, about 2 requests in)
3. /api/status (up; players: 1)
4. /api/auth/providers ({facebook:false, instagram:false, demo:true})
5. /privacy.txt
6. /.well-known/agent-card.json
7. /api/openapi.json (truncated by me, not needed)
8. /api/huddle/today (401, as expected without a session)
Understood in about 2 requests.

## 3. How I'd get a game
1. Person signs in. Facebook/Instagram are off on this server, so only the demo route is on: POST /api/auth/demo {name} gives a session. I did not call it (no account creation). I need the person's OK here, since it creates an account.
2. POST /api/huddle/home {place: "Daan Park, Taipei"}; /sports ["badminton"]; /limits {windows Mon-Fri 18:00-22:00, maxKm, maxEach}. Need the person's distance and price limits.
3. Answer about five GET /api/huddle/question taste questions (from what the person says, not guesses).
4. GET /api/huddle/today for games near them; POST /api/huddle/game {post, yes:true} to join, or POST /api/huddle/start {sport:"badminton", need:4, when:{days:[Mon..Fri], parts:["evening"]}} and poll /api/huddle/one?id=.
5. The person gives one yes per game (or they delegate). Ideally register an Ed25519 key for later.

## 4. Confusing or hesitating
- players: 1 in /api/status. With one player, I doubt anyone is near Daan Park to play. The llms.txt says the demo club's members are simulated. So a "game" may be with simulated people; it does not say how to tell that apart from real ones.
- Only a demo login works, yet the page says sign in with Facebook/Instagram. A demo account for a real person feels fake and I could not tell if it persists.
- No money, but "each" price and venue prices are "samples until a venue joins". Unclear whether any real court gets booked, or whether I just get a time and place.
- Weekday evenings need a per-day window; "Mon-Fri" is not shown as an example (only "Sun").
- The signed-request JWS spec is long; I would use the session instead.
- /api/huddle/today 401 body not shown to me beyond the code; it said where to sign in in the openapi only.

## 5. Score
8/10. Discovery is excellent. The weak part is that I cannot tell whether a real game exists.
