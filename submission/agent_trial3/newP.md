# newP report (about 22 requests, ~10 min)

## Path
GET / (pointers) -> /llms.txt (clear, enough to act) -> /.well-known/agent-card.json -> GET /api/auth/providers (demo:true) -> POST /api/auth/demo {"name":"Priya"} -> session -> POST /api/huddle/home {lat 25.041, lon 121.551} -> /sports [pickleball,badminton] -> /limits {Sat,Sun 08:00-12:00, maxKm 3, maxEach 120} -> GET /huddle/today -> POST /huddle/start (x3) -> GET /huddle/one -> GET /huddle/places?sport=badminton -> POST /huddle/cancel -> start with pin.

## How far
Proposal h-3e2491d0 (left open): badminton, Sat 31 Oct 09:00, "Badminton court" (public, 0.9 km, free, NT$0). Agents of Hana, Kenji, Bob, Ivan, Joy said yes; waiting on Ivan's one yes. Needs Priya's final yes. Did NOT use the signed agent key (used the session; skipped for time). Did not answer the 5 preference questions (Priya said only ask for the final yes).

## Problems, ranked
1. **Hard price limit broken.** Limits set maxEach 120 (response confirmed priceCap 120, "Nothing outside that is ever agreed"). Then POST /api/huddle/start {"sport":"badminton","need":2,"nearby":true,"when":{"days":["Sat","Sun"],"parts":["morning"]}} ended "Agreed: Saturday 31 Oct, 09:00 at ... NT$220 each" (pick.each 220, price 440). Cancelled it. Fix: refuse to agree above limitEach, or say why not.
2. **Pin makes Priya "yes" automatically.** start with pin returned players[You].answer "yes" with ask:false, before Priya saw it. Unclear whether her final yes is still needed. Fix: say plainly "waiting for your person's yes" and keep host yes empty.
3. **Pickleball finds nothing, no hint.** start pickleball -> status "stuck", "I found no pickleball courts near the group on the map." GET /huddle/places (default sport pickleball) -> "places":[]. Fix: suggest the nearest sport that has courts.
4. **Free public courts only found by guessing.** Auto-pick chose a paid venue; I had to read /huddle/places, find a kind:"public" court and pass pin.place "osm:way/..." (the format of place is a guess; the docs say only "place"?). Fix: with a price limit, prefer free/public courts; document pin.place.
5. **Odd reasons.** "It isn't one of Priya's usual times, so Priya is asked too" for Sat 09:00 inside her hard window. Today's only game card was Sun 19:30 (outside window) but shown as a recommendation.
6. places response: "looking":true/false and "retryAfter" unexplained. Venue names came back with broken UTF-8 in some terminal output (likely my shell; the JSON itself had odd surrogates in 3 names).
7. Docs: windows use "Sat"; "weekend" and "morning" meaning in the window (I chose 08:00-12:00) is a guess. Starting two huddles back to back at once is easy; no "list mine" noted besides /huddle/me.

## Fixes (short)
Enforce maxEach at agree time; never auto-yes the host; hint on empty sport; prefer free courts under a cap; document pin.place.

## Privacy
Home came back rounded to 25.04/121.55; no address sent or shown.
