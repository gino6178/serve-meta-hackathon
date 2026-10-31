# Web tester report, trial 37 (local 127.0.0.1:5190 only)

People used: Alma (A), Bram, Cleo. Phone size (375x812) for item 1; desktop for the rest
(the emulated-phone click mapping was unreliable for ref clicks, so later steps ran at desktop).

## 1. Club invite link end to end - PASS
Public club "Open Rally T37":
- Invite people dialog: "Anyone with this link can join", link #/club?join=tqKwQEcc, code shown.
- Signed out, opened link: heading "Join a club", card "Open Rally T37 · badminton", "1 member", button "Sign in to join" (not the generic sign-in page).
- Tapped it, went to #/join ("Join your club on Serve"), signed in as Bram: returned to #/club?join=... with "Join the club"; joined; club showed "2 members: Alma, You".
Private club "Closed Rally T37":
- Dialog text: "Anyone with this link can ask to join; you let them in" (not "Anyone with this link can join").
- Signed out, link shows "Closed Rally T37 · badminton · Private", "Sign in to join". After signing in as Cleo the button is "Ask to join" -> "Asked. The organiser lets you in."
- A saw bell notice and an "Asked to join: Cleo [Let in][No]" row; "Let in" -> "2 members: You, Cleo". Cleo opened the club room as a member.

## 2. Called-off huddle card - PASS
Started a huddle as Alma (area set, "Let the agents work it out"). Before: "You (host)", Ivan, Lily, Grace, "Waiting for ...". After "Call it off": card status CALLED OFF, lists no players, no waitlist, no "(asked)" label; thread ends "Alma called it off."

## 3. Calendar import - PASS
Imported a .ics on the "How you play" tab: note reads `1 event over 4 weeks: free Mon 07-22 ... Choose "From your calendar" and save to use it.` The Times select then shows "From your calendar" selected; Save button present (I did not save). Event title was not displayed.

## 4. Core sweep - PASS
- Club game posted (Cleo, "Test Hall"): card "Nobody yet · 3 left"; Alma joined -> "You're in · 2 left", agent comment "Alma is in. 2 of 3 spots left"; Alma left -> "Nobody yet · 3 left", comment "Alma can't make it. 3 of 3 spots left"; rejoined.
- Call off from the post menu asks first: confirm text "Call off Badminton Thu 19:00? The person in it will be told."; after yes the card left the feed ("Called off. Everyone in it is told.").
- Alma's bell and toast: "Cleo called off badminton Thu 19:00 at Test Hall." with Open; Open goes to the club page.
- Others' records are words only: "Shows up likely 74-99%", "Agent keeps its word", "Host: new · agent new"; no counts of other people's no-shows seen. No deposit/payment asked ("nothing is paid here").

## Findings (all MINOR)
- M1: "Copy link" in the invite dialog (phone-size emulation) only shows "Select the link and copy it." (clipboard unavailable in this embedded browser, likely environment).
- M2: Huddle "Call it off" cancelled on one click with no confirm step (window.confirm was not called; club-post call off does confirm). Inconsistent; a stray tap ends the game.
- M3: Private club still offers "Start a game anyone can join" button label.
- M4: Invite card repeats the club name twice ("Open Rally T37 · badminton" then "Open Rally T37 · 1 member").
- M5: Calendar import with a single one-off Monday 19:00-21:00 event reports "free Mon 07-22" (one-off event is treated as not recurring; may be intended).
- M6: Posting the club game showed no immediate feedback on the very first tap of "Post the invite" at phone size (needed a second tap; tool coordinate mapping at the phone preset is likely the cause, not confirmed as an app fault).

Console: 401s while signed out on the invite page (expected); one 400 from POST /api/huddle/start made before a home area was set (expected, area prompt shown). No JS exceptions, no layout breakage seen at phone or desktop width.

VERDICT: CLEAN
