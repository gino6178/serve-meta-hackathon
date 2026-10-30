# Trial 12 report: new1 (Wen, tennis, Da'an)

About 50 requests, all to 127.0.0.1:8899 with x-tester. Setup: demo account, home/sports/limits (Mon-Fri 09-17, Sat/Sun 08-12, 4 km, NT$250), delegation, own Ed25519 key; everything after that signed with the key.

Flow worked: places -> quotes (single, weekly, 2 players) -> huddle h-44b38069 pinned at Test Hall, Tue 3 Nov 14:00 (busy 12%, list 620/90 min, deal 410, NT$103 each). The same price shows in the quote, huddle pick and today's deal card. Host yes via the key worked. Mei (simulated) did not answer, so the game was not posted. No money or deposit appears anywhere. Loosening limits over the key is refused (403), as documented. Outside marks were right for Sat 07:00, Fri 19:00 and Wed 16:30-18:00. A pin at Sat 07:00 was refused in words.

## BUG
1. Quote busy level ignores the grid. Test Hall Wed 4 Nov, deal start 16:30 (ends 18:00): "usually only 15% full", price 410 (34% off), "quiet hour". The same venue's grid has Wed 17:00 at busy 0.95, and the block is mostly inside it. The quiet claim and discount are not backed by the numbers.
2. The teaching questions (GET /huddle/question) contradict the courts list. Test Sports Centre is "800 m" in q0, "2.0 km" and "1.0 km" in others, but places says 1.8 km. Test Tennis court B is "3.8 km" there, 2.6 km in places. "NT$90 each" for Sports Centre, against NT$113 each at quote. Sat 09:00 there is "a few people usually", but the grid says 0.82 and the quote says "82% full".
3. A game joined at "close: 0 m": the start huddle for Mon 2 Nov offered Hana's tennis at 信義網球場, Sat 31 Oct 10:00, "close: 0 m". That is not 0 m from Da'an.

## MINOR
- Weekly quote has the same price as a single (Hall 410 both; "the same time every week"). A weekly commitment earns nothing in the haggle.
- places "list" is per hour (440, 410); the quote's "list" is per 90 min (660, 620). No unit is given.
- The today "mine" card says agreed:true with going 1 while Mei has not said yes and status is "asking".
- /huddle/start without nearby returns "Tick 'Also ask people nearby'", which is wording for the web UI.
- The openapi schema for start lacks "when", "fill" and "repeat", which llms.txt describes.
- Public courts (free, quietest: court B 8%) are not mentioned as the best "quiet and price" choice. The deal route correctly says they are free.

Note: I tightened maxEach to 200 on the agent channel to test it, then restored 250 with the session.

VERDICT: 0 BLOCKER, 3 BUG
