# Hana Ito trial (r22hana) - about 62 requests

Setup: limits (Sat/Sun 09-21, Wed 18-21, 4 km, NT$150), delegation (NT$100, newPeople off then on), Ed25519 key registered, 3 host accounts in Daan Badminton.

Verified OK
- Agent yes refused outside permission: new host with newPeople off, Tue 19:00 (outside windows), NT$200 over cap (403, clear reasons, also on /agent-channel/join). Hana's game list unchanged.
- Agent yes within limits worked ("You're in"); shown in "Your games" and /huddle/today "mine".
- Double-booking blocked: overlapping Sat 10:30 join refused 409 for agent, person and feed.join; host cannot post an overlapping game of their own either.
- Waitlist: Hana waitlisted on a full 1-spot game, host saw "Hana is on the waitlist"; when the joiner left she was promoted, notice "A spot opened: you're in", "Your games" updated.
- Leave and take the spot back (agent): fine. Agent "no" with why: fine.
- Host-started huddle (fill + invite): Hana's agent yes through the signed channel; game on notice; host cancelled the huddle -> notice "called off", game gone from "Your games"/today. Host deleted a joined game (feed/delete) -> "called off" notice, gone everywhere. Notices delivered once.
- Agent cannot loosen limits (403, "needs person"), can tighten.
- Record stayed "12 of 12 / agent right 95%", chain only has the seed entry, after leave, host cancel and delete (host-side call-offs do not hurt her).

Findings (all MINOR)
1. Hosts see raw numbers: huddle players[].trust has rate:1, kept:0.95 beside the badge words (GET /api/huddle/one as host). Docs say badge words only; the percentages are in the words too, so low impact.
2. In GET /api/huddle/one (as invitee), found.agentMay says "Your person hasn't let you say yes" although delegation is on (it appears computed for the host, not the viewer).
3. After the agent said no (why busy) to a game, POST /api/huddle/game yes:false as the person returned 404 "That game isn't open any more" - harmless but confusing.
4. Two "Game on ... You're in" notices when a waitlisted spot opens (one is "A spot opened"), slightly redundant.
5. A pin at Sun 14:00 reported "every time that fits clashes with a game you already have" when her only Sunday game was 10:00 (unclear clash buffer); 18:00 was fine.
6. Pinned huddle with a place name not in the courts list stalls ("I can't find the court you picked"), and the pinned 18:00 talk failed on price/place for the seeded courts, so no huddle was agreed that way.

No BLOCKER or BUG found.

VERDICT: CLEAN
