# Sophie (phone 375x812, tab-14)

## Walked
1. Cleared storage, reloaded. Typed "Sophie", pressed "Try a demo account". Landed on Feed. OK.
2. Pressed Agent tab (home, #/). **Entirely blank black screen.** No home box, nothing. Reload gives the same blank page, and the whole app stays dead until a reload on another route.
3. Went to Games by URL. Typed "Xinyi District, Taipei" into the area box and pressed Set. "Asking..." showed for about 3 s, then the Get a game form appeared. OK.
4. Chose badminton, "Thu 05" (no "evening" choice exists once a day is picked), then "Let the agents work it out". After about 4 s it showed "AGREED, ASKING": Badminton, 4 players, Thu 5 Nov 19:00, Taipei Gymnasium, NT$98 each.
5. Pressed "Yes, I'm in". It then read "Waiting for Lily, Bob, Ivan", and "You said yes to Thursday evening". OK.
6. Games, "Your huddles" lists it as "AGREED, ASKING". "How you play" tab opens and reads fine, and it learned "You like Thursday evenings".
7. Feed, a Badminton Join: "You're in · 2 left", then Leave went back to "Nobody yet · 3 left". OK.

## Findings
- **BLOCKER/BUG: the Agent home (#/) is blank for a signed-in member.** The console says "React has detected a change in the order of Hooks ... ForYou" and "Rendered more hooks than during the previous render" (ForYou.jsx:43).
  - Cause, seen in D:\COmp2\serve-next\web\src\components\ForYou.jsx: `if (!r || r.failed) return null;` comes BEFORE `const [last, setLast] = useState("")`. The hook runs only once data has loaded, so React throws and unmounts the whole app.
  - Because of this I could not do these steps from the home screen: type "badminton Thursday evening" in the home box, see "Your games" with its status, or open a recommended game and press Join/Leave. I could only use the Feed's Join/Leave as a substitute.
  - The same crash would also hide the "Yes, I'm in" card and the "How you play" button on the home screen.
- MINOR: the first proposal was Thu 14:00, although Sophie chose Thursday. The day picker has no "evening" option, so "evening" is not asked for.
- MINOR: Kenji, Grace and Joy's agents answered YES but the game only counts "Lily, Bob, Ivan" as waiting. It is unclear to Sophie who the other yes answers are.
- MINOR: after "Yes, I'm in", a toast and chat bubbles overlapped the card at the bottom of the screen (seen while scrolled).

VERDICT: 1 BLOCKER, 0 BUG
